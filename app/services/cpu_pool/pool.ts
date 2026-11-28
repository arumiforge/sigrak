import { Worker } from 'node:worker_threads'
import type { CpuTaskName, CpuTaskPayload, CpuTaskResult } from './tasks.js'

/**
 * A small fixed-size `worker_threads` pool for CPU-heavy work (D-463).
 * Tasks run one per thread, the rest wait in a FIFO queue. A thread that
 * dies is replaced; an aborted task's thread is stopped and replaced.
 *
 * Our own pool rather than Piscina: we need only a fixed size, a queue,
 * abort and a drain on shutdown (about 200 lines), and this keeps an
 * extra dependency with optional native packages out of the install
 * (D-422).
 */

/** The task was stopped: aborted by its caller or cut off at shutdown. */
export class CpuTaskInterruptedError extends Error {
  name = 'CpuTaskInterruptedError'
  constructor(readonly reason: 'aborted' | 'shutdown') {
    super(`CPU task interrupted (${reason})`)
  }
}

/** The pool is closing or closed and takes no new tasks. */
export class CpuPoolClosedError extends Error {
  name = 'CpuPoolClosedError'
  constructor() {
    super('CPU pool is closed')
  }
}

/** The thread running the task ended without an answer. */
export class CpuThreadError extends Error {
  name = 'CpuThreadError'
}

/** An error thrown by the task inside its thread, with the thread's stack. */
export class CpuTaskError extends Error {
  name = 'CpuTaskError'
  constructor(
    message: string,
    readonly taskErrorName: string,
    readonly taskStack?: string
  ) {
    super(message)
  }
}

type Pending = {
  id: number
  task: CpuTaskName
  payload: unknown
  resolve(value: unknown): void
  reject(error: Error): void
  signal?: AbortSignal
  onAbort?: () => void
}

type Slot = { worker: Worker; current?: Pending }

type Reply =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: { name: string; message: string; stack?: string } }

export type CpuPoolStats = { size: number; threads: number; busy: number; queued: number }

/**
 * Source runs (dev, tests) load TypeScript through @poppinss/ts-exec,
 * whose hooks a new thread does not inherit; the bootstrap registers
 * them first. A build runs the compiled thread.js directly.
 */
const fromSource = import.meta.url.endsWith('.ts')
const threadEntry = new URL(`./thread.${fromSource ? 'ts' : 'js'}`, import.meta.url).href
const tsHook = fromSource ? import.meta.resolve('@poppinss/ts-exec') : undefined
/** Only dynamic imports, so it runs whether eval code is read as CommonJS or ESM. */
const bootstrap = `
import('node:worker_threads').then(async ({ workerData }) => {
  await import(workerData.tsHook);
  await import(workerData.threadEntry);
});
`

export class CpuPool {
  readonly size: number
  #slots = new Set<Slot>()
  #queue: Pending[] = []
  #nextId = 1
  #closing = false
  #idleWaiters: Array<() => void> = []

  constructor(options: { size: number }) {
    this.size = Math.max(1, Math.floor(options.size))
    for (let index = 0; index < this.size; index++) this.#spawn()
  }

  get closed() {
    return this.#closing
  }

