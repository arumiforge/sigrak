import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'

/**
 * One row of a class timetable (data model `timetable_slots`; D-247,
 * D-249, D-262). Model `TimetableSlot`.
 *
 * - `kind`: lesson, break (Istirahat), ceremony (Upacara) or activity
 *   (Kegiatan, optional `label` such as "Senam"). Only lessons have a
 *   subject and 1–4 JP; other rows have no subject and 0 JP (D-247).
 * - No `teacher_id`: the teacher is the class's teaching assignment for
 *   the subject (D-249).
 * - `period_no` is the row's place in the day, recomputed from the
 *   start times after every change (D-247). The unique key is checked
 *   at commit, so renumbering a day inside one transaction never trips
 *   it.
 * - `is_locked`: the draft timetable keeps the row as it is (D-262,
 *   D-381).
 * - The class must belong to the same school (composite foreign key);
 *   deleting a class removes its rows. A subject on a timetable cannot
 *   leave the catalogue (RESTRICT).
 *
 * School-owned, so RLS applies (R1-01).
 */
export default class extends BaseSchema {
  protected tableName = 'timetable_slots'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('school_id')
        .notNullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.bigInteger('class_id').notNullable()
      table.smallint('weekday').notNullable()
      table.smallint('period_no').notNullable()
      table.time('starts_at').notNullable()
      table.time('ends_at').notNullable()
      table.string('kind', 20).notNullable()
      table.string('label', 40).nullable()
      table
        .bigInteger('subject_id')
        .nullable()
        .references('id')
        .inTable('subjects')
        .onDelete('RESTRICT')
      table.smallint('jp').notNullable().defaultTo(0)
      table.boolean('is_locked').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table
        .foreign(['class_id', 'school_id'], 'timetable_slots_class_school_foreign')
        .references(['id', 'school_id'])
        .inTable('classes')
        .onDelete('CASCADE')
      table.index(['school_id', 'class_id', 'weekday'])
      table.index(['subject_id'])
      table.check('weekday BETWEEN 1 AND 6', [], 'timetable_slots_weekday_check')
      table.check('period_no >= 1', [], 'timetable_slots_period_check')
      table.check('starts_at < ends_at', [], 'timetable_slots_times_check')
      table.check(
        `kind IN ('lesson', 'break', 'ceremony', 'activity')`,
        [],
        'timetable_slots_kind_check'
      )
      table.check(
        `(kind = 'lesson' AND subject_id IS NOT NULL AND jp BETWEEN 1 AND 4 AND label IS NULL)
          OR (kind <> 'lesson' AND subject_id IS NULL AND jp = 0)`,
        [],
        'timetable_slots_lesson_check'
      )
      table.check(
        `label IS NULL OR (label = btrim(label) AND label <> '')`,
        [],
        'timetable_slots_label_check'
      )
    })

    this.schema.raw(
      `ALTER TABLE timetable_slots ADD CONSTRAINT timetable_slots_period_unique
        UNIQUE (class_id, weekday, period_no) DEFERRABLE INITIALLY DEFERRED`
    )

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
