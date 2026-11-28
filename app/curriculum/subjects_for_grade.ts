import db from '@adonisjs/lucid/services/db'
import { compareSchoolYears } from './school_year.js'
import {
  PolicyProfileResolver,
  type PolicyProfile,
  type ResolveInput,
} from './policy/policy_profile_resolver.js'
import type { SubjectDelivery, SubjectTransition } from './models/subject.js'
import { artBranches } from './types.js'
import type {
  AllocationStatus,
  ArtBranch,
  DefaultTeacher,
  JpTargetSetter,
  Religion,
  SubjectKind,
} from './types.js'

/**
 * - `compulsory`: every class of the grade takes it (religion subjects:
 *   each pupil takes their own religion's subject).
 * - `elective`: a mata pelajaran pilihan the school may offer (KKA,
 *   D-452; Bahasa Inggris grades 3–6 until 2026/2027, D-410).
 * - `optional`: SIGRAK content a school switches on, off by default (D-204).
 * - `local_content`: muatan lokal; on where the region or the school says so.
 */
export type GradeSubjectStatus = 'compulsory' | 'elective' | 'optional' | 'local_content'

export interface ArtTrack {
  artBranch: ArtBranch
  jpPerYear: number
  s1Jp: number
  s2Jp: number
  /** Tari and Teater have no SIGRAK topics yet; the school may still pick them (D-464). */
  hasTopics: boolean
}

export interface GradeSubject {
  subjectId: number
  code: string
  name: string
  kind: SubjectKind
  defaultTeacher: DefaultTeacher
  religion: Religion | null
  status: GradeSubjectStatus
  takenByDefault: boolean
  /** A condition the regulation puts on an elective (`school_readiness`). */
  condition: string | null
  jpPerWeek: number | null
  jpPerYear: number | null
  cocurricularJpPerYear: number
  /** `school` = SIGRAK's JP is only a suggestion; the school sets it (D-458). */
  jpTargetSetBy: JpTargetSetter
  delivery: SubjectDelivery | null
  artTracks: ArtTrack[]
}

interface AllocationRow {
  curriculum_version_id: number
  subject_id: number
  learning_type: 'intracurricular' | 'cocurricular'
  art_branch: ArtBranch | null
  status: AllocationStatus
  jp_target_set_by: JpTargetSetter
  jp_per_week: number
  jp_per_year: number
  s1_jp: number
  s2_jp: number
  code: string
  name: string
  kind: SubjectKind
  default_teacher: DefaultTeacher
  religion: Religion | null
  transition: SubjectTransition | null
  offered_grades: number[] | null
  delivery: SubjectDelivery | null
  sort_order: number
}

/**
 * Status of a subject phased in by regulation, for one school year,
 * level and grade (`subjects.transition`, D-410); undefined when the
 * transition does not cover them.
 */
export function transitionStatus(
  transition: SubjectTransition | null,
  level: string,
  grade: number,
  schoolYear: string
) {
  if (!transition || !transition.levels.includes(level) || !transition.grades.includes(grade)) {
    return undefined
  }
  return transition.periods.find(
    (period) =>
      (!period.until_school_year ||
        compareSchoolYears(schoolYear, period.until_school_year) <= 0) &&
      (!period.from_school_year || compareSchoolYears(schoolYear, period.from_school_year) >= 0)
  )
}

/**
 * The subjects of a grade at a level for a school year, at national
 * level (D-230): the structure version's subjects (status by school
 * year for phased-in subjects), then the SIGRAK version's optional and
 * local content, with the Seni dan Budaya branch tracks. The region's
 * local content (layer model, R1-07) and the school's own switches
 * (`school_subjects`, after R1-01) are applied on top of this list.
 */
export class SubjectsForGrade {
  constructor(private readonly resolver = new PolicyProfileResolver()) {}

