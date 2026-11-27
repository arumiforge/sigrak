import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import AiUsageLog from '#models/ai_usage_log'
import Generation from '#models/generation'
import GenerationStep from '#models/generation_step'
import { AICancelledError } from '#services/ai/contracts'
import { AIGateway, AIGatewayError, type GatewayFailure } from '#services/ai/ai_gateway'
import { aiProviders } from '#services/ai/providers'
import { cancellation } from '#services/generation/cancellation'
import { stepJobId, type GenerationPlan, type StepJobData } from '#services/generation/plan'
import { broadcastProgress } from '#services/generation/progress'
import { dispatch } from '#services/queue/queues'

export type StepOutcome =
  'stale' | 'cancelled' | 'interrupted' | 'step_done' | 'succeeded' | 'failed'

/** Queues the job that runs the step at `position`. */
export async function dispatchStep(
  plan: GenerationPlan,
  generation: Pick<Generation, 'id' | 'publicId' | 'runs'>,
  position: number
) {
  const data: StepJobData = { generationId: generation.id, run: generation.runs, position }
  await dispatch(plan.queue, plan.jobName, data, { jobId: stepJobId(generation, position) })
}

/** Rows changed by an UPDATE … RETURNING. */
function changed(result: { rowCount?: number | null }) {
  return (result.rowCount ?? 0) > 0
}

/**
 * Runs one pending step of a generation per job, then re-dispatches the
 * job for the next step, so each run is short and resumable
 * (ai-provider-engine.md, Queues and progress). Every state change is
 * a compare-and-set that also checks the generation is still running
 * in the same run, so a cancel, a retry or a duplicate job can never
 * overwrite an accepted output.
 */
export class GenerationRunner {
  constructor(private plan: GenerationPlan) {}

  async runStep(data: StepJobData, parentSignal?: AbortSignal): Promise<StepOutcome> {
    const generation = await Generation.find(data.generationId)
    if (!generation || generation.runs !== data.run || !generation.isActive) {
      return 'stale'
    }

    if (generation.status === 'queued') {
      const started = await db.rawQuery(
        `UPDATE generations
            SET status = 'running', started_at = coalesce(started_at, now()), updated_at = now()
          WHERE id = ? AND status = 'queued' AND runs = ?`,
        [generation.id, data.run]
      )
      if (!changed(started)) return 'stale'
      generation.status = 'running'
    }

    const steps = await GenerationStep.query()
      .where('generation_id', generation.id)
      .orderBy('position', 'asc')
    const step = steps.find((candidate) => candidate.status !== 'succeeded')
    if (!step) {
      return this.#finish(generation, data.run)
    }

    if (step.status === 'running') {
      // The worker that ran this step died mid-call: the call may still be billed.
      await AiUsageLog.create({
        userId: generation.userId,
        schoolId: generation.schoolId,
        aiCredentialId: generation.pinnedCredentialId,
        generationId: generation.id,
        stepKey: step.stepKey,
        attempt: step.attempts,
        purpose: 'unknown',
        model: 'unknown',
        outcome: 'unknown',
        httpStatus: null,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      })
      logger.warn({ generationId: generation.id, step: step.stepKey }, 'Resuming an orphaned step')
    }

    const claimed = await db.rawQuery(
      `UPDATE generation_steps
          SET status = 'running', attempts = attempts + 1, started_at = now(),
              finished_at = NULL, updated_at = now()
        WHERE id = ? AND status <> 'succeeded'
          AND EXISTS (SELECT 1 FROM generations WHERE id = ? AND status = 'running' AND runs = ?)`,
      [step.id, generation.id, data.run]
    )
    if (!changed(claimed)) return 'cancelled'
    await broadcastProgress(generation)

    const previousOutputs = Object.fromEntries(
      steps
        .filter((candidate) => candidate.status === 'succeeded' && candidate.output)
        .map((candidate) => [candidate.stepKey, candidate.output!])
    )

    const tracked = cancellation.track(generation.id, parentSignal)
    let result
    try {
      const gateway = new AIGateway(
        aiProviders.resolve({ scenario: generation.specification.scenario as string | undefined })
      )
      result = await gateway.run({
        request: this.plan.buildRequest(step.stepKey, generation, previousOutputs),
        userId: generation.userId,
        schoolId: generation.schoolId,
        generationId: generation.id,
        stepKey: step.stepKey,
        run: data.run,
        pinnedCredentialId: generation.pinnedCredentialId,
        signal: tracked.signal,
      })
    } catch (error) {
      if (error instanceof AICancelledError) {
        return tracked.reason() === 'shutdown'
          ? this.#release(step, generation)
          : this.#cancelled(generation)
      }
      if (error instanceof AIGatewayError) {
        return this.#fail(generation, step, data.run, error.failure, error.availableAt?.toISO())
      }
      await this.#fail(generation, step, data.run, 'internal', null)
      throw error
    } finally {
      tracked.done()
    }

    const accepted = await db.rawQuery(
      `UPDATE generation_steps
          SET status = 'succeeded', output = ?, finished_at = now(), updated_at = now()
        WHERE id = ? AND status = 'running'
          AND EXISTS (SELECT 1 FROM generations WHERE id = ? AND status = 'running' AND runs = ?)`,
      [JSON.stringify(result.response.data), step.id, generation.id, data.run]
    )
    if (!changed(accepted)) return 'cancelled'
    const changedAt = Date.now()

    await Generation.query()
      .where('id', generation.id)
      .update({ pinned_credential_id: result.credentialId })

    const next = steps.find((candidate) => candidate.position > step.position)
    if (!next) {
      return this.#finish(generation, data.run, changedAt)
    }
    // Broadcast before the next job can start, so the page never gets an older snapshot last.
    await broadcastProgress(generation, changedAt)
    await dispatchStep(this.plan, generation, next.position)
    return 'step_done'
  }

