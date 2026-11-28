import { LegalDocumentSchema } from '#database/schema'
import type { PublishStatus } from '#publishing/announcement_rules'
import type { LegalKey } from '#publishing/legal'

/**
 * One version of a legal page (D-435). Published versions never change
 * (a trigger refuses it); a new version starts as a draft.
 */
export default class LegalDocument extends LegalDocumentSchema {
  declare key: LegalKey
  declare status: PublishStatus
}
