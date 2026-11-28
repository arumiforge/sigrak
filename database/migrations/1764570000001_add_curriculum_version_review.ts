import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Curriculum console (R2-08, D-317, D-339): a version goes draft →
 * signed_off (a validator's sign-off) → active (published by the
 * curriculum role); a rollback sends it back to draft.
 *
 * - `imported_by_ids`: the staff who imported data into the version
 *   (`curriculum:import --by`); none of them may sign it off (D-339).
 * - The sign-off record: who, when, an optional note, and the
 *   fingerprint of the version's source files (`meta.files` hashes) at
 *   that moment, so data imported after the sign-off is never
 *   published without a new one.
 * - Who published it and when.
 *
 * History stays in staff_activity_logs (subject `curriculum_version`).
 *
 * The staff ids carry no foreign key on purpose: staff accounts are
 * disabled, never deleted, and a key would let `TRUNCATE staff_users
 * CASCADE` (test fixtures, restores) empty the global curriculum
 * tables.
 */
export default class extends BaseSchema {
  protected tableName = 'curriculum_versions'

  async up() {
    this.schema.raw(
      `ALTER TABLE curriculum_versions DROP CONSTRAINT curriculum_versions_status_check`
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.specificType('imported_by_ids', 'bigint[]').notNullable().defaultTo('{}')
      table.bigInteger('signed_off_by_id').nullable()
      table.timestamp('signed_off_at', { useTz: true }).nullable()
      table.text('sign_off_note').nullable()
      table.string('signed_off_fingerprint', 64).nullable()
      table.bigInteger('published_by_id').nullable()
      table.timestamp('published_at', { useTz: true }).nullable()

      table.check(
        `status IN ('draft', 'signed_off', 'active', 'retired')`,
        [],
        'curriculum_versions_status_check'
      )
      table.check(
        `status <> 'signed_off' OR (signed_off_at IS NOT NULL AND signed_off_fingerprint IS NOT NULL)`,
        [],
        'curriculum_versions_signed_off_check'
      )
      table.check(
        `status <> 'draft' OR (signed_off_at IS NULL AND published_at IS NULL)`,
        [],
        'curriculum_versions_draft_check'
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks([
        'curriculum_versions_draft_check',
        'curriculum_versions_signed_off_check',
        'curriculum_versions_status_check',
      ])
      table.dropColumn('published_at')
      table.dropColumn('published_by_id')
      table.dropColumn('signed_off_fingerprint')
      table.dropColumn('sign_off_note')
      table.dropColumn('signed_off_at')
      table.dropColumn('signed_off_by_id')
      table.dropColumn('imported_by_ids')
    })
    this.schema.raw(`UPDATE curriculum_versions SET status = 'draft' WHERE status = 'signed_off'`)
    this.schema.raw(
      `ALTER TABLE curriculum_versions ADD CONSTRAINT curriculum_versions_status_check CHECK (status IN ('draft', 'active', 'retired'))`
    )
  }
}
