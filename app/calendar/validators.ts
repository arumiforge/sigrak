import vine from '@vinejs/vine'

/** The year and class of a calendar form; the event fields are checked by the calendar adapter. */
export const eventFormValidator = vine.create({
  year: vine.string().trim().uuid().optional(),
  class: vine.string().trim().uuid().optional(),
  kind: vine.string().trim().maxLength(20),
  exam_type: vine.string().trim().maxLength(10).optional(),
  title: vine.string().trim().maxLength(150),
  starts_on: vine.string().trim().maxLength(10),
  ends_on: vine.string().trim().maxLength(10).optional(),
})

export const calendarProposalValidator = vine.create({
  year: vine.string().trim().uuid().optional(),
  action: vine.enum(['add', 'revise', 'hide', 'unhide', 'retire'] as const),
  item_key: vine.string().trim().maxLength(80).optional(),
  reason: vine.string().trim().maxLength(500).optional(),
  class: vine.string().trim().uuid().optional(),
  kind: vine.string().trim().maxLength(20).optional(),
  exam_type: vine.string().trim().maxLength(10).optional(),
  title: vine.string().trim().maxLength(150).optional(),
  starts_on: vine.string().trim().maxLength(10).optional(),
  ends_on: vine.string().trim().maxLength(10).optional(),
})

export const yearFormValidator = vine.create({
  year: vine.string().trim().uuid().optional(),
  reason: vine.string().trim().maxLength(300).optional(),
})

export const consoleImportValidator = vine.create({
  file: vine
    .string()
    .trim()
    .regex(/^[a-z0-9-]+\.json$/),
})
