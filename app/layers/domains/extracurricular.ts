import vine from '@vinejs/vine'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { ResolvedItem } from '../resolver/resolve_core.js'
import { itemInput, normaliseLabel, type DomainAdapter, type LayeredRow } from './domain_adapter.js'

/**
 * Proof domain of R1-07: the extracurricular catalog
 * (`docs/data/catalogs/extracurriculars.json`) on `catalog_items`.
 * It is the simplest domain that still uses every part of the model:
 * list items only (no settings, no dates), a national base, the
 * kepanduan group rule (at least one, Pramuka by default, D-452), and
 * no table of an earlier task to migrate.
 */

export const EXTRACURRICULAR_CATEGORIES = [
  'scouting_leadership',
  'sports',
  'arts_culture',
  'martial_arts',
  'health',
  'science_technology',
] as const
export type ExtracurricularCategory = (typeof EXTRACURRICULAR_CATEGORIES)[number]

export const SCOUTING_GROUP = 'scouting'

export interface ExtracurricularValue {
  label: string
  category: ExtracurricularCategory | null
  catalogKey: string | null
  description: string | null
  offeredByDefault: boolean
  sortOrder: number
}

const payloadValidator = vine.create({
  label: vine.string().trim().minLength(2).maxLength(160),
  category: vine.enum(EXTRACURRICULAR_CATEGORIES).optional(),
  description: vine.string().trim().maxLength(500).optional(),
  scouting: vine.boolean().optional(),
})

export type ExtracurricularPayload = {
  label: string
  category?: ExtracurricularCategory
  description?: string
  scouting?: boolean
}

type Row = LayeredRow & {
  label: string
  category: ExtracurricularCategory | null
  catalog_key: string | null
  description: string | null
  offered_by_default: boolean
  sort_order: number
}

export const extracurricularAdapter: DomainAdapter<ExtracurricularValue, ExtracurricularPayload> = {
  domain: 'extracurricular',
  itemTable: 'catalog_items',
  keyPrefix: 'EKS',

  async loadItems(client: QueryClientContract, packageIds: number[]) {
    if (packageIds.length === 0) return []
    const rows = (await client
      .from('catalog_items')
      .whereIn('package_id', packageIds)
      .whereNot('status', 'retired')
      .select('*')) as Row[]
    return rows.map((row) =>
      itemInput<ExtracurricularValue>(row, {
        label: row.label,
        category: row.category,
        catalogKey: row.catalog_key,
        description: row.description,
        offeredByDefault: row.offered_by_default,
        sortOrder: row.sort_order,
      })
    )
  },

  async validatePayload(payload: unknown) {
    return payloadValidator.validate(payload)
  },

  matchKeyOf(payload) {
    return normaliseLabel(payload.label)
  },

  groupKeyOf(payload) {
    return payload.scouting ? SCOUTING_GROUP : null
  },

  columnsOf(payload) {
    return {
      label: payload.label,
      category: payload.category ?? (payload.scouting ? 'scouting_leadership' : null),
      description: payload.description ?? null,
      offered_by_default: false,
      sort_order: 1000,
    }
  },

  labelOf(value) {
    return value.label
  },

  compare(a: ResolvedItem<ExtracurricularValue>, b: ResolvedItem<ExtracurricularValue>) {
    const category = (value: ExtracurricularValue) =>
      value.category ? EXTRACURRICULAR_CATEGORIES.indexOf(value.category) : 99
    return (
      category(a.value) - category(b.value) ||
      a.value.sortOrder - b.value.sortOrder ||
      a.value.label.localeCompare(b.value.label, 'id')
    )
  },
}
