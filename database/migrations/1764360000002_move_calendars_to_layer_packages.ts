import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { calendarMatchKey, eventKey, holidayKey } from '../../app/calendar/keys.js'
import { childRls, staffPolicy } from '../../app/tenancy/rls.js'
import { APP_ROLE } from '../../app/tenancy/database_roles.js'

const isoDate = (value: string | Date) =>
  typeof value === 'string'
    ? value.slice(0, 10)
    : new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

const FRAME = [
  ['FRAME-starts_on', 'Hari pertama tahun ajaran', 'starts_on'],
  ['FRAME-even_semester_starts_on', 'Awal semester 2', 'even_semester_starts_on'],
  ['FRAME-ends_on', 'Hari terakhir tahun ajaran', 'ends_on'],
  ['FRAME-school_days_per_week', 'Hari sekolah per minggu', 'school_days_per_week'],
] as const

/**
 * Moves the skeleton calendar tables onto layer packages (D-466,
 * docs/drafts/regional-layers.md §3.2, §10) and drops them:
 *
 * - `national_holidays` → the national base package
 *   `SIGRAK-KALENDER-NASIONAL` (draft until Tim Validasi signs off,
 *   D-113, D-254): national holidays mandatory, joint leave hideable.
 * - Region calendars (`calendars.region_id`) → one official package of
 *   their area per school year, line `all`: frame as settings, events as
 *   mandatory items, `joint_leave_school_days` as hides.
 * - School calendars → one school package per school. Copies of region
 *   events (`source_event_uid`, the D-256 copy model) are dropped, since
 *   the region package now flows down; the school's own events stay;
 *   joint-leave school days the region does not already keep become
 *   school hides. The frame now comes from the official package or the
 *   school's academic year (R1-06).
 *
 * Forward-only (D-085): `down()` recreates the old tables empty.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await moveNationalHolidays(db)
      const regionPackages = await moveRegionCalendars(db)
      await moveSchoolCalendars(db, regionPackages)
    })
    this.schema.dropTable('calendar_events')
    this.schema.dropTable('calendars')
    this.schema.dropTable('national_holidays')
  }

  async down() {
    this.schema.createTable('national_holidays', (table) => {
      table.bigIncrements('id')
      table.date('date').notNullable()
      table.string('name', 150).notNullable()
      table.string('kind', 20).notNullable()
      table.string('decree', 100).notNullable()
      table.string('academic_year', 9).notNullable()
      table.boolean('is_provisional').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['date', 'name'])
      table.index(['academic_year'])
    })
    this.schema.createTable('calendars', (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table.bigInteger('region_id').nullable().references('id').inTable('regions')
      table.bigInteger('school_id').nullable().references('id').inTable('schools')
      table.string('academic_year', 9).notNullable()
      table.string('code', 60).nullable().unique()
      table.string('name', 150).notNullable()
      table.string('status', 10).notNullable()
      table.smallint('school_days_per_week').notNullable()
      table.date('starts_on').notNullable()
      table.date('even_semester_starts_on').notNullable()
      table.date('ends_on').notNullable()
      table.integer('version').notNullable().defaultTo(1)
      table.bigInteger('source_calendar_id').nullable()
      table.integer('source_version').nullable()
      table.jsonb('joint_leave_school_days').notNullable().defaultTo('[]')
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.createTable('calendar_events', (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('calendar_id')
        .notNullable()
        .references('id')
        .inTable('calendars')
        .onDelete('CASCADE')
      table.date('starts_on').notNullable()
      table.date('ends_on').notNullable()
      table.string('kind', 20).notNullable()
      table.string('exam_type', 10).nullable()
      table.string('title', 150).notNullable()
      table.uuid('source_event_uid').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    for (const sql of [
      `ALTER TABLE calendars ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY calendars_school ON calendars FOR ALL TO ${APP_ROLE}
         USING (school_id = app_school_id() OR school_id IS NULL)
         WITH CHECK (school_id = app_school_id())`,
      ...staffPolicy('calendars'),
      ...childRls('calendar_events', {
        table: 'calendars',
        foreignKey: 'calendar_id',
        writableWhen: 'p.school_id = app_school_id()',
      }),
    ]) {
      this.schema.raw(sql)
    }
  }
}

async function insertPackage(db: QueryClientContract, values: Record<string, unknown>) {
  const now = new Date()
  const [row] = (await db
    .table('layer_packages')
    .insert({ domain: 'calendar', version: 1, created_at: now, updated_at: now, ...values })
    .returning('id')) as { id: number }[]
  return Number(row.id)
}

async function insertItem(
  db: QueryClientContract,
  packageId: number,
  item: {
    itemKey: string
    kind: string
    title: string
    startsOn: string | null
    endsOn: string | null
    force: string
    origin: string
    examType?: string | null
    settingValue?: string | null
    sourceRef?: Record<string, unknown> | null
  }
) {
  const now = new Date()
  await db.table('calendar_items').insert({
    package_id: packageId,
    item_key: item.itemKey,
    shape: item.kind === 'setting' ? 'setting' : 'list',
    force: item.force,
    origin: item.origin,
    match_key: calendarMatchKey(item),
    revision: 1,
    status: 'active',
    source_ref: item.sourceRef ? JSON.stringify(item.sourceRef) : null,
    kind: item.kind,
    exam_type: item.examType ?? null,
    title: item.title,
    starts_on: item.startsOn,
    ends_on: item.endsOn,
    setting_value: item.settingValue ?? null,
    created_at: now,
    updated_at: now,
  })
}

async function insertHide(db: QueryClientContract, packageId: number, date: string) {
  const now = new Date()
  await db
    .table('layer_hides')
    .insert({
      package_id: packageId,
      domain: 'calendar',
      target_item_key: holidayKey(date, 'joint_leave'),
      reason: null,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    .onConflict(['package_id', 'target_item_key'])
    .ignore()
}

async function moveNationalHolidays(db: QueryClientContract) {
  const rows = (await db.from('national_holidays').orderBy('date')) as {
    date: string | Date
    name: string
    kind: 'national_holiday' | 'joint_leave'
    decree: string
    academic_year: string
    is_provisional: boolean
  }[]
  if (rows.length === 0) return
  const years = [...new Set(rows.map((row) => row.academic_year))].sort()
  const decrees = [...new Set(rows.map((row) => row.decree))]
  const packageId = await insertPackage(db, {
    code: 'SIGRAK-KALENDER-NASIONAL',
    layer: 'national',
    line: 'all',
    kind: 'base',
    level_scope: 'both',
    name: 'Hari libur nasional dan cuti bersama',
    status: 'draft',
    applies_from_school_year: years[0],
    evidence: JSON.stringify({ regulation_code: decrees.join('; ') }),
  })
  const seen = new Set<string>()
  for (const row of rows) {
    const date = isoDate(row.date)
    const key = holidayKey(date, row.kind)
    if (seen.has(key)) continue
    seen.add(key)
    await insertItem(db, packageId, {
      itemKey: key,
      kind: row.kind,
      title: row.name,
      startsOn: date,
      endsOn: date,
      force: row.kind === 'national_holiday' ? 'mandatory' : 'example',
      origin: 'official',
      sourceRef: { regulation: row.decree, provisional: row.is_provisional },
    })
  }
}

interface CalendarRow {
  id: number
  region_id: number | null
  school_id: number | null
  academic_year: string
  code: string | null
  name: string
  status: string
  school_days_per_week: number
  starts_on: string | Date
  even_semester_starts_on: string | Date
  ends_on: string | Date
  source_calendar_id: number | null
  joint_leave_school_days: string[] | null
  meta: Record<string, unknown> | null
}

interface EventRow {
  calendar_id: number
  starts_on: string | Date
  ends_on: string | Date
  kind: string
  exam_type: string | null
  title: string
  source_event_uid: string | null
}

async function eventsOf(db: QueryClientContract, calendarId: number) {
  return (await db
    .from('calendar_events')
    .where('calendar_id', calendarId)
    .orderBy('starts_on')
    .orderBy('id')) as EventRow[]
}

/** Region calendar id → its joint-leave school days. */
async function moveRegionCalendars(db: QueryClientContract) {
  const calendars = (await db
    .from('calendars as c')
    .join('regions as r', 'r.id', 'c.region_id')
    .whereNotNull('c.region_id')
    .select('c.*', 'r.level as region_level')
    .orderBy('c.id')) as (CalendarRow & { region_level: string })[]
  const kept = new Map<number, Set<string>>()
  for (const calendar of calendars) {
    const official = calendar.region_level !== 'district'
    const active = calendar.status === 'active'
    const source = (calendar.meta?.source ?? {}) as Record<string, unknown>
    const packageId = await insertPackage(db, {
      code:
        calendar.code ?? `KALDIK-${calendar.region_id}-${calendar.academic_year.replace('/', '-')}`,
      layer: calendar.region_level,
      region_id: calendar.region_id,
      line: 'all',
      kind: official ? 'official' : 'local_agreement',
      level_scope: 'both',
      name: calendar.name,
      status: active ? 'active' : 'draft',
      applies_from_school_year: calendar.academic_year,
      applies_to_school_year: calendar.academic_year,
      evidence: JSON.stringify({
        document_title: typeof source.decree === 'string' ? source.decree : calendar.name,
        sha256: typeof source.sha256 === 'string' ? source.sha256 : null,
        source_file: typeof source.file === 'string' ? source.file : null,
        note: 'Dipindahkan dari kalender wilayah (R1-08).',
      }),
      approved_at: active ? new Date() : null,
    })
    const origin = official ? 'official' : 'local_agreement'
    for (const [key, title, column] of FRAME) {
      const raw = calendar[column]
      await insertItem(db, packageId, {
        itemKey: key,
        kind: 'setting',
        title,
        startsOn: null,
        endsOn: null,
        force: 'mandatory',
        origin,
        settingValue: typeof raw === 'number' ? String(raw) : isoDate(raw),
      })
    }
    const seen = new Set<string>()
    for (const event of await eventsOf(db, calendar.id)) {
      const startsOn = isoDate(event.starts_on)
      const key = eventKey(startsOn, event.title)
      if (seen.has(key)) continue
      seen.add(key)
      await insertItem(db, packageId, {
        itemKey: key,
        kind: event.kind,
        title: event.title,
        startsOn,
        endsOn: isoDate(event.ends_on),
        force: 'mandatory',
        origin,
        examType: event.exam_type,
      })
    }
    const days = new Set(calendar.joint_leave_school_days ?? [])
    for (const date of days) await insertHide(db, packageId, date)
    kept.set(Number(calendar.id), days)
  }
  return kept
}

