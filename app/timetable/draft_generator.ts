import { expandFrame, type FramePeriod } from './frame.js'
import { overlaps } from './rules.js'
import { seededRandom, shuffle, type Random } from './random.js'
import {
  CORE_CODES,
  MAX_JP,
  PJOK_CODE,
  type DayFrame,
  type PlainRow,
  type Preferences,
  type UnplacedReason,
} from './types.js'

/**
 * The draft timetable generator (D-262). Pure and seeded: the same
 * input and seed give the same draft, and nothing here reads the
 * database, so it can run in a CPU pool thread (R1-10).
 *
 * Hard limits are never broken (D-248…D-251): a class period holds one
 * lesson, or the parallel religion lessons (D-251); a teacher is never
 * in two places (busy times of other classes and locked rows included);
 * no subject gets more JP than its allocation minus its locked JP; a
 * subject without a teacher is not placed; locked rows and the periods
 * they cover are left alone. What cannot be placed is reported with
 * the reason.
 *
 * Soft preferences only change the score. Each class first gets a
 * target set of periods without holes (the first periods of each day,
 * shortest days trimmed from the end), then lessons are placed one JP
 * at a time, the most constrained teachers first, at the period that
 * scores best; a lesson with no free period may swap with one already
 * placed. The best of `attempts` tries wins: fewest JP left over, then
 * the lowest penalty.
 */

export interface GenSubject {
  subjectId: number
  code: string
  religion: string | null
  teacherId: number | null
  /** JP per week; null = no allocation, not placed (D-250). */
  allocation: number | null
}

export interface GenClass {
  id: number
  subjects: GenSubject[]
  /** Locked rows, kept as they are (D-262, D-381). */
  locked: PlainRow[]
}

/** A time a teacher already teaches (other classes, locked rows). */
export interface BusyInterval {
  teacherId: number
  weekday: number
  start: number
  end: number
}

export interface GeneratorInput {
  seed: number
  attempts: number
  frame: DayFrame
  preferences: Preferences
  classes: GenClass[]
  busy: BusyInterval[]
}

export interface UnplacedJp {
  subjectId: number
  jp: number
  reason: UnplacedReason
}

export interface DraftClassResult {
  classId: number
  /** New rows of the class (locked rows not included). */
  rows: PlainRow[]
  unplaced: UnplacedJp[]
}

export interface GeneratorResult {
  classes: DraftClassResult[]
  unplacedJp: number
  penalty: number
  attempts: number
}

export const DEFAULT_ATTEMPTS = 40

/** One JP to place: a subject, or the parallel religion lessons (D-251). */
interface Unit {
  classIndex: number
  /** Same key = same subject (or the religion group) for the preferences. */
  key: string
  code: string | null
  subjectIds: number[]
  teacherIds: number[]
}

interface Slot extends FramePeriod {
  /** Position among the class's free periods of the day. */
  position: number
  /** Index in the class's slot list. */
  ref: number
}

interface ClassSetup {
  source: GenClass
  extras: PlainRow[]
  slots: Slot[]
  slotsByDay: Map<number, Slot[]>
  units: Unit[]
  fixedUnplaced: UnplacedJp[]
  /** Slot indexes of the hole-free target. */
  target: Set<number>
}

const PENALTY = {
  gap: 20,
  overLimit: 10,
  splitRun: 6,
  pjokLate: 8,
  coreLate: 1,
  splitBreak: 6,
}

const PJOK_LATEST_END = 10 * 60
const IMPROVE_ROUNDS_PER_CLASS = 1500

/**
 * Splits the religion subjects into groups that can run in parallel:
 * one teacher can only teach one religion at a time.
 */
function religionGroups(subjects: (GenSubject & { remaining: number })[]) {
  const groups: (GenSubject & { remaining: number })[][] = []
  for (const subject of subjects) {
    const group = groups.find((list) => list.every((row) => row.teacherId !== subject.teacherId))
    if (group) group.push(subject)
    else groups.push([subject])
  }
  return groups
}

