import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Brings the skeleton tables to the data model (Accounts and schools).
 * The one-active-principal rule already has its partial unique index
 * (school_memberships_active_principal_unique), and the composite
 * indexes on school_memberships already start with school_id.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('school_memberships', (table) => {
      // An ended membership has an end date; an active one has none.
      table.check(
        `(status = 'ended') = (ended_on IS NOT NULL)`,
        [],
        'school_memberships_ended_on_check'
      )
      table.check(
        `ended_on IS NULL OR ended_on >= started_on`,
        [],
        'school_memberships_dates_check'
      )
    })

    this.schema.alterTable('users', (table) => {
      // NIP (Nomor Induk Pegawai) has 18 digits; NULL for non-civil-servant teachers.
      table.check(`nip ~ '^[0-9]{18}$'`, [], 'users_nip_check')
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropChecks(['users_nip_check'])
    })
    this.schema.alterTable('school_memberships', (table) => {
      table.dropChecks(['school_memberships_dates_check', 'school_memberships_ended_on_check'])
    })
  }
}
