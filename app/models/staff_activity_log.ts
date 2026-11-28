import { StaffActivityLogSchema } from '#database/schema'

export type ActivitySubject = 'school' | 'user' | 'setting' | 'invitation'

/**
 * One change a staff member made in the console. `changes` is a plain
 * object (old and new values), stored as JSONB.
 */
export default class StaffActivityLog extends StaffActivityLogSchema {
  declare subjectType: ActivitySubject
}
