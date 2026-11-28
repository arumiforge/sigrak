import { LearningOutcomeSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { ArtBranch, Phase } from '../types.js'

/**
 * Official CP text per subject, phase and element (D-226, D-452).
 */
export default class LearningOutcome extends LearningOutcomeSchema {
  declare phase: Phase
  declare artBranch: ArtBranch | null

  @column()
  declare extras: Record<string, unknown> | null
}
