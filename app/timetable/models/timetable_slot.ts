import { TimetableSlotSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { withPublicId } from '#models/mixins/with_public_id'
import { withSchoolScope } from '#tenancy/with_school_scope'
import Subject from '../../curriculum/models/subject.js'
import SchoolClass from '../../school_year/models/school_class.js'
import { parseClock } from '../time.js'
import type { PlainRow, SlotKind } from '../types.js'

/**
 * One row of a class timetable (D-247): a lesson, Istirahat, Upacara or
 * Kegiatan. The teacher of a lesson is the class's teaching assignment
 * for the subject (D-249); `isLocked` rows stay when a draft is saved
 * (D-381).
 */
export default class TimetableSlot extends compose(
  TimetableSlotSchema,
  withPublicId,
  withSchoolScope
) {
  declare kind: SlotKind

  @belongsTo(() => SchoolClass, { foreignKey: 'classId' })
  declare schoolClass: BelongsTo<typeof SchoolClass>

  @belongsTo(() => Subject)
  declare subject: BelongsTo<typeof Subject>

  /** The row as plain data, times in minutes. */
  toPlain(): PlainRow {
    return {
      weekday: this.weekday,
      start: parseClock(this.startsAt)!,
      end: parseClock(this.endsAt)!,
      kind: this.kind,
      label: this.label,
      subjectId: this.subjectId,
      jp: this.jp,
    }
  }
}
