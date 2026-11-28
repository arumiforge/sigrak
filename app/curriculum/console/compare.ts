import db from '@adonisjs/lucid/services/db'
import type { Phase } from '../types.js'

/**
 * Compares two curriculum versions of the same kind (R2-08, D-317):
 * what was added, removed or changed in JP allocations, CP elements,
 * CP, topics and TP, grouped per subject and grade (CP per phase).
 *
 * Rows are matched by code with the version code taken off the front
 * (`SIGRAK-SD-2026-R1-PP-K1-01` and `SIGRAK-SD-2027-R1-PP-K1-01` are
 * the same topic), allocations by subject, grade, learning type and art
 * branch, CP elements by their code within the subject.
 */

export type ChangeKind = 'added' | 'removed' | 'changed'
export type CompareArea = 'allocation' | 'element' | 'outcome' | 'topic' | 'objective'

export interface FieldChange {
  field: string
  before: string | number | null
  after: string | number | null
}

export interface Change {
  area: CompareArea
  kind: ChangeKind
  /** The matching key, shown as a small code. */
  key: string
  /** The row's name or text (the new one, or the old one when removed). */
  label: string
  /** For a removed or added row, nothing; for a changed row, each field. */
  fields: FieldChange[]
}

export interface CompareGroup {
  subjectCode: string
  /** A grade (1–6), or null for CP rows (per phase) and CP elements. */
  grade: number | null
  phase: Phase | null
  changes: Change[]
  /** JP per year for the subject and grade, when either side has an allocation. */
  jp: { before: number | null; after: number | null } | null
  /** Sum of the topics' JP, for topic versions. */
  topicJp: { before: number; after: number } | null
}

export interface SubjectSummary {
  code: string
  name: string
  added: number
  removed: number
  changed: number
  /** JP per year over every grade, before and after. */
  jpBefore: number
  jpAfter: number
  /** Whether the subject is in both versions or only in one of them. */
  presence: 'both' | 'base' | 'target'
}

export interface Comparison {
  summary: Record<CompareArea, Record<ChangeKind, number>>
  subjects: SubjectSummary[]
  /** Only for the selected subject (the page shows one subject at a time). */
  groups: CompareGroup[]
}

interface VersionRef {
  id: number
  code: string
}

type Row = Record<string, unknown> & { subject_code: string }

const AREAS: CompareArea[] = ['allocation', 'element', 'outcome', 'topic', 'objective']

const stripCode = (version: VersionRef, code: string) =>
  code.startsWith(`${version.code}-`) ? code.slice(version.code.length + 1) : code

const text = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  return JSON.stringify(value)
}

function fieldChanges(before: Row, after: Row, fields: string[]): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of fields) {
    const a = text(before[field])
    const b = text(after[field])
    if (a !== b) changes.push({ field, before: a, after: b })
  }
  return changes
}

/* ----------------------------------------------------------------------
 * Loading
 * -------------------------------------------------------------------- */

async function allocations(versionId: number) {
  return (await db
    .from('subject_allocations as a')
    .join('subjects as s', 's.id', 'a.subject_id')
    .where('a.curriculum_version_id', versionId)
    .select(
      's.code as subject_code',
      'a.grade',
      'a.learning_type',
      'a.art_branch',
      'a.status',
      'a.jp_target_set_by',
      'a.jp_per_week',
      'a.jp_per_year',
      'a.s1_jp',
      'a.s2_jp'
    )) as Row[]
}

async function elements(versionId: number) {
  return (await db
    .from('learning_outcome_elements as e')
    .join('subjects as s', 's.id', 'e.subject_id')
    .where('e.curriculum_version_id', versionId)
    .select('s.code as subject_code', 'e.code', 'e.name', 'e.phases', 'e.art_branch')) as Row[]
}

async function outcomes(versionId: number) {
  return (await db
    .from('learning_outcomes as o')
    .join('subjects as s', 's.id', 'o.subject_id')
    .where('o.curriculum_version_id', versionId)
    .select(
      's.code as subject_code',
      'o.code',
      'o.phase',
      'o.art_branch',
      'o.element_code',
      'o.element',
      'o.text'
    )) as Row[]
}

async function topics(versionId: number) {
  return (await db
    .from('topics as t')
    .join('subjects as s', 's.id', 't.subject_id')
    .where('t.curriculum_version_id', versionId)
    .select(
      's.code as subject_code',
      't.code',
      't.grade',
      't.semester',
      't.art_branch',
      't.order_in_semester',
      't.title',
      't.elements',
      't.jp_total',
      't.week_start',
      't.week_end'
    )) as Row[]
}

async function objectives(versionId: number) {
  return (await db
    .from('learning_objectives as o')
    .join('topics as t', 't.id', 'o.topic_id')
    .join('subjects as s', 's.id', 't.subject_id')
    .where('t.curriculum_version_id', versionId)
    .select('s.code as subject_code', 'o.code', 't.grade', 'o.text')) as Row[]
}

