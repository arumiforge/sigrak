import { cpuTasks, type CpuTaskName } from './tasks.js'

/**
 * Body of a CPU pool thread, loaded by Piscina in each worker thread.
 * Runs one task and answers with an envelope, so the pool can tell a
 * task's own error (`ok: false`) from a thread that ended.
 */
export type ThreadRequest = { task: CpuTaskName; payload: unknown }
export type ThreadReply =
  | { ok: true; result: unknown }
  | { ok: false; error: { name: string; message: string; stack?: string } }

export default async function runCpuTask({ task, payload }: ThreadRequest): Promise<ThreadReply> {
  try {
    const run = cpuTasks[task] as ((input: unknown) => unknown) | undefined
    if (!run) throw new Error(`Unknown CPU task "${task}"`)
    return { ok: true, result: await run(payload) }
  } catch (error) {
    const { name, message, stack } = error instanceof Error ? error : new Error(String(error))
    return { ok: false, error: { name, message, stack } }
  }
}
