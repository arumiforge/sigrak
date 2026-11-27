import { GenerationStepSchema } from '#database/schema'

export type GenerationStepStatus = 'pending' | 'running' | 'succeeded' | 'failed'

/**
 * One step of a generation. Its output is written once, by
 * compare-and-set on `status` (see GenerationRunner).
 */
export default class GenerationStep extends GenerationStepSchema {
  declare status: GenerationStepStatus
}
