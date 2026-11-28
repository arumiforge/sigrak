import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type { RawQueryBindings } from '@adonisjs/lucid/types/querybuilder'

/**
 * R1-11: the topic count of SubjectsForGrade (one version set, one
 * grade) has an index that starts with both columns, so it no longer
 * reads the whole topics table on every Jadwal page.
 */
test.group('Curriculum | topic counts index', () => {
  test('the per-grade topic count can use the version and grade index', async ({ assert }) => {
    const { sql, bindings } = db
      .from('topics')
      .whereIn('curriculum_version_id', [1, 2])
      .where('grade', 4)
      .groupBy('subject_id', 'art_branch')
      .select('subject_id', 'art_branch')
      .count('* as total')
      .toSQL()

    const plan = await db.transaction(async (trx) => {
      // The test table is nearly empty; a scan would win without this.
      await trx.rawQuery('SET LOCAL enable_seqscan = off')
      const result = await trx.rawQuery(`EXPLAIN ${sql}`, bindings as RawQueryBindings)
      return (result.rows as { 'QUERY PLAN': string }[]).map((row) => row['QUERY PLAN']).join('\n')
    })
    assert.include(plan, 'topics_curriculum_version_id_grade_index')
    assert.match(plan, /Index Cond: \(\(curriculum_version_id = ANY .*\) AND \(grade = /)
  })
})
