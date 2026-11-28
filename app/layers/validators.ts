import vine from '@vinejs/vine'

export const hideValidator = vine.create({
  reason: vine.string().trim().maxLength(300).optional(),
})

export const schoolProposalValidator = vine.create({
  action: vine.enum(['add', 'hide', 'unhide', 'retire'] as const),
  item_key: vine.string().trim().maxLength(80).optional(),
  reason: vine.string().trim().maxLength(500).optional(),
  label: vine.string().trim().maxLength(160).optional(),
  category: vine.string().trim().maxLength(40).optional(),
  description: vine.string().trim().maxLength(500).optional(),
  scouting: vine.boolean().optional(),
})

export const decisionValidator = vine.create({
  note: vine.string().trim().maxLength(500).optional(),
})

export const areaDecisionValidator = vine.create({
  note: vine.string().trim().maxLength(500).optional(),
  evidence_checked: vine.boolean().optional(),
})

export const areaProposalValidator = vine.create({
  domain: vine.string().trim().maxLength(40),
  region_id: vine.number().withoutDecimals().min(1),
  action: vine.enum(['create_package', 'add', 'hide', 'retire_package'] as const),
  package_id: vine.string().trim().uuid().optional(),
  item_key: vine.string().trim().maxLength(80).optional(),
  reason: vine.string().trim().maxLength(500).optional(),
  kind: vine.enum(['official', 'local_agreement'] as const).optional(),
  name: vine.string().trim().maxLength(200).optional(),
  line: vine.enum(['all', 'kemendikdasmen', 'kemenag'] as const).optional(),
  level_scope: vine.enum(['both', 'sd', 'mi'] as const).optional(),
  applies_from_school_year: vine.string().trim().maxLength(9).optional(),
  label: vine.string().trim().maxLength(160).optional(),
  category: vine.string().trim().maxLength(40).optional(),
  evidence_regulation: vine.string().trim().maxLength(120).optional(),
  evidence_document: vine.string().trim().maxLength(200).optional(),
  evidence_url: vine.string().trim().url().maxLength(500).optional(),
  evidence_pages: vine.string().trim().maxLength(100).optional(),
})