function setupClass(input: GeneratorInput, source: GenClass, classIndex: number): ClassSetup {
  const days = expandFrame(input.frame)
  const extras: PlainRow[] = []
  const slots: Slot[] = []
  const slotsByDay = new Map<number, Slot[]>()

  for (const day of days) {
    for (const extra of day.extras) {
      if (!source.locked.some((row) => overlaps(row, extra))) extras.push(extra)
    }
    const free: Slot[] = []
    for (const period of day.periods) {
      const blocked = source.locked.some((row) =>
        overlaps(row, { ...period, kind: 'lesson', label: null, subjectId: null, jp: 1 })
      )
      if (!blocked) free.push({ ...period, position: free.length, ref: slots.length + free.length })
    }
    slots.push(...free)
    slotsByDay.set(day.weekday, free)
  }

  const lockedJp = new Map<number, number>()
  for (const row of source.locked) {
    if (row.kind === 'lesson' && row.subjectId !== null) {
      lockedJp.set(row.subjectId, (lockedJp.get(row.subjectId) ?? 0) + row.jp)
    }
  }

  const units: Unit[] = []
  const fixedUnplaced: UnplacedJp[] = []
  const religions: (GenSubject & { remaining: number })[] = []
  for (const subject of source.subjects) {
    if (subject.allocation === null) continue
    const remaining = subject.allocation - (lockedJp.get(subject.subjectId) ?? 0)
    if (remaining <= 0) continue
    if (subject.teacherId === null) {
      fixedUnplaced.push({ subjectId: subject.subjectId, jp: remaining, reason: 'no_teacher' })
      continue
    }
    if (subject.religion !== null) {
      religions.push({ ...subject, remaining })
      continue
    }
    for (let count = 0; count < remaining; count++) {
      units.push({
        classIndex,
        key: `s${subject.subjectId}`,
        code: subject.code,
        subjectIds: [subject.subjectId],
        teacherIds: [subject.teacherId],
      })
    }
  }
  religionGroups(religions).forEach((group, groupIndex) => {
    const longest = Math.max(...group.map((row) => row.remaining))
    for (let count = 0; count < longest; count++) {
      const members = group.filter((row) => row.remaining > count)
      units.push({
        classIndex,
        key: `religion${groupIndex}`,
        code: null,
        subjectIds: members.map((row) => row.subjectId),
        teacherIds: members.map((row) => row.teacherId!),
      })
    }
  })

  // Target without holes: drop the last period of the longest day until
  // the class has as many periods as JP to place.
  const counts = new Map([...slotsByDay].map(([weekday, list]) => [weekday, list.length]))
  let total = slots.length
  const wanted = Math.min(units.length, slots.length)
  while (total > wanted) {
    let pick = -1
    for (const [weekday, count] of counts) {
      if (count === 0) continue
      if (
        pick === -1 ||
        count > counts.get(pick)! ||
        (count === counts.get(pick)! && weekday > pick)
      )
        pick = weekday
    }
    counts.set(pick, counts.get(pick)! - 1)
    total--
  }
  const target = new Set<number>()
  slots.forEach((slot, index) => {
    if (slot.position < counts.get(slot.weekday)!) target.add(index)
  })

  return { source, extras, slots, slotsByDay, units, fixedUnplaced, target }
}

class Attempt {
  /** Per class: slot index → unit. */
  readonly placed: (Unit | null)[][]
  private readonly teacherTimes = new Map<number, Map<number, { start: number; end: number }[]>>()

  constructor(
    private readonly setups: ClassSetup[],
    busy: BusyInterval[],
    private readonly preferences: Preferences,
    private readonly random: Random
  ) {
    this.placed = setups.map((setup) => setup.slots.map(() => null))
    for (const row of busy) this.reserve(row.teacherId, row.weekday, row.start, row.end)
  }

  private timesOf(teacherId: number, weekday: number) {
    let byDay = this.teacherTimes.get(teacherId)
    if (!byDay) {
      byDay = new Map()
      this.teacherTimes.set(teacherId, byDay)
    }
    let list = byDay.get(weekday)
    if (!list) {
      list = []
      byDay.set(weekday, list)
    }
    return list
  }

