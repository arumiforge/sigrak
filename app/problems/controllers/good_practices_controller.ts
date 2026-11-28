import type { HttpContext } from '@adonisjs/core/http'
import { authorizeStaff, staffCan } from '#staff/access'
import { staffReadTransaction } from '#tenancy/tenant_transaction'
import { GOOD_PRACTICE_TYPES, PROBLEM_LEVELS, problemNumber } from '../catalog.js'
import {
  createGoodPractice,
  deleteGoodPractice,
  updateGoodPractice,
  type GoodPracticeInput,
} from '../good_practices.js'
import { goodPracticeFilterValidator, goodPracticeValidator, lines } from '../validators.js'
import { cleanQs } from './problems_controller.js'

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null)

/**
 * Konsol: Bank Praktik Baik (R2-07, D-439). `good_practices.view` for
 * the list (all three teams), `good_practices.manage` to add, edit and
 * remove (Tim Kurikulum & Riset). Authors are credited by name on
 * every entry (F-034). Reads as read-only staff; changes logged.
 */
export default class GoodPracticesController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'good_practices.view')
    const filters = await goodPracticeFilterValidator.validate(cleanQs(ctx.request.qs()))
    const search = filters.cari?.trim() ?? ''
    const canManage = staffCan(staff, 'good_practices.manage')

    const data = await staffReadTransaction(async (trx) => {
      const query = trx
        .from('good_practices as g')
        .leftJoin('problems as p', 'p.id', 'g.problem_id')
      if (filters.jenis) query.where('g.type', filters.jenis)
      if (search) {
        query.where((where) =>
          where
            .whereILike('g.title', `%${search}%`)
            .orWhereILike('g.summary', `%${search}%`)
            .orWhereRaw("array_to_string(g.authors, ' ') ILIKE ?", [`%${search}%`])
        )
      }
      const rows = (await query
        .leftJoin('staff_users as st', 'st.id', 'g.added_by_staff_id')
        .orderBy('g.created_at', 'desc')
        .orderBy('g.id', 'desc')
        .limit(200)
        .select('g.*', 'p.title as problem_title', 'st.name as added_by')) as Record<string, any>[]
      const problems = canManage
        ? ((await trx
            .from('problems')
            .whereNull('merged_into_id')
            .orderBy('updated_at', 'desc')
            .limit(200)
            .select('id', 'title')) as { id: number; title: string }[])
        : []
      return { rows, problems }
    })

    return ctx.inertia.render('console/good_practices', {
      filters: { type: filters.jenis ?? '', search },
      practices: data.rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        summary: row.summary,
        type: row.type,
        authors: row.authors ?? [],
        link: row.link,
        level: row.level,
        year: row.year === null ? null : Number(row.year),
        problem: row.problem_id
          ? {
              id: Number(row.problem_id),
              number: problemNumber(Number(row.problem_id)),
              title: row.problem_title,
            }
          : null,
        addedBy: row.added_by ?? null,
        createdAt: iso(row.created_at)!,
      })),
      types: [...GOOD_PRACTICE_TYPES],
      levels: [...PROBLEM_LEVELS],
      problems: data.problems.map((row) => ({
        id: Number(row.id),
        number: problemNumber(Number(row.id)),
        title: row.title,
      })),
      can: { manage: canManage, viewProblems: staffCan(staff, 'problems.view') },
    })
  }

  async store(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'good_practices.manage')
    await createGoodPractice(staff, await this.#input(ctx))
    ctx.session.flash('success', ctx.i18n.t('problems.practices.flash.created'))
    return ctx.response.redirect().toPath('/bank-praktik-baik')
  }

  async update(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'good_practices.manage')
    await updateGoodPractice(staff, Number(ctx.params.practice), await this.#input(ctx))
    ctx.session.flash('success', ctx.i18n.t('problems.practices.flash.saved'))
    return ctx.response.redirect().toPath('/bank-praktik-baik')
  }

  async destroy(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'good_practices.manage')
    await deleteGoodPractice(staff, Number(ctx.params.practice))
    ctx.session.flash('success', ctx.i18n.t('problems.practices.flash.deleted'))
    return ctx.response.redirect().toPath('/bank-praktik-baik')
  }

  async #input(ctx: HttpContext): Promise<GoodPracticeInput> {
    const input = await ctx.request.validateUsing(goodPracticeValidator)
    return {
      title: input.title,
      summary: input.summary,
      type: input.type,
      authors: lines(input.authors).slice(0, 10),
      link: input.link ?? null,
      level: input.level ?? null,
      year: input.year ?? null,
      problemId: input.problem_id ?? null,
    }
  }
}
