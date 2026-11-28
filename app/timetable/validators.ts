import vine from '@vinejs/vine'
import {
  MAX_BREAKS,
  MAX_JP,
  MAX_LESSONS_PER_DAY,
  MIN_JP,
  openingKinds,
  slotKinds,
} from './types.js'

const clock = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
const checkbox = () => vine.boolean().optional()

/** One row of the Jadwal form (D-247). `subject` is the subject code. */
export const slotValidator = vine.create({
  weekday: vine.number().withoutDecimals().range([1, 6]),
  starts_at: clock(),
  ends_at: clock(),
  kind: vine.enum(slotKinds),
  subject: vine.string().trim().maxLength(20).nullable().optional(),
  label: vine.string().trim().maxLength(40).nullable().optional(),
  jp: vine.number().withoutDecimals().range([MIN_JP, MAX_JP]).nullable().optional(),
})

export const lockValidator = vine.create({
  locked: vine.boolean(),
})

/** The frame and switches of Susun Jadwal (D-262). */
export const settingsValidator = vine.create({
  days: vine
    .array(
      vine.object({
        weekday: vine.number().withoutDecimals().range([1, 6]),
        starts_at: clock(),
        lessons: vine.number().withoutDecimals().range([0, MAX_LESSONS_PER_DAY]),
        opening_kind: vine.enum(openingKinds).nullable().optional(),
        opening_label: vine.string().trim().maxLength(40).nullable().optional(),
        opening_minutes: vine.number().withoutDecimals().nullable().optional(),
      })
    )
    .minLength(1)
    .maxLength(6),
  breaks: vine
    .array(
      vine.object({
        after_lesson: vine.number().withoutDecimals().nullable().optional(),
        minutes: vine.number().withoutDecimals().nullable().optional(),
      })
    )
    .maxLength(MAX_BREAKS)
    .optional(),
  max_consecutive: checkbox(),
  pjok_morning: checkbox(),
  core_early: checkbox(),
  spread_week: checkbox(),
  no_split_break: checkbox(),
})

/** Susun draf: `all` or one class's public id, for a year. */
export const draftValidator = vine.create({
  year: vine.string().trim().uuid(),
  target: vine.string().trim().maxLength(64),
})
