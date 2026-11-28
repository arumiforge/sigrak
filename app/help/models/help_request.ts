import { HelpRequestSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import db from '@adonisjs/lucid/services/db'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withPublicId } from '#models/mixins/with_public_id'
import { TENANT_CONNECTION } from '#tenancy/database_roles'
import { TenancyAdapter } from '#tenancy/tenancy_adapter'
import type { HelpCategory, HelpStatus, SenderRole } from '../catalog.js'
import HelpRequestNote from './help_request_note.js'

/**
 * One Minta Bantuan request (D-320). On the tenant connection, so
 * row-level security filters every query: a school reads only its own
 * requests, a request without a school only its sender. No app-side
 * school scope (`school_id` may be NULL, D-459); callers filter by
 * sender as well.
 */
export default class HelpRequest extends compose(HelpRequestSchema, withPublicId) {
  static table = 'help_requests'
  static connection = TENANT_CONNECTION
  static $adapter = new TenancyAdapter(db)

  declare category: HelpCategory
  declare status: HelpStatus
  declare membershipRole: SenderRole | null

  @hasMany(() => HelpRequestNote)
  declare notes: HasMany<typeof HelpRequestNote>
}
