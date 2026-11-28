import vine from '@vinejs/vine'
import { MAX_MODELS_PER_PURPOSE, MODEL_NAME_PATTERN } from './ai_models.js'

/**
 * Console forms of the integration settings (R2-03). A secret field
 * left empty keeps the saved secret, so it is optional everywhere.
 */

const secret = () => vine.string().trim().maxLength(500).optional()
const hostName = () =>
  vine
    .string()
    .trim()
    .maxLength(253)
    .regex(/^[A-Za-z0-9.-]+$/)

export const mailSettingsValidator = vine.create({
  host: hostName(),
  port: vine.number().withoutDecimals().range([1, 65535]),
  security: vine.enum(['starttls', 'tls'] as const),
  username: vine.string().trim().maxLength(254),
  password: secret(),
  from_address: vine.string().trim().toLowerCase().email().maxLength(254),
  from_name: vine.string().trim().minLength(1).maxLength(100),
})

const httpsUrl = () =>
  vine
    .string()
    .trim()
    .maxLength(300)
    .url({ require_protocol: true, protocols: ['https'] })

export const chatbotProviderValidator = vine.create({
  base_url: httpsUrl(),
  model: vine.string().trim().minLength(1).maxLength(80).regex(MODEL_NAME_PATTERN),
})

export const chatbotKeyValidator = vine.create({
  label: vine.string().trim().minLength(1).maxLength(60),
  secret: vine.string().trim().minLength(8).maxLength(500),
})

export const storageSettingsValidator = vine.create({
  endpoint: httpsUrl(),
  region: vine
    .string()
    .trim()
    .minLength(1)
    .maxLength(40)
    .regex(/^[a-z0-9-]+$/),
  bucket: vine
    .string()
    .trim()
    .minLength(3)
    .maxLength(63)
    .regex(/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/),
  access_key_id: secret(),
  secret_access_key: secret(),
})

export const teamKeyValidator = vine.create({
  gemini_key: vine.string().trim().minLength(8).maxLength(500),
})

export const purposeModelsValidator = vine.create({
  models: vine
    .array(vine.string().trim().maxLength(80).regex(MODEL_NAME_PATTERN))
    .minLength(1)
    .maxLength(MAX_MODELS_PER_PURPOSE)
    .distinct(),
})

export const modelTestValidator = vine.create({
  model: vine.string().trim().minLength(1).maxLength(80).regex(MODEL_NAME_PATTERN),
})
