import SchoolMembership from '#models/school_membership'
import { SchoolContext } from '#tenancy/school_context'
import { SchoolYearRuleError } from './errors.js'

/**
 * Teachers the operator can pick for a class: active teacher
 * memberships of the school (D-240). The browser only sees the
 * membership's public id (D-182); rows store the user id.
 */
export interface TeacherOption {
  publicId: string
  userId: number
  name: string
}

/**
 * Form value that keeps the current teacher. It is offered when the
 * current teacher is no longer an active teacher of the school, so a
 * save of other fields does not drop them silently.
 */
export const KEEP_CURRENT = 'current'

export async function teacherOptions(): Promise<TeacherOption[]> {
  const scope = SchoolContext.current()
  const schoolId = SchoolContext.requireSchoolId()
  const memberships = await SchoolMembership.query({ client: scope!.trx! })
    .where('school_id', schoolId)
    .where('role', 'teacher')
    .where('status', 'active')
    .preload('user')
  return memberships
    .map((membership) => ({
      publicId: membership.publicId,
      userId: membership.userId,
      name: membership.user.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id-ID') || a.userId - b.userId)
}

/**
 * The user id for a picked teacher: '' or null clears, KEEP_CURRENT
 * keeps `current`, a membership public id must be an active teacher of
 * the school.
 */
export function pickTeacher(
  options: TeacherOption[],
  value: string | null | undefined,
  current: number | null,
  field: string
): number | null {
  if (value === null || value === undefined || value === '') return null
  if (value === KEEP_CURRENT) return current
  const option = options.find((teacher) => teacher.publicId === value)
  if (!option) throw new SchoolYearRuleError(field, 'classes.errors.teacher_unknown')
  return option.userId
}
