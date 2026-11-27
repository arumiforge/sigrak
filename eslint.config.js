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
  },
})
