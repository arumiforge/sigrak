import type { ArtBranch } from '../curriculum/types.js'
import type AcademicYear from './models/academic_year.js'
import SchoolClass from './models/school_class.js'
import { previousYear, refuseClosed } from './academic_years.js'
import type { ClassSubjects, SchoolPolicyInput } from './class_subjects.js'
import { lockYear } from './classes.js'
import { SchoolYearRuleError } from './errors.js'

/**
 * Copy classes into a new academic year (D-242…D-246):
 *
 * - The source is the school's latest year that starts before the
 *   target; the target must have no classes (checked under a row lock).
 * - Each class below grade 6 moves up one grade (grade 6 graduates). A
 *   name that starts with its grade number follows it (`4A` → `5A`,
 *   `4-Umar` → `5-Umar`); other names stay (`Kelas Merah`).
 * - Optionally last year's grade 1 classes are made again with the same
 *   names, for the new intake (on by default in the form).
 * - When a name would clash, the later class gets its grade added
 *   (`Kelas Merah 5`), cut to 20 characters.
 * - No homeroom teacher and no teaching assignments (D-242); the Seni
 *   dan Budaya branch is kept where the new grade offers it.
 */

export const MAX_CLASS_NAME = 20

export interface CopySource {
  name: string
  grade: number
  artBranch: ArtBranch | null
}

export interface CopyPlanRow extends CopySource {
  sourceName: string
}

/** `4A` in grade 4 → `5A`; `Kelas Merah` stays (D-245). */
export function movedUpName(name: string, grade: number) {
  const match = new RegExp(`^${grade}(?!\\d)`).exec(name)
  return match ? `${grade + 1}${name.slice(match[0].length)}` : name
}

function withSuffix(name: string, suffix: string) {
  return `${name.slice(0, MAX_CLASS_NAME - suffix.length).trimEnd()}${suffix}`
}

function byGradeAndName(a: CopySource, b: CopySource) {
  return a.grade - b.grade || a.name.localeCompare(b.name, 'id-ID', { numeric: true })
}

/**
 * The classes a copy makes, in order: moved-up classes by grade and
 * name, then the new grade 1 classes.
 */
export function planCopy(source: CopySource[], includeGradeOne: boolean): CopyPlanRow[] {
  const sorted = [...source].sort(byGradeAndName)
  const wanted: CopyPlanRow[] = [
    ...sorted
      .filter((row) => row.grade < 6)
      .map((row) => ({
        name: movedUpName(row.name, row.grade),
        grade: row.grade + 1,
        artBranch: row.artBranch,
        sourceName: row.name,
      })),
    ...(includeGradeOne
      ? sorted.filter((row) => row.grade === 1).map((row) => ({ ...row, sourceName: row.name }))
      : []),
  ]

  const used = new Set<string>()
  return wanted.map((row) => {
    let name = row.name
    for (let attempt = 1; used.has(name.toLocaleLowerCase('id-ID')); attempt++) {
      const suffix = attempt === 1 ? ` ${row.grade}` : ` ${row.grade}-${attempt}`
      name = withSuffix(row.name, suffix)
    }
    used.add(name.toLocaleLowerCase('id-ID'))
    return { ...row, name }
  })
}

export async function sourceClassesOf(year: AcademicYear): Promise<CopySource[]> {
  const classes = await SchoolClass.query().where('academic_year_id', year.id)
  return classes.map(({ name, grade, artBranch }) => ({ name, grade, artBranch }))
}

/**
 * Copies the previous year's classes into `target`; returns the number
 * of classes made.
 */
export async function copyClasses(
  deps: { classSubjects: ClassSubjects; school: SchoolPolicyInput },
  target: AcademicYear,
  includeGradeOne: boolean
) {
  refuseClosed(target)
  await lockYear(target)
  const hasClasses = await SchoolClass.query().where('academic_year_id', target.id).first()
  if (hasClasses) {
    throw new SchoolYearRuleError(null, 'classes.errors.copy_target_not_empty', {
      year: target.name,
    })
  }
  const source = await previousYear(target)
  if (!source) throw new SchoolYearRuleError(null, 'classes.errors.copy_no_source')
  const plan = planCopy(await sourceClassesOf(source), includeGradeOne)
  if (plan.length === 0) {
    throw new SchoolYearRuleError(null, 'classes.errors.copy_nothing', { year: source.name })
  }

  const branchesByGrade = new Map<number, ArtBranch[]>()
  for (const grade of new Set(plan.map((row) => row.grade))) {
    const list = await deps.classSubjects.forGrade(deps.school, target.name, grade)
    branchesByGrade.set(
      grade,
      list.artBranches.map((option) => option.artBranch)
    )
  }

  await SchoolClass.createMany(
    plan.map((row) => ({
      academicYearId: target.id,
      name: row.name,
      grade: row.grade,
      artBranch:
        row.artBranch && branchesByGrade.get(row.grade)?.includes(row.artBranch)
          ? row.artBranch
          : null,
      homeroomTeacherId: null,
    }))
  )
  return { count: plan.length, source }
}
