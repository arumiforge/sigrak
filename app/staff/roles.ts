/**
 * The twelve Tim SIGRAK roles (D-339 plus Peneliti, D-439) and the
 * scope parts each one uses (D-338, docs/drafts/internal-roles.md §2
 * and §5). Labels live in resources/lang/id/staff.json (`roles.*`).
 *
 * Area scope (regions and a named school list):
 * - `none`: the role has no area; it always covers every school.
 * - `optional`: an empty area means every school; a set area limits it.
 * - `required`: an empty area means no school at all, so a new
 *   Penjualan account sees nothing until the admin sets its area.
 *
 * `schools` says whether the area may also name single schools (only
 * Penjualan and Koordinator Wilayah, §5). Levels (SD, MI) and fields
 * (bidang) limit what the role works on when set; empty means all.
 */
export const STAFF_ROLES = [
  'owner',
  'admin',
  'validator',
  'content',
  'curriculum',
  'support',
  'marketing',
  'sales',
  'regional_lead',
  'finance',
  'engineer',
  'researcher',
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

export type AreaScope = 'none' | 'optional' | 'required'

export type RoleScopeRule = {
  area: AreaScope
  schools: boolean
  levels: boolean
  fields: boolean
}

export const ROLE_SCOPES: Record<StaffRole, RoleScopeRule> = {
  owner: { area: 'none', schools: false, levels: false, fields: false },
  admin: { area: 'optional', schools: false, levels: false, fields: false },
  validator: { area: 'optional', schools: false, levels: true, fields: true },
  content: { area: 'none', schools: false, levels: true, fields: true },
  curriculum: { area: 'none', schools: false, levels: true, fields: false },
  support: { area: 'optional', schools: false, levels: false, fields: false },
  marketing: { area: 'required', schools: false, levels: false, fields: false },
  sales: { area: 'required', schools: true, levels: false, fields: false },
  regional_lead: { area: 'required', schools: true, levels: false, fields: false },
  finance: { area: 'none', schools: false, levels: false, fields: false },
  engineer: { area: 'none', schools: false, levels: false, fields: false },
  researcher: { area: 'none', schools: false, levels: true, fields: true },
}

/**
 * Roles with high powers: only an owner grants or removes them, and
 * only an owner changes or disables an account that holds one
 * (internal-roles §2: "staff accounts with high powers").
 */
export const HIGH_ROLES: readonly StaffRole[] = ['owner', 'admin']

/** The levels a scope can name (schools.level). */
export const SCOPE_LEVELS = ['sd', 'mi'] as const
export type ScopeLevel = (typeof SCOPE_LEVELS)[number]

/**
 * Fields (bidang) a scope can name: the subject groups and the six
 * religions of internal-roles §2 and §5, plus the remaining SD/MI
 * subject groups. Labels: `staff.fields.*`.
 */
export const SCOPE_FIELDS = [
  'mathematics',
  'languages',
  'science_social',
  'pancasila',
  'arts',
  'physical_education',
  'islamic',
  'christian',
  'catholic',
  'hindu',
  'buddhist',
  'confucian',
  'local_content',
] as const
export type ScopeField = (typeof SCOPE_FIELDS)[number]

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value)
}