  async #finish(generation: Generation, run: number, changedAt = Date.now()) {
    const done = await db.rawQuery(
      `UPDATE generations SET status = 'succeeded', finished_at = now(), updated_at = now()
        WHERE id = ? AND status = 'running' AND runs = ?`,
      [generation.id, run]
    )
    if (!changed(done)) return 'stale'
    await broadcastProgress(generation, changedAt)
    return 'succeeded'
  }

  async #fail(
    generation: Generation,
    step: GenerationStep,
    run: number,
    failure: GatewayFailure | 'internal',
    availableAt: string | null | undefined
  ): Promise<StepOutcome> {
    await db.rawQuery(
      `UPDATE generation_steps SET status = 'failed', finished_at = now(), updated_at = now()
        WHERE id = ? AND status = 'running'`,
      [step.id]
    )
    const failed = await db.rawQuery(
      `UPDATE generations
          SET status = 'failed', error_class = ?, error_meta = ?, finished_at = now(), updated_at = now()
        WHERE id = ? AND status = 'running' AND runs = ?`,
      [failure, JSON.stringify({ availableAt: availableAt ?? null }), generation.id, run]
    )
    if (!changed(failed)) return 'cancelled'
    await broadcastProgress(generation)
    return 'failed'
  }

  /**
   * The teacher cancelled: the web process already set the status and
   * told the page; the step goes back to pending for "Coba lagi".
   */
  async #cancelled(generation: Generation): Promise<StepOutcome> {
    await db.rawQuery(
      `UPDATE generation_steps SET status = 'pending', updated_at = now()
        WHERE generation_id = ? AND status = 'running'`,
      [generation.id]
    )
    return 'cancelled'
  }

  /**
   * The worker is shutting down mid-call: the step goes back to pending
   * and the job back to the queue (see the worker), for the next worker.
   */
  async #release(step: GenerationStep, generation: Generation): Promise<StepOutcome> {
    await db.rawQuery(
      `UPDATE generation_steps SET status = 'pending', updated_at = now()
        WHERE id = ? AND status = 'running'`,
      [step.id]
    )
    await broadcastProgress(generation)
    return 'interrupted'
  }
}
