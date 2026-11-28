import { AnnouncementSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type {
  AnnouncementKind,
  PublishStatus,
  TargetLevel,
  TargetRole,
} from '#publishing/announcement_rules'

/** bigint[] arrives from pg as strings; ids are far below 2^53. */
const ids = {
  consume: (value: (string | number)[] | null) => (value ?? []).map(Number),
}

/**
 * A Kabar from Tim SIGRAK (D-319, D-477): in the app for its targets,
 * on sigrak.com/kabar, or both. Empty targets mean "all".
 */
export default class Announcement extends AnnouncementSchema {
  declare kind: AnnouncementKind
  declare status: PublishStatus
  declare targetLevels: TargetLevel[]
  declare targetRoles: TargetRole[]

  @column(ids)
  declare targetRegionIds: number[]

  @column(ids)
  declare targetSchoolIds: number[]
}
