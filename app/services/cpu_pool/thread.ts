import { parentPort } from 'node:worker_threads'
import { cpuTasks, type CpuTaskName } from './tasks.js'

/**
 * Body of one CPU pool thread: runs one task at a time and answers the
 * pool with its result or error. Messages: `{ id, task, payload }` in,
 * `{ id, ok, result | error }` out.
 */
type Request = { id: number; task: CpuTaskName; payload: unknown }

parentPort!.on('message', async ({ id, task, payload }: Request) => {
  try {
    const run = cpuTasks[task] as ((input: unknown) => unknown) | undefined
    if (!run) throw new Error(`Unknown CPU task "${task}"`)
    const result = await run(payload)
    parentPort!.postMessage({ id, ok: true, result })
  } catch (error) {
    const { name, message, stack } = error instanceof Error ? error : new Error(String(error))
    parentPort!.postMessage({ id, ok: false, error: { name, message, stack } })
  }
})
