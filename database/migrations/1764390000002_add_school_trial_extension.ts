import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A school-wide trial extension (D-469): "Tambah hari" for a school
 * reopens every teacher's trial counted from today, also for trials
 * that ended long ago. `schools.trial_extended_until` is the end that
 * extension gives every teacher with an active membership there; NULL
 * means none. `schools.trial_days` stays the school's own length,
 * counted from each teacher's start. The latest end wins
 * (app/accounts/trial.ts).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('schools', (table) => {
      table.timestamp('trial_extended_until', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable('schools', (table) => {
      table.dropColumn('trial_extended_until')
    })
  }
}
