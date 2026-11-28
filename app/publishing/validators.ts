import vine from '@vinejs/vine'
import { ANNOUNCEMENT_KINDS, TARGET_LEVELS, TARGET_ROLES } from './announcement_rules.js'

/** "2026-12-01T08:00" from a datetime-local field (read as WIB). */
const dateTime = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
const date = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
const ids = () => vine.array(vine.number().withoutDecimals().positive()).maxLength(200).optional()
const link = () =>
  vine
    .string()
    .trim()
    .maxLength(500)
    .url({ protocols: ['http', 'https'], require_protocol: true })

const common = {
  title: vine.string().trim().minLength(3).maxLength(200),
  summary: vine.string().trim().maxLength(300).optional(),
  publish: vine.boolean().optional(),
}

export const announcementValidator = vine.create({
  ...common,
  body: vine.string().trim().minLength(1).maxLength(20000),
  kind: vine.enum(ANNOUNCEMENT_KINDS),
  show_in_app: vine.boolean(),
  show_public: vine.boolean(),
  target_region_ids: ids(),
  target_school_ids: ids(),
  target_levels: vine.array(vine.enum(TARGET_LEVELS)).maxLength(TARGET_LEVELS.length).optional(),
  target_roles: vine.array(vine.enum(TARGET_ROLES)).maxLength(TARGET_ROLES.length).optional(),
  show_from: dateTime().optional(),
  show_until: dateTime().optional(),
})

export const eventValidator = vine.create({
  ...common,
  body: vine.string().trim().maxLength(20000).optional(),
  event_start: dateTime(),
  event_end: dateTime().optional(),
  place: vine.string().trim().maxLength(200).optional(),
  online_url: link().optional(),
  registration_url: link().optional(),
})

export const storyValidator = vine.create({
  ...common,
  body: vine.string().trim().minLength(1).maxLength(20000),
  school_name: vine.string().trim().minLength(3).maxLength(200),
  consent_note: vine.string().trim().minLength(10).maxLength(500),
  consent_on: date(),
})

export const legalDocumentValidator = vine.create({
  title: vine.string().trim().minLength(3).maxLength(200),
  body: vine.string().trim().minLength(1).maxLength(100000),
  effective_on: date(),
  change_note: vine.string().trim().maxLength(300).optional(),
})

export const targetSearchValidator = vine.create({
  wilayah: vine.string().trim().minLength(2).maxLength(100).optional(),
  sekolah: vine.string().trim().minLength(2).maxLength(100).optional(),
})

export const pageValidator = vine.create({
  halaman: vine.number().withoutDecimals().min(1).max(10000).optional(),
  versi: vine.number().withoutDecimals().min(1).max(100000).optional(),
})
