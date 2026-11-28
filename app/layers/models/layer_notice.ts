import { LayerNoticeSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { withPublicId } from '#models/mixins/with_public_id'
import { withSchoolScope } from '#tenancy/with_school_scope'
import type { NoticeAudience, NoticeKind } from '../types.js'

/**
 * A notice for a school's operator and principal about a layer change.
 */
export default class LayerNotice extends compose(LayerNoticeSchema, withSchoolScope, withPublicId) {
  declare kind: NoticeKind
  declare audience: NoticeAudience
  declare payload: Record<string, unknown>
}
