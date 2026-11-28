import { LearningOutcomeElementSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { ArtBranch, Phase } from '../types.js'

/**
 * An official CP element (D-452).
 */
export default class LearningOutcomeElement extends LearningOutcomeElementSchema {
  declare artBranch: ArtBranch | null

  @column()
  declare phases: Phase[]
}
