import { HelpRequestNoteSchema } from '#database/schema'
import db from '@adonisjs/lucid/services/db'
import { TENANT_CONNECTION } from '#tenancy/database_roles'
import { TenancyAdapter } from '#tenancy/tenancy_adapter'
import type { HelpNoteKind, HelpStatus } from '../catalog.js'

/**
 * One entry on a request's timeline: a reply the sender reads, a status
 * change the sender sees, or an internal note (never visible to the
 * school, not even through RLS). Only staff write them.
 */
export default class HelpRequestNote extends HelpRequestNoteSchema {
  static table = 'help_request_notes'
  static connection = TENANT_CONNECTION
  static $adapter = new TenancyAdapter(db)

  declare kind: HelpNoteKind
  declare status: HelpStatus | null
}
