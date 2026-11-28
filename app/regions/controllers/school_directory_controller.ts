import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { regionReviewer } from '#regions/access'
import { SchoolDirectory } from '#regions/school_directory'
import { directorySearchValidator } from '#regions/validators'

/**
 * Direktori Sekolah on admin.: NPSN lookup (what the school form fills,
 * D-169) and the directory size per kabupaten/kota.
 */
export default class SchoolDirectoryController {
  async index(ctx: HttpContext) {
    regionReviewer(ctx)
    const { npsn } = await ctx.request.validateUsing(directorySearchValidator, {
      data: ctx.request.qs(),
    })
    const query = npsn ?? ''
    const valid = /^\d{8}$/.test(query)

    return ctx.inertia.render('admin/school_directory', {
      query,
      invalid: query !== '' && !valid,
      result: valid ? await SchoolDirectory.lookup(query) : null,
      regencies: await summary(),
    })
  }

  /**
   * JSON for the console's school form: GET /direktori-sekolah/{npsn}.
   */
  async show(ctx: HttpContext) {
    regionReviewer(ctx)
    const result = await SchoolDirectory.lookup(ctx.params.npsn)
    if (!result) {
      return ctx.response.notFound({ message: ctx.i18n.t('regions.directory.not_found') })
    }
    return result
  }
}

async function summary() {
  const rows = (await db
    .from('school_directory_entries as e')
    .leftJoin('regions as r', 'r.id', 'e.region_id')
    .leftJoin('schools as s', 's.npsn', 'e.npsn')
    .whereNull('e.removed_at')
    .groupBy('e.regency_name', 'e.province_name', 'r.kemendagri_code')
    .orderBy('e.regency_name')
    .select(
      'e.regency_name as regency',
      'e.province_name as province',
      'r.kemendagri_code as code',
      db.raw('count(*)::int as total'),
      db.raw(`count(*) FILTER (WHERE e.level = 'sd')::int as sd`),
      db.raw(`count(*) FILTER (WHERE e.level = 'mi')::int as mi`),
      db.raw('count(*) FILTER (WHERE e.district_id IS NULL)::int as without_district'),
      db.raw('count(s.id)::int as customers'),
      db.raw('max(e.fetched_on)::text as fetched_on')
    )) as {
    regency: string
    province: string
    code: string | null
    total: number
    sd: number
    mi: number
    without_district: number
    customers: number
    fetched_on: string
  }[]

  return rows.map((row) => ({
    regency: row.regency,
    province: row.province,
    code: row.code,
    total: row.total,
    sd: row.sd,
    mi: row.mi,
    withoutDistrict: row.without_district,
    customers: row.customers,
    fetchedOn: row.fetched_on,
  }))
}
