import { TopicSchema } from '#database/schema'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Subject from './subject.js'
import LearningObjective from './learning_objective.js'
import FocusItem from './focus_item.js'
import type { ArtBranch, Phase } from '../types.js'

/**
 * A topic (materi pokok / ATP) of a SIGRAK version (D-363).
 */
export default class Topic extends TopicSchema {
  declare phase: Phase
  declare artBranch: ArtBranch | null

  @column()
  declare elementCodes: string[] | null

  @column()
  declare weeklyDistribution: number[]

  @column()
  declare references: Record<string, unknown>

  @column()
  declare curationNotes: Record<string, unknown> | null

  @column()
  declare outsideCp: Record<string, unknown>[] | null

  @column()
  declare extras: Record<string, unknown> | null

  @belongsTo(() => Subject)
  declare subject: BelongsTo<typeof Subject>

  @hasMany(() => LearningObjective)
  declare learningObjectives: HasMany<typeof LearningObjective>

  @hasMany(() => FocusItem)
  declare focusItems: HasMany<typeof FocusItem>
}
