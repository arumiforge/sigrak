import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type StaffUser from '#models/staff_user'
import {
  diffFields,
  hintOf,
  readIntegration,
  writeIntegration,
  type ChatbotSettings,
} from './store.js'

/**
 * The chatbot's provider: the owner's OpenAI-compatible base URL, model
 * and keys, tried in order with failover (D-393, Fondasi F-019). Only
 * saved here; the chatbot itself comes with its own slice.
 */

/** Keys the owner may keep for rotation. */
export const CHATBOT_MAX_KEYS = 10

const empty = (): ChatbotSettings => ({ baseUrl: '', model: '', keys: [] })

export async function presentChatbot() {
  const saved = await readIntegration('chatbot')
  const value = saved?.value ?? empty()
  return {
    saved: saved !== null,
    baseUrl: value.baseUrl,
    model: value.model,
    keys: value.keys.map((key) => ({
      id: key.id,
      label: key.label,
      addedAt: key.addedAt,
      ...hintOf(key.secret),
    })),
  }
}

export async function saveChatbotProvider(
  staff: StaffUser,
  input: { baseUrl: string; model: string }
) {
  return writeIntegration(staff, 'chatbot', (before) => {
    const current = before ?? empty()
    const value = { ...current, baseUrl: input.baseUrl, model: input.model }
    const changes = diffFields(
      { baseUrl: current.baseUrl, model: current.model },
      { baseUrl: value.baseUrl, model: value.model },
      []
    )
    return { value, changes }
  })
}

export type AddKeyOutcome = 'added' | 'duplicate' | 'full'

/** Adds a key at the end of the rotation; the same key twice is refused. */
export async function addChatbotKey(
  staff: StaffUser,
  input: { label: string; secret: string }
): Promise<AddKeyOutcome> {
  let outcome: AddKeyOutcome = 'added'
  await writeIntegration(staff, 'chatbot', (before) => {
    const current = before ?? empty()
    if (current.keys.some((key) => key.secret === input.secret)) {
      outcome = 'duplicate'
      return null
    }
    if (current.keys.length >= CHATBOT_MAX_KEYS) {
      outcome = 'full'
      return null
    }
    const key = {
      id: randomUUID(),
      label: input.label,
      secret: input.secret,
      addedAt: DateTime.now().toISO()!,
    }
    return {
      value: { ...current, keys: [...current.keys, key] },
      changes: { key_added: { id: key.id, label: key.label } },
      action: 'integration.key_added',
    }
  })
  return outcome
}

export async function removeChatbotKey(staff: StaffUser, id: string) {
  return writeIntegration(staff, 'chatbot', (before) => {
    const key = before?.keys.find((candidate) => candidate.id === id)
    if (!before || !key) return null
    return {
      value: { ...before, keys: before.keys.filter((candidate) => candidate.id !== id) },
      changes: { key_removed: { id: key.id, label: key.label } },
      action: 'integration.key_removed',
    }
  })
}