  stats(): CpuPoolStats {
    let busy = 0
    for (const slot of this.#slots) if (slot.current) busy++
    return { size: this.size, threads: this.#slots.size, busy, queued: this.#queue.length }
  }

  /**
   * Runs a task from `tasks.ts` in a thread. `signal` stops it: a waiting
   * task leaves the queue, a running one has its thread stopped.
   */
  run<Name extends CpuTaskName>(
    task: Name,
    payload: CpuTaskPayload<Name>,
    options: { signal?: AbortSignal } = {}
  ): Promise<Awaited<CpuTaskResult<Name>>> {
    if (this.#closing) return Promise.reject(new CpuPoolClosedError())
    if (options.signal?.aborted) return Promise.reject(new CpuTaskInterruptedError('aborted'))

    return new Promise((resolve, reject) => {
      const pending: Pending = {
        id: this.#nextId++,
        task,
        payload,
        resolve: resolve as (value: unknown) => void,
        reject,
        signal: options.signal,
      }
      if (options.signal) {
        pending.onAbort = () => this.#abort(pending)
        options.signal.addEventListener('abort', pending.onAbort, { once: true })
      }
      this.#queue.push(pending)
      this.#pump()
    })
  }

  /**
   * Takes no new tasks and lets running and waiting tasks finish for up
   * to `graceMs`; then stops every thread, and each unfinished task fails
   * with CpuTaskInterruptedError('shutdown'). Resolves `drained: true`
   * when everything finished in time.
   */
  async close(graceMs: number): Promise<{ drained: boolean }> {
    this.#closing = true
    let timer: NodeJS.Timeout | undefined
    const drained = await Promise.race([
      this.#whenIdle().then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), graceMs)
      }),
    ])
    clearTimeout(timer)

    for (const pending of this.#queue.splice(0)) {
      this.#settle(pending, new CpuTaskInterruptedError('shutdown'))
    }
    const stopping: Promise<number>[] = []
    for (const slot of this.#slots) {
      if (slot.current) {
        const pending = slot.current
        slot.current = undefined
        this.#settle(pending, new CpuTaskInterruptedError('shutdown'))
      }
      stopping.push(slot.worker.terminate())
    }
    await Promise.all(stopping)
    this.#slots.clear()
    return { drained }
  }

  #spawn() {
    const worker = tsHook
      ? new Worker(bootstrap, { eval: true, workerData: { tsHook, threadEntry }, name: 'cpu-pool' })
      : new Worker(new URL(threadEntry), { name: 'cpu-pool' })
    const slot: Slot = { worker }
    worker.unref()
    worker.on('message', (reply: Reply) => this.#onReply(slot, reply))
    worker.on('error', (error: unknown) =>
      this.#onThreadEnd(slot, error instanceof Error ? error : new Error(String(error)))
    )
    worker.on('exit', (code) => this.#onThreadEnd(slot, new CpuThreadError(`exit ${code}`)))
    this.#slots.add(slot)
  }

  #onReply(slot: Slot, reply: Reply) {
    const pending = slot.current
    if (!pending || pending.id !== reply.id) return
    slot.current = undefined
    slot.worker.unref()
    if (reply.ok) {
      this.#settle(pending, undefined, reply.result)
    } else {
      const { name, message, stack } = reply.error
      this.#settle(pending, new CpuTaskError(message, name, stack))
    }
    this.#pump()
  }

  /** A thread ended (crash, process.exit in a task, or terminate). */
  #onThreadEnd(slot: Slot, error: Error) {
    if (!this.#slots.delete(slot)) return
    const pending = slot.current
    slot.current = undefined
    if (pending) {
      this.#settle(pending, new CpuThreadError(`CPU pool thread ended: ${error.message}`))
    }
    if (!this.#closing) {
      this.#spawn()
      this.#pump()
    } else {
      this.#checkIdle()
    }
  }

  #abort(pending: Pending) {
    const queued = this.#queue.indexOf(pending)
    if (queued !== -1) {
      this.#queue.splice(queued, 1)
      this.#settle(pending, new CpuTaskInterruptedError('aborted'))
      this.#checkIdle()
      return
    }
    for (const slot of this.#slots) {
      if (slot.current === pending) {
        slot.current = undefined
        // Out of the pool at once, so no new task lands on the stopping thread.
        this.#slots.delete(slot)
        void slot.worker.terminate()
        this.#settle(pending, new CpuTaskInterruptedError('aborted'))
        if (!this.#closing) {
          this.#spawn()
          this.#pump()
        } else {
          this.#checkIdle()
        }
        return
      }
    }
  }

  #pump() {
    for (const slot of this.#slots) {
      if (this.#queue.length === 0) break
      if (slot.current) continue
      const pending = this.#queue.shift()!
      slot.current = pending
      slot.worker.ref()
      slot.worker.postMessage({ id: pending.id, task: pending.task, payload: pending.payload })
    }
    this.#checkIdle()
  }

  #settle(pending: Pending, error?: Error, result?: unknown) {
    if (pending.onAbort) pending.signal?.removeEventListener('abort', pending.onAbort)
    if (error) pending.reject(error)
    else pending.resolve(result)
  }

  #isIdle() {
    if (this.#queue.length > 0) return false
    for (const slot of this.#slots) if (slot.current) return false
    return true
  }

  #whenIdle() {
    if (this.#isIdle()) return Promise.resolve()
    return new Promise<void>((resolve) => this.#idleWaiters.push(resolve))
  }

  #checkIdle() {
    if (this.#idleWaiters.length === 0 || !this.#isIdle()) return
    for (const resolve of this.#idleWaiters.splice(0)) resolve()
  }
}