  private reserve(teacherId: number, weekday: number, start: number, end: number) {
    this.timesOf(teacherId, weekday).push({ start, end })
  }

  private release(teacherId: number, weekday: number, start: number, end: number) {
    const list = this.timesOf(teacherId, weekday)
    const at = list.findIndex((row) => row.start === start && row.end === end)
    if (at >= 0) list.splice(at, 1)
  }

  private teachersFree(unit: Unit, slot: Slot) {
    return unit.teacherIds.every((teacherId) =>
      this.timesOf(teacherId, slot.weekday).every(
        (row) => !(row.start < slot.end && slot.start < row.end)
      )
    )
  }

  private put(unit: Unit, slotIndex: number) {
    const slot = this.setups[unit.classIndex].slots[slotIndex]
    this.placed[unit.classIndex][slotIndex] = unit
    for (const teacherId of unit.teacherIds) {
      this.reserve(teacherId, slot.weekday, slot.start, slot.end)
    }
  }

  private take(classIndex: number, slotIndex: number) {
    const unit = this.placed[classIndex][slotIndex]!
    const slot = this.setups[classIndex].slots[slotIndex]
    this.placed[classIndex][slotIndex] = null
    for (const teacherId of unit.teacherIds) {
      this.release(teacherId, slot.weekday, slot.start, slot.end)
    }
    return unit
  }

  /** Penalty of one class day (gaps and the switched-on preferences). */
  dayPenalty(classIndex: number, weekday: number) {
    const setup = this.setups[classIndex]
    const daySlots = setup.slotsByDay.get(weekday) ?? []
    if (daySlots.length === 0) return 0
    const units = daySlots.map((slot) => this.placed[classIndex][slot.ref])
    const prefs = this.preferences
    let penalty = 0

    const lastUsed = units.findLastIndex((unit) => unit !== null)
    for (let position = 0; position < lastUsed; position++) {
      if (units[position] === null) penalty += PENALTY.gap
    }

    const counts = new Map<string, { count: number; runs: number; code: string | null }>()
    units.forEach((unit, position) => {
      if (!unit) return
      const slot = daySlots[position]
      const entry = counts.get(unit.key) ?? { count: 0, runs: 0, code: unit.code }
      entry.count++
      const previous = position > 0 ? units[position - 1] : null
      const adjacent = position > 0 && daySlots[position - 1].end === slot.start
      if (!previous || previous.key !== unit.key || !adjacent) entry.runs++
      counts.set(unit.key, entry)

      if (prefs.pjokMorning && unit.code === PJOK_CODE && slot.end > PJOK_LATEST_END) {
        penalty += PENALTY.pjokLate
      }
      if (prefs.coreEarly && unit.code && (CORE_CODES as readonly string[]).includes(unit.code)) {
        penalty += PENALTY.coreLate * slot.position
      }
      if (
        prefs.noSplitBreak &&
        previous &&
        previous.key === unit.key &&
        daySlots[position - 1].end < slot.start
      ) {
        penalty += PENALTY.splitBreak
      }
    })

    for (const entry of counts.values()) {
      const limit = entry.code === PJOK_CODE ? 3 : 2
      if (prefs.maxConsecutive && entry.count > limit) {
        penalty += (entry.count - limit) * PENALTY.overLimit
      }
      if (prefs.spreadWeek && entry.runs > 1) {
        penalty += (entry.runs - 1) * PENALTY.splitRun
      }
    }
    return penalty
  }

  /** Score of putting `unit` at `slotIndex` (lower is better). */
  private score(unit: Unit, slotIndex: number) {
    const slot = this.setups[unit.classIndex].slots[slotIndex]
    const before = this.dayPenalty(unit.classIndex, slot.weekday)
    this.placed[unit.classIndex][slotIndex] = unit
    const after = this.dayPenalty(unit.classIndex, slot.weekday)
    this.placed[unit.classIndex][slotIndex] = null
    return after - before + this.random() * 0.5
  }

