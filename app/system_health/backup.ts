import { readFile as nodeReadFile, stat as nodeStat } from 'node:fs/promises'

/**
 * The last successful backup (D-316, D-430). The backup job (R3) writes
 * a marker file after each success; this only reads it. The marker is
 * JSON `{ "finishedAt": "<ISO time>" }` (or `finished_at`), or a bare
 * ISO time; anything else falls back to the file's change time. No
 * marker means no backup yet: the page shows "belum ada".
 */

export type BackupSummary = {
  /** ISO time of the last successful backup, or null when none is known. */
  lastBackupAt: string | null
}

type ReadFile = (path: string, encoding: 'utf8') => Promise<string>
type Stat = (path: string) => Promise<{ mtime: Date }>

function validDate(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const date = new Date(value.trim())
  return Number.isNaN(date.getTime()) ? null : date
}

function timeFromMarker(text: string) {
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      return validDate(record.finishedAt) ?? validDate(record.finished_at)
    }
    return validDate(parsed)
  } catch {
    return validDate(text)
  }
}

export async function readLastBackup(
  markerPath: string,
  io: { readFile?: ReadFile; stat?: Stat } = {}
): Promise<BackupSummary> {
  const readFile = io.readFile ?? (nodeReadFile as ReadFile)
  const stat = io.stat ?? (nodeStat as Stat)
  let text: string
  try {
    text = await readFile(markerPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { lastBackupAt: null }
    throw error
  }
  const at = timeFromMarker(text)
  if (at) return { lastBackupAt: at.toISOString() }
  const { mtime } = await stat(markerPath)
  return { lastBackupAt: mtime.toISOString() }
}
