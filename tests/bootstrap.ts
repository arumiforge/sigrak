import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { inertiaApiClient } from '@adonisjs/inertia/plugins/api_client'

/**
 * Test setup. Functional tests run the real HTTP server and send the
 * Host header of each area (app., admin., ujian.).
 */
export const plugins: Config['plugins'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(app),
  dbAssertions(app),
  inertiaApiClient(app),
]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    () => testUtils.db().migrate(),
    // The app's login user for the RLS-bound "tenant" connection (R1-01).
    async () => {
      const { prepareTenantLogin } = await import('#tests/tenancy')
      await prepareTenantLogin()
    },
    // Shared cache entries of an earlier run could match the same ids again (D-480).
    async () => {
      const { cacheConnectionReady } = await import('#services/shared_cache')
      const { LayerResolver } = await import('#layers/resolver/layer_resolver')
      if (await cacheConnectionReady()) await LayerResolver.clearCache()
    },
  ],
  teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
