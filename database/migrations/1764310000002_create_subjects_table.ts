import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Subject catalogue from `docs/data/curriculum/subjects.json` (D-227,
 * D-452). Global reference data, not school-owned. `aliases` are the
 * keys other data files use (`alquran_hadis`, `seni_budaya`); the
 * import resolves subjects by code, then alias. `transition` holds the
 * status by school year of a subject phased in by regulation (D-410);
 * `offered_grades` and `delivery` describe an elective (KKA, D-452).
 */
export default class extends BaseSchema {
  protected tableName = 'subjects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('code', 20).notNullable().unique()
      table.string('name', 150).notNullable()
      table.string('kind', 15).notNullable()
      table.string('default_teacher', 15).notNullable()
      table.string('religion', 10).nullable()
      table.string('school_level', 4).notNullable()
      table.jsonb('aliases').notNullable().defaultTo('[]')
      table.jsonb('transition').nullable()
      table.jsonb('offered_grades').nullable()
      table.jsonb('delivery').nullable()
      table.smallint('sort_order').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(
        `kind IN ('compulsory', 'elective', 'local_content', 'cocurricular')`,
        [],
        'subjects_kind_check'
      )
      table.check(
        `default_teacher IN ('class_teacher', 'subject_teacher')`,
        [],
        'subjects_default_teacher_check'
      )
      table.check(
        `religion IN ('islam', 'kristen', 'katolik', 'hindu', 'buddha', 'khonghucu')`,
        [],
        'subjects_religion_check'
      )
      table.check(`school_level IN ('sd', 'mi', 'both')`, [], 'subjects_school_level_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
