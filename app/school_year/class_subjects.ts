import db from '@adonisjs/lucid/services/db'
import { SubjectsForGrade, type GradeSubject } from '../curriculum/subjects_for_grade.js'
import type { PolicyProfile, ResolveInput } from '../curriculum/policy/policy_profile_resolver.js'
import { PolicyProfileResolver } from '../curriculum/policy/policy_profile_resolver.js'
import type { ArtBranch } from '../curriculum/types.js'

/**
 * The subjects a class takes (D-230), for default teaching assignments
 * and the Kelas page.
 *
 * Today this is the national list from `SubjectsForGrade.forLevel()`,
 * limited to the subjects every class of the grade takes
 * (`takenByDefault`). The region's local content (layer model, R1-07)
 * and the school's own switches (`school_subjects`, R1-03 design) are
 * added here when they exist, so callers do not change.
 */

export interface SchoolPolicyInput {
  level: string
  regionProvince: string | null
}

/**
 * The school's level and province, the resolver's input besides the
 * school year. Schools and regions are not school-owned rows.
 */
export async function schoolPolicyInput(schoolId: number): Promise<SchoolPolicyInput> {
  const row = (await db
    .from('schools as s')
    .leftJoin('regions as r', 'r.id', 's.region_id')
    .leftJoin('regions as p', 'p.id', 'r.parent_id')
    .where('s.id', schoolId)
    .select('s.level', 'p.name as province')
    .firstOrFail()) as { level: string; province: string | null }
  return { level: row.level, regionProvince: row.province }
}

export interface ArtBranchOption {
  artBranch: ArtBranch
  /** False for Tari and Teater until SIGRAK adds topics (D-464). */
  hasTopics: boolean
}

export interface ClassSubjectList {
  policy: PolicyProfile
  subjects: GradeSubject[]
  /** Seni dan Budaya branches a class of this grade may pick (D-458). */
  artBranches: ArtBranchOption[]
}

export class ClassSubjects {
  constructor(
    private readonly subjectsForGrade = new SubjectsForGrade(),
    private readonly resolver = new PolicyProfileResolver()
  ) {}

  async forGrade(
    school: SchoolPolicyInput,
    schoolYear: string,
    grade: number
  ): Promise<ClassSubjectList> {
    const input: ResolveInput & { grade: number } = { ...school, schoolYear, grade }
    const { policy, subjects } = await this.subjectsForGrade.forLevel(input)
    const taken = subjects.filter((subject) => subject.takenByDefault)
    const artBranches = taken
      .flatMap((subject) => subject.artTracks)
      .map(({ artBranch, hasTopics }) => ({ artBranch, hasTopics }))
    return { policy, subjects: taken, artBranches }
  }

  /** The Profil Jenjang of the school for a school year (level terms, D-383). */
  async policy(school: SchoolPolicyInput, schoolYear: string) {
    return this.resolver.resolve({ ...school, schoolYear })
  }
}

/** The level term as the R1-02 helper takes it (D-383). */
export function levelTermsOf(policy: PolicyProfile) {
  return { homeroomTeacherTerm: policy.profile.data.homeroom_teacher_term }
}
