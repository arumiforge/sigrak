/**
 * School years are written `2026/2027` (data files, profiles,
 * `curriculum_versions.applies_from_school_year`).
 */
const pattern = /^(\d{4})\/(\d{4})$/

export function isSchoolYear(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = pattern.exec(value)
  return match !== null && Number(match[2]) === Number(match[1]) + 1
}

/**
 * The first calendar year of a school year: `2026/2027` → 2026.
 */
export function schoolYearStart(value: string): number {
  if (!isSchoolYear(value)) {
    throw new Error(`"${value}" is not a school year (expected for example 2026/2027)`)
  }
  return Number(value.slice(0, 4))
}

/**
 * Negative when a is earlier than b, 0 when equal, positive when later.
 */
export function compareSchoolYears(a: string, b: string) {
  return schoolYearStart(a) - schoolYearStart(b)
}
