import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { APP_TIMEZONE } from '#services/i18n/format'
import { staffReadTransaction } from '#tenancy/tenant_transaction'

/**
 * Generations and AI errors per day (D-316), read from `generations`
 * and `ai_usage_logs` across every school as read-only staff (D-469).
 * Days are WIB days (D-165), oldest first, with zeros for quiet days.
 * Only counts leave the database: no school, user or content.
 */

export type ActivityDay = {
  /** WIB date, `YYYY-MM-DD`. */
  day: string
  generations: number
  succeeded: number
  failed: number
  aiAttempts: number
  /** AI attempts whose outcome was not `success` (an error class or `unknown`). */
  aiErrors: number
}

export type DailyActivity = {
  days: ActivityDay[]
  /** AI error classes over the whole window, most frequent first. */
  aiErrorKinds: { outcome: string; count: number }[]
}

type DayRow = { day: string; total: string; succeeded?: string; failed?: string }

async function readActivity(
  client: QueryClientContract,
  since: Date
): Promise<{ generations: DayRow[]; ai: DayRow[]; kinds: { outcome: string; count: string }[] }> {
  const day = `to_char(created_at AT TIME ZONE '${APP_TIMEZONE}', 'YYYY-MM-DD')`
  const generations = await client.rawQuery(
    `SELECT ${day} AS day, count(*) AS total,
            count(*) FILTER (WHERE status = 'succeeded') AS succeeded,
            count(*) FILTER (WHERE status = 'failed') AS failed
       FROM generations WHERE created_at >= ? GROUP BY 1`,
    [since]
  )
  const ai = await client.rawQuery(
    `SELECT ${day} AS day, count(*) AS total,
            count(*) FILTER (WHERE outcome <> 'success') AS failed
       FROM ai_usage_logs WHERE created_at >= ? GROUP BY 1`,
    [since]
  )
  const kinds = await client.rawQuery(
    `SELECT outcome, count(*) AS count FROM ai_usage_logs
      WHERE created_at >= ? AND outcome <> 'success'
      GROUP BY outcome ORDER BY count(*) DESC, outcome ASC`,
    [since]
  )
  return { generations: generations.rows, ai: ai.rows, kinds: kinds.rows }
}

export async function collectDailyActivity(
  options: { days?: number; now?: DateTime } = {}
): Promise<DailyActivity> {
  const count = Math.max(1, options.days ?? 14)
  const today = (options.now ?? DateTime.now()).setZone(APP_TIMEZONE).startOf('day')
  const first = today.minus({ days: count - 1 })

  const rows = await staffReadTransaction((trx) => readActivity(trx, first.toJSDate()))
  const generationsByDay = new Map(rows.generations.map((row) => [row.day, row]))
  const aiByDay = new Map(rows.ai.map((row) => [row.day, row]))

  const days = Array.from({ length: count }, (_, index) => {
    const day = first.plus({ days: index }).toISODate()!
    const generation = generationsByDay.get(day)
    const ai = aiByDay.get(day)
    return {
      day,
      generations: Number(generation?.total ?? 0),
      succeeded: Number(generation?.succeeded ?? 0),
      failed: Number(generation?.failed ?? 0),
      aiAttempts: Number(ai?.total ?? 0),
      aiErrors: Number(ai?.failed ?? 0),
    }
  })

  return {
    days,
    aiErrorKinds: rows.kinds.map((row) => ({ outcome: row.outcome, count: Number(row.count) })),
  }
}
