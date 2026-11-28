import type { HttpContext } from '@adonisjs/core/http'
import { basename } from 'node:path'
import { staffTransaction } from '#tenancy/tenant_transaction'
import {
  canApproveAreaChange,
  LayerAccessDeniedException,
  layerStaff,
} from '../../layers/access.js'
import {
  activateCalendarPackage,
  CalendarImportException,
  checkHolidayFile,
  checkRegionFile,
  dataFile,
  holidayFiles,
  importNationalHolidays,
  importRegionCalendar,
  readJson,
  regionFiles,
  type HolidayFile,
  type RegionFile,
} from '../data_files.js'
import { toIsoDate } from '../dates.js'
import { consoleImportValidator } from '../validators.js'

const PATH = '/kalender'

interface PackageRow {
  id: number
  public_id: string
  code: string
  name: string
  layer: 'national' | 'province' | 'regency' | 'district'
  status: 'draft' | 'active' | 'retired'
  version: number
  applies_from_school_year: string
  applies_to_school_year: string | null
  approved_at: Date | null
  region_name: string | null
  regency_kind: string | null
}

interface ItemRow {
  package_id: number
  item_key: string
  kind: string
  exam_type: string | null
  title: string
  starts_on: string | Date | null
  ends_on: string | Date | null
  force: string
  setting_value: string | null
}

/**
 * Kalender on admin. (D-253, D-254, D-323): the national holiday package
 * and the region calendar packages, the D-254 check of each data file in
 * the repository, import after the check, and activation after Tim
 * Validasi's sign-off. Changes to a published package go through
 * Usulan wilayah.
 */
export default class ConsoleCalendarController {
  async index(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    const { packages, items, hides } = await staffTransaction(async (trx) => {
      const rows = (await trx
        .from('layer_packages as p')
        .leftJoin('regions as r', 'r.id', 'p.region_id')
        .where('p.domain', 'calendar')
        .whereIn('p.layer', ['national', 'province', 'regency', 'district'])
        .whereNot('p.status', 'retired')
        .select('p.*', 'r.name as region_name', 'r.regency_kind')
        .orderByRaw('layer_rank(p.layer), p.applies_from_school_year desc, p.name')) as PackageRow[]
      const ids = rows.map((row) => row.id)
      return {
        packages: rows,
        items: (ids.length === 0
          ? []
          : await trx
              .from('calendar_items')
              .whereIn('package_id', ids)
              .where('status', 'active')
              .select(
                'package_id',
                'item_key',
                'kind',
                'exam_type',
                'title',
                'starts_on',
                'ends_on',
                'force',
                'setting_value'
              )
              .orderByRaw('starts_on NULLS FIRST, item_key')) as ItemRow[],
        hides: (ids.length === 0
          ? []
          : await trx
              .from('layer_hides')
              .whereIn('package_id', ids)
              .where('status', 'active')
              .select('package_id', 'target_item_key')) as {
          package_id: number
          target_item_key: string
        }[],
      }
    })

    const [holidayPaths, regionPaths] = await Promise.all([holidayFiles(), regionFiles()])
    const files = await Promise.all([
      ...holidayPaths.map(async (path) => {
        const check = checkHolidayFile(await readJson<HolidayFile>(path))
        return {
          file: basename(path),
          kind: 'holidays' as const,
          ok: check.ok,
          problems: check.problems,
          summary: check.summary,
        }
      }),
      ...regionPaths.map(async (path) => {
        const check = checkRegionFile(await readJson<RegionFile>(path))
        return {
          file: basename(path),
          kind: 'region' as const,
          ok: check.ok,
          problems: check.problems,
          summary: check.summary,
        }
      }),
    ])

    return ctx.inertia.render('admin/calendar', {
      canImport: true,
      canActivate: canApproveAreaChange(staff),
      files,
      packages: packages.map((row) => ({
        id: row.public_id,
        code: row.code,
        name: row.name,
        layer: row.layer,
        area: row.region_name
          ? {
              name: row.region_name,
              kind: row.layer === 'regency' ? (row.regency_kind ?? 'kabupaten') : row.layer,
            }
          : null,
        status: row.status,
        version: row.version,
        schoolYears: row.applies_to_school_year
          ? row.applies_from_school_year === row.applies_to_school_year
            ? row.applies_from_school_year
            : `${row.applies_from_school_year}–${row.applies_to_school_year}`
          : row.applies_from_school_year,
        openEnded: row.applies_to_school_year === null,
        items: items
          .filter((item) => Number(item.package_id) === Number(row.id))
          .map((item) => ({
            key: item.item_key,
            kind: item.kind,
            examType: item.exam_type,
            title: item.title,
            startsOn: item.starts_on === null ? null : toIsoDate(item.starts_on),
            endsOn: item.ends_on === null ? null : toIsoDate(item.ends_on),
            mandatory: item.force === 'mandatory',
            value: item.setting_value,
          })),
        hides: hides
          .filter((hide) => Number(hide.package_id) === Number(row.id))
          .map((hide) => hide.target_item_key),
      })),
    })
  }

  /** Imports one data file after its check (D-254); the package stays draft. */
  async import(ctx: HttpContext) {
    layerStaff(ctx)
    const { file } = await ctx.request.validateUsing(consoleImportValidator)
    const path = await dataFile(file)
    if (!path) {
      ctx.session.flash('error', ctx.i18n.t('calendar.console.errors.file'))
      return ctx.response.redirect().toPath(PATH)
    }
    try {
      const report = await staffTransaction((trx) =>
        basename(path).startsWith('national-holidays-')
          ? importNationalHolidays(trx, { file: path })
          : importRegionCalendar(trx, { file: path })
      )
      ctx.session.flash(
        'success',
        ctx.i18n.t('calendar.console.toasts.imported', {
          created: report.created,
          revised: report.revised,
          retired: report.retired,
          unchanged: report.unchanged,
        })
      )
    } catch (error) {
      if (!(error instanceof CalendarImportException)) throw error
      const first = error.problems[0]
      ctx.session.flash(
        'error',
        ctx.i18n.t('calendar.console.check_failed', {
          problem: ctx.i18n.t(`calendar.console.problems.${first.key}`, first.values ?? {}),
        })
      )
    }
    return ctx.response.redirect().toPath(PATH)
  }

  /** Tim Validasi signed off: the package applies to every school in scope. Approvers only. */
  async activate(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    if (!canApproveAreaChange(staff)) throw new LayerAccessDeniedException()
    const changed = await staffTransaction(async (trx) => {
      const row = (await trx
        .from('layer_packages')
        .where('public_id', ctx.params.package)
        .where('domain', 'calendar')
        .select('code')
        .first()) as { code: string } | undefined
      return row ? activateCalendarPackage(trx, row.code, staff.id) : 0
    })
    ctx.session.flash(
      changed > 0 ? 'success' : 'error',
      ctx.i18n.t(
        changed > 0 ? 'calendar.console.toasts.activated' : 'calendar.console.errors.not_draft'
      )
    )
    return ctx.response.redirect().toPath(PATH)
  }
}