  private freeSlots(unit: Unit, inTarget: boolean) {
    const setup = this.setups[unit.classIndex]
    const list: number[] = []
    setup.slots.forEach((slot, index) => {
      if (setup.target.has(index) !== inTarget) return
      if (this.placed[unit.classIndex][index] !== null) return
      if (this.teachersFree(unit, slot)) list.push(index)
    })
    return list
  }

  /** Places one JP; false when no period works, even after one swap. */
  place(unit: Unit) {
    for (const inTarget of [true, false]) {
      const candidates = this.freeSlots(unit, inTarget)
      if (candidates.length === 0) continue
      let best = candidates[0]
      let bestScore = Number.POSITIVE_INFINITY
      for (const index of candidates) {
        const value = this.score(unit, index)
        if (value < bestScore) {
          bestScore = value
          best = index
        }
      }
      this.put(unit, best)
      return true
    }
    return this.swapIn(unit)
  }

  /**
   * Moves a placed lesson of the same class to an empty period so that
   * `unit` can take its place. Every move keeps the hard limits.
   */
  private swapIn(unit: Unit) {
    const setup = this.setups[unit.classIndex]
    const row = this.placed[unit.classIndex]
    const occupied = shuffle(
      row.flatMap((placed, index) => (placed ? [index] : [])),
      this.random
    ).sort((a, b) => Number(setup.target.has(b)) - Number(setup.target.has(a)))
    for (const from of occupied) {
      const moved = this.take(unit.classIndex, from)
      if (this.teachersFree(unit, setup.slots[from])) {
        this.put(unit, from)
        const empty = setup.slots
          .map((_, index) => index)
          .filter((index) => row[index] === null)
          .sort((a, b) => Number(setup.target.has(b)) - Number(setup.target.has(a)))
        const to = empty.find((index) => this.teachersFree(moved, setup.slots[index]))
        if (to !== undefined) {
          this.put(moved, to)
          return true
        }
        this.take(unit.classIndex, from)
      }
      this.put(moved, from)
    }
    return false
  }

  /**
   * Local search: swaps two periods of a class (or moves a lesson to an
   * empty period) when that keeps every teacher free and does not raise
   * the penalty of the days involved.
   */
  improve(rounds: number) {
    for (let round = 0; round < rounds; round++) {
      const classIndex = Math.floor(this.random() * this.setups.length)
      const setup = this.setups[classIndex]
      const count = setup.slots.length
      if (count < 2) continue
      const a = Math.floor(this.random() * count)
      const b = Math.floor(this.random() * count)
      const row = this.placed[classIndex]
      if (a === b || (row[a] === null && row[b] === null)) continue
      if (row[a] && row[b] && row[a]!.key === row[b]!.key) continue
      const days = [...new Set([setup.slots[a].weekday, setup.slots[b].weekday])]
      const before = days.reduce((sum, day) => sum + this.dayPenalty(classIndex, day), 0)
      const first = row[a] ? this.take(classIndex, a) : null
      const second = row[b] ? this.take(classIndex, b) : null
      const fits =
        (!first || this.teachersFree(first, setup.slots[b])) &&
        (!second || this.teachersFree(second, setup.slots[a]))
      if (fits) {
        if (first) this.put(first, b)
        if (second) this.put(second, a)
        const after = days.reduce((sum, day) => sum + this.dayPenalty(classIndex, day), 0)
        if (after <= before) continue
        if (first) this.take(classIndex, b)
        if (second) this.take(classIndex, a)
      }
      if (first) this.put(first, a)
      if (second) this.put(second, b)
    }
  }

  totalPenalty() {
    let penalty = 0
    this.setups.forEach((setup, classIndex) => {
      for (const weekday of setup.slotsByDay.keys()) penalty += this.dayPenalty(classIndex, weekday)
    })
    return penalty
  }
}

