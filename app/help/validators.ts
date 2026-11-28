import vine from '@vinejs/vine'
import {
  HELP_CATEGORIES,
  HELP_STATUSES,
  MESSAGE_MAX,
  MESSAGE_MIN,
  NOTE_MAX,
  PAGE_URL_MAX,
} from './catalog.js'

/** The Minta bantuan form (app.). */
export const helpRequestValidator = vine.create({
  category: vine.enum(HELP_CATEGORIES),
  message: vine.string().trim().minLength(MESSAGE_MIN).maxLength(MESSAGE_MAX),
  page_url: vine
    .string()
    .trim()
    .maxLength(PAGE_URL_MAX * 2)
    .optional(),
})

/** `?halaman=` on the form: the page the user came from. */
export const helpFormQueryValidator = vine.create({
  halaman: vine
    .string()
    .trim()
    .maxLength(PAGE_URL_MAX * 2)
    .optional(),
})

/** Console list filters. */
export const helpFilterValidator = vine.create({
  status: vine.enum(HELP_STATUSES).optional(),
  jenis: vine.enum(HELP_CATEGORIES).optional(),
  wilayah: vine.number().withoutDecimals().positive().optional(),
  petugas: vine.enum(['saya', 'kosong'] as const).optional(),
  halaman: vine.number().withoutDecimals().positive().max(10_000).optional(),
})

/** A reply to the sender, optionally with a status change and a mail. */
export const helpReplyValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(NOTE_MAX),
  status: vine.enum(HELP_STATUSES).optional(),
  email: vine.boolean().optional(),
})

/** An internal note (never shown to the school). */
export const helpNoteValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(NOTE_MAX),
})

export const helpStatusValidator = vine.create({
  status: vine.enum(HELP_STATUSES),
})

export const supportSessionListValidator = vine.create({
  halaman: vine.number().withoutDecimals().positive().max(10_000).optional(),
})

/**
 * The app path a request was sent from, or null: only a path on the
 * same site ("/kelas?tahun=…"), never another host, and not the help
 * pages themselves.
 */
export function cleanPageUrl(value: string | undefined | null): string | null {
  if (!value) return null
  let path = value.trim()
  try {
    // A full URL keeps only its path, query and hash.
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
      const url = new URL(path)
      path = `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return null
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  if ([...path].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    return null
  }
  if (path.startsWith('/minta-bantuan') || path.startsWith('/bantuan-saya')) return null
  return path.slice(0, PAGE_URL_MAX)
}
