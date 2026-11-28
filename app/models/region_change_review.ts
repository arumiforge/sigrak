import { RegionChangeReviewSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Region from '#models/region'
import School from '#models/school'
import SchoolDirectoryEntry from '#models/school_directory_entry'
import StaffUser from '#models/staff_user'
import { withSchoolScope } from '#tenancy/with_school_scope'

export type RegionChangeStatus = 'pending' | 'accepted' | 'rejected' | 'superseded'
export type RegionChangeApplyFrom = 'next_day' | 'next_school_year'

/**
 * "Perubahan wilayah": a school's region in the NPSN directory differs
 * from the school's own (D-466). Staff accept it from the next day or
 * the next school year, or reject it (app/regions/region_change_queue.ts).
 */
export default class RegionChangeReview extends compose(RegionChangeReviewSchema, withSchoolScope) {
  declare status: RegionChangeStatus
  declare applyFrom: RegionChangeApplyFrom | null

  @belongsTo(() => School)
  declare school: BelongsTo<typeof School>

  @belongsTo(() => SchoolDirectoryEntry, { foreignKey: 'directoryEntryId' })
  declare directoryEntry: BelongsTo<typeof SchoolDirectoryEntry>

  @belongsTo(() => Region, { foreignKey: 'fromRegionId' })
  declare fromRegion: BelongsTo<typeof Region>

  @belongsTo(() => Region, { foreignKey: 'fromDistrictId' })
  declare fromDistrict: BelongsTo<typeof Region>

  @belongsTo(() => Region, { foreignKey: 'toRegionId' })
  declare toRegion: BelongsTo<typeof Region>

  @belongsTo(() => Region, { foreignKey: 'toDistrictId' })
  declare toDistrict: BelongsTo<typeof Region>

  @belongsTo(() => StaffUser, { foreignKey: 'decidedByStaffId' })
  declare decidedBy: BelongsTo<typeof StaffUser>
}
