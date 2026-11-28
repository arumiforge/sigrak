import { SupportSessionSchema } from '#database/schema'
import db from '@adonisjs/lucid/services/db'
import { TENANT_CONNECTION } from '#tenancy/database_roles'
import { TenancyAdapter } from '#tenancy/tenancy_adapter'

/**
 * One support session (D-341): a staff member viewing one school
 * read-only, from "Lihat sekolah ini" to "Akhiri" or the time-out.
 * Internal only; the app role sees no row.
 */
export default class SupportSession extends SupportSessionSchema {
  static table = 'support_sessions'
  static connection = TENANT_CONNECTION
  static $adapter = new TenancyAdapter(db)
}
