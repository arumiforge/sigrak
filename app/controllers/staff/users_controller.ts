import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'
import User from '#models/user'
import { changeUserTrial } from '#accounts/console'
import { staffUser } from '#accounts/http'
import { trialOf } from '#accounts/trial'
import { authorizeStaff, staffCan } from '#accounts/staff_access'
import { trialChangeValidator } from '#validators/accounts'

const searchValidator = vine.create({ q: vine.string().trim().maxLength(254).optional() })

/**
 * Konsol: find a school user by name or email and change their own
 * trial (D-459). Users are not school-owned, so the owner connection
 * reads them; their trial reads their memberships the same way.
 */
export default class UsersController {
  async index(ctx: HttpContext) {
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'schools.view')
    const { q } = await searchValidator.validate(ctx.request.qs())

    const users = q
      ? await User.query()
          .where((where) => {
            where.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`)
          })
          .orderBy('name', 'asc')
          .limit(50)
      : []

    const rows = await Promise.all(
      users.map(async (user) => {
        const trial = await trialOf(user, db.connection())
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          trial: {
            started: trial.startedAt !== null,
            active: trial.active,
            days: trial.days,
            source: trial.source,
            endsAt: trial.endsAt?.toISO() ?? null,
          },
        }
      })
    )

    return ctx.inertia.render('console/users', {
      q: q ?? '',
      users: rows,
      can: { manageTrials: staffCan(staff, 'trials.manage') },
    })
  }

  async updateTrial(ctx: HttpContext) {
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'trials.manage')
    const change = await ctx.request.validateUsing(trialChangeValidator)
    const user = await changeUserTrial(staff, Number(ctx.params.user), change)
    ctx.session.flash('success', ctx.i18n.t('console.trial.saved'))
    return ctx.response.redirect().toPath(`/pengguna?q=${encodeURIComponent(user.email)}`)
  }
}