/** Lessons as rows: consecutive periods of the same lesson become one row (up to 4 JP). */
function lessonRows(setup: ClassSetup, placed: (Unit | null)[]): PlainRow[] {
  const rows: PlainRow[] = []
  for (const daySlots of setup.slotsByDay.values()) {
    let run: { unit: Unit; start: number; end: number; jp: number; weekday: number } | null = null
    const flush = () => {
      if (!run) return
      for (const subjectId of run.unit.subjectIds) {
        rows.push({
          weekday: run.weekday,
          start: run.start,
          end: run.end,
          kind: 'lesson',
          label: null,
          subjectId,
          jp: run.jp,
        })
      }
      run = null
    }
    for (const slot of daySlots) {
      const unit = placed[slot.ref]
      const continues =
        run !== null &&
        unit !== null &&
        run.unit.key === unit.key &&
        run.unit.subjectIds.join() === unit.subjectIds.join() &&
        run.end === slot.start &&
        run.jp < MAX_JP
      if (continues) {
        run!.end = slot.end
        run!.jp++
        continue
      }
      flush()
      if (unit) run = { unit, start: slot.start, end: slot.end, jp: 1, weekday: slot.weekday }
    }
    flush()
  }
  return rows
}

function runAttempt(input: GeneratorInput, setups: ClassSetup[], random: Random) {
  const attempt = new Attempt(setups, input.busy, input.preferences, random)

  // Most constrained first: teachers with the most JP across the draft.
  const demand = new Map<number, number>()
  const units = setups.flatMap((setup) => setup.units)
  for (const unit of units) {
    for (const teacherId of unit.teacherIds) {
      demand.set(teacherId, (demand.get(teacherId) ?? 0) + 1)
    }
  }
  const weight = (unit: Unit) =>
    unit.teacherIds.reduce((sum, teacherId) => sum + demand.get(teacherId)!, 0)
  const order = shuffle([...units], random).sort((a, b) => weight(b) - weight(a))

  const unplaced = setups.map(() => new Map<string, UnplacedJp>())
  for (const unit of order) {
    if (attempt.place(unit)) continue
    // More JP than free periods: no room; otherwise the teachers are busy.
    const setup = setups[unit.classIndex]
    const reason: UnplacedReason =
      setup.units.length > setup.slots.length ? 'no_room' : 'teacher_busy'
    for (const subjectId of unit.subjectIds) {
      const key = `${subjectId}|${reason}`
      const entry = unplaced[unit.classIndex].get(key) ?? { subjectId, jp: 0, reason }
      entry.jp++
      unplaced[unit.classIndex].set(key, entry)
    }
  }

  attempt.improve(IMPROVE_ROUNDS_PER_CLASS * setups.length)

  const classes = setups.map((setup, classIndex) => ({
    classId: setup.source.id,
    rows: [...setup.extras, ...lessonRows(setup, attempt.placed[classIndex])].sort(
      (a, b) =>
        a.weekday - b.weekday || a.start - b.start || (a.subjectId ?? 0) - (b.subjectId ?? 0)
    ),
    unplaced: [...setup.fixedUnplaced, ...unplaced[classIndex].values()],
  }))
  const unplacedJp = classes.reduce(
    (sum, row) =>
      sum +
      row.unplaced.filter((item) => item.reason !== 'no_teacher').reduce((s, i) => s + i.jp, 0),
    0
  )
  return { classes, unplacedJp, penalty: attempt.totalPenalty() }
}

export function generateDraft(input: GeneratorInput): GeneratorResult {
  const setups = input.classes.map((source, index) => setupClass(input, source, index))
  const master = seededRandom(input.seed)
  const attempts = Math.max(1, Math.floor(input.attempts))
  let best: ReturnType<typeof runAttempt> | null = null
  for (let round = 0; round < attempts; round++) {
    const random = seededRandom(Math.floor(master() * 0x7fffffff) + 1)
    const result = runAttempt(input, setups, random)
    if (
      !best ||
      result.unplacedJp < best.unplacedJp ||
      (result.unplacedJp === best.unplacedJp && result.penalty < best.penalty)
    ) {
      best = result
    }
    if (best.unplacedJp === 0 && best.penalty === 0) break
  }
  return { ...best!, attempts }
}
