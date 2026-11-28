import { Piscina } from 'piscina'
import type { CpuTaskName, CpuTaskPayload, CpuTaskResult } from './tasks.js'
import type { ThreadReply, ThreadRequest } from './thread.js'

/**
 * A fixed-size `worker_threads` pool for CPU-heavy work (D-463), built on
 * Piscina (D-469). Tasks run one per thread, the rest wait in a FIFO
 * queue. A thread that dies is replaced; an aborted task's thread is
 * stopped and replaced. Piscina's optional native `@napi-rs/nice` is not
 * installed (`pnpm-workspace.yaml`, D-422): Piscina loads it only for
 * `niceIncrement`, which this pool leaves at 0.
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

export type CpuPoolStats = { size: number; threads: number; busy: number; queued: number }

/**
 * Source runs (dev, tests) load TypeScript through @poppinss/ts-exec,
 * whose hooks a new thread does not inherit; each thread gets it with
 * `--import`. A build runs the compiled thread.js directly.
 */
const fromSource = import.meta.url.endsWith('.ts')
const threadEntry = new URL(`./thread.${fromSource ? 'ts' : 'js'}`, import.meta.url).href
const threadExecArgv = fromSource
  ? [...process.execArgv, '--import', import.meta.resolve('@poppinss/ts-exec')]
  : process.execArgv

export class CpuPool {
  readonly size: number
  #piscina: Piscina<ThreadRequest, ThreadReply>
  #inFlight = 0
  #closing = false
  #cutOff = false

  constructor(options: { size: number }) {
    this.size = Math.max(1, Math.floor(options.size))
    this.#piscina = new Piscina<ThreadRequest, ThreadReply>({
      filename: threadEntry,
      name: 'default',
      minThreads: this.size,
      maxThreads: this.size,
      concurrentTasksPerWorker: 1,
      idleTimeout: Infinity,
      execArgv: threadExecArgv,
      niceIncrement: 0,
      // close() runs its own grace timer; Piscina's must never end first.
      closeTimeout: 2_147_483_647,
    })
    // Piscina reports its own close timeout as an 'error' event; the grace
    // timer in close() decides here, so the event only needs a listener.
    this.#piscina.on('error', () => {})
  }

  get closed() {
    return this.#closing
  }

  stats(): CpuPoolStats {
    const busy = Math.min(this.#inFlight, this.size)
    return {
      size: this.size,
      threads: this.#piscina.threads.length,
      busy,
      queued: this.#inFlight - busy,
    }
  }

  /**
   * Runs a task from `tasks.ts` in a thread. `signal` stops it: a waiting
   * task leaves the queue, a running one has its thread stopped.
   */
  async run<Name extends CpuTaskName>(
    task: Name,
    payload: CpuTaskPayload<Name>,
    options: { signal?: AbortSignal } = {}
  ): Promise<Awaited<CpuTaskResult<Name>>> {
    if (this.#closing) throw new CpuPoolClosedError()
    if (options.signal?.aborted) throw new CpuTaskInterruptedError('aborted')

    this.#inFlight++
    let reply: ThreadReply
    try {
      reply = await this.#piscina.run({ task, payload }, { signal: options.signal })
    } catch (error) {
      throw this.#interruption(error)
    } finally {
      this.#inFlight--
    }
    if (!reply.ok) {
      const { name, message, stack } = reply.error
      throw new CpuTaskError(message, name, stack)
    }
    return reply.result as Awaited<CpuTaskResult<Name>>
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
      this.#piscina.close().then(
        () => true,
        () => true
      ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), graceMs)
      }),
    ])
    clearTimeout(timer)
    if (!drained) {
      this.#cutOff = true
      await this.#piscina.destroy()
    }
    return { drained }
  }

  /** Maps a rejected Piscina task onto the pool's own errors. */
  #interruption(error: unknown): Error {
    if (this.#cutOff) return new CpuTaskInterruptedError('shutdown')
    if (error instanceof Error && error.name === 'AbortError') {
      return new CpuTaskInterruptedError('aborted')
    }
    const message = error instanceof Error ? error.message : String(error)
    return new CpuThreadError(`CPU pool thread ended: ${message}`)
  }
}
