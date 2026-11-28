/**
 * The one catalogue of staff ability keys (R2-00: owned by R2-01, used
 * as-is by R2-02…R2-09 and later slices). Every console page and action
 * names the ability it needs; which roles hold which ability is fixed
 * in code in app/staff/powers.ts (D-314, D-338). A missing key is added
 * here by the integrator, never by a parallel task.
 *
 * Grouped as on the Hak akses page; labels are
 * `staff.abilities.<group>.<action>` and `staff.ability_groups.<group>`
 * in resources/lang/id/staff.json. Scoped means the assignment's scope
 * (region, school list, level, field) limits the ability; see
 * app/staff/access.ts.
 */
export const ABILITY_GROUPS = {
  /** Tim SIGRAK itself: staff accounts, roles and scopes, the logs (R2-01). */
  team: [
    'staff.view',
    'staff.manage',
    /** Grant or remove owner and admin, change or disable their accounts (owner only). */
    'staff.manage_high',
    /** Reset another staff member's 2FA (R2-02). */
    'staff.reset_2fa',
    'audit.view',
    /** The read-only Hak akses matrix (D-314): every staff member. */
    'access.view',
  ],
  /** Schools, school users, invitations and trials (R1-05, scoped by area). */
  schools: [
    'schools.view',
    'schools.manage',
    'users.view',
    'invitations.manage',
    /** Any trial change: extend, set, back to default (owner, admin, finance). */
    'trials.manage',
    /** "Tambah hari" within a limit for the own area (sales, regional lead). */
    'trials.extend',
    /** School directory and region changes (R1-04). */
    'regions.review',
    /** Propose an area layer change (R1-07). */
    'layers.propose',
    /** Approve area layer changes and activate area calendars (R1-07, R1-08). */
    'layers.approve',
  ],
  /** Subscriptions, payments and prices: keys for the R5 business slice (D-340, D-477). */
  business: [
    'subscriptions.view',
    'subscriptions.manage',
    'payments.view',
    'payments.record',
    'payments.confirm',
    'invoices.manage',
    /** Prices and the core/add-on plan mapping (D-211). */
    'prices.view',
    'prices.manage',
  ],
  /** Curated material: template prompts and LKPD patterns, catalogs and assets, embeds. */
  content: [
    'templates.view',
    'templates.prepare',
    'templates.signoff',
    /** Catalogs, seed lists, Game kelas content packs, pictograms and 3D models. */
    'catalogs.view',
    'catalogs.prepare',
    'catalogs.signoff',
    /** Embed allowlist (D-330). */
    'embeds.view',
    'embeds.prepare',
    'embeds.signoff',
    'embeds.manage',
  ],
  /** Curriculum console (R2-08, D-317). */
  curriculum: [
    /** Versions list, compare, impact report. */
    'curriculum.view',
    'curriculum.draft',
    /** Sign off a draft; never one's own import (D-339). */
    'curriculum.signoff',
    /** Publish a signed-off version and roll back. */
    'curriculum.publish',
  ],
  /** Kabar, Acara, Cerita Sekolah and legal pages (R2-05, D-319, D-435, D-477). */
  communication: [
    /** Every Kabar with every target, in the app and on sigrak.com. */
    'announcements.manage',
    /** Kabar in the app to targets within the own scope. */
    'announcements.write',
    /** Show a Kabar on sigrak.com/kabar. */
    'announcements.public',
    'events.manage',
    'stories.manage',
    'legal_pages.manage',
  ],
  /** Minta Bantuan and support sessions (R2-06, D-320, D-341). */
  help: [
    'help_requests.view',
    'help_requests.manage',
    /** Open a school's view read-only under the MoU (D-341). */
    'support_sessions.start',
    /** The internal list of support sessions. */
    'support_sessions.view',
    /** Pengawas requests for sekolah binaan (D-309, built in R5 with the portal). */
    'supervisor_requests.manage',
  ],
  /** Bank Masalah, Bank Praktik Baik and the Forum Masalah→Solusi (R2-07, D-439). */
  problems: [
    'problems.view',
    /** Record a problem by hand or from a help request (Tim Lapangan). */
    'problems.record',
    /** Triage, merge duplicates (Tim Lapangan). */
    'problems.triage',
    /** Root cause, regulation check, evidence (Tim Kurikulum & Riset). */
    'problems.analyse',
    /** Move a decided problem through building, trial and release (Tim Produk). */
    'problems.deliver',
    /** Decide in the forum (the owner, D-439). */
    'problems.decide',
    'good_practices.view',
    'good_practices.manage',
    'forum.view',
    /** Build the forum agenda and record the meeting. */
    'forum.manage',
  ],
  /** Settings, integrations, AI models, Kesehatan Sistem, reports (R2-03, R2-04). */
  system: [
    /** Console settings such as the default trial length (D-459). */
    'settings.view',
    'settings.manage',
    /** Mail, storage and chatbot provider settings (D-431, D-394). */
    'integrations.view',
    'integrations.manage',
    /** AI model and fallback list per purpose (D-315). */
    'ai_models.view',
    'ai_models.manage',
    /** Kesehatan Sistem (D-316). */
    'system_health.view',
    /** Retry or remove failed jobs. */
    'system_health.manage',
    /** Usage reports; scoped roles see their area only, counts only. */
    'reports.view',
  ],
} as const

export type AbilityGroup = keyof typeof ABILITY_GROUPS
export type StaffAbility = (typeof ABILITY_GROUPS)[AbilityGroup][number]

export const STAFF_ABILITIES: readonly StaffAbility[] = Object.values(ABILITY_GROUPS).flat()

export function isStaffAbility(value: string): value is StaffAbility {
  return (STAFF_ABILITIES as readonly string[]).includes(value)
}
