import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'

/**
 * Who teaches a subject in a class (data model; D-032, D-240).
 *
 * - One row per class and subject. `teacher_id` is NOT NULL: a subject
 *   without a row has no teacher yet (D-240).
 * - The class must belong to the same school: composite foreign key on
 *   `(class_id, school_id)`; deleting a class removes its rows.
 * - A subject still taught somewhere cannot leave the catalogue
 *   (RESTRICT). Deleting a user removes their rows, which means "no
 *   teacher yet" for those subjects.
 *
 * School-owned, so RLS applies (R1-01).
 */
export default class extends BaseSchema {
  protected tableName = 'teaching_assignments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('school_id')
        .notNullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.bigInteger('class_id').notNullable()
      table
        .bigInteger('subject_id')
        .notNullable()
        .references('id')
        .inTable('subjects')
        .onDelete('RESTRICT')
        .index()
      table
        .bigInteger('teacher_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table
        .foreign(['class_id', 'school_id'], 'teaching_assignments_class_school_foreign')
        .references(['id', 'school_id'])
        .inTable('classes')
        .onDelete('CASCADE')
      table.unique(['class_id', 'subject_id'])
      table.index(['school_id', 'teacher_id'])
    })

    for (const sql of schoolRls(this.tableName)) {
      this.schema.raw(sql)
    }
  }

  async down() {
    for (const sql of dropRls(this.tableName)) {
      this.schema.raw(sql)
    }
    this.schema.dropTable(this.tableName)
  }
}
