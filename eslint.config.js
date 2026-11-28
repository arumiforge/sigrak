import { configApp } from '@adonisjs/eslint-config'
import { react } from '@adonisjs/eslint-config/react'

export default configApp(...react, {
  /**
   * Routes are bound to three hostnames (app., admin., ujian.), so pages
   * link by plain paths on their own host; the Tuyau route registry is
   * not used for now.
   */
  rules: {
    '@adonisjs/prefer-adonisjs-inertia-form': 'off',
    '@adonisjs/prefer-adonisjs-inertia-link': 'off',
    /**
     * Pure helpers without imports that the browser reuses, so both
     * sides format and word things the same way (R1-02).
     */
    '@adonisjs/no-backend-import-in-frontend': [
      'error',
      {
        allowed: ['../../app/services/i18n/format', '../../app/services/i18n/level_terms'],
      },
    ],
  },
})
