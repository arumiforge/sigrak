import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import type { AiConfig } from '#config/ai'
import Generation, { activeStatuses } from '#models/generation'
import { cancellation } from '#services/generation/cancellation'
import { dispatchStep } from '#services/generation/generation_runner'
import { stepJobId, type GenerationPlan } from '#services/generation/plan'
import { broadcastProgress } from '#services/generation/progress'
import { queue } from '#services/queue/queues'

/** The teacher already has the most generations allowed at once. */
export class TooManyActiveGenerationsError extends Error {
  constructor() {
    super('Too many active generations')
    this.name = 'TooManyActiveGenerationsError'
  }
}

async function assertBelowActiveLimit(userId: number) {
  const { maxActiveGenerationsPerUser } = app.config.get<AiConfig>('ai')
  const row = await db
    .from('generations')
    .where('user_id', userId)
    .whereIn('status', activeStatuses)
    .count('* as total')
    .first()
  if (Number(row?.total ?? 0) >= maxActiveGenerationsPerUser) {
    throw new TooManyActiveGenerationsError()
  }
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string })?.code === '23505'
}

/**
 * Start, cancel and retry from the web process. Each one changes the
 * database first (compare-and-set), then queues, then tells the page.
 */
export const generationService = {
  /**
   * Creates a generation and queues its first step. The same client
   * token twice (a double click) returns the first generation.
   */
  async start(
    plan: GenerationPlan,
    input: {
      userId: number
      schoolId: number | null
      clientToken: string
      specification: Record<string, unknown>
    }
  ): Promise<Generation> {
    const existing = await Generation.findBy({
      userId: input.userId,
      clientToken: input.clientToken,
    })
    if (existing) return existing

    await assertBelowActiveLimit(input.userId)

    let generation: Generation
    try {
      generation = await db.transaction(async (trx) => {
        const created = await Generation.create(
          {
            userId: input.userId,
            schoolId: input.schoolId,
            templateKey: plan.templateKey,
            templateVersion: plan.templateVersion,
            kind: 'create',
            clientToken: input.clientToken,
            specification: input.specification,
            status: 'queued',
            runs: 1,
          },
          { client: trx }
        )
        await trx
          .insertQuery()
          .table('generation_steps')
          .multiInsert(
            plan.steps.map((step, index) => ({
              generation_id: created.id,
              step_key: step.key,
              position: index + 1,
              status: 'pending',
              attempts: 0,
              created_at: new Date(),
              updated_at: new Date(),
            }))
          )
        return created
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      return Generation.findByOrFail({ userId: input.userId, clientToken: input.clientToken })
    }

    // Tell the page before the worker can start, so "queued" never arrives after "running".
    await broadcastProgress(generation)
    await dispatchStep(plan, generation, 1)
    return generation
  },

  /**
   * Stops a queued or running generation at once: the status changes
   * here, the waiting job is removed, and a running call is aborted in
   * the worker. Returns false when there was nothing to stop.
   */
  async cancel(plan: GenerationPlan, generation: Generation): Promise<boolean> {
    const result = await db.rawQuery(
      `UPDATE generations SET status = 'cancelled', finished_at = now(), updated_at = now()
        WHERE id = ? AND status IN ('queued', 'running')`,
      [generation.id]
    )
    if ((result.rowCount ?? 0) === 0) return false
    const changedAt = Date.now()

    await db.rawQuery(
      `UPDATE generation_steps SET status = 'pending', updated_at = now()
        WHERE generation_id = ? AND status = 'running'`,
      [generation.id]
    )
    await cancellation.publish(generation.id)
    await Promise.all(
      plan.steps.map((_, index) =>
        queue(plan.queue)
          .remove(stepJobId(generation, index + 1))
          .catch(() => 0)
      )
    )
    await broadcastProgress(generation, changedAt)
    return true
  },

  /**
   * Runs a failed or cancelled generation again from its first
   * unfinished step; finished steps are kept.
   */
  async retry(plan: GenerationPlan, generation: Generation): Promise<boolean> {
    await assertBelowActiveLimit(generation.userId)

    const result = await db.rawQuery(
      `UPDATE generations
          SET status = 'queued', runs = runs + 1, error_class = NULL, error_meta = NULL,
              finished_at = NULL, updated_at = now()
        WHERE id = ? AND status IN ('failed', 'cancelled')
        RETURNING runs`,
      [generation.id]
    )
    if ((result.rowCount ?? 0) === 0) return false
    generation.runs = Number(result.rows[0].runs)

    await db.rawQuery(
      `UPDATE generation_steps SET status = 'pending', updated_at = now()
        WHERE generation_id = ? AND status <> 'succeeded'`,
      [generation.id]
    )
    const next = await db
      .from('generation_steps')
      .where('generation_id', generation.id)
      .whereNot('status', 'succeeded')
      .orderBy('position', 'asc')
      .first()

    await broadcastProgress(generation)
    await dispatchStep(plan, generation, next?.position ?? plan.steps.length)
    return true
  },
}
