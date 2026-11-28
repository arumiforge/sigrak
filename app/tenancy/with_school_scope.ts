import db from '@adonisjs/lucid/services/db'
import {
  beforeCreate,
  beforeDelete,
  beforeFetch,
  beforeFind,
  beforePaginate,
  beforeUpdate,
} from '@adonisjs/lucid/orm'
import type { BaseModel } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import type {
  LucidModel,
  ModelAdapterOptions,
  ModelQueryBuilderContract,
} from '@adonisjs/lucid/types/model'
import { TENANT_CONNECTION } from './database_roles.js'
import { TenancyAdapter } from './tenancy_adapter.js'
import { SchoolContext, SchoolMismatchException } from './school_context.js'

type AnyQuery = ModelQueryBuilderContract<any, any>

/**
 * Queries whose app scope was settled when they were built: scoped by
 * query(), or left open by withoutSchoolScope(). The run-time hooks
 * scope only the others (relation and preload queries).
 */
const settled = new WeakSet<object>()

/**
 * Applies the app-side school scope to a query: rows of the current
 * school; no rows without a school (fail-closed); every row inside a
 * staff transaction.
 */
function applySchoolScope(query: AnyQuery) {
  const scope = SchoolContext.current()
  if (scope?.staff) return
  const table = query.model.table
  if (scope?.schoolId === null || scope?.schoolId === undefined) {
    query.whereRaw('false')
  } else {
    query.where(`${table}.school_id`, scope.schoolId)
  }
}

/**
 * For models of school-owned tables (every row has `school_id`).
 *
 * - The model uses the tenant connection (the non-owner app role), and
 *   inside tenantTransaction() the open transaction, so PostgreSQL
 *   row-level security filters every query as a second wall.
 * - Every select is scoped to the current school; no school in the
 *   context means no rows. `Model.withoutSchoolScope()` skips only the
 *   app scope, for the console and jobs that name the school.
 * - Creating fills `school_id` from the context and refuses another
 *   school; moving a row to another school is refused; deleting a row
 *   of another school is refused. Inside staffTransaction() these
 *   checks are off.
 *
 * Bulk `query().update()`/`delete()` get the scope too, because
 * `query()` applies it when the query is built.
 */
export function withSchoolScope<T extends NormalizeConstructor<typeof BaseModel>>(superclass: T) {
  class ModelWithSchoolScope extends superclass {
    static connection = TENANT_CONNECTION
    static $adapter = new TenancyAdapter(db)

    declare schoolId: number

    /**
     * A query scoped to the current school.
     */
    static query<Model extends LucidModel, Result = InstanceType<Model>>(
      this: Model,
      options?: ModelAdapterOptions
    ): ModelQueryBuilderContract<Model, Result> {
      const query = super.query<Model, Result>(options)
      applySchoolScope(query)
      settled.add(query)
      return query
    }

    /**
     * A query without the app scope. Row-level security still applies:
     * use it inside tenantTransaction() for a named school, or
     * staffTransaction() in the console.
     */
    static withoutSchoolScope<M extends typeof ModelWithSchoolScope>(
      this: M,
      options?: ModelAdapterOptions
    ): ModelQueryBuilderContract<M, InstanceType<M>> {
      const query = super.query<M, InstanceType<M>>(options)
      settled.add(query)
      return query
    }

    // Queries built without query() (relations, preloads) get the scope at run time.
    @beforeFind()
    static scopeFind(query: AnyQuery) {
      if (!settled.has(query)) applySchoolScope(query)
    }

    @beforeFetch()
    static scopeFetch(query: AnyQuery) {
      if (!settled.has(query)) applySchoolScope(query)
    }

    @beforePaginate()
    static scopePaginate([countQuery, query]: [AnyQuery, AnyQuery]) {
      if (!settled.has(query)) applySchoolScope(countQuery)
    }

    @beforeCreate()
    static fillSchool(model: ModelWithSchoolScope) {
      const scope = SchoolContext.current()
      if (scope?.staff && model.schoolId) return
      const schoolId = SchoolContext.requireSchoolId()
      if (model.schoolId === undefined || model.schoolId === null) {
        model.schoolId = schoolId
      } else if (model.schoolId !== schoolId) {
        throw new SchoolMismatchException()
      }
    }

    @beforeUpdate()
    static keepSchool(model: ModelWithSchoolScope) {
      if (SchoolContext.current()?.staff) return
      if (model.$dirty.schoolId !== undefined || model.schoolId !== SchoolContext.schoolId()) {
        throw new SchoolMismatchException()
      }
    }

    @beforeDelete()
    static deleteOwnOnly(model: ModelWithSchoolScope) {
      if (SchoolContext.current()?.staff) return
      if (model.schoolId !== SchoolContext.schoolId()) {
        throw new SchoolMismatchException()
      }
    }
  }
  return ModelWithSchoolScope
}
