import { test } from '@japa/runner'
import {
  generateDraft,
  type GenClass,
  type GeneratorInput,
  type GenSubject,
} from '../../app/timetable/draft_generator.js'
import { expandFrame } from '../../app/timetable/frame.js'
import { seededRandom, type Random } from '../../app/timetable/random.js'
import { checkRows, overlaps, type ClassRules, type RuleRow } from '../../app/timetable/rules.js'
import { parseClock } from '../../app/timetable/time.js'
import {
  preferenceKeys,
  type DayFrame,
  type PlainRow,
  type Preferences,
} from '../../app/timetable/types.js'

/**
 * Property tests for the draft generator (D-262): for many random
 * schools, whatever the seed and switches, the draft never breaks a
 * hard limit (D-248…D-251), leaves locked rows alone, and is the same
 * draft for the same seed.
 */

const RELIGIONS = ['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'khonghucu']
const CODES = ['PP', 'BIN', 'MTK', 'IPAS', 'PJOK', 'SB', 'BIG', 'KKA']

function pick<T>(random: Random, items: readonly T[]) {
  return items[Math.floor(random() * items.length)]
}

function int(random: Random, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1))
}

function randomFrame(random: Random): DayFrame {
  return {
    days: [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      startsAt: parseClock(pick(random, ['06:45', '07:00', '07:15']))!,
      lessons: random() < 0.15 ? 0 : int(random, 3, 9),
      opening:
        random() < 0.3
          ? { kind: pick(random, ['ceremony', 'activity'] as const), label: null, minutes: 30 }
          : null,
    })),
    breaks: random() < 0.8 ? [{ afterLesson: int(random, 2, 4), minutes: 15 }] : [],
  }
}

function randomPreferences(random: Random): Preferences {
  return Object.fromEntries(preferenceKeys.map((key) => [key, random() < 0.6])) as Preferences
}

interface Scenario {
  input: GeneratorInput
  context: { classes: Map<number, ClassRules>; religionOf: Map<number, string | null> }
  /** Rows that stay: locked rows and the rows of classes outside the draft. */
  kept: RuleRow[]
}

function randomScenario(seed: number): Scenario {
  const random = seededRandom(seed)
  const frame = randomFrame(random)
  const teacherCount = int(random, 3, 10)
  const teachers = Array.from({ length: teacherCount }, (_, index) => index + 1)
  const religionOf = new Map<number, string | null>()
  const subjectIds: number[] = []
  CODES.forEach((_, index) => {
    religionOf.set(index + 1, null)
    subjectIds.push(index + 1)
  })
  RELIGIONS.forEach((religion, index) => religionOf.set(100 + index, religion))

  const classCount = int(random, 1, 6)
  const classes: GenClass[] = []
  const rules = new Map<number, ClassRules>()
  const kept: RuleRow[] = []
  const days = expandFrame(frame)

  for (let c = 0; c < classCount + 1; c++) {
    const classId = c + 1
    const homeroom = pick(random, teachers)
    const subjects: GenSubject[] = []
    CODES.forEach((code, index) => {
      if (random() < 0.2) return
      subjects.push({
        subjectId: index + 1,
        code,
        religion: null,
        teacherId:
          random() < 0.1 ? null : code === 'PJOK' || code === 'BIG' ? teachers[0] : homeroom,
        allocation: random() < 0.1 ? null : int(random, 1, 6),
      })
    })
    for (const [index, religion] of RELIGIONS.entries()) {
      if (random() < 0.4) continue
      subjects.push({
        subjectId: 100 + index,
        code: `PA${index}`,
        religion,
        teacherId: random() < 0.15 ? null : pick(random, teachers),
        allocation: 3,
      })
    }
    rules.set(classId, {
      id: classId,
      name: `${classId}A`,
      taken: new Map(subjects.map((row) => [row.subjectId, row.allocation])),
      teacherOf: new Map(
        subjects.flatMap((row) =>
          row.teacherId === null ? [] : [[row.subjectId, row.teacherId] as const]
        )
      ),
    })

    // A few locked rows on frame periods, kept valid against each other.
    const locked: PlainRow[] = []
    const lockedJp = new Map<number, number>()
    for (const day of days) {
      for (const period of day.periods) {
        if (random() > 0.08) continue
        const subject = pick(random, subjects)
        const row: PlainRow =
          random() < 0.3 || !subject || subject.teacherId === null
            ? { ...period, kind: 'activity', label: null, subjectId: null, jp: 0 }
            : { ...period, kind: 'lesson', label: null, subjectId: subject.subjectId, jp: 1 }
        if (row.kind === 'lesson') {
          const used = lockedJp.get(row.subjectId!) ?? 0
          if (subject.allocation !== null && used + 1 > subject.allocation) continue
          const teacher = subject.teacherId!
          const clash = kept.some(
            (other) =>
              other.kind === 'lesson' &&
              rules.get(other.classId)!.teacherOf.get(other.subjectId!) === teacher &&
              overlaps(other, row)
          )
          if (clash) continue
          lockedJp.set(row.subjectId!, used + 1)
        }
        locked.push(row)
        kept.push({ ...row, key: `locked-${classId}-${kept.length}`, classId })
      }
    }
    // The last class is outside the draft: all its rows stay.
    if (c < classCount) classes.push({ id: classId, subjects, locked })
  }

  const busy = kept.flatMap((row) => {
    const teacherId =
      row.kind === 'lesson' ? rules.get(row.classId)!.teacherOf.get(row.subjectId!) : undefined
    return teacherId === undefined
      ? []
      : [{ teacherId, weekday: row.weekday, start: row.start, end: row.end }]
  })

  return {
    input: {
      seed: seed * 7919 + 1,
      attempts: int(random, 1, 6),
      frame,
      preferences: randomPreferences(random),
      classes,
      busy,
    },
    context: { classes: rules, religionOf },
    kept,
  }
}

