import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import StaffActivityLog, { type ActivitySubject } from '#models/staff_activity_log'
import type StaffUser from '#models/staff_user'

/**
 * Records one console change (data model: every console setting change
 * is logged). Pass the transaction of the change so both commit
 * together.
 */
export async function logStaffActivity(
  staff: StaffUser,
  action: string,
  subjectType: ActivitySubject,
  subjectId: string | number,
  changes: Record<string, unknown>,
  client?: QueryClientContract
) {
  await StaffActivityLog.create(
    { staffUserId: staff.id, action, subjectType, subjectId: String(subjectId), changes },
    client ? { client } : undefined
  )
}
