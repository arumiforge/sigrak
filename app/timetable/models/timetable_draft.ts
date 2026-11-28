import { TimetableDraftSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { column } from '@adonisjs/lucid/orm'
import { withPublicId } from '#models/mixins/with_public_id'
import { withSchoolScope } from '#tenancy/with_school_scope'
import type { GeneratorResult } from '../draft_generator.js'
import type { DayFrame, Preferences } from '../types.js'

export type DraftStatus = 'queued' | 'running' | 'ready' | 'failed' | 'saved'

/** What a draft was made with. */
export interface DraftInput {
  frame: DayFrame
  preferences: Preferences
}

/**
 * A draft timetable for one class or all classes of a year (D-262):
 * made by the `default` queue job, saved by the operator (D-381).
 */
export default class TimetableDraft extends compose(
  TimetableDraftSchema,
  withPublicId,
  withSchoolScope
) {
  declare status: DraftStatus

  /** `bigint[]` comes back as strings from the driver. */
  @column({ consume: (value: (string | number)[]) => value.map(Number) })
  declare classIds: number[]

  declare input: DraftInput | null
  declare result: GeneratorResult | null
}