test.group('Timetable | draft generator', () => {
  test('never breaks a hard limit and leaves locked rows alone (property, 300 schools)', ({
    assert,
  }) => {
    for (let seed = 1; seed <= 300; seed++) {
      const { input, context, kept } = randomScenario(seed)
      const result = generateDraft(input)
      const generated: RuleRow[] = result.classes.flatMap((row) =>
        row.rows.map((plain, index) => ({
          ...plain,
          key: `new-${row.classId}-${index}`,
          classId: row.classId,
        }))
      )
      const violations = checkRows([...kept, ...generated], context, (row) =>
        row.key.startsWith('new-')
      )
      assert.deepEqual(
        violations.map((violation) => `${violation.rule} ${JSON.stringify(violation.row)}`),
        [],
        `seed ${seed}`
      )

      // A day of the draft never ends with an opening or break row.
      for (const draft of result.classes) {
        for (const weekday of new Set(draft.rows.map((row) => row.weekday))) {
          const day = draft.rows.filter((row) => row.weekday === weekday)
          const last = day.reduce((a, b) => (b.end > a.end ? b : a))
          assert.equal(last.kind, 'lesson', `seed ${seed}: day ${weekday} ends with ${last.kind}`)
        }
      }

      // Locked rows untouched: no new row overlaps one of its class.
      for (const row of generated) {
        const hit = kept.find((other) => other.classId === row.classId && overlaps(other, row))
        assert.isUndefined(hit, `seed ${seed}: overlaps a locked row`)
      }

      // Every allocated JP is placed or reported, never more.
      for (const schoolClass of input.classes) {
        const draft = result.classes.find((row) => row.classId === schoolClass.id)!
        for (const subject of schoolClass.subjects) {
          if (subject.allocation === null) continue
          const locked = schoolClass.locked
            .filter((row) => row.subjectId === subject.subjectId)
            .reduce((sum, row) => sum + row.jp, 0)
          const placed = draft.rows
            .filter((row) => row.subjectId === subject.subjectId)
            .reduce((sum, row) => sum + row.jp, 0)
          const missing = draft.unplaced
            .filter((row) => row.subjectId === subject.subjectId)
            .reduce((sum, row) => sum + row.jp, 0)
          assert.equal(
            locked + placed + missing,
            Math.max(locked, subject.allocation),
            `seed ${seed}: subject ${subject.subjectId} of class ${schoolClass.id}`
          )
        }
      }
    }
  })

  test('the same seed gives the same draft; another seed may differ', ({ assert }) => {
    const { input } = randomScenario(42)
    assert.deepEqual(generateDraft(input), generateDraft({ ...input }))
    const other = generateDraft({ ...input, seed: input.seed + 1 })
    assert.equal(other.classes.length, input.classes.length)
  })

  test('a plain SD week is filled completely, religions in parallel, PJOK in the morning', ({
    assert,
  }) => {
    const frame: DayFrame = {
      days: [1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        startsAt: 420,
        lessons: weekday === 5 ? 5 : weekday === 6 ? 6 : 7,
        opening: weekday === 1 ? { kind: 'ceremony' as const, label: null, minutes: 35 } : null,
      })),
      breaks: [
        { afterLesson: 3, minutes: 15 },
        { afterLesson: 6, minutes: 15 },
      ],
    }
    const subjects: GenSubject[] = [
      { subjectId: 1, code: 'PP', religion: null, teacherId: 1, allocation: 4 },
      { subjectId: 2, code: 'BIN', religion: null, teacherId: 1, allocation: 6 },
      { subjectId: 3, code: 'MTK', religion: null, teacherId: 1, allocation: 5 },
      { subjectId: 4, code: 'IPAS', religion: null, teacherId: 1, allocation: 5 },
      { subjectId: 5, code: 'PJOK', religion: null, teacherId: 2, allocation: 3 },
      { subjectId: 6, code: 'SB', religion: null, teacherId: 1, allocation: 3 },
      { subjectId: 7, code: 'BIG', religion: null, teacherId: 3, allocation: 2 },
      { subjectId: 100, code: 'PAI', religion: 'islam', teacherId: 4, allocation: 3 },
      { subjectId: 101, code: 'PAKR', religion: 'kristen', teacherId: 5, allocation: 3 },
    ]
    const result = generateDraft({
      seed: 7,
      attempts: 20,
      frame,
      preferences: Object.fromEntries(preferenceKeys.map((key) => [key, true])) as Preferences,
      classes: [{ id: 1, subjects, locked: [] }],
      busy: [],
    })
    const [draft] = result.classes
    assert.deepEqual(draft.unplaced, [])
    const lessonJp = (id: number) =>
      draft.rows.filter((row) => row.subjectId === id).reduce((sum, row) => sum + row.jp, 0)
    for (const subject of subjects) assert.equal(lessonJp(subject.subjectId), subject.allocation)
    const islam = draft.rows.filter((row) => row.subjectId === 100)
    const kristen = draft.rows.filter((row) => row.subjectId === 101)
    assert.deepEqual(
      islam.map((row) => [row.weekday, row.start, row.end]),
      kristen.map((row) => [row.weekday, row.start, row.end])
    )
    for (const row of draft.rows.filter((item) => item.subjectId === 5)) {
      assert.isAtMost(row.end, 600)
    }
    assert.equal(draft.rows.filter((row) => row.kind === 'ceremony').length, 1)
  })

  test('JP that cannot be placed are reported with the reason', ({ assert }) => {
    const frame: DayFrame = {
      days: [{ weekday: 1, startsAt: 420, lessons: 3, opening: null }],
      breaks: [],
    }
    const result = generateDraft({
      seed: 1,
      attempts: 3,
      frame,
      preferences: Object.fromEntries(preferenceKeys.map((key) => [key, false])) as Preferences,
      classes: [
        {
          id: 1,
          subjects: [
            { subjectId: 1, code: 'MTK', religion: null, teacherId: 1, allocation: 2 },
            { subjectId: 2, code: 'PJOK', religion: null, teacherId: 2, allocation: 2 },
            { subjectId: 3, code: 'SB', religion: null, teacherId: null, allocation: 2 },
          ],
          locked: [],
        },
      ],
      // The PJOK teacher teaches elsewhere at the first two periods.
      busy: [{ teacherId: 2, weekday: 1, start: 420, end: 490 }],
    })
    const [draft] = result.classes
    assert.deepInclude(draft.unplaced, { subjectId: 3, jp: 2, reason: 'no_teacher' })
    assert.deepInclude(draft.unplaced, { subjectId: 2, jp: 1, reason: 'no_room' })
    const pjok = draft.rows.filter((row) => row.subjectId === 2)
    assert.deepEqual(
      pjok.map((row) => row.start),
      [490]
    )
  })
})
