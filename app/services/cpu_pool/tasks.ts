import { createHash } from 'node:crypto'
import { threadId } from 'node:worker_threads'
import { generateDraft, type GeneratorInput } from '../../timetable/draft_generator.js'

/**
 * Functions that run inside a CPU pool thread. Each takes one plain,
 * structured-cloneable payload and returns a plain result. Keep them
 * free of app services (no database, no Redis, no config): a thread has
 * no booted app, only its payload.
 *
 * Real export work (large Excel builds and imports, image processing,
 * leger) is added here by the tasks that build it (D-463).
 */
export const cpuTasks = {
  /** Draft timetable (D-262, R1-09): the pure, seeded generator. */
  timetableDraft(payload: GeneratorInput) {
    return generateDraft(payload)
  },

  /**
   * Sample CPU job for `worker-exports`: hashes the seed `rounds` times.
   * Stands in for an export build until the real ones exist.
   */
  checksum(payload: { seed: string; rounds: number }) {
    let digest = payload.seed
    for (let round = 0; round < payload.rounds; round++) {
      digest = createHash('sha256').update(digest).digest('hex')
    }
    return { digest, rounds: payload.rounds, threadId }
  },

  /** Keeps the thread busy for `ms` milliseconds (tests and load checks). */
  spin(payload: { ms: number }) {
    const until = performance.now() + payload.ms
    let loops = 0
    while (performance.now() < until) loops++
    return { loops, threadId }
  },

  /** Throws inside the thread (tests the error path). */
  fail(payload: { message: string }): never {
    throw new Error(payload.message)
  },

  /** Ends the thread without an answer (tests crash recovery). */
  crash(_payload: Record<string, never>): never {
    process.exit(1)
  },
}

export type CpuTasks = typeof cpuTasks
export type CpuTaskName = keyof CpuTasks
export type CpuTaskPayload<Name extends CpuTaskName> = Parameters<CpuTasks[Name]>[0]
export type CpuTaskResult<Name extends CpuTaskName> = ReturnType<CpuTasks[Name]>
