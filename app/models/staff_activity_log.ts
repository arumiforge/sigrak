import { StaffActivityLogSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import StaffUser from '#models/staff_user'

/**
 * What a log row is about (the subject_type check of the R2-01
 * migration). R2 tasks use the types named for them; a new type needs
 * a migration that widens the check.
 */
export const ACTIVITY_SUBJECTS = [
  'school',
  'user',
  'setting',
  'invitation',
  'staff',
  'integration',
  'ai_model',
  'job',
  'announcement',
  'event',
  'story',
  'legal_document',
  'help_request',
  'support_session',
  'problem',
  'good_practice',
  'forum_meeting',
  'curriculum_version',
] as const

export type ActivitySubject = (typeof ACTIVITY_SUBJECTS)[number]

/**
 * One change a staff member made in the console. `changes` is a plain
 * object (old and new values), stored as JSONB.
 */
export default class StaffActivityLog extends StaffActivityLogSchema {
  declare subjectType: ActivitySubject

  @belongsTo(() => StaffUser)
  declare staffUser: BelongsTo<typeof StaffUser>
}
