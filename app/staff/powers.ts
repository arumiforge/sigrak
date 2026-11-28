import { STAFF_ABILITIES, type StaffAbility } from './abilities.js'
import type { StaffRole } from './roles.js'

/**
 * What each role may do, fixed in code (D-314, D-338): the access
 * matrix of docs/drafts/internal-roles.md §3, with D-340 (payments
 * confirmed by Keuangan or the owner, recorded by Penjualan), D-341
 * (support views a school read-only under the MoU), D-439 (the three
 * teams and Peneliti) and D-477 (payments, pipeline and pengawas
 * requests come in R5; their keys are already here).
 *
 * The matrix's "within scope" cells are the assignment's scope (see
 * app/staff/roles.ts and access.ts); "read only" cells are the `.view`
 * keys. Student data is in no role; teachers' documents only through a
 * support session.
 */

/** Every staff member: the Peran page and area proposals (R1-07: every staff role). */
const EVERYONE: StaffAbility[] = ['access.view', 'layers.propose']

/** Bank Masalah and the forum for all three teams of D-439. */
const TEAMS: StaffAbility[] = ['problems.view', 'good_practices.view', 'forum.view']

/** Tim Lapangan: support, sales, regional lead, marketing (D-439). */
const FIELD_TEAM: StaffAbility[] = [...TEAMS, 'problems.record', 'problems.triage']

/** Tim Kurikulum & Riset: validator, content, curriculum curator, researcher (D-439). */
const RESEARCH_TEAM: StaffAbility[] = [...TEAMS, 'problems.analyse', 'good_practices.manage']

/**
 * The owner holds every ability except recording a payment (the person
 * who confirms a payment does not record it, D-340) and opening a
 * school's view, which is support's (matrix: teachers' documents).
 */
const OWNER_EXCLUDED: StaffAbility[] = ['payments.record', 'support_sessions.start']

const admin: StaffAbility[] = [
  ...EVERYONE,
  'staff.view',
  'staff.manage',
  'staff.reset_2fa',
  'audit.view',
  'schools.view',
  'schools.manage',
  'users.view',
  'invitations.manage',
  'trials.manage',
  'regions.review',
  'layers.approve',
  'subscriptions.view',
  'subscriptions.manage',
  'payments.view',
  'prices.view',
  'templates.view',
  'catalogs.view',
  'embeds.view',
  'embeds.manage',
  'curriculum.view',
  'announcements.manage',
  'announcements.write',
  'announcements.public',
  'events.manage',
  'stories.manage',
  'legal_pages.manage',
  'help_requests.view',
  'help_requests.manage',
  'support_sessions.view',
  'supervisor_requests.manage',
  'problems.view',
  'problems.record',
  'problems.triage',
  'good_practices.view',
  'forum.view',
  'forum.manage',
  'settings.view',
  'settings.manage',
  'integrations.view',
  'ai_models.view',
  'system_health.view',
  'reports.view',
]

const sales: StaffAbility[] = [
  ...EVERYONE,
  ...FIELD_TEAM,
  'schools.view',
  'users.view',
  'trials.extend',
  'payments.record',
  'announcements.write',
  'help_requests.view',
  'reports.view',
]

export const POWERS: Record<StaffRole, readonly StaffAbility[]> = {
  owner: STAFF_ABILITIES.filter((ability) => !OWNER_EXCLUDED.includes(ability)),
  admin,
  validator: [
    ...EVERYONE,
    ...RESEARCH_TEAM,
    'layers.approve',
    'templates.view',
    'templates.signoff',
    'catalogs.view',
    'catalogs.signoff',
    'embeds.view',
    'embeds.signoff',
    'curriculum.view',
    'curriculum.signoff',
    'reports.view',
  ],
  content: [
    ...EVERYONE,
    ...RESEARCH_TEAM,
    'templates.view',
    'templates.prepare',
    'catalogs.view',
    'catalogs.prepare',
    'embeds.view',
    'embeds.prepare',
    'curriculum.view',
    'curriculum.draft',
    'help_requests.view',
    'reports.view',
  ],
  curriculum: [
    ...EVERYONE,
    ...RESEARCH_TEAM,
    'curriculum.view',
    'curriculum.publish',
    'announcements.write',
    'reports.view',
  ],
  support: [
    ...EVERYONE,
    ...FIELD_TEAM,
    'schools.view',
    'users.view',
    'subscriptions.view',
    'regions.review',
    'announcements.write',
    'help_requests.view',
    'help_requests.manage',
    'support_sessions.start',
    'supervisor_requests.manage',
    'reports.view',
  ],
  marketing: [
    ...EVERYONE,
    ...FIELD_TEAM,
    'announcements.write',
    'announcements.public',
    'events.manage',
    'stories.manage',
    'reports.view',
  ],
  sales,
  regional_lead: [...sales, 'layers.approve', 'subscriptions.view', 'payments.view'],
  finance: [
    ...EVERYONE,
    'schools.view',
    'subscriptions.view',
    'subscriptions.manage',
    'trials.manage',
    'payments.view',
    'payments.confirm',
    'invoices.manage',
    'prices.view',
    'ai_models.view',
    'help_requests.view',
    'reports.view',
  ],
  engineer: [
    ...EVERYONE,
    ...TEAMS,
    'problems.deliver',
    'audit.view',
    'prices.view',
    'ai_models.view',
    'integrations.view',
    'embeds.view',
    'announcements.write',
    'help_requests.view',
    'system_health.view',
    'system_health.manage',
    'reports.view',
  ],
  researcher: [...EVERYONE, ...RESEARCH_TEAM, 'curriculum.view'],
}

export function roleHas(role: StaffRole, ability: StaffAbility) {
  return POWERS[role].includes(ability)
}
