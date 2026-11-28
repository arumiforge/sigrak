import type { MembershipRole } from '#models/school_membership'
import { tenantTransaction } from '#tenancy/tenant_transaction'

/**
 * One active role of the signed-in user, as the role switch and the
 * account page show it. Only the membership's public id leaves the
 * server (D-182).
 */
export type MembershipChoice = {
  publicId: string
  role: MembershipRole
  schoolName: string
}

/**
 * The user's active memberships in every school, oldest first. Read in
 * a tenant transaction with the user only: row-level security shows a
 * user their own memberships before a school is chosen.
 */
export async function activeMembershipsOf(userId: number): Promise<MembershipChoice[]> {
  return tenantTransaction(
    async (trx) => {
      const rows = await trx
        .from('school_memberships as m')
        .join('schools as s', 's.id', 'm.school_id')
        .where('m.user_id', userId)
        .where('m.status', 'active')
        .orderBy('m.started_on', 'asc')
        .orderBy('m.id', 'asc')
        .select('m.public_id', 'm.role', 's.name as school_name')
      return rows.map((row: { public_id: string; role: MembershipRole; school_name: string }) => ({
        publicId: row.public_id,
        role: row.role,
        schoolName: row.school_name,
      }))
    },
    { schoolId: null, userId }
  )
}
