import app from '@adonisjs/core/services/app'
import { defineConfig, formatters, loaders } from '@adonisjs/i18n'

/**
 * UI copy is Indonesian and lives in resources/lang/id/*.json with
 * English keys (CLAUDE.md language policy).
 */
const i18nConfig = defineConfig({
  defaultLocale: 'id',
  supportedLocales: ['id'],
  formatter: formatters.icu(),

  loaders: [
    loaders.fs({
      location: app.languageFilesPath(),
    }),
  ],
})

export default i18nConfig
