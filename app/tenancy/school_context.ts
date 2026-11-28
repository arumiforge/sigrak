import { AsyncLocalStorage } from 'node:async_hooks'
import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * The tenant of the current unit of work: one HTTP request or one job.
 *
 * It lives in AsyncLocalStorage, so it is empty at the start of every
 * request and job and cannot leak from one to the next. The school
 * context middleware fills it from the active membership; a job names
 * its school with `SchoolContext.runFor()`. Nothing falls back to "all
 * schools": no context means no school rows (fail-closed).
 */
export interface SchoolScope {
  /** The school whose rows are visible. Null: only the user's own rows. */
  schoolId: number | null
  /** The signed-in user, if any (memberships before a school is chosen). */
  userId: number | null
  /** The open tenant transaction, set by tenantTransaction(). */
  trx?: TransactionClientContract
  /** True only inside staffTransaction(): every school is visible. */
  staff?: boolean
}

const storage = new AsyncLocalStorage<SchoolScope>()

export class MissingSchoolContextException extends Exception {
  static status = 500
  static code = 'E_MISSING_SCHOOL_CONTEXT'
  static message = 'No school in the context. Run the work inside SchoolContext.runFor().'
}

export class SchoolMismatchException extends Exception {
  static status = 404
  static code = 'E_SCHOOL_MISMATCH'
  static message = 'The row belongs to another school.'
}

export const SchoolContext = {
  /**
   * The current scope, or undefined outside any request or job scope.
   */
  current(): SchoolScope | undefined {
    return storage.getStore()
  },

  /**
   * The current school id, or null.
   */
  schoolId(): number | null {
    return storage.getStore()?.schoolId ?? null
  },

  /**
   * The current school id; throws when there is none.
   */
  requireSchoolId(): number {
    const schoolId = this.schoolId()
    if (schoolId === null) throw new MissingSchoolContextException()
    return schoolId
  },

  /**
   * Runs `work` with the given scope. Used by the middleware for a
   * request.
   */
  run<T>(scope: Pick<SchoolScope, 'schoolId' | 'userId'>, work: () => T): T {
    return storage.run({ schoolId: scope.schoolId, userId: scope.userId }, work)
  },

  /**
   * Runs `work` for one school, as a job does: `runFor(job.schoolId, …)`.
   * An optional user id is kept for the user-owned rows of that school.
   */
  runFor<T>(schoolId: number, work: () => T, userId: number | null = null): T {
    return storage.run({ schoolId, userId }, work)
  },

  /**
   * Runs `work` with the open transaction stored in the scope, so models
   * with the school scope use it (tenantTransaction).
   * @internal
   */
  withTransaction<T>(scope: SchoolScope, trx: TransactionClientContract, work: () => T): T {
    return storage.run({ ...scope, trx }, work)
  },
}
