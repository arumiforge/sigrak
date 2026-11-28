import { readFileSync } from 'node:fs'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type School from '#models/school'
import { registerDomainAdapter, syncLayerDomains } from '#layers/domains/registry'
import {
  itemInput,
  normaliseLabel,
  type DomainAdapter,
  type LayeredRow,
} from '#layers/domains/domain_adapter'
import { importExtracurricularCatalog } from '#layers/domains/extracurricular_import'
import { LayerResolver, type ResolveOptions } from '#layers/resolver/layer_resolver'
import type { Force, ItemShape, Layer, Line, PackageKind } from '#layers/types'
import { createSchoolIn, region, seedJawaTengah } from '#tests/regions'
import { asSchool } from '#tests/tenancy'

/**
 * Test helpers for the layer model (R1-07): the §11.3 fixtures and a
 * second, test-only domain (`layer_test`) on `catalog_items`, which
 * shows a new domain plugging in with no change to the resolver.
 */

export const YEAR = '2026/2027'

type TestValue = { label: string }

export const testAdapter: DomainAdapter<TestValue, { label: string }> = {
  domain: 'layer_test',
  itemTable: 'catalog_items',
  keyPrefix: 'TST',
  async loadItems(client, packageIds) {
    if (packageIds.length === 0) return []
    const rows = (await client
      .from('catalog_items')
      .whereIn('package_id', packageIds)
      .whereNot('status', 'retired')) as (LayeredRow & { label: string })[]
    return rows.map((row) => itemInput<TestValue>(row, { label: row.label }))
  },
  async validatePayload(payload) {
    const label = String((payload as { label?: unknown })?.label ?? '').trim()
    if (label.length < 2) throw new Error('label')
    return { label }
  },
  matchKeyOf: (payload) => normaliseLabel(payload.label),
  groupKeyOf: () => null,
  columnsOf: (payload) => ({ label: payload.label }),
  labelOf: (value) => value.label,
  compare: (a, b) => (a.itemKey < b.itemKey ? -1 : a.itemKey > b.itemKey ? 1 : 0),
}

let packageCounter = 0

export interface PackageFields {
  domain?: string
  layer: Layer
  kind?: PackageKind
  line?: Line
  regionCode?: string
  school?: School
  status?: 'draft' | 'active' | 'retired'
  from?: string
  to?: string | null
  effectiveOn?: string | null
  levelScope?: 'sd' | 'mi' | 'both'
  name?: string
}

const defaultKind: Record<Layer, PackageKind> = {
  national: 'base',
  province: 'official',
  regency: 'official',
  district: 'local_agreement',
  school: 'school',
}

/**
 * A package written with the owner connection (bypasses the walls).
 */
export async function createPackage(fields: PackageFields) {
  const kind = fields.kind ?? defaultKind[fields.layer]
  const area = fields.regionCode ? await region(fields.regionCode) : null
  const regionId = area ? area.id : null
  const now = new Date()
  const code = `TEST-${fields.layer.toUpperCase()}-${Date.now().toString(36)}-${packageCounter++}`
  const [row] = (await db
    .table('layer_packages')
    .insert({
      code,
      domain: fields.domain ?? 'layer_test',
      layer: fields.layer,
      region_id: regionId,
      school_id: fields.school?.id ?? null,
      line: fields.line ?? 'all',
      kind,
      level_scope: fields.levelScope ?? 'both',
      name: fields.name ?? `Paket ${code}`,
      status: fields.status ?? 'active',
      applies_from_school_year: fields.from ?? YEAR,
      applies_to_school_year: fields.to ?? null,
      effective_on: fields.effectiveOn ?? null,
      version: 1,
      evidence:
        kind === 'official' || kind === 'local_agreement'
          ? JSON.stringify({ document_title: 'Dokumen uji', checked_on: '2026-11-01' })
          : null,
      approved_at: ['province', 'regency', 'district'].includes(fields.layer) ? now : null,
      created_at: now,
      updated_at: now,
    })
    .returning(['id', 'code', 'public_id'])) as { id: number; code: string; public_id: string }[]
  return { id: Number(row.id), code: row.code, publicId: row.public_id }
}

