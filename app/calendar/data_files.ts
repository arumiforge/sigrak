import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import app from '@adonisjs/core/services/app'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { isIsoDate } from './dates.js'
import { calendarMatchKey, eventKey, holidayKey, noteKey } from './keys.js'
import { EVENT_KINDS, EXAM_TYPES, FRAME_KEYS } from './types.js'

/**
 * Calendar data from the repository (`docs/data/calendar/`, D-253,
 * D-254, D-323) into layer packages:
 *
 * - the SKB file → the national base package `SIGRAK-KALENDER-NASIONAL`
 *   (holidays mandatory, joint leave hideable, D-255), after the D-254
 *   check of the file's own `check` block;
 * - a region file → one official package of its area (frame settings,
 *   events mandatory for the area's schools, notes, joint-leave school
 *   days as hides; D-466).
 *
 * Nothing is fetched from outside: the online SKB check happened when
 * the file was made, and its record (sources, check date, differences)
 * is part of the file. A package is created as `draft` and stays so
 * until staff activate it after Tim Validasi's sign-off (D-113);
 * importing again only writes what changed (new revisions, retired
 * items), so it is safe to repeat.
 */

export const NATIONAL_PACKAGE_CODE = 'SIGRAK-KALENDER-NASIONAL'

export const calendarDataDir = () => app.makePath('docs/data/calendar')

export interface CheckProblem {
  key: string
  values?: Record<string, string | number>
}

