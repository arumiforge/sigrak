import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Account state for self sign-up and the flexible trial (D-183, D-459).
 *
 * users:
 * - `email_verified_at`: set when the person shows they read mail at
 *   the address (accepting an invitation, D-183, or using a reset
 *   link). NULL for a self sign-up that has done neither yet.
 * - `trial_started_at`: when the teacher's trial began (sign-up, or the
 *   first accepted invitation). NULL: no trial started.
 * - `trial_days`: this person's own trial length; NULL follows the
 *   school or the default.
 *
 * schools:
 * - `trial_days`: the trial length for every teacher of the school
 *   (D-459); NULL follows the default setting.
 *
 * The rule that combines them lives in app/accounts/trial.ts.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.timestamp('email_verified_at', { useTz: true }).nullable()
      table.timestamp('trial_started_at', { useTz: true }).nullable()
      table.integer('trial_days').nullable()
      table.check(`trial_days BETWEEN 1 AND 3650`, [], 'users_trial_days_check')
    })

    this.schema.alterTable('schools', (table) => {
      table.integer('trial_days').nullable()
      table.check(`trial_days BETWEEN 1 AND 3650`, [], 'schools_trial_days_check')
    })
  }

  async down() {
    this.schema.alterTable('schools', (table) => {
      table.dropChecks(['schools_trial_days_check'])
      table.dropColumn('trial_days')
    })
    this.schema.alterTable('users', (table) => {
      table.dropChecks(['users_trial_days_check'])
      table.dropColumns('email_verified_at', 'trial_started_at', 'trial_days')
    })
  }
}
