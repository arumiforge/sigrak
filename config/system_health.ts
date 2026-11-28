import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import env from '#start/env'

/**
 * Kesehatan sistem (R2-04, D-316). The page reads; it never alerts
 * (server monitoring does that, D-426).
 */
const dataPath = env.get('SYSTEM_DATA_PATH') || app.makePath('storage')

const systemHealthConfig = {
  /**
   * The data volume whose free space the page shows. A path that does
   * not exist yet is measured at its nearest existing parent folder.
   */
  dataPath,

  /**
   * The marker file the backup job writes after each successful backup
   * (R3, D-430): JSON `{ "finishedAt": "<ISO time>" }`, or just the ISO
   * time. Until it exists the page shows "belum ada".
   */
  backupMarkerPath: env.get('BACKUP_MARKER_PATH') || join(dataPath, 'backup', 'last-backup.json'),

  /** Seconds between the page's automatic refreshes. */
  refreshSeconds: 30,

  /** Days of generations and AI attempts on the page, today included. */
  activityDays: 14,

  /** Failed jobs listed per queue, newest first. */
  failedJobsPerQueue: 25,
}

export type SystemHealthConfig = typeof systemHealthConfig

export default systemHealthConfig
