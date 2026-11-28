import { SubjectAllocationSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Subject from './subject.js'
import CurriculumVersion from './curriculum_version.js'
import type { AllocationStatus, ArtBranch, JpTargetSetter, LearningType, Phase } from '../types.js'

/**
 * JP per version, subject, grade, learning type and art branch (D-366,
 * D-458).
 */
export default class SubjectAllocation extends SubjectAllocationSchema {
  declare phase: Phase
  declare learningType: LearningType
  declare artBranch: ArtBranch | null
  declare status: AllocationStatus
  declare jpTargetSetBy: JpTargetSetter

  @column()
  declare meta: Record<string, unknown>

  @belongsTo(() => Subject)
  declare subject: BelongsTo<typeof Subject>

  @belongsTo(() => CurriculumVersion)
  declare curriculumVersion: BelongsTo<typeof CurriculumVersion>
}