export interface ImportReport {
  packageCode: string
  packageCreated: boolean
  created: number
  revised: number
  retired: number
  unchanged: number
  hidesWritten: number
  status: string
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

async function filesMatching(prefix: string) {
  const names = await readdir(calendarDataDir()).catch(() => [] as string[])
  return names
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort()
    .map((name) => join(calendarDataDir(), name))
}

export const holidayFiles = () => filesMatching('national-holidays-')
export const regionFiles = () => filesMatching('region-')

/** A file of the calendar data folder, by its base name only (no paths from forms). */
export async function dataFile(name: string) {
  const all = [...(await holidayFiles()), ...(await regionFiles())]
  return all.find((path) => basename(path) === name) ?? null
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

/* ------------------------------------------------------------------ */
/* National holidays: the D-254 check                                  */
/* ------------------------------------------------------------------ */

export interface HolidayFile {
  dataset: string
  code?: string
  status?: string
  check?: {
    checked_on?: string
    method?: string
    sources?: { url?: string; title?: string; what?: string }[]
    summary?: string
    differences?: unknown[]
    unresolved?: unknown[]
  }
  academic_years?: {
    academic_year: string
    covered_until?: string
    days: {
      date: string
      name: string
      kind: string
      decree: string
      is_provisional?: boolean
    }[]
  }[]
}

export interface HolidayCheck {
  ok: boolean
  problems: CheckProblem[]
  summary: {
    code: string | null
    status: string | null
    checkedOn: string | null
    officialSources: number
    decrees: string[]
    days: number
    differences: number
    unresolved: number
    years: string[]
  }
}

const OFFICIAL_HOST = /^https:\/\/([a-z0-9-]+\.)*go\.id(\/|$)/i

/** `SKB 1497/2/5 Tahun 2025` → the first decree number and the year: `1497`, `2025`. */
function decreeNumbers(decree: string) {
  const match = /(\d+)(?:\/\d+)*\s+Tahun\s+(\d{4})/i.exec(decree)
  return match ? { number: match[1], year: match[2] } : null
}

/**
 * D-254 on the repository data: the file records an online check (date,
 * method, official sources on government sites), every day is a valid
 * date of its academic year with a known kind and a decree, no day is
 * listed twice, and every decree a day cites is one an official source
 * in the check names (its number and year appear in that source's
 * title). Problems block the import.
 */
export function checkHolidayFile(data: HolidayFile): HolidayCheck {
  const problems: CheckProblem[] = []
  const check = data.check ?? {}
  const sources = (check.sources ?? []).filter(
    (source) => typeof source.url === 'string' && OFFICIAL_HOST.test(source.url)
  )
  const years = data.academic_years ?? []
  const decrees = new Set<string>()
  const seen = new Set<string>()
  let days = 0

  if (data.dataset !== 'national_holidays') problems.push({ key: 'dataset' })
  if (!isIsoDate(check.checked_on)) problems.push({ key: 'check_missing' })
  if (sources.length === 0) problems.push({ key: 'no_official_source' })
  if (years.length === 0) problems.push({ key: 'no_days' })

  for (const year of years) {
    const match = /^(\d{4})\/(\d{4})$/.exec(year.academic_year ?? '')
    if (!match || Number(match[2]) !== Number(match[1]) + 1) {
      problems.push({ key: 'school_year', values: { year: String(year.academic_year) } })
      continue
    }
    const from = `${match[1]}-07-01`
    const until =
      year.covered_until && isIsoDate(year.covered_until) ? year.covered_until : `${match[2]}-06-30`
    for (const day of year.days ?? []) {
      days++
      const label = String(day.date)
      if (!isIsoDate(day.date) || day.date < from || day.date > until) {
        problems.push({ key: 'day_date', values: { date: label, year: year.academic_year } })
        continue
      }
      if (day.kind !== 'national_holiday' && day.kind !== 'joint_leave') {
        problems.push({ key: 'day_kind', values: { date: label } })
        continue
      }
      if (!day.name || day.name.trim() === '') {
        problems.push({ key: 'day_name', values: { date: label } })
      }
      const key = `${day.date}|${day.kind}`
      if (seen.has(key)) problems.push({ key: 'day_twice', values: { date: label } })
      seen.add(key)
      if (!day.decree || !decreeNumbers(day.decree)) {
        problems.push({ key: 'day_decree', values: { date: label } })
        continue
      }
      decrees.add(day.decree)
    }
  }

  for (const decree of decrees) {
    const numbers = decreeNumbers(decree)!
    const backed = sources.some((source) => {
      const title = source.title ?? ''
      return (
        new RegExp(`\\b${numbers.number}\\b`).test(title) &&
        new RegExp(`\\b${numbers.year}\\b`).test(title)
      )
    })
    if (!backed) problems.push({ key: 'decree_unbacked', values: { decree } })
  }

  return {
    ok: problems.length === 0,
    problems,
    summary: {
      code: data.code ?? null,
      status: data.status ?? null,
      checkedOn: isIsoDate(check.checked_on) ? check.checked_on : null,
      officialSources: sources.length,
      decrees: [...decrees],
      days,
      differences: check.differences?.length ?? 0,
      unresolved: check.unresolved?.length ?? 0,
      years: years.map((year) => year.academic_year),
    },
  }
}

export class CalendarImportException extends Error {
  constructor(readonly problems: CheckProblem[]) {
    super(`Calendar data check failed: ${problems.map((problem) => problem.key).join(', ')}`)
  }
}

/* ------------------------------------------------------------------ */
/* Region calendars                                                    */
/* ------------------------------------------------------------------ */

export interface RegionFile {
  dataset: string
  code: string
  name: string
  status?: string
  region: { province: string; regency: string | null }
  academic_year: string
  school_days_per_week: number
  starts_on: string
  even_semester_starts_on: string
  ends_on: string
  source?: { file?: string; sha256?: string; decree?: string; set_on?: string; pages?: string }
  events?: {
    kind: string
    exam_type?: string | null
    title: string
    starts_on: string
    ends_on: string
    source_ref?: string
  }[]
  joint_leave_school_days?: { date: string; title?: string; source_ref?: string }[]
  assessment_windows?: { title: string; starts_on: string; ends_on: string; source_ref?: string }[]
  milestones?: { date: string; end_date?: string; title: string; source_ref?: string }[]
}

export interface RegionCheck {
  ok: boolean
  problems: CheckProblem[]
  summary: {
    code: string | null
    name: string | null
    status: string | null
    area: string | null
    schoolYear: string | null
    decree: string | null
    events: number
    notes: number
    schoolDays: number
  }
}

export function checkRegionFile(data: RegionFile): RegionCheck {
  const problems: CheckProblem[] = []
  // Events may run past the last school day (the year-end break), never out of the school year.
  const startYear = Number(String(data.academic_year ?? '').slice(0, 4))
  const inFrame = (date: string) => date >= `${startYear}-07-01` && date <= `${startYear + 1}-06-30`
  if (data.dataset !== 'region_calendar') problems.push({ key: 'dataset' })
  if (!data.code || !/^[A-Z0-9][A-Z0-9-]{2,119}$/.test(data.code)) problems.push({ key: 'code' })
  if (!data.region?.province) problems.push({ key: 'region_missing' })
  const year = /^(\d{4})\/(\d{4})$/.exec(data.academic_year ?? '')
  if (!year || Number(year[2]) !== Number(year[1]) + 1) {
    problems.push({ key: 'school_year', values: { year: String(data.academic_year) } })
  }
  if (
    ![data.starts_on, data.even_semester_starts_on, data.ends_on].every(isIsoDate) ||
    !(data.starts_on < data.even_semester_starts_on && data.even_semester_starts_on < data.ends_on)
  ) {
    problems.push({ key: 'frame' })
  }
  if (![5, 6].includes(data.school_days_per_week)) problems.push({ key: 'days_per_week' })
  if (!data.source?.decree || !data.source?.sha256) problems.push({ key: 'evidence' })

  for (const event of data.events ?? []) {
    const label = event.title ?? '?'
    if (!(EVENT_KINDS as readonly string[]).includes(event.kind)) {
      problems.push({ key: 'event_kind', values: { title: label } })
    }
    if (
      event.kind === 'exam' &&
      !(EXAM_TYPES as readonly string[]).includes(event.exam_type ?? '')
    ) {
      problems.push({ key: 'event_kind', values: { title: label } })
    }
    if (
      !isIsoDate(event.starts_on) ||
      !isIsoDate(event.ends_on) ||
      event.ends_on < event.starts_on ||
      !inFrame(event.starts_on)
    ) {
      problems.push({ key: 'event_date', values: { title: label } })
    }
  }
  for (const day of data.joint_leave_school_days ?? []) {
    if (!isIsoDate(day.date) || !inFrame(day.date)) {
      problems.push({ key: 'event_date', values: { title: String(day.date) } })
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    summary: {
      code: data.code ?? null,
      name: data.name ?? null,
      status: data.status ?? null,
      area: data.region?.regency ?? data.region?.province ?? null,
      schoolYear: data.academic_year ?? null,
      decree: data.source?.decree ?? null,
      events: data.events?.length ?? 0,
      notes: (data.assessment_windows?.length ?? 0) + (data.milestones?.length ?? 0),
      schoolDays: data.joint_leave_school_days?.length ?? 0,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Writing packages                                                    */
/* ------------------------------------------------------------------ */

interface DesiredItem {
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

interface LiveRow {
  id: number
  item_key: string
  kind: string
  title: string
  starts_on: string | Date | null
  ends_on: string | Date | null
  force: string
  exam_type: string | null
  setting_value: string | null
  source_ref: Record<string, unknown> | null
  revision: number
}

const iso = (value: string | Date | null) =>
  value === null
    ? null
    : typeof value === 'string'
      ? value.slice(0, 10)
      : new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

function sameItem(row: LiveRow, item: DesiredItem) {
  return (
    row.kind === item.kind &&
    row.title === item.title &&
    iso(row.starts_on) === item.startsOn &&
    iso(row.ends_on) === item.endsOn &&
    row.force === item.force &&
    (row.exam_type ?? null) === (item.examType ?? null) &&
    (row.setting_value ?? null) === (item.settingValue ?? null) &&
    JSON.stringify(row.source_ref ?? null) === JSON.stringify(item.sourceRef ?? null)
  )
}

/**
 * Brings a package's live items in line with `desired`: new keys are
 * inserted, changed ones get a new revision, keys no longer listed are
 * retired (only those `retireWhen` accepts).
 */
async function syncItems(
  client: QueryClientContract,
  packageId: number,
  desired: DesiredItem[],
  retireWhen: (row: LiveRow) => boolean,
  report: ImportReport
) {
  const live = (await client
    .from('calendar_items')
    .where('package_id', packageId)
    .whereNot('status', 'retired')
    .select('*')) as LiveRow[]
  const byKey = new Map(live.map((row) => [row.item_key, row]))
  const now = new Date()
  const insert = (item: DesiredItem, revision = 1, supersedesId: number | null = null) =>
    client.table('calendar_items').insert({
      package_id: packageId,
      item_key: item.itemKey,
      shape: item.kind === 'setting' ? 'setting' : 'list',
      force: item.force,
      origin: item.origin,
      match_key: calendarMatchKey(item),
      revision,
      supersedes_id: supersedesId,
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

  const wanted = new Set<string>()
  for (const item of desired) {
    if (wanted.has(item.itemKey)) continue
    wanted.add(item.itemKey)
    const row = byKey.get(item.itemKey)
    if (!row) {
      await insert(item)
      report.created++
    } else if (sameItem(row, item)) {
      report.unchanged++
    } else {
      await client
        .from('calendar_items')
        .where('id', row.id)
        .update({ status: 'retired', updated_at: now })
      await insert(item, Number(row.revision) + 1, Number(row.id))
      report.revised++
    }
  }
  for (const row of live) {
    if (wanted.has(row.item_key) || !retireWhen(row)) continue
    await client
      .from('calendar_items')
      .where('id', row.id)
      .update({ status: 'retired', updated_at: now })
    report.retired++
  }
}

async function syncHides(
  client: QueryClientContract,
  packageId: number,
  keys: string[],
  report: ImportReport
) {
  const now = new Date()
  for (const key of keys) {
    await client
      .table('layer_hides')
      .insert({
        package_id: packageId,
        domain: 'calendar',
        target_item_key: key,
        reason: null,
        status: 'active',
        created_at: now,
        updated_at: now,
      })
      .onConflict(['package_id', 'target_item_key'])
      .merge({ status: 'active', void_reason: null, updated_at: now })
    report.hidesWritten++
  }
  const voidQuery = client
    .from('layer_hides')
    .where('package_id', packageId)
    .where('status', 'active')
  if (keys.length > 0) voidQuery.whereNotIn('target_item_key', keys)
  await voidQuery.update({ status: 'void', void_reason: 'unhidden', updated_at: now })
}

async function upsertPackage(
  client: QueryClientContract,
  values: Record<string, unknown> & { code: string },
  report: ImportReport
) {
  const now = new Date()
  const existing = (await client
    .from('layer_packages')
    .where('code', values.code)
    .select('id', 'status', 'domain')
    .first()) as { id: number; status: string; domain: string } | undefined
  if (existing) {
    if (existing.domain !== 'calendar') throw new CalendarImportException([{ key: 'code' }])
    // The frame (code, layer, area, line, kind) never changes (layer_packages_guard).
    const rest = Object.fromEntries(
      Object.entries(values).filter(
        ([key]) => !['code', 'layer', 'region_id', 'line', 'kind'].includes(key)
      )
    )
    await client
      .from('layer_packages')
      .where('id', existing.id)
      .update({ ...rest, updated_at: now })
    report.status = existing.status
    return Number(existing.id)
  }
  const [row] = (await client
    .table('layer_packages')
    .insert({
      domain: 'calendar',
      status: 'draft',
      version: 1,
      created_at: now,
      updated_at: now,
      ...values,
    })
    .returning('id')) as { id: number }[]
  report.packageCreated = true
  report.status = 'draft'
  return Number(row.id)
}

async function finish(client: QueryClientContract, packageId: number, report: ImportReport) {
  if (!report.packageCreated && report.created + report.revised + report.retired > 0) {
    await client
      .from('layer_packages')
      .where('id', packageId)
      .update({ version: client.raw('version + 1'), updated_at: new Date() })
  }
}

function newReport(code: string): ImportReport {
  return {
    packageCode: code,
    packageCreated: false,
    created: 0,
    revised: 0,
    retired: 0,
    unchanged: 0,
    hidesWritten: 0,
    status: 'draft',
  }
}

/**
 * Imports an SKB file into the national base package after the D-254
 * check. Items of dates the file covers but no longer lists are
 * retired; earlier years stay as they are.
 */
export async function importNationalHolidays(
  client: QueryClientContract,
  options: { file?: string } = {}
): Promise<ImportReport> {
  const files = options.file ? [options.file] : await holidayFiles()
  const file = files.at(-1)
  if (!file) throw new CalendarImportException([{ key: 'no_days' }])
  const data = await readJson<HolidayFile>(file)
  const check = checkHolidayFile(data)
  if (!check.ok) throw new CalendarImportException(check.problems)

  const report = newReport(NATIONAL_PACKAGE_CODE)
  const years = check.summary.years.slice().sort()
  const existing = (await client
    .from('layer_packages')
    .where('code', NATIONAL_PACKAGE_CODE)
    .select('applies_from_school_year')
    .first()) as { applies_from_school_year: string } | undefined
  const from =
    existing && existing.applies_from_school_year < years[0]
      ? existing.applies_from_school_year
      : years[0]
  const official = (data.check?.sources ?? []).find(
    (source) => typeof source.url === 'string' && OFFICIAL_HOST.test(source.url)
  )
  const packageId = await upsertPackage(
    client,
    {
      code: NATIONAL_PACKAGE_CODE,
      layer: 'national',
      line: 'all',
      kind: 'base',
      level_scope: 'both',
      name: 'Hari libur nasional dan cuti bersama',
      applies_from_school_year: from,
      applies_to_school_year: null,
      evidence: JSON.stringify({
        regulation_code: check.summary.decrees.join('; '),
        document_title: official?.title ?? null,
        source_url: official?.url ?? null,
        checked_on: check.summary.checkedOn,
      }),
    },
    report
  )

  const ranges: [string, string][] = []
  const desired: DesiredItem[] = []
  for (const year of data.academic_years ?? []) {
    const start = Number(year.academic_year.slice(0, 4))
    ranges.push([`${start}-07-01`, year.covered_until ?? `${start + 1}-06-30`])
    for (const day of year.days) {
      const kind = day.kind as 'national_holiday' | 'joint_leave'
      desired.push({
        itemKey: holidayKey(day.date, kind),
        kind,
        title: day.name.trim(),
        startsOn: day.date,
        endsOn: day.date,
        force: kind === 'national_holiday' ? 'mandatory' : 'example',
        origin: 'official',
        sourceRef: { regulation: day.decree, provisional: Boolean(day.is_provisional) },
      })
    }
  }
  await syncItems(
    client,
    packageId,
    desired,
    (row) => {
      const date = iso(row.starts_on)
      return date !== null && ranges.some(([from_, to]) => date >= from_ && date <= to)
    },
    report
  )
  await finish(client, packageId, report)
  return report
}

/**
 * Imports a region calendar file into the official package of its area.
 */
export async function importRegionCalendar(
  client: QueryClientContract,
  options: { file: string }
): Promise<ImportReport> {
  const data = await readJson<RegionFile>(options.file)
  const check = checkRegionFile(data)
  if (!check.ok) throw new CalendarImportException(check.problems)

  const province = (await client
    .from('regions')
    .where('level', 'province')
    .where('status', 'active')
    .whereRaw('lower(name) = lower(?)', [data.region.province])
    .select('id')
    .first()) as { id: number } | undefined
  if (!province) throw new CalendarImportException([{ key: 'region_missing' }])
  let area = { id: Number(province.id), layer: 'province' }
  if (data.region.regency) {
    const regency = (await client
      .from('regions')
      .where('level', 'regency')
      .where('parent_id', province.id)
      .where('status', 'active')
      .whereRaw('lower(name) = lower(?)', [data.region.regency])
      .select('id')
      .first()) as { id: number } | undefined
    if (!regency) throw new CalendarImportException([{ key: 'region_missing' }])
    area = { id: Number(regency.id), layer: 'regency' }
  }

  const report = newReport(data.code)
  const packageId = await upsertPackage(
    client,
    {
      code: data.code,
      layer: area.layer,
      region_id: area.id,
      line: 'all',
      kind: 'official',
      level_scope: 'both',
      name: data.name,
      applies_from_school_year: data.academic_year,
      applies_to_school_year: data.academic_year,
      evidence: JSON.stringify({
        regulation_code: data.source?.decree ?? null,
        document_title: data.source?.decree ?? null,
        source_file: data.source?.file ?? null,
        sha256: data.source?.sha256 ?? null,
        note: data.source?.pages ?? null,
      }),
    },
    report
  )

  const ref = (text: string | undefined) => (text ? { article: text } : null)
  const frameValues: Record<(typeof FRAME_KEYS)[number], [string, string]> = {
    'FRAME-starts_on': ['Hari pertama tahun ajaran', data.starts_on],
    'FRAME-even_semester_starts_on': ['Awal semester 2', data.even_semester_starts_on],
    'FRAME-ends_on': ['Hari terakhir tahun ajaran', data.ends_on],
    'FRAME-school_days_per_week': ['Hari sekolah per minggu', String(data.school_days_per_week)],
  }
  const desired: DesiredItem[] = [
    ...FRAME_KEYS.map((key) => ({
      itemKey: key,
      kind: 'setting',
      title: frameValues[key][0],
      startsOn: null,
      endsOn: null,
      force: 'mandatory',
      origin: 'official',
      settingValue: frameValues[key][1],
      sourceRef: ref(data.source?.pages),
    })),
    ...(data.events ?? []).map((event) => ({
      itemKey: eventKey(event.starts_on, event.title),
      kind: event.kind,
      title: event.title,
      startsOn: event.starts_on,
      endsOn: event.ends_on,
      force: 'mandatory',
      origin: 'official',
      examType: event.kind === 'exam' ? (event.exam_type ?? 'other') : null,
      sourceRef: ref(event.source_ref),
    })),
    ...(data.assessment_windows ?? []).map((window) => ({
      itemKey: noteKey(window.starts_on, window.title),
      kind: 'note',
      title: window.title,
      startsOn: window.starts_on,
      endsOn: window.ends_on,
      force: 'example',
      origin: 'official',
      sourceRef: ref(window.source_ref),
    })),
    ...(data.milestones ?? [])
      .filter((milestone) => milestone.date <= data.ends_on && milestone.date >= data.starts_on)
      .map((milestone) => ({
        itemKey: noteKey(milestone.date, milestone.title),
        kind: 'note',
        title: milestone.title,
        startsOn: milestone.date,
        endsOn: milestone.end_date ?? milestone.date,
        force: 'example',
        origin: 'official',
        sourceRef: ref(milestone.source_ref),
      })),
  ]
  await syncItems(client, packageId, desired, () => true, report)
  await syncHides(
    client,
    packageId,
    (data.joint_leave_school_days ?? []).map((day) => holidayKey(day.date, 'joint_leave')),
    report
  )
  await finish(client, packageId, report)
  return report
}

/**
 * Tim Validasi signed the data off: the package becomes active (staff
 * transaction or owner connection).
 */
export async function activateCalendarPackage(
  client: QueryClientContract,
  code: string,
  staffId: number | null
) {
  const now = new Date()
  const updated = await client
    .from('layer_packages')
    .where('code', code)
    .where('domain', 'calendar')
    .where('status', 'draft')
    .update({
      status: 'active',
      approved_by_staff_id: staffId,
      approved_at: now,
      updated_at: now,
    })
  return Array.isArray(updated) ? updated.length : Number(updated)
}
