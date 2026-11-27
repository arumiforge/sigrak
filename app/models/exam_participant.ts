import { timingSafeEqual } from 'node:crypto'
import { ExamParticipantSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import encryption from '@adonisjs/core/services/encryption'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ExamSession from '#models/exam_session'
import { withPublicId } from '#models/mixins/with_public_id'

export type ExamParticipantStatus = 'not_started' | 'in_progress' | 'submitted' | 'expired'

/**
 * An exam participant signs in to ujian. with an exam card (username +
 * password) of one session. Not a user. The password is stored
 * encrypted so the card can be reprinted (data model).
 */
export default class ExamParticipant extends compose(ExamParticipantSchema, withPublicId) {
  declare status: ExamParticipantStatus

  @belongsTo(() => ExamSession)
  declare examSession: BelongsTo<typeof ExamSession>

  static encryptPassword(plain: string) {
    return encryption.encrypt(plain)
  }

  passwordMatches(plain: string) {
    const stored = encryption.decrypt<string>(this.password)
    if (typeof stored !== 'string') {
      return false
    }
    const a = Buffer.from(stored)
    const b = Buffer.from(plain)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  /**
   * Finds the participant of an open session whose card matches.
   * Returns null for a wrong card or a session that is not open.
   */
  static async verifyCard(username: string, password: string) {
    const candidates = await ExamParticipant.query()
      .where('username', username)
      .whereHas('examSession', (query) => query.where('status', 'open'))
      .preload('examSession')

    return (
      candidates.find(
        (participant) =>
          participant.examSession.acceptsLogins() && participant.passwordMatches(password)
      ) ?? null
    )
  }
}
