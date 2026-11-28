import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { STAFF_READ_ROLE, STAFF_ROLE, TENANT_CONNECTION } from './database_roles.js'
import { MissingSchoolContextException, SchoolContext, type SchoolScope } from './school_context.js'

type Work<T> = (trx: TransactionClientContract) => Promise<T>

/**
 * Runs `work` in one transaction on the tenant connection (the
 * non-owner app role, so row-level security applies). The first
 * statement sets the tenant with SET LOCAL semantics
 * (`set_config(..., true)`), which ends with the transaction, so a
 * pooled connection (PgBouncer in transaction mode, D-429) never
 * carries one school's tenant into the next transaction.
 *
 * The school and user come from the SchoolContext, or from `scope` for
 * code that names them. Models with the school scope use this
 * transaction automatically inside `work`. A nested call for the same
 * school reuses the open transaction.
 */
export async function tenantTransaction<T>(
  work: Work<T>,
  scope?: Partial<Pick<SchoolScope, 'schoolId' | 'userId'>>
): Promise<T> {
  const current = SchoolContext.current()
  const schoolId = scope?.schoolId !== undefined ? scope.schoolId : (current?.schoolId ?? null)
  const userId = scope?.userId !== undefined ? scope.userId : (current?.userId ?? null)

  if (schoolId === null && userId === null) {
    throw new MissingSchoolContextException()
  }

  if (current?.trx && !current.staff) {
    if (current.schoolId !== schoolId || current.userId !== userId) {
      throw new MissingSchoolContextException(
        'A tenant transaction for another school or user is already open.'
      )
    }
    return work(current.trx)
  }

  return db.connection(TENANT_CONNECTION).transaction(async (trx) => {
    await trx.rawQuery(
      `SELECT set_config('app.school_id', ?, true), set_config('app.user_id', ?, true)`,
      [schoolId === null ? '' : String(schoolId), userId === null ? '' : String(userId)]
    )
    return SchoolContext.withTransaction({ schoolId, userId }, trx, () => work(trx))
  })
}

/**
 * Runs `work` as Tim SIGRAK staff: `SET LOCAL ROLE sigrak_staff` for
 * this one transaction, so the staff policies apply and every school is
 * visible. Only for the internal console and staff jobs; the caller
 * checks the staff member's role and scope first.
 */
export async function staffTransaction<T>(work: Work<T>): Promise<T> {
  return db.connection(TENANT_CONNECTION).transaction(async (trx) => {
    await trx.rawQuery(`SET LOCAL ROLE ${STAFF_ROLE}`)
    return SchoolContext.withTransaction({ schoolId: null, userId: null, staff: true }, trx, () =>
      work(trx)
    )
  })
}

/**
 * Runs `work` as read-only staff (support, D-469): a READ ONLY
 * transaction with `SET LOCAL ROLE sigrak_staff_readonly`, so every
 * school is visible but the database refuses any write, both through
 * the transaction mode and the role's grants. For the console's view
 * pages; changes go through `staffTransaction` and an admin. The
 * caller checks the staff member's role first.
 */
export async function staffReadTransaction<T>(work: Work<T>): Promise<T> {
  return db.connection(TENANT_CONNECTION).transaction(async (trx) => {
    await trx.rawQuery('SET TRANSACTION READ ONLY')
    await trx.rawQuery(`SET LOCAL ROLE ${STAFF_READ_ROLE}`)
    return SchoolContext.withTransaction(
      { schoolId: null, userId: null, staff: true, readOnly: true },
      trx,
      () => work(trx)
    )
  })
}
