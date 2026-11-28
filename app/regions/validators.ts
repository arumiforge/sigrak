import vine from '@vinejs/vine'

export const acceptRegionChangeValidator = vine.create({
  apply_from: vine.enum(['next_day', 'next_school_year'] as const),
})

export const rejectRegionChangeValidator = vine.create({
  note: vine.string().trim().maxLength(500).optional(),
})

export const directorySearchValidator = vine.create({
  npsn: vine.string().trim().optional(),
})
