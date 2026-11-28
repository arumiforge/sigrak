/**
 * Vocabulary of the layer model (D-456, D-466,
 * docs/drafts/regional-layers.md §2). The same lists feed the database
 * CHECKs (migrations 17643500…), so code and database never drift.
 */

/** Layers from the top down. Code says `regency`/`district`; the UI says Kabupaten/Kota and Kecamatan. */
export const LAYERS = ['national', 'province', 'regency', 'district', 'school'] as const
export type Layer = (typeof LAYERS)[number]
export type RegionLayer = 'province' | 'regency' | 'district'
export const REGION_LAYERS: readonly RegionLayer[] = ['province', 'regency', 'district']

export const LINES = ['kemendikdasmen', 'kemenag', 'all'] as const
export type Line = (typeof LINES)[number]

/** `base` national, `official` automatic, `local_agreement` opt-in, `school` the school's own differences. */
export const PACKAGE_KINDS = ['base', 'official', 'local_agreement', 'school'] as const
export type PackageKind = (typeof PACKAGE_KINDS)[number]

export const PACKAGE_STATUSES = ['draft', 'active', 'retired'] as const
export type PackageStatus = (typeof PACKAGE_STATUSES)[number]

export const LEVEL_SCOPES = ['sd', 'mi', 'both'] as const
export type LevelScope = (typeof LEVEL_SCOPES)[number]

/** Rule strengths (D-353). Only `mandatory` blocks hides and overrides. */
export const FORCES = [
  'mandatory',
  'minimum',
  'maximum',
  'recommended',
  'not_recommended',
  'example',
  'school_discretion',
  'teacher_discretion',
  'free',
] as const
export type Force = (typeof FORCES)[number]

export const ORIGINS = ['official', 'sigrak', 'local_agreement', 'school'] as const
export type Origin = (typeof ORIGINS)[number]

/** `list`: a set member (add or hide). `setting`: one value per key, the nearest layer wins. */
export const ITEM_SHAPES = ['list', 'setting'] as const
export type ItemShape = (typeof ITEM_SHAPES)[number]

export const ITEM_STATUSES = ['active', 'retired', 'shadowed'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const HIDE_STATUSES = ['active', 'void'] as const
export const VOID_REASONS = [
  'became_mandatory',
  'group_minimum',
  'target_retired',
  'region_changed',
  'unhidden',
] as const
export type VoidReason = (typeof VOID_REASONS)[number]

export const CHOICE_STATUSES = ['active', 'ended'] as const
export const CHOICE_END_REASONS = ['operator_left', 'package_retired', 'region_changed'] as const
export type ChoiceEndReason = (typeof CHOICE_END_REASONS)[number]

export const PROPOSAL_ACTIONS = [
  'add',
  'revise',
  'hide',
  'unhide',
  'retire',
  'create_package',
  'retire_package',
] as const
export type ProposalAction = (typeof PROPOSAL_ACTIONS)[number]

export const PROPOSAL_STATUSES = [
  'draft',
  'submitted',
  'returned',
  'approved',
  'rejected',
  'withdrawn',
] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const NOTICE_KINDS = [
  'became_mandatory',
  'region_changed',
  'package_chosen',
  'package_left',
  'package_retired',
  'proposal_decided',
  'package_carried_over',
] as const
export type NoticeKind = (typeof NOTICE_KINDS)[number]

export const NOTICE_AUDIENCES = ['operator', 'principal', 'all'] as const
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number]

export function layerRank(layer: Layer) {
  return LAYERS.indexOf(layer)
}

/**
 * Where a regulation, page or article is cited (`source_ref` of items,
 * `evidence` of packages and proposals).
 */
export interface SourceRef {
  regulation?: string
  article?: string
  pages?: number[]
  note?: string
  [key: string]: unknown
}

/**
 * Evidence for an official package or a local agreement (§2.3, D-466):
 * a registered regulation or the agreement document, with the date the
 * approver checked it.
 */
export interface Evidence {
  regulation_code?: string | null
  document_title?: string | null
  source_file?: string | null
  sha256?: string | null
  source_url?: string | null
  pages?: number[] | null
  checked_on?: string | null
  note?: string | null
}
