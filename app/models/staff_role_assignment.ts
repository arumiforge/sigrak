import { StaffRoleAssignmentSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import StaffUser from '#models/staff_user'
import type { ScopeField, ScopeLevel, StaffRole } from '#staff/roles'

/** bigint[] arrives from pg as strings; ids are far below 2^53. */
const ids = {
  consume: (value: (string | number)[] | null) => (value ?? []).map(Number),
}

/**
 * One role of one staff member with its scope (D-338, D-339): region
 * ids, a named school list, levels and fields. Empty parts mean what
 * app/staff/roles.ts says for the role.
 */
export default class StaffRoleAssignment extends StaffRoleAssignmentSchema {
  declare role: StaffRole
  declare levels: ScopeLevel[]
  declare fields: ScopeField[]

  @column(ids)
  declare regionIds: number[]

  @column(ids)
  declare schoolIds: number[]

  @belongsTo(() => StaffUser)
  declare staffUser: BelongsTo<typeof StaffUser>
}
