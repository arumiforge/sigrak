import type { Job } from 'bullmq'
import { cpuPool } from '#services/cpu_pool/main'

export type CpuSampleData = { seed: string; rounds: number }

/**
 * Sample CPU job on `worker-exports` (D-463): the hashing runs in the CPU
 * pool, so the worker's event loop keeps renewing job locks meanwhile.
 * Real exports (Excel, leger, images) follow this shape: prepare data on
 * the main thread, do the heavy part with `cpuPool().run(...)`.
 */
export const cpuSample = {
  jobName: 'cpu-sample',
  async handle(job: Job<CpuSampleData>, signal?: AbortSignal) {
    const { seed, rounds } = job.data
    return cpuPool().run('checksum', { seed, rounds }, { signal })
  },
}
