import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { FileReport } from './report.js'
import type { VersionFileMeta, VersionMeta } from '../models/curriculum_version.js'
import type { VersionKind } from '../types.js'

/**
 * An invalid file: the import writes nothing from it (D-229).
 */
export class CurriculumImportError extends Error {}

export type Json = Record<string, unknown>

/**
 * One source file, read and parsed.
 */
export interface SourceFile {
  /** Path relative to the app root, as stored in `meta.files`. */
  name: string
  sha256: string
  data: Json
}

export interface SubjectRef {
  id: number
  code: string
  name: string
  kind: string
  religion: string | null
  schoolLevel: string
}

/**
 * Finds a subject by code, alias, or snake_case name (`sejarah_kebudayaan_islam`).
 */
export class SubjectLookup {
  #byKey = new Map<string, SubjectRef>()
  readonly all: SubjectRef[]

  constructor(rows: (SubjectRef & { aliases: string[] })[]) {
    this.all = rows
    for (const row of rows) this.#byKey.set(snakeCase(row.name), row)
    for (const row of rows) for (const alias of row.aliases) this.#byKey.set(alias, row)
    for (const row of rows) this.#byKey.set(row.code, row)
  }

  static async load(trx: TransactionClientContract) {
    const rows = (await trx
      .from('subjects')
      .select('id', 'code', 'name', 'kind', 'religion', 'school_level', 'aliases')
      .orderBy('sort_order')) as {
      id: number
      code: string
      name: string
      kind: string
      religion: string | null
      school_level: string
      aliases: string[]
    }[]
    return new SubjectLookup(
      rows.map((row) => ({ ...row, schoolLevel: row.school_level, aliases: row.aliases ?? [] }))
    )
  }

  find(key: string): SubjectRef | undefined {
    return this.#byKey.get(key)
  }

  /**
   * A subject the file needs; an unknown one makes the file invalid.
   */
  get(key: string, where: string): SubjectRef {
    const subject = this.find(key)
    if (!subject) {
      throw new CurriculumImportError(
        `${where}: unknown subject "${key}". Import subjects.json first, or add the code or alias there.`
      )
    }
    return subject
  }
}

export function snakeCase(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Stable JSON for comparing values regardless of key order.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Json)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/**
 * Creates the version if it does not exist yet (status `draft`, name
 * from the file that creates it) and records the file in `meta.files`.
 * An existing version keeps its name and status (D-229).
 */
export async function ensureVersion(
  trx: TransactionClientContract,
  report: FileReport,
  input: { code: string; kind: VersionKind; name: string; file: string; fileMeta: VersionFileMeta }
): Promise<number> {
  report.versionCode = input.code
  const existing = (await trx
    .from('curriculum_versions')
    .where('code', input.code)
    .forUpdate()
    .first()) as { id: number; kind: string; meta: VersionMeta } | null

  if (!existing) {
    const meta: VersionMeta = { files: { [input.file]: input.fileMeta } }
    const [row] = (await trx
      .table('curriculum_versions')
      .insert({
        code: input.code,
        kind: input.kind,
        name: input.name,
        status: 'draft',
        meta: JSON.stringify(meta),
        created_at: trx.raw('now()'),
        updated_at: trx.raw('now()'),
      })
      .returning('id')) as { id: number }[]
    report.versionCreated = true
    report.count('curriculum_versions', { created: 1, updated: 0, unchanged: 0 })
    return row.id
  }

  if (existing.kind !== input.kind) {
    throw new CurriculumImportError(
      `${input.file}: version ${input.code} exists as kind "${existing.kind}", the file gives "${input.kind}"`
    )
  }

  const meta: VersionMeta = { ...existing.meta, files: { ...existing.meta.files } }
  meta.files![input.file] = input.fileMeta
  if (canonicalJson(meta) === canonicalJson(existing.meta)) {
    report.count('curriculum_versions', { created: 0, updated: 0, unchanged: 1 })
  } else {
    await trx
      .from('curriculum_versions')
      .where('id', existing.id)
      .update({ meta: JSON.stringify(meta), updated_at: trx.raw('now()') })
    report.count('curriculum_versions', { created: 0, updated: 1, unchanged: 0 })
  }
  return existing.id
}

/**
 * Codes the database holds for a scope but the file does not list: kept
 * and reported (D-229).
 */
export function reportMissing(
  report: FileReport,
  kind: string,
  label: string,
  inDatabase: string[],
  inFile: Set<string>
) {
  for (const code of inDatabase) {
    if (!inFile.has(code)) {
      report.missingRow(kind, `${label} ${code} is in the database but not in the file; kept`, code)
    }
  }
}

/**
 * Throws when a code appears twice in one file.
 */
export function assertUnique(codes: string[], what: string, file: string) {
  const seen = new Set<string>()
  for (const code of codes) {
    if (seen.has(code))
      throw new CurriculumImportError(`${file}: ${what} code ${code} appears twice`)
    seen.add(code)
  }
}

// Small typed readers for the parsed JSON. They throw CurriculumImportError
// so a malformed file writes nothing.

export function requireString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CurriculumImportError(`${where}: expected a non-empty string`)
  }
  return value
}

export function optionalString(value: unknown, where: string): string | null {
  if (value === undefined || value === null) return null
  return requireString(value, where)
}

export function requireInt(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new CurriculumImportError(
      `${where}: expected a whole number, got ${JSON.stringify(value)}`
    )
  }
  return value
}

export function requireArray<T = Json>(value: unknown, where: string): T[] {
  if (!Array.isArray(value)) throw new CurriculumImportError(`${where}: expected a list`)
  return value as T[]
}

export function requireOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  where: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new CurriculumImportError(
      `${where}: expected one of ${allowed.join(', ')}, got ${JSON.stringify(value)}`
    )
  }
  return value as T
}

export function pad2(value: number) {
  return String(value).padStart(2, '0')
}