export interface ItemFields {
  key: string
  label?: string
  force?: Force
  shape?: ItemShape
  groupKey?: string | null
  matchKey?: string
  status?: 'active' | 'retired' | 'shadowed'
}

const originOf: Record<PackageKind, string> = {
  base: 'sigrak',
  official: 'official',
  local_agreement: 'local_agreement',
  school: 'school',
}

export async function addItems(pkg: { id: number }, items: ItemFields[]) {
  const row = (await db.from('layer_packages').where('id', pkg.id).select('kind').first()) as {
    kind: PackageKind
  }
  const now = new Date()
  for (const item of items) {
    const label = item.label ?? item.key
    await db.table('catalog_items').insert({
      package_id: pkg.id,
      item_key: item.key,
      shape: item.shape ?? 'list',
      force: item.force ?? 'free',
      origin: originOf[row.kind],
      group_key: item.groupKey ?? null,
      match_key: item.matchKey ?? normaliseLabel(label),
      revision: 1,
      status: item.status ?? 'active',
      label,
      created_at: now,
      updated_at: now,
    })
  }
}

export async function hide(pkg: { id: number }, key: string, reason: string | null = null) {
  const now = new Date()
  await db.table('layer_hides').insert({
    package_id: pkg.id,
    domain: '',
    target_item_key: key,
    reason,
    status: 'active',
    created_at: now,
    updated_at: now,
  })
}

export async function groupRule(
  domain: string,
  groupKey: string,
  defaultItemKey: string,
  min = 1,
  line: Line = 'all'
) {
  const now = new Date()
  await db.table('layer_group_rules').insert({
    domain,
    group_key: groupKey,
    label: 'Kelompok uji',
    min,
    default_item_key: defaultItemKey,
    line,
    force: 'mandatory',
    created_at: now,
    updated_at: now,
  })
}

/**
 * The §11.3 fixture areas: Jawa Tengah (33) → Kudus (33.19) → Jati and
 * Dawe; Jepara (33.20) with one school that has no kecamatan; an SD and
 * an MI in Jati.
 */
export async function layerFixtures() {
  registerDomainAdapter(testAdapter)
  await seedJawaTengah()
  await syncLayerDomains(db.connection())
  await LayerResolver.clearCache()
  const sdJati = await createSchoolIn('SD Uji Jati', '90000001', '33.19.03')
  const miJati = await createSchoolIn('MI Uji Jati', '90000002', '33.19.03')
  miJati.level = 'mi'
  await miJati.save()
  const sdDawe = await createSchoolIn('SD Uji Dawe', '90000003', '33.19.09')
  const sdJepara = await createSchoolIn('SD Uji Jepara', '90000004', '33.20.06')
  sdJepara.districtId = null
  sdJepara.district = null
  await sdJepara.save()
  return { sdJati, miJati, sdDawe, sdJepara }
}

export function resolveFor(
  school: School,
  domain = 'layer_test',
  options: ResolveOptions & { schoolYear?: string } = {}
) {
  return asSchool(school, () =>
    LayerResolver.resolve<TestValue>(domain, school.id, options.schoolYear ?? YEAR, {
      fresh: true,
      ...options,
    })
  )
}

export const keys = (items: { itemKey: string }[]) => items.map((item) => item.itemKey).sort()

export async function itemKeysFor(...args: Parameters<typeof resolveFor>) {
  const result = await resolveFor(...args)
  return keys(result.items)
}

/**
 * The national extracurricular base, published (tests only; the real
 * import keeps it draft until Tim Validasi signs it off).
 */
export async function publishedCatalog() {
  return db.transaction((trx) => importExtracurricularCatalog(trx, { activate: true }))
}

export function nationalHolidays() {
  const file = app.makePath('docs/data/calendar/national-holidays-2026-2027.json')
  const data = JSON.parse(readFileSync(file, 'utf8')) as {
    academic_years: { days: { date: string; name: string; kind: string }[] }[]
  }
  return data.academic_years[0].days
}

export function jatengJointLeaveSchoolDays() {
  const file = app.makePath('docs/data/calendar/region-jawa-tengah-2026-2027.json')
  const data = JSON.parse(readFileSync(file, 'utf8')) as {
    joint_leave_school_days: { date: string }[]
  }
  return data.joint_leave_school_days.map((day) => day.date)
}
