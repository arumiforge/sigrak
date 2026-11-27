import type { QueueName } from '#config/queue'
import type Generation from '#models/generation'
import type { AIRequest } from '#services/ai/contracts'

/**
 * What one content type declares (content-engine.md, D-024): its job
 * name, its steps and how each step's request is built. The mechanics
 * live in the shared GenerationRunner.
 */
export interface GenerationPlan {
  templateKey: string
  templateVersion: number
  /** BullMQ job name, one per content type. */
  jobName: string
  queue: QueueName
  steps: { key: string }[]
  buildRequest(
    stepKey: string,
    generation: Generation,
    previousOutputs: Record<string, Record<string, unknown>>
  ): AIRequest
}

/** Data of one step job. `run` and `position` make stale jobs harmless. */
export type StepJobData = {
  generationId: number
  run: number
  position: number
}

/**
 * Queue job id of a step: at most one job per (generation, run, step)
 * waits or runs, and a job that re-dispatches itself for the next step
 * gets a new id (D-050). BullMQ ids may not contain ":".
 */
export function stepJobId(generation: Pick<Generation, 'publicId' | 'runs'>, position: number) {
  return `gen-${generation.publicId}-r${generation.runs}-s${position}`
}
