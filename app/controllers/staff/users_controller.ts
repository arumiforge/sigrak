import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import User from '#models/user'
import { authorizeTrialChange, changeUserTrial } from '#accounts/console'
import { trialExtendMaxDays } from '#accounts/settings'
import { trialOf } from '#accounts/trial'
import { applySchoolScope, authorizeStaff, schoolScopeOf, staffCan } from '#staff/access'
import { staffReadTransaction } from '#tenancy/tenant_transaction'
import { trialChangeValidator } from '#validators/accounts'

const searchValidator = vine.create({ q: vine.string().trim().maxLength(254).optional() })

/**
 * Konsol: find a school user by name or email and change their own
 * trial (D-459). Ability `users.view`; a staff member with an area sees
 * only users with an active membership in a school of that area
 * (D-338). The list is read as read-only staff (`staffReadTransaction`,
 * D-469), memberships and schools included.
 */
export default class UsersController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'users.view')
    const scope = schoolScopeOf(staff, 'users.view')
    const { q } = await searchValidator.validate(ctx.request.qs())

    const rows = q
      ? await staffReadTransaction(async (trx) => {
          const users = await User.query({ client: trx })
            .where((where) => {
              where.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`)
            })
            .if(!scope.all, (query) =>
              query.whereExists((members) => {
                members
                  .from('school_memberships as m')
                  .join('schools', 'schools.id', 'm.school_id')
                  .whereColumn('m.user_id', 'users.id')
                  .where('m.status', 'active')
                applySchoolScope(members, scope)
              })
            )
            .orderBy('name', 'asc')
            .limit(50)
          const found = []
          // One transaction client: the trials are read one after another.
          for (const user of users) {
            const trial = await trialOf(user, trx)
            found.push({
              id: user.id,
              name: user.name,
              email: user.email,
              trial: {
                started: trial.endsAt !== null,
                active: trial.active,
                days: trial.days,
                source: trial.source,
                endsAt: trial.endsAt?.toISO() ?? null,
              },
            })
          }
          return found
        })
      : []

    return ctx.inertia.render('console/users', {
      q: q ?? '',
      users: rows,
      can: {
        manageTrials: staffCan(staff, 'trials.manage'),
        extendTrials: staffCan(staff, 'trials.extend'),
      },
      trialExtendMaxDays: await trialExtendMaxDays(),
    })
  }

  async updateTrial(ctx: HttpContext) {
    const userId = Number(ctx.params.user)
    const change = await ctx.request.validateUsing(trialChangeValidator)
    const staff = await authorizeTrialChange(ctx, change, { userId })
    const user = await changeUserTrial(staff, userId, change)
    ctx.session.flash('success', ctx.i18n.t('console.trial.saved'))
    return ctx.response.redirect().toPath(`/pengguna?q=${encodeURIComponent(user.email)}`)
  }
}
