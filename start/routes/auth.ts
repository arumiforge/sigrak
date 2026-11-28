/*
|--------------------------------------------------------------------------
| Routes: sign-in and accounts on app. (R1-05)
|--------------------------------------------------------------------------
|
| Only sign-in, sign-up, password reset and invitation acceptance work
| without a session (product concept, Access model; D-459). Everything
| else needs the "web" guard and runs in the school context of the
| active membership (R1-01); a teacher who signed up alone has no school
| yet and still reaches Akun and Ganti peran.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { loginIpThrottle } from '#start/limiter'
import { hosts } from '#config/hosts'
import { TOKEN_PATTERN } from '#accounts/tokens'
import {
  invitationThrottle,
  resetLinkThrottle,
  resetPasswordThrottle,
  signUpThrottle,
} from '#accounts/throttles'

const SessionController = () => import('#controllers/school/session_controller')
const PasswordResetController = () => import('#controllers/school/password_reset_controller')
const SignUpController = () => import('#controllers/school/sign_up_controller')
const InvitationController = () => import('#controllers/school/invitation_controller')
const AccountController = () => import('#controllers/school/account_controller')
const RoleSwitchController = () => import('#controllers/school/role_switch_controller')
const TeachersController = () => import('#controllers/school/teachers_controller')

const token = { match: TOKEN_PATTERN }
const uuid = router.matchers.uuid()

router
  .group(() => {
    /*
    | Guests only.
    */
    router
      .group(() => {
        router.get('/masuk', [SessionController, 'create']).as('login')
        router.post('/masuk', [SessionController, 'store']).as('login.store').use(loginIpThrottle)

        router.get('/lupa-kata-sandi', [PasswordResetController, 'create']).as('password.forgot')
        router
          .post('/lupa-kata-sandi', [PasswordResetController, 'store'])
          .as('password.email')
          .use(resetLinkThrottle)
        router
          .get('/kata-sandi-baru/:token', [PasswordResetController, 'edit'])
          .as('password.reset')
          .where('token', token)
        router
          .post('/kata-sandi-baru/:token', [PasswordResetController, 'update'])
          .as('password.update')
          .where('token', token)
          .use(resetPasswordThrottle)

        router.get('/daftar', [SignUpController, 'create']).as('sign_up')
        router.post('/daftar', [SignUpController, 'store']).as('sign_up.store').use(signUpThrottle)
      })
      .use(middleware.guest({ guard: 'web' }))

    /*
    | With or without a session: a signed-in teacher who signed up alone
    | accepts with the open session.
    */
    router
      .group(() => {
        router
          .get('/undangan/:token', [InvitationController, 'show'])
          .as('invitations.show')
          .where('token', token)
        router
          .post('/undangan/:token', [InvitationController, 'store'])
          .as('invitations.accept')
          .where('token', token)
          .use(invitationThrottle)
      })
      .use(middleware.translations(['accounts']))

    /*
    | Signed in; a school is optional.
    */
    router
      .group(() => {
        router.post('/keluar', [SessionController, 'destroy']).as('logout')
        router.get('/akun', [AccountController, 'show']).as('account.show')
        router.post('/akun', [AccountController, 'updateProfile']).as('account.update')
        router
          .post('/akun/kata-sandi', [AccountController, 'updatePassword'])
          .as('account.password')
        router.get('/ganti-peran', [RoleSwitchController, 'show']).as('role_switch.show')
        router.post('/ganti-peran', [RoleSwitchController, 'store']).as('role_switch.store')
      })
      .use([
        middleware.auth({ guard: 'web' }),
        middleware.school({ optional: true }),
        middleware.translations(['accounts']),
      ])

    /*
    | Operator only: Guru (invite, send again, cancel).
    */
    router
      .group(() => {
        router.get('/guru', [TeachersController, 'index']).as('index')
        router.post('/guru/undangan', [TeachersController, 'invite']).as('invite')
        router
          .post('/guru/undangan/:invitation/kirim-ulang', [TeachersController, 'resend'])
          .as('resend')
          .where('invitation', uuid)
        router
          .post('/guru/undangan/:invitation/batal', [TeachersController, 'cancel'])
          .as('cancel')
          .where('invitation', uuid)
      })
      .as('teachers')
      .use([
        middleware.auth({ guard: 'web' }),
        middleware.school(),
        middleware.translations(['accounts']),
      ])
  })
  .domain(hosts.app)
  .as('app')
  .use(middleware.translations(['auth']))