  async forLevel(
    input: ResolveInput & { grade: number }
  ): Promise<{ policy: PolicyProfile; subjects: GradeSubject[] }> {
    const policy = await this.resolver.resolve(input)
    const structureIds = (policy.ruleSets.structure_jp ?? []).flatMap((r) => r.versionId ?? [])
    const topicIds = (policy.ruleSets.tp_atp_defaults ?? []).flatMap((r) => r.versionId ?? [])
    const versionIds = [...structureIds, ...topicIds]
    if (versionIds.length === 0) return { policy, subjects: [] }

    const rows = (await db
      .from('subject_allocations as a')
      .join('subjects as s', 's.id', 'a.subject_id')
      .whereIn('a.curriculum_version_id', versionIds)
      .where('a.grade', input.grade)
      .select(
        'a.curriculum_version_id',
        'a.subject_id',
        'a.learning_type',
        'a.art_branch',
        'a.status',
        'a.jp_target_set_by',
        'a.jp_per_week',
        'a.jp_per_year',
        'a.s1_jp',
        'a.s2_jp',
        's.code',
        's.name',
        's.kind',
        's.default_teacher',
        's.religion',
        's.transition',
        's.offered_grades',
        's.delivery',
        's.sort_order'
      )) as AllocationRow[]

    const topicCounts = new Map<string, number>()
    if (topicIds.length > 0) {
      const counts = (await db
        .from('topics')
        .whereIn('curriculum_version_id', topicIds)
        .where('grade', input.grade)
        .groupBy('subject_id', 'art_branch')
        .select('subject_id', 'art_branch')
        .count('* as total')) as { subject_id: number; art_branch: string | null; total: string }[]
      for (const row of counts) {
        topicCounts.set(`${row.subject_id}|${row.art_branch ?? ''}`, Number(row.total))
      }
    }

    const bySubject = new Map<number, { structure: AllocationRow[]; sigrak: AllocationRow[] }>()
    for (const row of rows) {
      if (row.offered_grades && !row.offered_grades.includes(input.grade)) continue
      if (!bySubject.has(row.subject_id))
        bySubject.set(row.subject_id, { structure: [], sigrak: [] })
      const group = bySubject.get(row.subject_id)!
      ;(structureIds.includes(row.curriculum_version_id) ? group.structure : group.sigrak).push(row)
    }

    const subjects: (GradeSubject & { sortOrder: number })[] = []
    for (const [subjectId, { structure, sigrak }] of bySubject) {
      const intra = structure.find((row) => row.learning_type === 'intracurricular')
      const cocurricular = structure.find((row) => row.learning_type === 'cocurricular')
      const plain = sigrak.find(
        (row) => row.art_branch === null && row.learning_type === 'intracurricular'
      )
      const base = intra ?? plain ?? sigrak[0]
      if (!base) continue

      let status: GradeSubjectStatus
      let condition: string | null = null
      if (intra) {
        status = intra.status === 'elective' ? 'elective' : 'compulsory'
        const period = transitionStatus(base.transition, input.level, input.grade, input.schoolYear)
        if (period) {
          status = period.status
          condition = period.condition ?? null
        }
      } else if (base.status === 'optional') {
        // SIGRAK content a school switches on, off by default (Bahasa Inggris
        // grades 1–2, Tata Boga; D-204). `kind` still says local_content.
        status = 'optional'
      } else if (base.kind === 'local_content') {
        status = 'local_content'
      } else if (base.status === 'elective') {
        status = 'elective'
      } else {
        status = 'optional'
      }

      const artTracks: ArtTrack[] = sigrak
        .filter((row) => row.art_branch !== null)
        .map((row) => ({
          artBranch: row.art_branch!,
          jpPerYear: row.jp_per_year,
          s1Jp: row.s1_jp,
          s2Jp: row.s2_jp,
          hasTopics: (topicCounts.get(`${subjectId}|${row.art_branch}`) ?? 0) > 0,
        }))
        .sort((a, b) => artBranches.indexOf(a.artBranch) - artBranches.indexOf(b.artBranch))

      subjects.push({
        subjectId,
        code: base.code,
        name: base.name,
        kind: base.kind,
        defaultTeacher: base.default_teacher,
        religion: base.religion,
        status,
        takenByDefault: status === 'compulsory',
        condition,
        jpPerWeek: (intra ?? plain)?.jp_per_week ?? null,
        jpPerYear: (intra ?? plain)?.jp_per_year ?? null,
        cocurricularJpPerYear: cocurricular?.jp_per_year ?? 0,
        jpTargetSetBy: intra ? 'curriculum' : (plain?.jp_target_set_by ?? 'curriculum'),
        delivery: base.delivery,
        artTracks,
        sortOrder: base.sort_order,
      })
    }

    return {
      policy,
      subjects: subjects
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ sortOrder: _sortOrder, ...subject }) => subject),
    }
  }
}
