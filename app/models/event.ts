import { EventSchema } from '#database/schema'
import type { PublishStatus } from '#publishing/announcement_rules'

/** An Acara on sigrak.com/acara (D-435): a date, a place or an online link. */
export default class Event extends EventSchema {
  declare status: PublishStatus
}
