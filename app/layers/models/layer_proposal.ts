import { LayerProposalSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Region from '#models/region'
import StaffUser from '#models/staff_user'
import User from '#models/user'
import { withPublicId } from '#models/mixins/with_public_id'
import type { Evidence, Layer, ProposalAction, ProposalStatus } from '../types.js'
import LayerPackage from './layer_package.js'
import { withTenantConnection } from './with_tenant_connection.js'

/**
 * A proposal to change a layer (§6): school proposals are school-owned
 * rows (RLS); area proposals are staff-only.
 */
export default class LayerProposal extends compose(
  LayerProposalSchema,
  withTenantConnection,
  withPublicId
) {
  declare targetLayer: Exclude<Layer, 'national'>
  declare action: ProposalAction
  declare status: ProposalStatus
  declare payload: Record<string, unknown>
  declare evidence: Evidence | null
  declare impact: Record<string, unknown> | null

  @belongsTo(() => LayerPackage, { foreignKey: 'packageId' })
  declare package: BelongsTo<typeof LayerPackage>

  @belongsTo(() => Region)
  declare region: BelongsTo<typeof Region>

  @belongsTo(() => User, { foreignKey: 'proposedByUserId' })
  declare proposedByUser: BelongsTo<typeof User>

  @belongsTo(() => StaffUser, { foreignKey: 'proposedByStaffId' })
  declare proposedByStaff: BelongsTo<typeof StaffUser>

  @belongsTo(() => User, { foreignKey: 'decidedByUserId' })
  declare decidedByUser: BelongsTo<typeof User>

  @belongsTo(() => StaffUser, { foreignKey: 'decidedByStaffId' })
  declare decidedByStaff: BelongsTo<typeof StaffUser>
}
