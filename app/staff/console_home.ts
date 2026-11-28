import logger from '@adonisjs/core/services/logger'
import type StaffUser from '#models/staff_user'
import { queue } from '#services/queue/queues'
import { queueNames } from '#services/queue/wait_metrics'
import { staffReadTransaction } from '#tenancy/tenant_transaction'
import { applySchoolScope, schoolScopeOf, staffCan } from './access.js'
import type { StaffAbility } from './abilities.js'

/**
 * What waits for action on the console home (R2-09), per ability: each
 * staff member sees only the counts their roles can act on, within
 * their area scope where the list itself is scoped. Counts only; the
 * card links to the filtered list. A count that cannot be read (Redis
 * down) is left out instead of failing the home page.
 */

export type AttentionKey =
  | 'help_new'
  | 'problems_new'
  | 'problems_triaged'
  | 'curriculum_signoff'
  | 'curriculum_publish'
  | 'failed_jobs'

export type AttentionItem = { key: AttentionKey; count: number; href: string }

type Counter = {
  key: AttentionKey
  ability: StaffAbility
  href: string
  count: (staff: StaffUser) => Promise<number>
}

type CountRow = { count: string | number } | undefined
const asCount = (row: CountRow) => Number(row?.count ?? 0)

const COUNTERS: Counter[] = [
  {
    key: 'help_new',
    ability: 'help_requests.manage',
    href: '/bantuan?status=new',
    // Same scope rule as the Permintaan bantuan list.
    count: (staff) =>
      staffReadTransaction(async (trx) => {
        const scope = schoolScopeOf(staff, 'help_requests.manage')
        const query = trx
          .from('help_requests as h')
          .leftJoin('schools as s', 's.id', 'h.school_id')
          .where('h.status', 'new')
        if (!scope.all) {
          query.whereNotNull('h.school_id')
          applySchoolScope(query, scope, 's')
        }
        return asCount((await query.count('* as count').first()) as CountRow)
      }),
  },
  {
    key: 'problems_new',
    ability: 'problems.triage',
    href: '/bank-masalah?status=new',
    count: () => problemsWith('new'),
  },
  {
    key: 'problems_triaged',
    ability: 'problems.analyse',
    href: '/bank-masalah?status=triaged',
    count: () => problemsWith('triaged'),
  },
  {
    key: 'curriculum_signoff',
    ability: 'curriculum.signoff',
    href: '/kurikulum',
    // A validator never signs off their own import (D-339).
    count: (staff) =>
      staffReadTransaction(async (trx) =>
        asCount(
          (await trx
            .from('curriculum_versions')
            .where('status', 'draft')
            .whereRaw('NOT (? = ANY(imported_by_ids))', [staff.id])
            .count('* as count')
            .first()) as CountRow
        )
      ),
  },
  {
    key: 'curriculum_publish',
    ability: 'curriculum.publish',
    href: '/kurikulum',
    count: () =>
      staffReadTransaction(async (trx) =>
        asCount(
          (await trx
            .from('curriculum_versions')
            .where('status', 'signed_off')
            .count('* as count')
            .first()) as CountRow
        )
      ),
  },
  {
    key: 'failed_jobs',
    ability: 'system_health.view',
    href: '/kesehatan-sistem#failed-title',
    count: async () => {
      const counts = await Promise.all(queueNames.map((name) => queue(name).getFailedCount()))
      return counts.reduce((sum, count) => sum + count, 0)
    },
  },
]

function problemsWith(status: 'new' | 'triaged') {
  return staffReadTransaction(async (trx) =>
    asCount(
      (await trx
        .from('problems')
        .where('status', status)
        .whereNull('merged_into_id')
        .count('* as count')
        .first()) as CountRow
    )
  )
}

/** The counts this staff member can act on, in menu order. */
export async function attentionFor(staff: StaffUser): Promise<AttentionItem[]> {
  const counters = COUNTERS.filter((counter) => staffCan(staff, counter.ability))
  const items = await Promise.all(
    counters.map(async (counter): Promise<AttentionItem | null> => {
      try {
        return { key: counter.key, count: await counter.count(staff), href: counter.href }
      } catch (error) {
        logger.warn({ err: error, count: counter.key }, 'Console home: count not readable')
        return null
      }
    })
  )
  return items.filter((item): item is AttentionItem => item !== null)
}
