import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Staff 2FA with an authenticator app (TOTP, D-343, R2-02).
 *
 * - `two_factor_secret`: the TOTP secret, encrypted with the app key
 *   (never stored or logged in plain text). Set while the staff member
 *   enrols; kept once confirmed.
 * - `two_factor_confirmed_at`: set when the first code is accepted.
 *   Sign-in asks for a code only when it is set.
 * - `two_factor_last_step`: the 30-second time step of the last code
 *   accepted, so one code cannot be used twice.
 *
 * There are no recovery codes: an admin resets all three columns and
 * the staff member enrols again (D-343).
 */
export default class extends BaseSchema {
  protected tableName = 'staff_users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('two_factor_secret').nullable()
      table.timestamp('two_factor_confirmed_at', { useTz: true }).nullable()
      table.bigInteger('two_factor_last_step').nullable()
    })
    this.schema.raw(`
      ALTER TABLE staff_users ADD CONSTRAINT staff_users_two_factor_confirmed_has_secret
        CHECK (two_factor_confirmed_at IS NULL OR two_factor_secret IS NOT NULL)
    `)
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['staff_users_two_factor_confirmed_has_secret'])
      table.dropColumns('two_factor_secret', 'two_factor_confirmed_at', 'two_factor_last_step')
    })
  }
}
