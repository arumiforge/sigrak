import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Small curriculum files for the import tests, written to a temporary
 * folder so a test can change one value and import again.
 */
export async function tempDir(prefix: string) {
  return mkdtemp(join(tmpdir(), `sigrak-${prefix}-`))
}

export async function writeJson(directory: string, name: string, data: unknown) {
  const path = join(directory, name)
  await writeFile(path, JSON.stringify(data, null, 2))
  return path
}

function topic(code: string, semester: number, order: number, jp: number) {
  return {
    code,
    grade: 1,
    phase: 'A',
    semester,
    order_in_semester: order,
    element: 'Pancasila',
    element_codes: ['PP-E1'],
    title: `Topik ${code.slice(-2)}`,
    cp_summary: 'Ringkasan uji.',
    atp_code: `ATP-PP-K1-BAB-${String(order).padStart(2, '0')}`,
    jp_total: jp,
    jp_per_week: 2,
    week_start: 1,
    week_end: jp / 2,
    weekly_distribution: Array.from({ length: jp / 2 }, () => 2),
    learning_objectives: [
      { code: `${code}-TP01`, order: 1, text: 'Tujuan pertama.' },
      { code: `${code}-TP02`, order: 2, text: 'Tujuan kedua.' },
    ],
    focus_items: [
      {
        code: `${code}-FM01`,
        order: 1,
        title: 'Fokus pertama',
        estimated_jp: jp / 2,
        allocation_status: 'sesuai',
        objective_codes: [`${code}-TP01`],
      },
      {
        code: `${code}-FM02`,
        order: 2,
        title: 'Fokus kedua',
        estimated_jp: jp / 2,
        allocation_status: 'sesuai',
        objective_codes: [`${code}-TP02`],
      },
    ],
    references: { book: 'Buku uji' },
  }
}

/**
 * A SIGRAK topic file for one subject (PP grade 1) whose topics match
 * the semester targets: 8 JP in each semester.
 */
export function topicFile(versionCode = 'SIGRAK-UJI-2026-R1') {
  return {
    dataset: 'sigrak_curriculum_topics',
    version_code: versionCode,
    status: 'draft',
    scope: 'Data uji',
    subjects: [
      {
        code: 'PP',
        name: 'Pendidikan Pancasila',
        cp_version_code: 'CP-UMUM-SD-BSKAP-046-2025',
        curation: { status: 'curated', since: '2026-11-28' },
        allocations: [
          {
            grade: 1,
            phase: 'A',
            jp_per_week: 2,
            s1_jp: 8,
            s1_effective_weeks: 18,
            s2_jp: 8,
            s2_effective_weeks: 18,
          },
        ],
        topics: [
          topic(`${versionCode}-PP-K1-01`, 1, 1, 4),
          topic(`${versionCode}-PP-K1-02`, 1, 2, 4),
          topic(`${versionCode}-PP-K1-03`, 2, 1, 8),
        ],
      },
    ],
  }
}

export function ruleSet(code: string, appliesFrom: string, extra: Record<string, unknown> = {}) {
  return { code, effective_on: null, applies_from_school_year: appliesFrom, ...extra }
}

/**
 * A Profil Jenjang file with the given versions' rule sets.
 */
export function profileFile(
  level: string,
  versions: { code: string; appliesFrom: string; ruleSets: Record<string, unknown[]> }[]
) {
  return {
    dataset: 'level_profile',
    level,
    status: 'draft',
    versions: versions.map((version) => ({
      code: version.code,
      applies_from_school_year: version.appliesFrom,
      label: level.toUpperCase(),
      ministry: { code: 'uji', name: 'Kementerian Uji' },
      rule_sets: version.ruleSets,
      religion_subjects: 'six_religions',
      character_frameworks: ['dpl_8'],
      cocurricular_jp_source: 'all_compulsory_except_english',
      rpm_extra_fields: {},
      report_export_target: 'e_rapor_sd',
      homeroom_teacher_term: 'Guru kelas',
      homeroom_jtm_default: 2,
      external_assessments: [],
      calendar_source: 'provincial_kaldik',
      data_of_record: 'dapodik',
    })),
  }
}
