import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  assertUnique,
  reportMissing,
  requireArray,
  requireOneOf,
  requireString,
  type Json,
  type SourceFile,
} from '../context.js'
import type { FileReport } from '../report.js'
import { upsertRows } from '../upsert.js'
import { defaultTeachers, religions, subjectKinds, subjectSchoolLevels } from '../../types.js'

/**
 * `subjects.json`: the subject catalogue (D-227, D-410, D-452).
 */
export async function importSubjects(
  trx: TransactionClientContract,
  source: SourceFile,
  report: FileReport
) {
  const subjects = requireArray(source.data.subjects, `${source.name} subjects`)
  assertUnique(
    subjects.map((subject) => String(subject.code)),
    'subject',
    source.name
  )

  const rows = subjects.map((subject: Json, index) => {
    const where = `${source.name} subjects[${index}]`
    return {
      code: requireString(subject.code, `${where}.code`),
      name: requireString(subject.name, `${where}.name`),
      kind: requireOneOf(subject.kind, subjectKinds, `${where}.kind`),
      default_teacher: requireOneOf(
        subject.default_teacher,
        defaultTeachers,
        `${where}.default_teacher`
      ),
      religion:
        subject.religion === null || subject.religion === undefined
          ? null
          : requireOneOf(subject.religion, religions, `${where}.religion`),
      school_level: requireOneOf(
        subject.school_level,
        subjectSchoolLevels,
        `${where}.school_level`
      ),
      aliases: requireArray<string>(subject.aliases ?? [], `${where}.aliases`),
      transition: subject.transition ?? null,
      offered_grades: subject.grades ?? null,
      delivery: subject.delivery ?? null,
      sort_order: index + 1,
    }
  })

  report.count(
    'subjects',
    await upsertRows(trx, 'subjects', rows, {
      conflict: ['code'],
      jsonColumns: ['aliases', 'transition', 'offered_grades', 'delivery'],
    })
  )

  const inDatabase = (await trx.from('subjects').select('code')) as { code: string }[]
  reportMissing(
    report,
    'subject',
    'Subject',
    inDatabase.map((row) => row.code),
    new Set(rows.map((row) => row.code))
  )

  const regionDefaults = Array.isArray(source.data.region_defaults)
    ? source.data.region_defaults
    : []
  if (regionDefaults.length > 0) {
    report.note(
      'region_defaults_not_imported',
      `${regionDefaults.length} region default(s) not imported: local content per region comes with the layer model (local_content_items, R1-07)`
    )
  }
}
