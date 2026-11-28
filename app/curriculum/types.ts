/**
 * Fixed sets of the curriculum module, mirrored by CHECK constraints in
 * the 17643100… migrations (data model: Conventions).
 */

export const versionKinds = ['structure', 'cp', 'topics'] as const
export type VersionKind = (typeof versionKinds)[number]

export const versionStatuses = ['draft', 'active', 'retired'] as const
export type VersionStatus = (typeof versionStatuses)[number]

export const subjectKinds = ['compulsory', 'elective', 'local_content', 'cocurricular'] as const
export type SubjectKind = (typeof subjectKinds)[number]

export const defaultTeachers = ['class_teacher', 'subject_teacher'] as const
export type DefaultTeacher = (typeof defaultTeachers)[number]

export const religions = ['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'khonghucu'] as const
export type Religion = (typeof religions)[number]

export const subjectSchoolLevels = ['sd', 'mi', 'both'] as const
export type SubjectSchoolLevel = (typeof subjectSchoolLevels)[number]

export const phases = ['A', 'B', 'C'] as const
export type Phase = (typeof phases)[number]

export const learningTypes = ['intracurricular', 'cocurricular'] as const
export type LearningType = (typeof learningTypes)[number]

export const allocationStatuses = ['compulsory', 'optional', 'elective'] as const
export type AllocationStatus = (typeof allocationStatuses)[number]

export const jpTargetSetters = ['curriculum', 'school'] as const
export type JpTargetSetter = (typeof jpTargetSetters)[number]

/**
 * Seni dan Budaya branches (Permendikdasmen 13/2025 Tabel 1–5 note b,
 * D-458). The data files name them in Indonesian; the database stores
 * the English code.
 */
export const artBranches = ['music', 'visual_art', 'dance', 'theatre'] as const
export type ArtBranch = (typeof artBranches)[number]

export const artBranchByLabel: Record<string, ArtBranch> = {
  'Seni Musik': 'music',
  'Seni Rupa': 'visual_art',
  'Seni Tari': 'dance',
  'Seni Teater': 'theatre',
}

/**
 * Grades of each phase in SD/MI.
 */
export const phaseGrades: Record<Phase, number[]> = {
  A: [1, 2],
  B: [3, 4],
  C: [5, 6],
}

export function phaseOfGrade(grade: number): Phase | undefined {
  return phases.find((phase) => phaseGrades[phase].includes(grade))
}
