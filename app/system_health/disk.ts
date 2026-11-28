import { statfs as nodeStatfs } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/**
 * Free space on the data volume (D-316). A tone, not an alert: the
 * server monitoring alerts (D-426); the page only colours the number.
 */

export type StatFsResult = { bsize: number; blocks: number; bavail: number }
export type StatFs = (path: string) => Promise<StatFsResult>

export type DiskSummary = {
  /** The folder that was measured (the configured one or its nearest parent). */
  path: string
  totalBytes: number
  /** Free for the app (blocks available to unprivileged users). */
  freeBytes: number
  /** Whole percent of the volume still free. */
  freePercent: number
  status: 'ok' | 'low' | 'critical'
}

/** Below these shares of free space the number turns amber, then red. */
export const DISK_LOW_PERCENT = 15
export const DISK_CRITICAL_PERCENT = 5

function isMissing(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

/**
 * Measures the volume that holds `path`. A path that does not exist yet
 * (the storage folder before the first upload) is measured at its
 * nearest existing parent, which sits on the same volume.
 */
export async function collectDisk(
  path: string,
  statfs: StatFs = nodeStatfs as StatFs
): Promise<DiskSummary> {
  let current = resolve(path)
  for (;;) {
    try {
      const stats = await statfs(current)
      const totalBytes = stats.blocks * stats.bsize
      const freeBytes = stats.bavail * stats.bsize
      const freePercent = totalBytes > 0 ? Math.floor((freeBytes / totalBytes) * 100) : 0
      const status =
        freePercent < DISK_CRITICAL_PERCENT
          ? 'critical'
          : freePercent < DISK_LOW_PERCENT
            ? 'low'
            : 'ok'
      return { path: current, totalBytes, freeBytes, freePercent, status }
    } catch (error) {
      const parent = dirname(current)
      if (!isMissing(error) || parent === current) throw error
      current = parent
    }
  }
}
