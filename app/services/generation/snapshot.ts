import db from '@adonisjs/lucid/services/db'
import Generation, { type GenerationStatus } from '#models/generation'
import type { GenerationStepStatus } from '#models/generation_step'

export type GenerationSnapshot = {
  id: string
  /**
   * Database time (µs) when the snapshot was read. Messages from the
   * web and worker processes may arrive out of order; the page keeps
   * the newest.
   */
  version: number
  status: GenerationStatus
  runs: number
  scenario: string | null
  totalSteps: number
  /** Position of the running step, or of the next one to run. */
  currentStep: number | null
  errorClass: string | null
  /** For "every key is busy": when the earliest key is usable again. */
  availableAt: string | null
  createdAt: string
  finishedAt: string | null
  steps: {
    key: string
    position: number
    status: GenerationStepStatus
    attempts: number
    output: string | null
  }[]
  /** Technical detail behind "Lihat detail": every AI attempt, without keys. */
  attempts: {
    stepKey: string | null
    attempt: number
    keyLabel: string | null
    outcome: string
    latencyMs: number
  }[]
}

/**
 * The state of a generation as the page shows it, in one shape for the
 * first render and for every progress message.
 */
export async function snapshotOf(generation: Generation): Promise<GenerationSnapshot> {
  const clock = await db.rawQuery(
    `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000000)::bigint AS version`
  )
  const fresh = await Generation.findOrFail(generation.id)
  const [steps, attempts] = await Promise.all([
    db
      .from('generation_steps')
      .where('generation_id', fresh.id)
      .orderBy('position', 'asc')
      .select('step_key', 'position', 'status', 'attempts', 'output'),
    db
      .from('ai_usage_logs as logs')
      .leftJoin('ai_credentials as keys', 'keys.id', 'logs.ai_credential_id')
      .where('logs.generation_id', fresh.id)
      .orderBy('logs.id', 'asc')
      .select('logs.step_key', 'logs.attempt', 'keys.label', 'logs.outcome', 'logs.latency_ms'),
  ])

  const current =
    steps.find((step) => step.status === 'running') ??
    steps.find((step) => step.status !== 'succeeded')
  const meta = (fresh.errorMeta ?? {}) as { availableAt?: string | null }

  return {
    id: fresh.publicId,
    version: Number(clock.rows[0].version),
    status: fresh.status,
    runs: fresh.runs,
    scenario:
      typeof fresh.specification.scenario === 'string' ? fresh.specification.scenario : null,
    totalSteps: steps.length,
    currentStep: current?.position ?? null,
    errorClass: fresh.errorClass,
    availableAt: meta.availableAt ?? null,
    createdAt: fresh.createdAt.toISO()!,
    finishedAt: fresh.finishedAt?.toISO() ?? null,
    steps: steps.map((step) => ({
      key: step.step_key,
      position: step.position,
      status: step.status,
      attempts: step.attempts,
      output: typeof step.output?.text === 'string' ? step.output.text : null,
    })),
    attempts: attempts.map((row) => ({
      stepKey: row.step_key,
      attempt: row.attempt,
      keyLabel: row.label,
      outcome: row.outcome,
      latencyMs: row.latency_ms,
    })),
  }
}
