/*
|--------------------------------------------------------------------------
| Routes: staff 2FA on admin. (R2-02)
|--------------------------------------------------------------------------
|
| TOTP with an authenticator app (D-343): the code step after the
| password, the staff member's Akun page with enrolment, and "Atur
| ulang 2FA" on the Staf page. Owner and admin accounts without 2FA
| reach only the enrolment page and Keluar (AuthMiddleware).
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'
import { loginIpThrottle } from '#start/limiter'

const ChallengeController = () => import('#staff/controllers/two_factor_challenge_controller')
const TwoFactorController = () => import('#staff/controllers/two_factor_controller')

const id = router.matchers.number()

router
  .group(() => {
    router.get('/masuk/kode', [ChallengeController, 'create']).as('two_factor.challenge')
    router
      .post('/masuk/kode', [ChallengeController, 'store'])
      .as('two_factor.verify')
      .use(loginIpThrottle)
  })
  .domain(hosts.admin)
  .as('admin')
  .use([middleware.guest({ guard: 'staff' }), middleware.translations(['auth', 'two_factor'])])

router
  .group(() => {
    router.get('/akun', [TwoFactorController, 'account']).as('account.show')
    router.get('/akun/verifikasi-dua-langkah', [TwoFactorController, 'edit']).as('two_factor.edit')
    router
      .post('/akun/verifikasi-dua-langkah', [TwoFactorController, 'confirm'])
      .as('two_factor.confirm')
    router
      .post('/akun/verifikasi-dua-langkah/matikan', [TwoFactorController, 'disable'])
      .as('two_factor.disable')
    router
      .post('/staf/:staff/atur-ulang-2fa', [TwoFactorController, 'reset'])
      .as('two_factor.reset')
      .where('staff', id)
  })
  .domain(hosts.admin)
  .as('admin')
  .use([
    middleware.auth({ guard: 'staff' }),
    middleware.translations(['auth', 'areas', 'console', 'staff', 'two_factor']),
  ])
