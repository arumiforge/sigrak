import type { HttpContext } from '@adonisjs/core/http'
import { backWithFieldError, requireRole } from '#accounts/http'
import { SchoolYearRuleError } from './errors.js'
import { ClassSubjects, schoolPolicyInput } from './class_subjects.js'

/**
 * Request helpers for the Tahun Ajaran and Kelas pages (operator only,
 * D-241).
 */

/** The operator's membership and what the school-year actions need. */
export async function operatorContext(ctx: HttpContext) {
  const membership = requireRole(ctx, 'operator')
  return {
    membership,
    deps: {
      classSubjects: new ClassSubjects(),
      school: await schoolPolicyInput(membership.schoolId),
    },
  }
}

/**
 * Runs `work`; a broken school-year rule goes back to `path` with the
 * message on its field, or as an error toast.
 */
export async function withRules(
  ctx: HttpContext,
  path: string,
  work: () => Promise<ReturnType<HttpContext['response']['redirect']> | void>
) {
  try {
    return await work()
  } catch (error) {
    if (!(error instanceof SchoolYearRuleError)) throw error
    const message = ctx.i18n.t(error.key, error.params)
    if (error.field) return backWithFieldError(ctx, path, error.field, message)
    ctx.session.flash('error', message)
    return ctx.response.redirect().toPath(path)
  }
}

/** A date column as `YYYY-MM-DD`. */
export function isoDate(value: { toISODate(): string | null }) {
  return value.toISODate()!
}
