import { toClock } from './time.js'
import type { PlainRow } from './types.js'
import type { YearState } from './year_state.js'

/**
 * Rows as the pages get them: times as `HH:MM` (the page shows
 * `HH.MM`), the subject and teacher by name, never internal ids
 * (D-182).
 */

export interface RowProps {
  publicId: string | null
  weekday: number
  periodNo: number | null
  startsAt: string
  endsAt: string
  kind: PlainRow['kind']
  label: string | null
  subjectCode: string | null
  subjectName: string | null
  /** Null: no teacher (yet) for a lesson (D-249). */
  teacherName: string | null
  jp: number
  locked: boolean
  /** A lesson of a subject the class no longer takes. */
  notTaught: boolean
}

export function presentRow(
  state: YearState,
  classId: number,
  row: PlainRow,
  extra: { publicId?: string; periodNo?: number; locked?: boolean } = {}
): RowProps {
  const classState = state.classes.get(classId)
  const subject = row.subjectId === null ? null : state.subjects.get(row.subjectId)
  const teacherId =
    row.subjectId === null ? undefined : classState?.rules.teacherOf.get(row.subjectId)
  return {
    publicId: extra.publicId ?? null,
    weekday: row.weekday,
    periodNo: extra.periodNo ?? null,
    startsAt: toClock(row.start),
    endsAt: toClock(row.end),
    kind: row.kind,
    label: row.label,
    subjectCode: subject?.code ?? null,
    subjectName: subject?.name ?? null,
    teacherName: teacherId === undefined ? null : (state.teacherNames.get(teacherId) ?? null),
    jp: row.jp,
    locked: extra.locked ?? false,
    notTaught:
      row.kind === 'lesson' &&
      row.subjectId !== null &&
      !classState?.rules.taken.has(row.subjectId),
  }
}

/** The stored rows of a class, in day and period order. */
export function classRows(state: YearState, classId: number): RowProps[] {
  return state.slots
    .filter((slot) => slot.classId === classId)
    .sort((a, b) => a.weekday - b.weekday || a.periodNo - b.periodNo)
    .map((slot) =>
      presentRow(state, classId, slot.toPlain(), {
        publicId: slot.publicId,
        periodNo: slot.periodNo,
        locked: slot.isLocked,
      })
    )
}
