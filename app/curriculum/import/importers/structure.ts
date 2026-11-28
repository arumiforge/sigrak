import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  CurriculumImportError,
  SubjectLookup,
  ensureVersion,
  requireArray,
  requireInt,
  requireOneOf,
  requireString,
  type Json,
  type SourceFile,
} from '../context.js'
import type { FileReport } from '../report.js'
import { upsertRows, type Row } from '../upsert.js'
import {
  phaseOfGrade,
  phases,
  type AllocationStatus,
  type LearningType,
  type Phase,
} from '../../types.js'

/**
 * Effective weeks of semester 1 when a source prints only JP per year;
 * semester 2 gets the rest (18 in grades 1–5, 14 in grade 6), D-229.
 */
const firstSemesterWeeks = 18

const statusByGroup: Record<string, AllocationStatus> = {
  required: 'compulsory',
  elective: 'elective',
}

function yearlyRow(
  report: FileReport,
  input: {
    versionId: number
    subjectId: number
    subjectCode: string
    grade: number
    phase: Phase
    learningType: LearningType
    status: AllocationStatus
    jpPerYear: number
    weeksPerYear: number
    basis: string | null
    meta: Json
  }
): Row {
  const where = `${input.subjectCode} grade ${input.grade} ${input.learningType}`
  const s1Weeks = firstSemesterWeeks
  const s2Weeks = input.weeksPerYear - firstSemesterWeeks
  const perWeek = input.jpPerYear / input.weeksPerYear
  if (!Number.isInteger(perWeek)) {
    report.mismatch(
      'jp_per_week_fraction',
      `${where}: ${input.jpPerYear} JP over ${input.weeksPerYear} weeks is not a whole number of JP per week`
    )
  }
  const s1Exact = (input.jpPerYear * s1Weeks) / input.weeksPerYear
  if (!Number.isInteger(s1Exact)) {
    report.mismatch(
      'semester_split_fraction',
      `${where}: ${input.jpPerYear} JP a year does not split into whole semester JP (${s1Weeks}/${s2Weeks} weeks)`
    )
  }
  const s1 = Math.floor(s1Exact)
  return {
    curriculum_version_id: input.versionId,
    subject_id: input.subjectId,
    grade: input.grade,
    phase: input.phase,
    learning_type: input.learningType,
    art_branch: null,
    status: input.status,
    jp_target_set_by: 'curriculum',
    jp_per_week: Math.round(perWeek),
    jp_per_year: input.jpPerYear,
    weeks_per_year: input.weeksPerYear,
    s1_jp: s1,
    s1_effective_weeks: s1Weeks,
    s2_jp: input.jpPerYear - s1,
    s2_effective_weeks: s2Weeks,
    basis: input.basis,
    meta: input.meta,
  }
}

export async function writeAllocations(
  trx: TransactionClientContract,
  report: FileReport,
  versionId: number,
  rows: Row[],
  scope: { subjectIds?: number[] } = {}
) {
  const key = (row: Row) =>
    [row.subject_id, row.grade, row.learning_type, row.art_branch ?? ''].join('|')
  const keys = new Set<string>()
  for (const row of rows) {
    if (keys.has(key(row))) {
      throw new CurriculumImportError(
        `${report.file}: two allocation rows for subject ${row.subject_id}, grade ${row.grade}, ${row.learning_type}`
      )
    }
    keys.add(key(row))
  }
  report.count(
    'subject_allocations',
    await upsertRows(trx, 'subject_allocations', rows, {
      conflict: { constraint: 'subject_allocations_row_unique' },
      jsonColumns: ['meta'],
    })
  )
  const query = trx
    .from('subject_allocations')
    .join('subjects', 'subjects.id', 'subject_allocations.subject_id')
    .where('curriculum_version_id', versionId)
  // A version made from several files: each file answers for its own subjects.
  if (scope.subjectIds) query.whereIn('subject_allocations.subject_id', scope.subjectIds)
  const inDatabase = (await query.select(
    'subject_allocations.subject_id',
    'subject_allocations.grade',
    'subject_allocations.learning_type',
    'subject_allocations.art_branch',
    'subjects.code'
  )) as Row[]
  for (const row of inDatabase) {
    if (!keys.has(key(row))) {
      report.missingRow(
        'subject_allocation',
        `Allocation ${row.code} grade ${row.grade} ${row.learning_type} is in the database but not in the file; kept`
      )
    }
  }
}

