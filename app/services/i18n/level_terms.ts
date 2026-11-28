/**
 * Level terms (D-383): the teacher who holds one class is "Guru kelas"
 * in SD and "Wali kelas" in MI. Copy never hard-codes either word; it
 * takes them as parameters, e.g. "Hubungi {homeroom_teacher_lower} Anda."
 *
 * The term belongs to the Profil Jenjang (`homeroom_teacher_term`,
 * D-356). Until the policy-profile resolver lands (R1-03) a caller may
 * pass the school's level code instead, and the term is read from
 * `common.terms.homeroom_teacher.<level>`. Code never branches on the
 * level itself.
 *
 * No imports, so the browser reuses this file (inertia/lib/level_terms.ts).
 */
export type SchoolLevel = 'sd' | 'mi'

/** What the resolver returns for a school's level profile (R1-03). */
export type LevelProfileTerms = { homeroomTeacherTerm: string }

export type LevelTermSource = SchoolLevel | LevelProfileTerms

export type LevelTermParams = {
  /** "Guru kelas" / "Wali kelas", for the start of a sentence or a label. */
  homeroom_teacher: string
  /** "guru kelas" / "wali kelas", for the middle of a sentence. */
  homeroom_teacher_lower: string
}

type Translate = (key: string) => string

function lowerFirst(text: string) {
  return text.charAt(0).toLocaleLowerCase('id-ID') + text.slice(1)
}

export function levelTermParams(translate: Translate, source: LevelTermSource): LevelTermParams {
  const term =
    typeof source === 'string'
      ? translate(`common.terms.homeroom_teacher.${source}`)
      : source.homeroomTeacherTerm
  return { homeroom_teacher: term, homeroom_teacher_lower: lowerFirst(term) }
}
