import { DateTime } from 'luxon'
import i18nManager from '@adonisjs/i18n/services/main'
import { refuseClosed } from '../school_year/academic_years.js'
import { lockYear } from '../school_year/classes.js'
import { SchoolYearRuleError } from '../school_year/errors.js'
import type AcademicYear from '../school_year/models/academic_year.js'
import {
  DEFAULT_ATTEMPTS,
  type BusyInterval,
  type GenClass,
  type GeneratorInput,
  type GeneratorResult,
} from './draft_generator.js'
import { describeViolation } from './messages.js'
import TimetableDraft from './models/timetable_draft.js'
import TimetableSlot from './models/timetable_slot.js'
import { checkRows, teacherOfRow, type RuleRow } from './rules.js'
import { renumberDays } from './slots.js'
import { toClock } from './time.js'
import type { DayFrame, Preferences } from './types.js'
import { loadYearState, ruleRowOf, type TimetableDeps, type YearState } from './year_state.js'

/**
 * Draft timetables (D-262, D-381): what the generator gets from the
 * database, and saving a draft over the unlocked rows of its classes.
 * Runs inside a tenant transaction of the school.
 */

/** Drafts kept per school; older ones are removed when a new one is made. */
export const KEPT_DRAFTS = 10

export async function createDraft(
  year: AcademicYear,
  classIds: number[],
  settings: { frame: DayFrame; preferences: Preferences },
  seed: number,
  createdById: number | null
) {
  refuseClosed(year)
  if (classIds.length === 0) throw new SchoolYearRuleError(null, 'timetable.errors.no_classes')
  const draft = await TimetableDraft.create({
    academicYearId: year.id,
    classIds,
    seed,
    status: 'queued',
    input: settings,
    result: null,
    createdById,
  })
  const old = await TimetableDraft.query()
    .whereNot('status', 'running')
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .offset(KEPT_DRAFTS)
  for (const row of old) await row.delete()
  return draft
}

/**
 * The generator's input for `classIds` of the year: the subjects with
 * their allocation and teacher, the locked rows, and every time a
 * teacher already teaches in a row that stays (other classes of the
 * year, locked rows).
 */
export function generatorInput(
  state: YearState,
  classIds: number[],
  settings: { frame: DayFrame; preferences: Preferences },
  seed: number
): GeneratorInput {
  const inDraft = new Set(classIds.filter((id) => state.classes.has(id)))
  const classes: GenClass[] = [...inDraft].map((classId) => {
    const classState = state.classes.get(classId)!
    return {
      id: classId,
      subjects: classState.subjects.map((subject) => ({
        subjectId: subject.subjectId,
        code: subject.code,
        religion: subject.religion,
        teacherId: classState.rules.teacherOf.get(subject.subjectId) ?? null,
        allocation: subject.jpPerWeek,
      })),
      locked: state.slots
        .filter((slot) => slot.classId === classId && slot.isLocked)
        .map((slot) => slot.toPlain()),
    }
  })
  const busy: BusyInterval[] = []
  for (const slot of state.slots) {
    if (inDraft.has(slot.classId) && !slot.isLocked) continue
    const teacherId = teacherOfRow(ruleRowOf(slot), state.context)
    if (teacherId === null) continue
    const plain = slot.toPlain()
    busy.push({ teacherId, weekday: plain.weekday, start: plain.start, end: plain.end })
  }
  return {
    seed,
    attempts: DEFAULT_ATTEMPTS,
    frame: settings.frame,
    preferences: settings.preferences,
    classes,
    busy,
  }
}

/**
 * Saves a ready draft (D-381): every unlocked row of each class in the
 * draft is replaced by the draft's rows; locked rows stay. The new rows
 * pass the same rules as the manual form first (D-262); a draft that no
 * longer fits (a teacher changed, a row was locked meanwhile) is
 * refused and nothing changes.
 */
export async function saveDraft(deps: TimetableDeps, draft: TimetableDraft, year: AcademicYear) {
  if (draft.status !== 'ready' || !draft.result) {
    throw new SchoolYearRuleError(null, 'timetable.errors.draft_not_ready')
  }
  refuseClosed(year)
  await lockYear(year)
  const state = await loadYearState(deps, year, { lockSlots: true })
  const result: GeneratorResult = draft.result
  const classes = result.classes.filter((row) => state.classes.has(row.classId))
  const replaced = new Set(classes.map((row) => row.classId))

  const newRows: RuleRow[] = classes.flatMap((row) =>
    row.rows.map((plain, index) => ({
      ...plain,
      key: `new-${row.classId}-${index}`,
      classId: row.classId,
    }))
  )
  const kept = state.slots
    .filter((slot) => !replaced.has(slot.classId) || slot.isLocked)
    .map(ruleRowOf)
  const violations = checkRows([...kept, ...newRows], state.context, (row) =>
    row.key.startsWith('new-')
  )
  if (violations.length > 0) {
    const detail = describeViolation(violations[0], state)
    throw new SchoolYearRuleError(null, 'timetable.errors.draft_stale', {
      class: state.classes.get(violations[0].row.classId)?.model.name ?? '',
      detail: i18nManager.locale('id').t(detail.key, detail.params),
    })
  }

  for (const classId of replaced) {
    await TimetableSlot.query().where('class_id', classId).where('is_locked', false).delete()
  }
  let order = 1000
  for (const row of newRows) {
    await TimetableSlot.create({
      classId: row.classId,
      weekday: row.weekday,
      startsAt: toClock(row.start),
      endsAt: toClock(row.end),
      kind: row.kind,
      label: row.label,
      subjectId: row.subjectId,
      jp: row.jp,
      isLocked: false,
      periodNo: order++,
    })
  }
  for (const classId of replaced) await renumberDays(classId, [1, 2, 3, 4, 5, 6])

  draft.status = 'saved'
  draft.savedAt = DateTime.now()
  await draft.save()
  return { classes: replaced.size, rows: newRows.length }
}
