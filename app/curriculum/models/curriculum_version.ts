import { CurriculumVersionSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { VersionKind, VersionStatus } from '../types.js'

export interface Curation {
  status: 'converted' | 'in_review' | 'curated'
  since?: string | null
  reviewed_by?: string | null
  reviewed_on?: string | null
  note?: string | null
}

/**
 * Per source file, what the import keeps in `meta.files` (D-229, D-364).
 */
export interface VersionFileMeta {
  sha256: string
  dataset: string
  subjects?: Record<string, { curation: Curation | null; cp_version_code?: string | null }>
  [key: string]: unknown
}

export interface VersionMeta {
  files?: Record<string, VersionFileMeta>
  [key: string]: unknown
}

/**
 * A curriculum data set: official structure, official CP, or SIGRAK
 * topics (D-355, D-363). A new version starts as `draft`; the import
 * never changes the status of an existing one (D-229).
 */
export default class CurriculumVersion extends CurriculumVersionSchema {
  declare kind: VersionKind
  declare status: VersionStatus

  @column({ prepare: (value: VersionMeta) => JSON.stringify(value) })
  declare meta: VersionMeta

  /** bigint[] arrives from pg as strings; ids are far below 2^53. */
  @column({ consume: (value: (string | number)[] | null) => (value ?? []).map(Number) })
  declare importedByIds: number[]

  /**
   * Subjects whose curation status is `curated` in the version's files:
   * only these are active for teachers (D-364, enforced from the content
   * core).
   */
  curatedSubjectCodes(): string[] {
    const codes = new Set<string>()
    for (const file of Object.values(this.meta.files ?? {})) {
      for (const [code, subject] of Object.entries(file.subjects ?? {})) {
        if (subject.curation?.status === 'curated') codes.add(code)
      }
    }
    return [...codes].sort()
  }
}
