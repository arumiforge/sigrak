import { SchoolPackageChoiceSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { withPublicId } from '#models/mixins/with_public_id'
import { withSchoolScope } from '#tenancy/with_school_scope'
import type { ChoiceEndReason } from '../types.js'
import LayerPackage from './layer_package.js'

/**
 * A school following a local agreement for one school year (§7).
 */
export default class SchoolPackageChoice extends compose(
  SchoolPackageChoiceSchema,
  withSchoolScope,
  withPublicId
) {
  declare status: 'active' | 'ended'
  declare endReason: ChoiceEndReason | null

  @belongsTo(() => LayerPackage, { foreignKey: 'packageId' })
  declare package: BelongsTo<typeof LayerPackage>
}