/* ----------------------------------------------------------------------
 * Matching
 * -------------------------------------------------------------------- */

interface AreaSpec {
  area: CompareArea
  load: (versionId: number) => Promise<Row[]>
  key: (version: VersionRef, row: Row) => string
  label: (row: Row) => string
  grade: (row: Row) => number | null
  phase: (row: Row) => Phase | null
  fields: string[]
}

const allocationKey = (row: Row) =>
  [row.subject_code, row.grade, row.learning_type, row.art_branch ?? ''].join('|')

const SPECS: AreaSpec[] = [
  {
    area: 'allocation',
    load: allocations,
    key: (_version, row) => allocationKey(row),
    // `intracurricular` or `intracurricular|music`: the page words both parts.
    label: (row) => [row.learning_type, row.art_branch].filter(Boolean).join('|'),
    grade: (row) => Number(row.grade),
    phase: () => null,
    fields: ['jp_per_week', 'jp_per_year', 's1_jp', 's2_jp', 'status', 'jp_target_set_by'],
  },
  {
    area: 'element',
    load: elements,
    key: (_version, row) => `${row.subject_code}|${row.code}`,
    label: (row) => String(row.name),
    grade: () => null,
    phase: () => null,
    fields: ['name', 'phases'],
  },
  {
    area: 'outcome',
    load: outcomes,
    key: (version, row) => stripCode(version, String(row.code)),
    label: (row) => String(row.text),
    grade: () => null,
    phase: (row) => row.phase as Phase,
    fields: ['phase', 'element_code', 'element', 'text'],
  },
  {
    area: 'topic',
    load: topics,
    key: (version, row) => stripCode(version, String(row.code)),
    label: (row) => String(row.title),
    grade: (row) => Number(row.grade),
    phase: () => null,
    fields: [
      'title',
      'semester',
      'order_in_semester',
      'elements',
      'jp_total',
      'week_start',
      'week_end',
    ],
  },
  {
    area: 'objective',
    load: objectives,
    key: (version, row) => stripCode(version, String(row.code)),
    label: (row) => String(row.text),
    grade: (row) => Number(row.grade),
    phase: () => null,
    fields: ['text'],
  },
]

interface Located extends Change {
  subjectCode: string
  grade: number | null
  phase: Phase | null
}

function diffArea(
  spec: AreaSpec,
  base: VersionRef,
  baseRows: Row[],
  target: VersionRef,
  targetRows: Row[]
) {
  const before = new Map(baseRows.map((row) => [spec.key(base, row), row]))
  const after = new Map(targetRows.map((row) => [spec.key(target, row), row]))
  const changes: Located[] = []
  const place = (row: Row) => ({
    subjectCode: row.subject_code,
    grade: spec.grade(row),
    phase: spec.phase(row),
  })
  for (const [key, row] of after) {
    const old = before.get(key)
    if (!old) {
      changes.push({
        area: spec.area,
        kind: 'added',
        key,
        label: spec.label(row),
        fields: [],
        ...place(row),
      })
      continue
    }
    const fields = fieldChanges(old, row, spec.fields)
    if (fields.length > 0) {
      changes.push({
        area: spec.area,
        kind: 'changed',
        key,
        label: spec.label(row),
        fields,
        ...place(row),
      })
    }
  }
  for (const [key, row] of before) {
    if (!after.has(key)) {
      changes.push({
        area: spec.area,
        kind: 'removed',
        key,
        label: spec.label(row),
        fields: [],
        ...place(row),
      })
    }
  }
  return changes
}

/* ----------------------------------------------------------------------
 * The comparison
 * -------------------------------------------------------------------- */

function jpByGrade(rows: Row[]) {
  const jp = new Map<string, number>()
  for (const row of rows) {
    if (row.learning_type !== 'intracurricular') continue
    // One art branch per pupil (D-458): count a subject's grade once.
    const key = `${row.subject_code}|${row.grade}`
    jp.set(key, Math.max(jp.get(key) ?? 0, Number(row.jp_per_year)))
  }
  return jp
}

