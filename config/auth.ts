import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

/**
 * One guard per area, each on its own table, so a school account can
 * never act as staff or as an exam participant (data model: staff_users
 * on a separate guard and table; exam participants are not users).
 */
const authConfig = defineConfig({
  default: 'web',

  guards: {
    /**
     * app.: school users (teachers, principals, operators, supervisors).
     */
    web: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),

    /**
     * admin.: Tim SIGRAK staff.
     */
    staff: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#models/staff_user'),
      }),
    }),

    /**
     * ujian.: exam participants with per-session exam cards.
     */
    exam: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#models/exam_participant'),
      }),
    }),
  },
})

export default authConfig

declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
