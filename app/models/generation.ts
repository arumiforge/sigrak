import { GenerationSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import GenerationStep from '#models/generation_step'
import { withPublicId } from '#models/mixins/with_public_id'

export type GenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/** Statuses of a generation that still has work to do. */
export const activeStatuses: GenerationStatus[] = ['queued', 'running']

/**
 * One run of a template for one teacher (content-engine.md). Status:
 * queued → running (step i of n) → succeeded | failed | cancelled.
 */
export default class Generation extends compose(GenerationSchema, withPublicId) {
  declare status: GenerationStatus

  @hasMany(() => GenerationStep)
  declare steps: HasMany<typeof GenerationStep>

  get isActive() {
    return activeStatuses.includes(this.status)
  }
}
