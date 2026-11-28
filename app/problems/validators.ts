import vine from '@vinejs/vine'
import {
  CREDITS_MAX,
  DECISION_NOTE_MAX,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  EVIDENCE_LINKS_MAX,
  FORUM_OUTCOMES,
  GOOD_PRACTICE_TYPES,
  LINK_MAX,
  MANUAL_SOURCES,
  MEETING_NOTES_MAX,
  NAME_MAX,
  PROBLEM_LEVELS,
  PROBLEM_SOURCES,
  PROBLEM_STATUSES,
  REGULATIONS_MAX,
  RELEASE_NOTE_MAX,
  ROOT_CAUSE_MAX,
  SUMMARY_MAX,
  TITLE_MAX,
} from './catalog.js'

const id = () => vine.number().withoutDecimals().positive()
const title = () => vine.string().trim().minLength(3).maxLength(TITLE_MAX)
const description = () => vine.string().trim().minLength(DESCRIPTION_MIN).maxLength(DESCRIPTION_MAX)
/** An empty select ("Semua wilayah", "Semua jenjang") arrives as "" and means none. */
const optionalId = () => vine.number().withoutDecimals().positive().optional().nullable()
const optionalLevel = () => vine.enum(PROBLEM_LEVELS).optional().nullable()
const link = () =>
  vine
    .string()
    .trim()
    .maxLength(LINK_MAX)
    .url({ protocols: ['http', 'https'], require_protocol: true })

/** Console list filters (Bank Masalah). */
export const problemFilterValidator = vine.create({
  status: vine.enum([...PROBLEM_STATUSES, 'open'] as const).optional(),
  sumber: vine.enum(PROBLEM_SOURCES).optional(),
  cari: vine.string().trim().maxLength(100).optional(),
  halaman: vine.number().withoutDecimals().positive().max(10_000).optional(),
})

/** "Catat masalah" by hand. */
export const recordProblemValidator = vine.create({
  title: title(),
  description: description(),
  source: vine.enum(MANUAL_SOURCES),
  region_id: optionalId(),
  level: optionalLevel(),
})

export const updateProblemValidator = vine.create({
  title: title(),
  description: description(),
  region_id: optionalId(),
  level: optionalLevel(),
})

export const moveProblemValidator = vine.create({
  status: vine.enum(PROBLEM_STATUSES),
  release_note: vine.string().trim().maxLength(RELEASE_NOTE_MAX).optional(),
})

export const mergeProblemValidator = vine.create({
  target_id: id(),
})

/** One analysis: root cause, regulation check, evidence links, credits. */
export const analysisValidator = vine.create({
  root_cause: vine.string().trim().minLength(10).maxLength(ROOT_CAUSE_MAX),
  regulations: vine.string().trim().maxLength(REGULATIONS_MAX).optional(),
  /** One link per line. */
  evidence_links: vine
    .string()
    .trim()
    .maxLength(EVIDENCE_LINKS_MAX * (LINK_MAX + 2))
    .optional(),
  credited_staff_ids: vine.array(id()).maxLength(CREDITS_MAX).optional(),
  /** Outside contributors, one name per line. */
  credited_names: vine
    .string()
    .trim()
    .maxLength(CREDITS_MAX * (NAME_MAX + 2))
    .optional(),
})

/** Lines of a textarea, trimmed, without empty ones. */
export function lines(value: string | undefined | null): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

const urlCheck = vine.create({ url: link() })

/** The evidence links, each a full http(s) URL; null when one is not. */
export async function evidenceLinks(value: string | undefined): Promise<string[] | null> {
  const list = lines(value)
  if (list.length > EVIDENCE_LINKS_MAX) return null
  for (const url of list) {
    const [error] = await urlCheck.tryValidate({ url })
    if (error) return null
  }
  return list
}

/** "Jadikan masalah" on a help request: a new problem, or link to an open one. */
export const toProblemValidator = vine.create({
  mode: vine.enum(['new', 'link'] as const),
  title: title().optional().requiredWhen('mode', '=', 'new'),
  description: description().optional().requiredWhen('mode', '=', 'new'),
  problem_id: id().optional().requiredWhen('mode', '=', 'link'),
})

export const goodPracticeValidator = vine.create({
  title: title(),
  summary: vine.string().trim().minLength(10).maxLength(SUMMARY_MAX),
  type: vine.enum(GOOD_PRACTICE_TYPES),
  /** One author per line. */
  authors: vine
    .string()
    .trim()
    .minLength(2)
    .maxLength(CREDITS_MAX * (NAME_MAX + 2)),
  link: link().optional(),
  level: optionalLevel(),
  year: vine.number().withoutDecimals().min(1945).max(2100).optional().nullable(),
  problem_id: optionalId(),
})

export const goodPracticeFilterValidator = vine.create({
  jenis: vine.enum(GOOD_PRACTICE_TYPES).optional(),
  cari: vine.string().trim().maxLength(100).optional(),
})

export const meetingValidator = vine.create({
  held_on: vine.date({ formats: ['YYYY-MM-DD'] }),
})

export const meetingUpdateValidator = vine.create({
  held_on: vine.date({ formats: ['YYYY-MM-DD'] }),
  notes: vine.string().trim().maxLength(MEETING_NOTES_MAX).optional(),
})

export const agendaValidator = vine.create({
  problem_id: id(),
})

export const agendaMoveValidator = vine.create({
  problem_id: id(),
  direction: vine.enum(['up', 'down'] as const),
})

export const decisionValidator = vine.create({
  problem_id: id(),
  outcome: vine.enum(FORUM_OUTCOMES),
  note: vine.string().trim().maxLength(DECISION_NOTE_MAX).optional(),
})
