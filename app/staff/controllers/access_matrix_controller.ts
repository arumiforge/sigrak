import type { HttpContext } from '@adonisjs/core/http'
import { ABILITY_GROUPS } from '../abilities.js'
import { authorizeStaff, rolesOf } from '../access.js'
import { POWERS } from '../powers.js'
import { ROLE_SCOPES, STAFF_ROLES } from '../roles.js'

/**
 * Konsol: Peran (D-314, D-481). The read-only matrix of roles and
 * abilities, straight from app/staff/powers.ts, so the page can never
 * drift from what the code enforces. A cell is "within scope" when the
 * role uses an area, level or field scope. Ability `access.view`
 * (every staff member).
 */
export default class AccessMatrixController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'access.view')
    const scoped = (role: (typeof STAFF_ROLES)[number]) => {
      const rule = ROLE_SCOPES[role]
      return rule.area !== 'none' || rule.levels || rule.fields
    }
    return ctx.inertia.render('console/access_matrix', {
      roles: STAFF_ROLES.map((role) => ({ role, scoped: scoped(role), scope: ROLE_SCOPES[role] })),
      groups: Object.entries(ABILITY_GROUPS).map(([group, abilities]) => ({
        group,
        abilities: abilities.map((ability) => ({
          ability,
          roles: STAFF_ROLES.filter((role) => POWERS[role].includes(ability)),
        })),
      })),
      ownRoles: rolesOf(staff),
    })
  }
}