function topicJpByGrade(rows: Row[]) {
  const jp = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.subject_code}|${row.grade}`
    jp.set(key, (jp.get(key) ?? 0) + Number(row.jp_total))
  }
  return jp
}

const PHASE_ORDER: Record<string, number> = { A: 1, B: 3, C: 5 }

/**
 * Compares `target` (usually the draft) with `base` (usually the active
 * version it replaces). `subject` picks the subject whose groups are
 * returned; the summary always covers every subject.
 */
export async function compareVersions(
  base: VersionRef,
  target: VersionRef,
  subject: string | null
): Promise<Comparison> {
  // One query after another: callers may run inside a transaction (one connection).
  const loaded: { spec: AreaSpec; before: Row[]; after: Row[] }[] = []
  for (const spec of SPECS) {
    loaded.push({ spec, before: await spec.load(base.id), after: await spec.load(target.id) })
  }
  const changes = loaded.flatMap(({ spec, before, after }) =>
    diffArea(spec, base, before, target, after)
  )

  const summary = Object.fromEntries(
    AREAS.map((area) => [area, { added: 0, removed: 0, changed: 0 }])
  ) as Comparison['summary']
  for (const change of changes) summary[change.area][change.kind]++

  const allocationRows = loaded.find(({ spec }) => spec.area === 'allocation')!
  const topicRows = loaded.find(({ spec }) => spec.area === 'topic')!
  const jpBefore = jpByGrade(allocationRows.before)
  const jpAfter = jpByGrade(allocationRows.after)
  const topicBefore = topicJpByGrade(topicRows.before)
  const topicAfter = topicJpByGrade(topicRows.after)
  const hasTopics = topicRows.before.length > 0 || topicRows.after.length > 0

  // Every subject that appears on either side, with counts and yearly JP.
  const codes = new Set<string>()
  const inBase = new Set<string>()
  const inTarget = new Set<string>()
  for (const { before, after } of loaded) {
    for (const row of before) inBase.add(row.subject_code)
    for (const row of after) inTarget.add(row.subject_code)
  }
  for (const code of [...inBase, ...inTarget]) codes.add(code)
  const presenceOf = (code: string): SubjectSummary['presence'] =>
    inBase.has(code) && inTarget.has(code) ? 'both' : inBase.has(code) ? 'base' : 'target'
  const names = new Map(
    (
      (await db
        .from('subjects')
        .whereIn('code', codes.size > 0 ? [...codes] : [''])
        .select('code', 'name', 'sort_order')) as {
        code: string
        name: string
        sort_order: number
      }[]
    ).map((row) => [row.code, row])
  )
  const sumFor = (jp: Map<string, number>, code: string) =>
    [...jp].filter(([key]) => key.startsWith(`${code}|`)).reduce((sum, [, value]) => sum + value, 0)
  const subjects: SubjectSummary[] = [...codes]
    .map((code) => {
      const own = changes.filter((change) => change.subjectCode === code)
      return {
        code,
        name: names.get(code)?.name ?? code,
        added: own.filter((change) => change.kind === 'added').length,
        removed: own.filter((change) => change.kind === 'removed').length,
        changed: own.filter((change) => change.kind === 'changed').length,
        jpBefore: sumFor(jpBefore, code),
        jpAfter: sumFor(jpAfter, code),
        presence: presenceOf(code),
      }
    })
    .sort(
      (a, b) =>
        (names.get(a.code)?.sort_order ?? 999) - (names.get(b.code)?.sort_order ?? 999) ||
        a.code.localeCompare(b.code)
    )

  const groups = new Map<string, CompareGroup>()
  const groupFor = (grade: number | null, phase: Phase | null) => {
    const key = `${grade ?? ''}|${phase ?? ''}`
    let group = groups.get(key)
    if (!group) {
      group = { subjectCode: subject!, grade, phase, changes: [], jp: null, topicJp: null }
      groups.set(key, group)
    }
    return group
  }
  if (subject) {
    // A subject in one version only is shown as a whole, not row by row.
    const listRows = presenceOf(subject) === 'both'
    for (const change of changes) {
      if (!listRows || change.subjectCode !== subject) continue
      const { area, kind, key, label, fields } = change
      groupFor(change.grade, change.phase).changes.push({ area, kind, key, label, fields })
    }
    // JP lines for every grade of the subject, changed or not, so the page shows the totals.
    const grades = new Set<number>()
    for (const key of [
      ...jpBefore.keys(),
      ...jpAfter.keys(),
      ...topicBefore.keys(),
      ...topicAfter.keys(),
    ]) {
      const [code, grade] = key.split('|')
      if (code === subject) grades.add(Number(grade))
    }
    for (const grade of grades) {
      const key = `${subject}|${grade}`
      const group = groupFor(grade, null)
      if (jpBefore.has(key) || jpAfter.has(key)) {
        group.jp = { before: jpBefore.get(key) ?? null, after: jpAfter.get(key) ?? null }
      }
      if (hasTopics) {
        group.topicJp = { before: topicBefore.get(key) ?? 0, after: topicAfter.get(key) ?? 0 }
      }
    }
  }

  const order = (group: CompareGroup) =>
    group.grade !== null ? group.grade : group.phase ? PHASE_ORDER[group.phase] - 0.5 : 0
  const kindOrder: Record<ChangeKind, number> = { added: 0, changed: 1, removed: 2 }
  const areaOrder = Object.fromEntries(AREAS.map((area, index) => [area, index]))
  const sorted = [...groups.values()].sort((a, b) => order(a) - order(b))
  for (const group of sorted) {
    group.changes.sort(
      (a, b) =>
        areaOrder[a.area] - areaOrder[b.area] ||
        kindOrder[a.kind] - kindOrder[b.kind] ||
        a.key.localeCompare(b.key, 'id', { numeric: true })
    )
  }

  return { summary, subjects, groups: sorted }
}