function gradePhase(report: FileReport, grade: number, phase: unknown, where: string): Phase {
  const expected = phaseOfGrade(grade)
  const given = requireOneOf(phase, phases, `${where}.phase`)
  if (expected !== given) {
    report.mismatch(
      'phase_grade',
      `${where}: grade ${grade} is in Fase ${expected}, the file says ${given}`
    )
  }
  return given
}

/**
 * `curriculum-structure-permendikdasmen-13-2025.json`: SD allocation,
 * Lampiran II B Tabel 1–5 only (D-366). The six religions share the one
 * Pendidikan Agama row; the muatan lokal cap goes to the version meta.
 */
export async function importStructureSd(
  trx: TransactionClientContract,
  source: SourceFile,
  report: FileReport
) {
  const data = source.data
  const versionCode = requireString(data.version_code, `${source.name} version_code`)
  const subjects = await SubjectLookup.load(trx)
  const allocation = (data.jp_allocation_sd_mi ?? {}) as Json
  const tables = requireArray(allocation.tables, `${source.name} jp_allocation_sd_mi.tables`)
  const religionSubjects = subjects.all.filter(
    (subject) => subject.religion !== null && subject.schoolLevel !== 'mi'
  )

  const localContent: Record<string, Json> = {}
  const pending: Omit<Parameters<typeof yearlyRow>[1], 'versionId'>[] = []

  for (const [tableIndex, table] of tables.entries()) {
    const where = `${source.name} tables[${tableIndex}]`
    const weeksPerYear = requireInt(table.weeks_per_year, `${where}.weeks_per_year`)
    const footnotes = (table.footnotes ?? {}) as Record<string, string>
    for (const grade of requireArray<number>(table.grades, `${where}.grades`)) {
      const phase = gradePhase(report, requireInt(grade, `${where}.grades`), table.phase, where)
      for (const [rowIndex, row] of requireArray(table.subjects, `${where}.subjects`).entries()) {
        const rowWhere = `${where}.subjects[${rowIndex}]`
        const key = requireString(row.key, `${rowWhere}.key`)
        const footnote = typeof row.footnote === 'string' ? (footnotes[row.footnote] ?? null) : null
        const intra = requireInt(row.intrakurikuler, `${rowWhere}.intrakurikuler`)
        const cocurricular = requireInt(row.kokurikuler ?? 0, `${rowWhere}.kokurikuler`)

        if (key === 'muatan_lokal') {
          localContent[String(grade)] = {
            max_jp_per_year: intra,
            jp_per_week: row.intrakurikuler_per_week ?? null,
            rule: footnote,
          }
          continue
        }
        const targets =
          key === 'pendidikan_agama' ? religionSubjects : [subjects.get(key, rowWhere)]
        const status = statusByGroup[String(row.group)]
        if (!status) {
          throw new CurriculumImportError(`${rowWhere}: unknown group "${row.group}"`)
        }
        const meta = {
          table: table.table,
          pages: table.pages ?? null,
          ...(row.options ? { options: row.options } : {}),
        }
        for (const subject of targets) {
          pending.push({
            subjectId: subject.id,
            subjectCode: subject.code,
            grade,
            phase,
            learningType: 'intracurricular',
            status,
            jpPerYear: intra,
            weeksPerYear,
            basis: footnote,
            meta,
          })
          if (cocurricular > 0) {
            pending.push({
              subjectId: subject.id,
              subjectCode: subject.code,
              grade,
              phase,
              learningType: 'cocurricular',
              status,
              jpPerYear: cocurricular,
              weeksPerYear,
              basis: null,
              meta,
            })
          }
        }
      }
    }
  }

  const sourceInfo = (data.source ?? {}) as Json
  const versionId = await ensureVersion(trx, report, {
    code: versionCode,
    kind: 'structure',
    name: requireString(sourceInfo.title ?? versionCode, `${source.name} source.title`),
    file: source.name,
    fileMeta: {
      sha256: source.sha256,
      dataset: String(data.dataset),
      status: data.status ?? null,
      source: {
        number: sourceInfo.number,
        promulgated_on: sourceInfo.promulgated_on,
        file: sourceInfo.file,
      },
      section: allocation.section ?? null,
      local_content: localContent,
    },
  })

  await writeAllocations(
    trx,
    report,
    versionId,
    pending.map((input) => yearlyRow(report, { ...input, versionId }))
  )
}

