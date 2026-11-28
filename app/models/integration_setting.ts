import { IntegrationSettingSchema } from '#database/schema'

/**
 * One integration's settings from the console (D-431). `payload` is
 * encrypted with the app key; only app/integrations/store.ts reads and
 * writes it, and no page ever receives this model.
 */
export default class IntegrationSetting extends IntegrationSettingSchema {}
