import { StorySchema } from '#database/schema'
import type { PublishStatus } from '#publishing/announcement_rules'

/** A Cerita Sekolah on sigrak.com (D-435), naming the school only with its consent. */
export default class Story extends StorySchema {
  declare status: PublishStatus
}
