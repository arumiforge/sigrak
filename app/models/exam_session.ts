import { ExamSessionSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import ExamParticipant from '#models/exam_participant'
import { withPublicId } from '#models/mixins/with_public_id'

export type ExamSessionStatus = 'draft' | 'scheduled' | 'open' | 'closed'

export default class ExamSession extends compose(ExamSessionSchema, withPublicId) {
  declare status: ExamSessionStatus

  @hasMany(() => ExamParticipant)
  declare participants: HasMany<typeof ExamParticipant>

  /**
   * Exam cards work only while the session is open and inside its window.
   */
  acceptsLogins(now: DateTime = DateTime.now()) {
    return this.status === 'open' && this.opensAt <= now && now < this.closesAt
  }
}
