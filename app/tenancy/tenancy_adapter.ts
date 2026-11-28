import db from '@adonisjs/lucid/services/db'
import { Adapter } from '@adonisjs/lucid/orm'
import type { LucidModel, ModelAdapterOptions } from '@adonisjs/lucid/types/model'
import { SchoolContext } from './school_context.js'

/**
 * Model adapter for school-scoped models: a query or save without an
 * explicit client runs inside the open tenant transaction of the
 * SchoolContext (tenantTransaction / staffTransaction). Outside one, it
 * uses the model's connection, which is the tenant connection, where
 * row-level security shows no school rows.
 */
export class TenancyAdapter extends Adapter {
  modelConstructorClient(modelConstructor: LucidModel, options?: ModelAdapterOptions) {
    if (options?.client) {
      return options.client
    }
    const trx = options?.connection ? undefined : SchoolContext.current()?.trx
    if (trx) {
      return trx
    }
    return db.connection(options?.connection || modelConstructor.connection)
  }
}
