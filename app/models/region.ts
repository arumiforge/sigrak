import { RegionSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export type RegionLevel = 'province' | 'regency' | 'district'
export type RegencyKind = 'kabupaten' | 'kota'
export type RegionStatus = 'active' | 'retired'
/** The word the UI puts before the name (lang key `regions.kinds.<kind>`). */
export type RegionKind = 'province' | RegencyKind | 'district'

/**
 * One node of the region tree (D-456, D-466): a province, a kabupaten
 * or kota (`regency`), or a kecamatan (`district`). Keyed by the
 * Kemendagri code (`33`, `33.19`, `33.19.03`) with the Kemendikdasmen/
 * Dapodik code alongside. Reference data: written by migrations and
 * seeders only (app/regions/region_list.ts).
 */
export default class Region extends RegionSchema {
  declare level: RegionLevel
  declare regencyKind: RegencyKind | null
  declare status: RegionStatus

  @belongsTo(() => Region, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof Region>

  @hasMany(() => Region, { foreignKey: 'parentId' })
  declare children: HasMany<typeof Region>

  get kind(): RegionKind {
    return this.level === 'regency' ? (this.regencyKind ?? 'kabupaten') : this.level
  }
}
