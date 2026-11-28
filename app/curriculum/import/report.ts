import { addCounts, emptyCounts, type WriteCounts } from './upsert.js'

/**
 * One line of the import report. `kind` is a stable key tests and
 * scripts can filter on; `message` is for the team (English).
 */
export interface Finding {
  kind: string
  code?: string
  message: string
}

/**
 * What one file did: rows written per table, data mismatches (stop the
 * file only with `--strict`), notes (expected gaps and information),
 * and rows the database has that the file no longer lists (kept, never
 * deleted, D-229).
 */
export class FileReport {
  versionCode: string | null = null
  versionCreated = false
  tables: Record<string, WriteCounts> = {}
  mismatches: Finding[] = []
  notes: Finding[] = []
  missing: Finding[] = []

  constructor(
    readonly file: string,
    readonly dataset: string
  ) {}

  count(table: string, counts: WriteCounts) {
    this.tables[table] ??= emptyCounts()
    addCounts(this.tables[table], counts)
  }

  mismatch(kind: string, message: string, code?: string) {
    this.mismatches.push({ kind, message, code })
  }

  note(kind: string, message: string, code?: string) {
    this.notes.push({ kind, message, code })
  }

  missingRow(kind: string, message: string, code?: string) {
    this.missing.push({ kind, message, code })
  }

  /** Total rows created or updated across tables. */
  get changes() {
    return Object.values(this.tables).reduce((sum, row) => sum + row.created + row.updated, 0)
  }
}

export interface ImportReport {
  files: FileReport[]
  profiles: FileReport | null
  failed: { file: string; error: string } | null
}
