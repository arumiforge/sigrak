import db from '@adonisjs/lucid/services/db'
import type { BaseModel } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import { TENANT_CONNECTION } from '../../tenancy/database_roles.js'
import { TenancyAdapter } from '../../tenancy/tenancy_adapter.js'

/**
 * For layer tables that mix shared rows (national and area packages,
 * area hides and proposals) with school rows: the model runs on the
 * tenant connection, inside the open tenant or staff transaction, so
 * row-level security decides what is visible. Unlike `withSchoolScope`
 * it adds no `school_id = …` filter, because a school also reads the
 * national and area rows of its own chain.
 */
export function withTenantConnection<T extends NormalizeConstructor<typeof BaseModel>>(
  superclass: T
) {
  class ModelWithTenantConnection extends superclass {
    static connection = TENANT_CONNECTION
    static $adapter = new TenancyAdapter(db)
  }
  return ModelWithTenantConnection
}
