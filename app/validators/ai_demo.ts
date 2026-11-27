import vine from '@vinejs/vine'
import { demoScenarios } from '#services/ai/fake_provider'

/**
 * Starting a demo generation. The client token (a UUID made when the
 * form opens) turns a double submit into one generation. The scenario
 * only matters while AI_PROVIDER=fake.
 */
export const startDemoValidator = vine.create({
  clientToken: vine.string().uuid(),
  scenario: vine.enum(demoScenarios).optional(),
})
