import { FocusItemSchema } from '#database/schema'
import { manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import LearningObjective from './learning_objective.js'

/**
 * A fokus materi of a topic, linked to the TP it serves.
 */
export default class FocusItem extends FocusItemSchema {
  @manyToMany(() => LearningObjective, {
    pivotTable: 'focus_item_objectives',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare learningObjectives: ManyToMany<typeof LearningObjective>
}
