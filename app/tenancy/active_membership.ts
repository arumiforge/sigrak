import SchoolMembership, { type MembershipRole } from '#models/school_membership'
import { tenantTransaction } from './tenant_transaction.js'

/**
 * The membership a request runs under.
 */
export interface ActiveMembership {
  id: number
  publicId: string
  schoolId: number
  userId: number
  role: MembershipRole
}

/**
 * Session key holding the public id of the membership the user chose
 * with the role switch (R1-05 writes it).
 */
export const ACTIVE_MEMBERSHIP_SESSION_KEY = 'tenancy.membership'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Picks the user's active membership: the one kept in the session when
 * it is still active, else the earliest active one (oldest start date,
 * then oldest row). Null when the user has no active membership.
 *
 * Runs before a school is chosen, so it reads with the user id only;
 * row-level security lets a user see their own memberships.
 */
export async function resolveActiveMembership(
  userId: number,
  preferredPublicId?: string | null
): Promise<ActiveMembership | null> {
  return tenantTransaction(
    async (trx) => {
      const active = () =>
        SchoolMembership.query({ client: trx }).where('user_id', userId).where('status', 'active')

      const preferred =
        preferredPublicId && UUID.test(preferredPublicId)
          ? await active().where('public_id', preferredPublicId).first()
          : null
      const membership =
        preferred ?? (await active().orderBy('started_on', 'asc').orderBy('id', 'asc').first())

      if (!membership) return null
      return {
        id: membership.id,
        publicId: membership.publicId,
        schoolId: membership.schoolId,
        userId: membership.userId,
        role: membership.role,
      }
    },
    { schoolId: null, userId }
  )
}
