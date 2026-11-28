import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Legal pages of sigrak.com (D-435, R2-05): Syarat penggunaan,
 * Kebijakan privasi and Perlindungan data murid (the data-processing
 * agreement for schools under UU PDP).
 *
 * One row per version of a page (`key`). A version starts as a draft
 * (at most one draft per page), is published once with its version
 * number and "berlaku sejak" date, and is then kept as it is: a
 * trigger refuses any change to or removal of a published row, so
 * every version a school agreed to stays readable. The public page
 * shows the newest published version whose date has come.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('legal_documents', (table) => {
      table.bigIncrements('id')
      table.string('key', 20).notNullable()
      table.integer('version').notNullable()
      table.string('title', 200).notNullable()
      table.date('effective_on').notNullable()
      table.string('change_note', 300).nullable()
      table.text('body').notNullable()
      table.string('status', 10).notNullable().defaultTo('draft')
      table.timestamp('published_at', { useTz: true }).nullable()
      table
        .bigInteger('published_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table
        .bigInteger('created_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['key', 'version'])
      table.check(`key IN ('terms', 'privacy', 'student_data')`, [], 'legal_documents_key_check')
      table.check(`version > 0`, [], 'legal_documents_version_check')
      table.check(`status IN ('draft', 'published')`, [], 'legal_documents_status_check')
      table.check(
        `(status = 'published') = (published_at IS NOT NULL)`,
        [],
        'legal_documents_published_at_check'
      )
    })

    this.schema.raw(
      `CREATE UNIQUE INDEX legal_documents_one_draft ON legal_documents (key) WHERE status = 'draft'`
    )

    this.schema.raw(`
      CREATE FUNCTION legal_documents_keep_published() RETURNS trigger AS $$
      BEGIN
        IF OLD.status = 'published' THEN
          RAISE EXCEPTION 'A published legal document version cannot change'
            USING ERRCODE = 'check_violation';
        END IF;
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)
    this.schema.raw(`
      CREATE TRIGGER legal_documents_keep_published
        BEFORE UPDATE OR DELETE ON legal_documents
        FOR EACH ROW EXECUTE FUNCTION legal_documents_keep_published()
    `)
  }

  async down() {
    this.schema.dropTable('legal_documents')
    this.schema.raw('DROP FUNCTION IF EXISTS legal_documents_keep_published()')
  }
}
