/**
 * Fixed lists of Minta Bantuan (R2-06, D-320), matching the CHECK
 * constraints of the help_requests migration. Labels are in
 * resources/lang/id/help.json (`help.categories.*`, `help.statuses.*`).
 */

/** What the request is about (close to the app areas of Bank Masalah). */
export const HELP_CATEGORIES = [
  'account',
  'school_data',
  'content',
  'ai_key',
  'exam',
  'payment',
  'other',
] as const
export type HelpCategory = (typeof HELP_CATEGORIES)[number]

/** Baru, Diproses, Selesai (D-320). */
export const HELP_STATUSES = ['new', 'in_progress', 'done'] as const
export type HelpStatus = (typeof HELP_STATUSES)[number]

/** Timeline entries: the sender sees `reply` and `status`, never `note`. */
export const HELP_NOTE_KINDS = ['reply', 'note', 'status'] as const
export type HelpNoteKind = (typeof HELP_NOTE_KINDS)[number]

/** The role the sender acted as when sending. */
export type SenderRole = 'principal' | 'operator' | 'teacher'

export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 2000
export const NOTE_MAX = 4000
export const PAGE_URL_MAX = 500

/** A support session closes by itself after this long (R2-06). */
export const SUPPORT_SESSION_HOURS = 2
