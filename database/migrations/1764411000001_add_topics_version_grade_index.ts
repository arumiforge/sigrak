import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Topic counts per grade (R1-11): `SubjectsForGrade` counts the topics
 * of a curriculum version for one grade on every page that lists a
 * class's subjects (the Jadwal pages run it once per grade). The
 * existing index puts `grade` third, after `subject_id`, so PostgreSQL
 * read the whole table each time; under load it was the busiest
 * statement. Topics only grow with each curriculum version.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('topics', (table) => {
      table.index(['curriculum_version_id', 'grade'])
    })
  }

  async down() {
    this.schema.alterTable('topics', (table) => {
      table.dropIndex(['curriculum_version_id', 'grade'])
    })
  }
}
