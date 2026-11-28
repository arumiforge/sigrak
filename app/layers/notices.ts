import { DateTime } from 'luxon'
import type { MembershipRole } from '#models/school_membership'
import { LayerRuleException } from './layer_rules.js'
import LayerNotice from './models/layer_notice.js'
import type { NoticeAudience } from './types.js'

/**
 * Layer notices of the school in context (operator and principal).
 * Teachers get none: they hear about decisions on their own proposals
 * on the Usulan page.
 */
const audiences: Record<MembershipRole, NoticeAudience[]> = {
  operator: ['operator', 'all'],
  principal: ['principal', 'all'],
  teacher: [],
}

export const Notices = {
  async unread(role: MembershipRole) {
    const allowed = audiences[role]
    if (allowed.length === 0) return []
    const rows = await LayerNotice.query()
      .whereNull('read_at')
      .whereIn('audience', allowed)
      .orderBy('created_at', 'desc')
      .limit(20)
    return rows.map((notice) => ({
      id: notice.publicId,
      kind: notice.kind,
      createdOn: notice.createdAt.setZone('Asia/Jakarta').toISODate()!,
      item: (notice.payload.item_key as string | undefined) ?? null,
      label: (notice.payload.label as string | undefined) ?? null,
      packageName: (notice.payload.package_name as string | undefined) ?? null,
      actorName: (notice.payload.actor_name as string | undefined) ?? null,
      status: (notice.payload.status as string | undefined) ?? null,
      schoolYear: (notice.payload.school_year as string | undefined) ?? null,
      carriedPackages: Array.isArray(notice.payload.packages)
        ? (notice.payload.packages as { package_name: string }[]).map((pkg) => pkg.package_name)
        : [],
      endedPackages: Array.isArray(notice.payload.ended_packages)
        ? (notice.payload.ended_packages as { package_name: string }[]).map(
            (pkg) => pkg.package_name
          )
        : [],
    }))
  },

  async markRead(publicId: string, userId: number) {
    const notice = await LayerNotice.query().where('public_id', publicId).first()
    if (!notice) throw new LayerRuleException('layers.errors.item_not_found')
    notice.merge({ readAt: DateTime.now(), readByUserId: userId })
    await notice.save()
  },
}
