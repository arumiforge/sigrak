import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export interface WriteCounts {
  created: number
  updated: number
  unchanged: number
}

export function emptyCounts(): WriteCounts {
  return { created: 0, updated: 0, unchanged: 0 }
}

export function addCounts(target: WriteCounts, source: WriteCounts) {
  target.created += source.created
  target.updated += source.updated
  target.unchanged += source.unchanged
}

export type Row = Record<string, unknown>

interface UpsertOptions {
  /** Columns of the unique index rows are matched on, or a constraint name. */
  conflict: string[] | { constraint: string }
  /** Columns stored as jsonb (values are serialised; JS null is SQL NULL). */
  jsonColumns?: string[]
}

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`

/**
 * Inserts new rows and updates changed ones in one statement per chunk:
 * `INSERT … ON CONFLICT DO UPDATE … WHERE (old) IS DISTINCT FROM (new)`.
 * A row whose values are unchanged is not touched, so `updated_at`
 * stays and a second import reports nothing (D-229). Rows are never
 * deleted here.
 */
export async function upsertRows(
  trx: TransactionClientContract,
  table: string,
  rows: Row[],
  options: UpsertOptions
): Promise<WriteCounts> {
  const counts = emptyCounts()
  if (rows.length === 0) return counts

  const columns = Object.keys(rows[0])
  const jsonColumns = new Set(options.jsonColumns ?? [])
  const conflictColumns = Array.isArray(options.conflict) ? options.conflict : []
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column))

  const placeholders = `(${columns
    .map((column) => (jsonColumns.has(column) ? '?::jsonb' : '?'))
    .join(', ')}, now(), now())`
  const conflictTarget = Array.isArray(options.conflict)
    ? `(${options.conflict.map(quote).join(', ')})`
    : `ON CONSTRAINT ${quote(options.conflict.constraint)}`
  const assignments = updateColumns.map((column) => `${quote(column)} = EXCLUDED.${quote(column)}`)
  const oldValues = updateColumns.map((column) => `t.${quote(column)}`).join(', ')
  const newValues = updateColumns.map((column) => `EXCLUDED.${quote(column)}`).join(', ')

  // Stay well below PostgreSQL's 65,535 bind parameters per statement.
  const chunkSize = Math.max(1, Math.floor(20_000 / columns.length))
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    const bindings: (string | number | boolean | null)[] = []
    for (const row of chunk) {
      for (const column of columns) {
        const value = row[column]
        bindings.push(
          jsonColumns.has(column) && value !== null && value !== undefined
            ? JSON.stringify(value)
            : ((value ?? null) as string | number | boolean | null)
        )
      }
    }

    const sql = [
      `INSERT INTO ${quote(table)} AS t (${columns.map(quote).join(', ')}, "created_at", "updated_at")`,
      `VALUES ${chunk.map(() => placeholders).join(', ')}`,
      `ON CONFLICT ${conflictTarget} DO UPDATE SET ${[...assignments, '"updated_at" = now()'].join(', ')}`,
      updateColumns.length > 0 ? `WHERE (${oldValues}) IS DISTINCT FROM (${newValues})` : '',
      'RETURNING (xmax = 0) AS inserted',
    ].join(' ')

    const result = await trx.rawQuery(sql, bindings as never)
    const returned = result.rows as { inserted: boolean }[]
    const created = returned.filter((row) => row.inserted).length
    counts.created += created
    counts.updated += returned.length - created
    counts.unchanged += chunk.length - returned.length
  }
  return counts
}

/**
 * `code → id` for the given codes of a table.
 */
export async function idsByCode(
  trx: TransactionClientContract,
  table: string,
  codes: string[],
  where: Row = {}
): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  const chunkSize = 5_000
  for (let start = 0; start < codes.length; start += chunkSize) {
    const rows = (await trx
      .from(table)
      .where(where)
      .whereIn('code', codes.slice(start, start + chunkSize))
      .select('id', 'code')) as { id: number; code: string }[]
    for (const row of rows) ids.set(row.code, row.id)
  }
  return ids
}
