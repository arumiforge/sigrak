import { createHmac } from 'node:crypto'
import { AiCredentialSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import encryption from '@adonisjs/core/services/encryption'
import env from '#start/env'
import { withPublicId } from '#models/mixins/with_public_id'

export type AiCredentialStatus = 'active' | 'invalid' | 'disabled'

/**
 * A teacher's Gemini key (ai-provider-engine.md, Keys). The secret is
 * write-only: it is stored encrypted, decrypted only for the provider
 * call, and never serialized (`serializeAs: null`).
 */
export default class AiCredential extends compose(AiCredentialSchema, withPublicId) {
  declare status: AiCredentialStatus

  /**
   * HMAC-SHA256 of the secret with the app key: finds duplicates
   * without storing the secret in a searchable form.
   */
  static fingerprint(secret: string) {
    return createHmac('sha256', env.get('APP_KEY').release()).update(secret).digest('hex')
  }

  /**
   * Fills secret, last four characters and fingerprint from a plain key.
   */
  setSecret(plain: string) {
    this.secret = encryption.encrypt(plain)
    this.secretLast4 = plain.slice(-4)
    this.secretFingerprint = AiCredential.fingerprint(plain)
  }

  revealSecret(): string {
    const plain = encryption.decrypt<string>(this.secret)
    if (typeof plain !== 'string') {
      throw new Error(`AI credential ${this.id} cannot be decrypted`)
    }
    return plain
  }
}
