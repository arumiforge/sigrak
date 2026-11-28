import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { AiConfig, PurposeSettings } from '#config/ai'
import AiPurposeModel from '#models/ai_purpose_model'
import type StaffUser from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'
import { AIError, type AIErrorClass } from '#services/ai/contracts'
import { aiProviders } from '#services/ai/providers'
import { hintOf, readIntegration, writeIntegration } from './store.js'

/**
 * The AI model per purpose (D-315): the purposes and their starting
 * values are code (config/ai.ts); the owner sets the active model and
 * an ordered fallback list per purpose in the console, stored in
 * `ai_purpose_models`. The gateway reads the choice on every step, so
 * a change applies to the next step without a deploy. Every change is
 * logged. The test button calls a model with Tim SIGRAK's own key,
 * never a teacher's (ai-provider-engine.md, Keys).
 */

/** Active model plus up to four fallbacks. */
export const MAX_MODELS_PER_PURPOSE = 5

/** Vendor model ids: letters, digits and `.-_/:` (e.g. `gemini-3.8-flash`). */
export const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/:]{0,79}$/

const settings = () => app.config.get<AiConfig>('ai')

function purposeSettings(): Record<string, PurposeSettings> {
  return settings().purposes as Record<string, PurposeSettings>
}

/** The purposes templates may name, in config order. */
export function aiPurposes(): string[] {
  return Object.keys(purposeSettings())
}

export function isPurpose(purpose: string) {
  return Object.hasOwn(purposeSettings(), purpose)
}

export function startingModels(purpose: string): string[] {
  const found = purposeSettings()[purpose]
  if (!found) throw new Error(`Unknown AI purpose "${purpose}"`)
  return [...found.models]
}

/**
 * The models of a purpose in the order the gateway tries them on
 * `model_unavailable`: the console's choice, or the starting value.
 */
export async function purposeModels(purpose: string): Promise<string[]> {
  const starting = startingModels(purpose)
  const row = await AiPurposeModel.findBy('purpose', purpose)
  return row && row.models.length > 0 ? [...row.models] : starting
}

/** The model list of a purpose for the gateway: models from the console, timeout from config. */
export async function resolvePurpose(purpose: string): Promise<PurposeSettings | null> {
  const found = purposeSettings()[purpose]
  if (!found) return null
  return { ...found, models: await purposeModels(purpose) }
}

/** Trims, drops empty rows and repeats, keeping the first place of each model. */
export function normaliseModels(models: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of models) {
    const model = raw.trim()
    if (!model || seen.has(model)) continue
    seen.add(model)
    out.push(model)
  }
  return out
}

export class InvalidModelListException extends Error {
  constructor() {
    super('A purpose needs one to five valid model names')
    this.name = 'InvalidModelListException'
  }
}

/**
 * Sets the active model and fallbacks of a purpose and logs the change.
 * Setting the starting value again removes the console row, so a later
 * change of the config default applies.
 */
export async function setPurposeModels(staff: StaffUser, purpose: string, input: string[]) {
  const models = normaliseModels(input)
  if (
    models.length === 0 ||
    models.length > MAX_MODELS_PER_PURPOSE ||
    !models.every((model) => MODEL_NAME_PATTERN.test(model))
  ) {
    throw new InvalidModelListException()
  }
  const starting = startingModels(purpose)

  return db.transaction(async (trx) => {
    const row = await AiPurposeModel.query({ client: trx })
      .where('purpose', purpose)
      .forUpdate()
      .first()
    const before = row?.models ?? starting
    if (JSON.stringify(before) === JSON.stringify(models)) return false

    if (JSON.stringify(models) === JSON.stringify(starting)) {
      await row?.useTransaction(trx).delete()
    } else {
      await trx.rawQuery(
        `INSERT INTO ai_purpose_models (purpose, models, updated_by_staff_id, created_at, updated_at)
         VALUES (?, ?::text[], ?, now(), now())
         ON CONFLICT (purpose) DO UPDATE
           SET models = EXCLUDED.models, updated_by_staff_id = EXCLUDED.updated_by_staff_id,
               updated_at = now()`,
        [purpose, models, staff.id]
      )
    }
    await logStaffActivity(
      staff,
      'ai_model.updated',
      'ai_model',
      purpose,
      { from: before, to: models },
      trx
    )
    return true
  })
}

/** Back to the starting value of config/ai.ts. */
export async function resetPurposeModels(staff: StaffUser, purpose: string) {
  return setPurposeModels(staff, purpose, startingModels(purpose))
}

/** What the console page lists per purpose. */
export async function presentPurposes() {
  const rows = await AiPurposeModel.all()
  const byPurpose = new Map(rows.map((row) => [row.purpose, row]))
  return aiPurposes().map((purpose) => {
    const row = byPurpose.get(purpose)
    const starting = startingModels(purpose)
    return {
      purpose,
      models: row?.models.length ? row.models : starting,
      starting,
      custom: Boolean(row),
      timeoutSeconds: Math.round(purposeSettings()[purpose].timeoutMs / 1000),
      updatedAt: row ? row.updatedAt.toISO() : null,
    }
  })
}

/* ----------------------------------------------------------------------
 * Tim SIGRAK's test key
 * -------------------------------------------------------------------- */

export async function presentTeamKey() {
  const saved = await readIntegration('ai_team_key')
  return hintOf(saved?.value.geminiKey)
}

export async function saveTeamKey(staff: StaffUser, geminiKey: string) {
  return writeIntegration(staff, 'ai_team_key', (before) => {
    if (before?.geminiKey === geminiKey) return null
    return { value: { geminiKey }, changes: { geminiKey: 'changed' } }
  })
}

/* ----------------------------------------------------------------------
 * Test button
 * -------------------------------------------------------------------- */

/** How long the console waits for a test answer. */
const TEST_TIMEOUT_MS = 30_000

export type ModelTestResult =
  | { ok: true; model: string; latencyMs: number }
  | { ok: false; model: string; reason: AIErrorClass | 'no_team_key' | 'unknown' }

/**
 * Sends one short request to `model` with Tim SIGRAK's key and reports
 * whether it answered. With AI_PROVIDER=fake the fake provider answers
 * (tests swap it), so no paid call ever runs outside production. Each
 * test is logged, since it spends Tim SIGRAK's quota.
 */
export async function testModel(
  staff: StaffUser,
  purpose: string,
  model: string
): Promise<ModelTestResult> {
  const saved = await readIntegration('ai_team_key')
  let result: ModelTestResult
  if (!saved?.value.geminiKey) {
    result = { ok: false, model, reason: 'no_team_key' }
  } else {
    const started = Date.now()
    try {
      await aiProviders.resolve().generate({
        purpose,
        system: 'Jawab dengan satu kata.',
        parts: ['Balas dengan kata "siap".'],
        maxOutputTokens: 16,
        model,
        credential: { id: 0, secret: saved.value.geminiKey },
        timeoutMs: TEST_TIMEOUT_MS,
        trace: { stepKey: 'console_test', attempt: 1 },
      })
      result = { ok: true, model, latencyMs: Date.now() - started }
    } catch (error) {
      result = {
        ok: false,
        model,
        reason: error instanceof AIError ? error.errorClass : 'unknown',
      }
    }
  }
  await logStaffActivity(staff, 'ai_model.tested', 'ai_model', purpose, {
    model,
    ok: result.ok,
    ...(result.ok ? {} : { reason: result.reason }),
  })
  return result
}