async function moveSchoolCalendars(db: QueryClientContract, regionDays: Map<number, Set<string>>) {
  const calendars = (await db
    .from('calendars')
    .whereNotNull('school_id')
    .orderBy('school_id')
    .orderBy('academic_year')) as CalendarRow[]
  const packages = new Map<number, number>()
  for (const calendar of calendars) {
    const schoolId = Number(calendar.school_id)
    let packageId = packages.get(schoolId)
    if (packageId === undefined) {
      packageId = await insertPackage(db, {
        code: `SCHOOL-${schoolId}-CALENDAR-${calendar.academic_year.replace('/', '-')}`,
        layer: 'school',
        school_id: schoolId,
        line: 'all',
        kind: 'school',
        level_scope: 'both',
        name: 'Perubahan sekolah',
        status: 'active',
        applies_from_school_year: calendar.academic_year,
      })
      packages.set(schoolId, packageId)
    }
    const seen = new Set<string>()
    for (const event of await eventsOf(db, calendar.id)) {
      if (event.source_event_uid) continue
      const startsOn = isoDate(event.starts_on)
      const key = `CAL-SCH-${eventKey(startsOn, event.title).slice(3)}`
      if (seen.has(key)) continue
      seen.add(key)
      await insertItem(db, packageId, {
        itemKey: key,
        kind: event.kind,
        title: event.title,
        startsOn,
        endsOn: isoDate(event.ends_on),
        force: 'free',
        origin: 'school',
        examType: event.exam_type,
      })
    }
    const inherited = calendar.source_calendar_id
      ? (regionDays.get(Number(calendar.source_calendar_id)) ?? new Set<string>())
      : new Set<string>()
    for (const date of calendar.joint_leave_school_days ?? []) {
      if (!inherited.has(date)) await insertHide(db, packageId, date)
    }
  }
}
