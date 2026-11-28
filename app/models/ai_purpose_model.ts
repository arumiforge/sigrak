import { AiPurposeModelSchema } from '#database/schema'

/**
 * The active model and ordered fallbacks of one AI purpose, set in the
 * console (D-315). `models[0]` is the active model.
 */
export default class AiPurposeModel extends AiPurposeModelSchema {
  declare models: string[]
}
