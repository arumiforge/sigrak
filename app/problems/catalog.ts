import type { StaffAbility } from '#staff/abilities'

/**
 * Fixed lists of Bank Masalah, Bank Praktik Baik and the Forum
 * Masalah→Solusi (R2-07, D-439, D-477), matching the CHECK constraints
 * of the 1764560000001 migration. Labels are in
 * resources/lang/id/problems.json.
 */

/**
 * Baru, Dipilah, Dianalisis, Diputuskan, Dikerjakan, Rilis, Ditutup.
 * Tim Lapangan records and triages, Tim Kurikulum & Riset analyses,
 * the forum decides (the owner), Tim Produk builds and releases.
 */
export const PROBLEM_STATUSES = [
  'new',
  'triaged',
  'analysed',
  'decided',
  'in_progress',
  'released',
  'closed',
] as const
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number]

/** Where a problem came from (D-477: a help request, or by hand from a visit, chat or webinar). */
export const PROBLEM_SOURCES = ['help_request', 'field_note', 'webinar', 'other'] as const
export type ProblemSource = (typeof PROBLEM_SOURCES)[number]

/** Sources staff pick by hand; `help_request` only comes from "Jadikan masalah". */
export const MANUAL_SOURCES = ['field_note', 'webinar', 'other'] as const

export const PROBLEM_LEVELS = ['sd', 'mi'] as const
export type ProblemLevel = (typeof PROBLEM_LEVELS)[number]

/**
 * Who may move a problem from one status to the next (the console's
 * status buttons). Moves into Diputuskan, and out of Dianalisis into
 * Ditutup, are not here: only a forum decision makes them (D-439, the
 * owner decides in the forum). Merging closes a problem too (triage).
 */
export const TRANSITIONS: Record<ProblemStatus, Partial<Record<ProblemStatus, StaffAbility>>> = {
  new: { triaged: 'problems.triage', closed: 'problems.triage' },
  triaged: { analysed: 'problems.analyse', new: 'problems.triage', closed: 'problems.triage' },
  analysed: { triaged: 'problems.analyse' },
  decided: { in_progress: 'problems.deliver' },
  in_progress: { released: 'problems.deliver', decided: 'problems.deliver' },
  released: { closed: 'problems.deliver', in_progress: 'problems.deliver' },
  closed: { triaged: 'problems.triage' },
}

/** Problems that can still be worked on, linked to or put on a forum agenda. */
export const OPEN_STATUSES: readonly ProblemStatus[] = [
  'new',
  'triaged',
  'analysed',
  'decided',
  'in_progress',
]

/** Problems a forum agenda takes: analysed ones wait for a decision. */
export const AGENDA_STATUSES: readonly ProblemStatus[] = ['analysed']

/** Forum outcomes: go ahead (Diputuskan), not pursued (Ditutup), later (unchanged). */
export const FORUM_OUTCOMES = ['go', 'decline', 'defer'] as const
export type ForumOutcome = (typeof FORUM_OUTCOMES)[number]

export const FORUM_STATUSES = ['planned', 'held'] as const
export type ForumStatus = (typeof FORUM_STATUSES)[number]

/** Bank Praktik Baik entry types: good practice, PTK, skripsi, seminar, webinar (D-439). */
export const GOOD_PRACTICE_TYPES = [
  'practice',
  'classroom_research',
  'thesis',
  'seminar',
  'webinar',
] as const
export type GoodPracticeType = (typeof GOOD_PRACTICE_TYPES)[number]

export const TITLE_MAX = 160
export const DESCRIPTION_MIN = 10
export const DESCRIPTION_MAX = 4000
export const RELEASE_NOTE_MAX = 1000
export const ROOT_CAUSE_MAX = 4000
export const REGULATIONS_MAX = 2000
export const EVIDENCE_LINKS_MAX = 10
export const CREDITS_MAX = 10
export const NAME_MAX = 120
export const LINK_MAX = 500
export const SUMMARY_MAX = 2000
export const MEETING_NOTES_MAX = 8000
export const DECISION_NOTE_MAX = 1000

/** "BM-0042": the number staff use for a problem. */
export function problemNumber(id: number) {
  return `BM-${String(id).padStart(4, '0')}`
}
