import { LayerPackageSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Region from '#models/region'
import { withPublicId } from '#models/mixins/with_public_id'
import type {
  Evidence,
  Layer,
  LevelScope,
  Line,
  PackageKind,
  PackageStatus,
} from '../types.js'
import { withTenantConnection } from './with_tenant_connection.js'

/**
 * A versioned bundle of layered items one authority set for one area
 * and domain (docs/drafts/regional-layers.md §2.3).
 */
export default class LayerPackage extends compose(
  LayerPackageSchema,
  withTenantConnection,
  withPublicId
) {
  declare layer: Layer
  declare line: Line
  declare kind: PackageKind
  declare levelScope: LevelScope
  declare status: PackageStatus
  declare evidence: Evidence | null

  @belongsTo(() => Region)
  declare region: BelongsTo<typeof Region>
}
