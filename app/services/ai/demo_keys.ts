import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import AiCredential from '#models/ai_credential'

/**
 * Three stand-in keys from three "projects", so the demo shows round
 * robin and failover without a real Gemini key. Only used while
 * AI_PROVIDER=fake: the fake provider never sends a key anywhere. The
 * real "Kunci AI Saya" page (add, test, consent, D-023) comes with the
 * AI slice.
 */
export async function ensureDemoKeys(userId: number) {
  const existing = await AiCredential.query().where('user_id', userId).first()
  if (existing) return

  for (const [index, name] of ['A', 'B', 'C'].entries()) {
    const credential = new AiCredential()
    credential.fill({
      userId,
      label: `Kunci contoh ${name}`,
      projectLabel: `Project contoh ${name}`,
      accountLabel: null,
      status: 'active',
      isBackup: false,
      consecutiveFailures: 0,
      multiKeyConsentAt: index === 0 ? null : DateTime.now(),
    })
    credential.setSecret(`fake-${randomBytes(12).toString('hex')}`)
    await credential.save()
  }
}
