import db from '@adonisjs/lucid/services/db'
import type School from '#models/school'
import { asSchool } from '#tests/tenancy'
import { postForm, type Session } from '#tests/accounts'
import Subject from '../../../app/curriculum/models/subject.js'
import type SchoolClass from '../../../app/school_year/models/school_class.js'
import TeachingAssignment from '../../../app/school_year/models/teaching_assignment.js'
import TimetableSlot from '../../../app/timetable/models/timetable_slot.js'
import type { SlotKind } from '../../../app/timetable/types.js'

/**
 * Fixtures for the timetable tests (R1-09), on top of the school-year
 * fixtures (curriculum imported once per group).
 */

type Client = Parameters<typeof postForm>[0]

export async function subjectId(code: string) {
  const subject = await Subject.findByOrFail('code', code)
  return subject.id
}

/** Gives `code` in the class to `teacherId` (owner of the row: the class's school). */
export async function assign(
  school: School,
  schoolClass: SchoolClass,
  code: string,
  teacherId: number
) {
  const id = await subjectId(code)
  return asSchool(school, () =>
    TeachingAssignment.create({ classId: schoolClass.id, subjectId: id, teacherId })
  )
}

let period = 1

/** A row written directly, without the rules. */
export async function createSlot(
  school: School,
  schoolClass: SchoolClass,
  values: {
    weekday?: number
    startsAt: string
    endsAt: string
    kind?: SlotKind
    subject?: string
    jp?: number
    label?: string | null
    isLocked?: boolean
  }
) {
  const kind = values.kind ?? 'lesson'
  const subject = values.subject ? await subjectId(values.subject) : null
  return asSchool(school, () =>
    TimetableSlot.create({
      classId: schoolClass.id,
      weekday: values.weekday ?? 1,
      periodNo: period++,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      kind,
      label: values.label ?? null,
      subjectId: kind === 'lesson' ? subject : null,
      jp: kind === 'lesson' ? (values.jp ?? 1) : 0,
      isLocked: values.isLocked ?? false,
    })
  )
}

export function jadwalPath(schoolClass: SchoolClass) {
  return `/kelas/${schoolClass.publicId}/jadwal`
}

/** POSTs the Jadwal form of a class. */
export function addRow(
  client: Client,
  operator: Session,
  schoolClass: SchoolClass,
  data: Record<string, string | number>
) {
  return postForm(
    client,
    operator,
    jadwalPath(schoolClass),
    { weekday: 1, kind: 'lesson', ...data },
    jadwalPath(schoolClass)
  )
}

/** Rows of a class in day and period order (owner connection). */
export async function rowsOf(schoolClass: SchoolClass) {
  return db
    .from('timetable_slots as t')
    .leftJoin('subjects as s', 's.id', 't.subject_id')
    .where('t.class_id', schoolClass.id)
    .orderBy('t.weekday')
    .orderBy('t.period_no')
    .select(
      't.weekday',
      't.period_no',
      't.starts_at',
      't.ends_at',
      't.kind',
      't.label',
      's.code',
      't.jp',
      't.is_locked'
    ) as Promise<
    {
      weekday: number
      period_no: number
      starts_at: string
      ends_at: string
      kind: SlotKind
      label: string | null
      code: string | null
      jp: number
      is_locked: boolean
    }[]
  >
}