/**
 * `mi-allocation-kma-1503-2025.json`: MI allocation (KMA 1503/2025).
 */
export async function importAllocationMi(
  trx: TransactionClientContract,
  source: SourceFile,
  report: FileReport
) {
  const data = source.data
  const versionCode = requireString(data.version_code, `${source.name} version_code`)
  const subjects = await SubjectLookup.load(trx)
  const notes = (data.notes ?? {}) as Record<string, string>

  const localContent: Record<string, Json> = {}
  const pending: Omit<Parameters<typeof yearlyRow>[1], 'versionId'>[] = []
  for (const [gradeIndex, block] of requireArray(data.grades, `${source.name} grades`).entries()) {
    const where = `${source.name} grades[${gradeIndex}]`
    const weeksPerYear = requireInt(block.weeks_per_year, `${where}.weeks_per_year`)
    for (const grade of requireArray<number>(block.grades, `${where}.grades`)) {
      const phase = gradePhase(report, requireInt(grade, `${where}.grades`), block.phase, where)
      const local = (block.muatan_lokal ?? null) as Json | null
      if (local) {
        localContent[String(grade)] = {
          min_jp_per_year: local.intrakurikuler_min ?? null,
          max_jp_per_year: local.intrakurikuler_max ?? null,
          rule: typeof local.note === 'string' ? (notes[local.note] ?? null) : null,
        }
      }
      for (const [rowIndex, row] of requireArray(block.subjects, `${where}.subjects`).entries()) {
        const rowWhere = `${where}.subjects[${rowIndex}]`
        const subject = subjects.get(requireString(row.key, `${rowWhere}.key`), rowWhere)
        const status = statusByGroup[String(row.group)]
        if (!status) {
          throw new CurriculumImportError(`${rowWhere}: unknown group "${row.group}"`)
        }
        const intra = requireInt(row.intrakurikuler, `${rowWhere}.intrakurikuler`)
        const cocurricular = requireInt(row.kokurikuler ?? 0, `${rowWhere}.kokurikuler`)
        const printedPerWeek = row.intrakurikuler_per_week
        if (typeof printedPerWeek === 'number' && printedPerWeek * weeksPerYear !== intra) {
          report.mismatch(
            'jp_per_week_printed',
            `${subject.code} grade ${grade}: ${printedPerWeek} JP a week × ${weeksPerYear} ≠ ${intra}`
          )
        }
        const basis = typeof row.note === 'string' ? (notes[row.note] ?? null) : null
        const meta = { source_table: (block.source as Json | undefined)?.table ?? null }
        pending.push({
          subjectId: subject.id,
          subjectCode: subject.code,
          grade,
          phase,
          learningType: 'intracurricular',
          status,
          jpPerYear: intra,
          weeksPerYear,
          basis,
          meta,
        })
        if (cocurricular > 0) {
          pending.push({
            subjectId: subject.id,
            subjectCode: subject.code,
            grade,
            phase,
            learningType: 'cocurricular',
            status,
            jpPerYear: cocurricular,
            weeksPerYear,
            basis: null,
            meta,
          })
        }
      }
    }
  }

  const sourceInfo = (data.source ?? {}) as Json
  const versionId = await ensureVersion(trx, report, {
    code: versionCode,
    kind: 'structure',
    name: requireString(sourceInfo.title ?? versionCode, `${source.name} source.title`),
    file: source.name,
    fileMeta: {
      sha256: source.sha256,
      dataset: String(data.dataset),
      source: {
        issued_on: sourceInfo.issued_on,
        file: sourceInfo.file,
        section: sourceInfo.section,
      },
      local_content: localContent,
    },
  })

  await writeAllocations(
    trx,
    report,
    versionId,
    pending.map((input) => yearlyRow(report, { ...input, versionId }))
  )
}
