import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Runtime settings that Tim SIGRAK changes in the console without a
 * deploy (D-431, D-459), and the log of what staff change there (data
 * model: "Every console setting change … is logged").
 *
 * - `app_settings`: one row per setting key, the value as JSONB (each
 *   key is typed in code in app/accounts/settings.ts). The first key is
 *   the default trial length, 7 days (D-160, made a setting by D-459).
 * - `staff_activity_logs`: who did what to which row. The subject is a
 *   type and an id rather than a school_id column, because a row can be
 *   about a user, a school, an invitation or a setting. Only staff read
 *   it.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('app_settings', (table) => {
      table.bigIncrements('id')
      table.string('key', 60).notNullable().unique()
      table.jsonb('value').notNullable()
      table
        .bigInteger('updated_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
        .index()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.raw(
      `INSERT INTO app_settings (key, value, created_at, updated_at) VALUES ('trial.default_days', '7'::jsonb, now(), now())`
    )

    this.schema.createTable('staff_activity_logs', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('staff_user_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
        .index()
      table.string('action', 40).notNullable()
      table.string('subject_type', 20).notNullable()
      table.string('subject_id', 60).notNullable()
      table.jsonb('changes').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['subject_type', 'subject_id'])
      table.check(
        `subject_type IN ('school', 'user', 'setting', 'invitation')`,
        [],
        'staff_activity_logs_subject_type_check'
      )
    })
  }

  async down() {
    this.schema.dropTable('staff_activity_logs')
    this.schema.dropTable('app_settings')
  }
}
