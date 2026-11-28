import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import type StaffUser from '#models/staff_user'
import { authorizeStaff, staffCan } from '#staff/access'
import { staffReadTransaction } from '#tenancy/tenant_transaction'
import { staffReaches } from '#help/help_requests'
import { errors as vineErrors } from '@vinejs/vine'
import { reachesProblem, regenciesInScope } from '../access.js'
import {
  MANUAL_SOURCES,
  PROBLEM_LEVELS,
  PROBLEM_SOURCES,
  PROBLEM_STATUSES,
  OPEN_STATUSES,
  problemNumber,
  type ProblemLevel,
  type ProblemStatus,
} from '../catalog.js'
import {
  addAnalysis,
  allowedMoves,
  mergeProblem,
  moveProblem,
  ProblemChangeRefusedException,
  ProblemNotFoundException,
  recordProblem,
  updateProblem,
  type ProblemRow,
} from '../problems.js'
import {
  analysisValidator,
  evidenceLinks,
  lines,
  mergeProblemValidator,
  moveProblemValidator,
  problemFilterValidator,
  recordProblemValidator,
  updateProblemValidator,
} from '../validators.js'

const PER_PAGE = 50

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null)

/** Query string without empty values (an empty select means "all"). */
export function cleanQs(qs: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(qs).filter(([, value]) => value !== ''))
}

type RegionOption = { id: number; name: string; kind: string }

/**
 * Konsol: Bank Masalah (R2-07, D-439, D-477). Abilities:
 * `problems.view` for the list and a problem page (all teams, no area
 * limit); `problems.record` to record by hand (inside the area);
 * `problems.triage` to edit, move through triage, close and merge
 * (inside the area); `problems.analyse` to add an analysis and move to
 * Dianalisis (inside the level scope); `problems.deliver` for
 * Dikerjakan and Rilis. Diputuskan comes only from the forum
 * (forum_controller.ts, `problems.decide`). Reads run as read-only
 * staff; changes in problems.ts, logged.
 */
export default class ProblemsController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'problems.view')
    const filters = await problemFilterValidator.validate(cleanQs(ctx.request.qs()))
    const page = filters.halaman ?? 1
    const search = filters.cari?.trim() ?? ''
    const number = /^(?:bm-?)?0*(\d{1,9})$/i.exec(search)?.[1]

    const data = await staffReadTransaction(async (trx) => {
      const base = () => {
        const query = trx.from('problems as p')
        if (filters.sumber) query.where('p.source', filters.sumber)
        if (search) {
          query.where((where) => {
            where.whereILike('p.title', `%${search}%`)
            if (number) where.orWhere('p.id', Number(number))
          })
        }
        return query
      }
      const counts = (await base().groupBy('p.status').select('p.status').count('* as count')) as {
        status: string
        count: string
      }[]

      const query = base()
      if (filters.status === 'open') query.whereIn('p.status', [...OPEN_STATUSES])
      else if (filters.status) query.where('p.status', filters.status)
      const total = Number(
        ((await query.clone().count('* as count').first()) as { count: string }).count
      )
      const rows = (await query
        .leftJoin('regions as r', 'r.id', 'p.region_id')
        .orderByRaw(
          `CASE p.status WHEN 'new' THEN 0 WHEN 'triaged' THEN 1 WHEN 'analysed' THEN 2
             WHEN 'decided' THEN 3 WHEN 'in_progress' THEN 4 WHEN 'released' THEN 5 ELSE 6 END`
        )
        .orderBy('p.updated_at', 'desc')
        .orderBy('p.id', 'desc')
        .limit(PER_PAGE)
        .offset((page - 1) * PER_PAGE)
        .select(
          'p.id',
          'p.title',
          'p.status',
          'p.source',
          'p.level',
          'p.updated_at',
          'r.name as region_name',
          'r.regency_kind',
          trx.raw('(SELECT count(*) FROM problem_reports pr WHERE pr.problem_id = p.id) AS reports')
        )) as {
        id: number
        title: string
        status: string
        source: string
        level: string | null
        updated_at: Date
        region_name: string | null
        regency_kind: string | null
        reports: string
      }[]
      return { counts, total, rows }
    })

    const canRecord = staffCan(staff, 'problems.record')
    return ctx.inertia.render('console/problems', {
      filters: {
        status: filters.status ?? '',
        source: filters.sumber ?? '',
        search,
      },
      page,
      lastPage: Math.max(1, Math.ceil(data.total / PER_PAGE)),
      total: data.total,
      counts: Object.fromEntries(data.counts.map((row) => [row.status, Number(row.count)])),
      problems: data.rows.map((row) => ({
        id: Number(row.id),
        number: problemNumber(Number(row.id)),
        title: row.title,
        status: row.status,
        source: row.source,
        level: row.level,
        region: row.region_name
          ? { name: row.region_name, kind: row.regency_kind ?? 'kabupaten' }
          : null,
        reports: Number(row.reports),
        updatedAt: iso(row.updated_at)!,
      })),
      statuses: [...PROBLEM_STATUSES],
      sources: [...PROBLEM_SOURCES],
      manualSources: [...MANUAL_SOURCES],
      levels: [...PROBLEM_LEVELS],
      can: { record: canRecord },
      recordRegions: canRecord ? await this.#regionOptions(staff, 'problems.record') : null,
    })
  }

  async store(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'problems.record')
    const input = await ctx.request.validateUsing(recordProblemValidator)
    const problemId = await recordProblem(staff, {
      title: input.title,
      description: input.description,
      source: input.source,
      regionId: input.region_id ?? null,
      level: input.level ?? null,
    })
    ctx.session.flash(
      'success',
      ctx.i18n.t('problems.flash.recorded', { number: problemNumber(problemId) })
    )
    return ctx.response.redirect().toPath(`/bank-masalah/${problemId}`)
  }

  async show(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'problems.view')
    const problemId = Number(ctx.params.problem)
    const canViewHelp = staffCan(staff, 'help_requests.view')

    const data = await staffReadTransaction(async (trx) => {
      const problem = (await trx
        .from('problems as p')
        .leftJoin('regions as r', 'r.id', 'p.region_id')
        .leftJoin('staff_users as st', 'st.id', 'p.recorded_by_staff_id')
        .where('p.id', problemId)
        .select('p.*', 'r.name as region_name', 'r.regency_kind', 'st.name as recorded_by')
        .first()) as (ProblemRow & Record<string, any>) | undefined
      if (!problem) throw new ProblemNotFoundException()

      // Reporters: school and role only; the sender's name stays on the help request.
      const reports = (await trx
        .from('problem_reports as pr')
        .join('help_requests as h', 'h.id', 'pr.help_request_id')
        .leftJoin('schools as s', 's.id', 'h.school_id')
        .leftJoin('regions as r', 'r.id', 's.region_id')
        .where('pr.problem_id', problemId)
        .orderBy('pr.created_at', 'asc')
        .select(
          'pr.id',
          'pr.help_request_id',
          'pr.notified_at',
          'pr.created_at',
          'h.school_id',
          'h.membership_role',
          'h.status as request_status',
          's.name as school_name',
          'r.name as region_name',
          'r.regency_kind'
        )) as Record<string, any>[]

      const analyses = (await trx
        .from('problem_analyses as a')
        .leftJoin('staff_users as st', 'st.id', 'a.author_staff_id')
        .where('a.problem_id', problemId)
        .orderBy('a.created_at', 'asc')
        .select('a.*', 'st.name as author_name')) as Record<string, any>[]
      const creditedIds = [
        ...new Set(analyses.flatMap((row) => (row.credited_staff_ids ?? []).map(Number))),
      ]
      const creditedStaff = creditedIds.length
        ? ((await trx.from('staff_users').whereIn('id', creditedIds).select('id', 'name')) as {
            id: number
            name: string
          }[])
        : []

      const forum = (await trx
        .from('forum_decisions as d')
        .join('forum_meetings as m', 'm.id', 'd.meeting_id')
        .where('d.problem_id', problemId)
        .orderBy('m.held_on', 'asc')
        .select('m.id as meeting_id', 'm.held_on', 'd.outcome', 'd.note')) as Record<string, any>[]

      const practices = (await trx
        .from('good_practices')
        .where('problem_id', problemId)
        .orderBy('created_at', 'desc')
        .select('id', 'title', 'type', 'authors', 'link')) as Record<string, any>[]

      const merged = (await trx
        .from('problems')
        .where('merged_into_id', problemId)
        .orderBy('id')
        .select('id', 'title')) as { id: number; title: string }[]

      return { problem, reports, analyses, creditedStaff, forum, practices, merged }
    })

    const { problem } = data
    const place = {
      regionId: problem.region_id === null ? null : Number(problem.region_id),
      level: problem.level as ProblemLevel | null,
    }
    const row: ProblemRow = {
      ...problem,
      id: Number(problem.id),
      region_id: place.regionId,
      merged_into_id: problem.merged_into_id ? Number(problem.merged_into_id) : null,
    }
    const open = row.status !== 'closed' && !row.merged_into_id
    const canTriage = open && (await reachesProblem(staff, 'problems.triage', place))
    const canAnalyse = open && (await reachesProblem(staff, 'problems.analyse', place))
    const staffNames = new Map(data.creditedStaff.map((s) => [Number(s.id), s.name]))

    return ctx.inertia.render('console/problem', {
      problem: {
        id: row.id,
        number: problemNumber(row.id),
        title: row.title,
        description: row.description,
        source: row.source,
        status: row.status,
        level: row.level,
        regionId: place.regionId,
        region: problem.region_name
          ? { name: problem.region_name, kind: problem.regency_kind ?? 'kabupaten' }
          : null,
        releaseNote: row.release_note,
        recordedBy: problem.recorded_by ?? null,
        createdAt: iso(problem.created_at)!,
        statusChangedAt: iso(problem.status_changed_at)!,
        mergedInto: row.merged_into_id
          ? { id: row.merged_into_id, number: problemNumber(row.merged_into_id) }
          : null,
      },
      reports: await Promise.all(
        data.reports.map(async (report) => {
          const schoolId = report.school_id === null ? null : Number(report.school_id)
          return {
            id: Number(report.id),
            helpRequestId:
              canViewHelp && (await this.#reachesRequest(staff, schoolId))
                ? Number(report.help_request_id)
                : null,
            schoolName: report.school_name,
            region: report.region_name
              ? { name: report.region_name, kind: report.regency_kind ?? 'kabupaten' }
              : null,
            role: report.membership_role,
            notifiedAt: iso(report.notified_at),
            linkedAt: iso(report.created_at)!,
          }
        })
      ),
      analyses: data.analyses.map((analysis) => ({
        id: Number(analysis.id),
        rootCause: analysis.root_cause,
        regulations: analysis.regulations,
        evidenceLinks: analysis.evidence_links ?? [],
        author: analysis.author_name ?? null,
        credits: [
          ...(analysis.credited_staff_ids ?? []).map(
            (staffId: string | number) => staffNames.get(Number(staffId)) ?? '–'
          ),
          ...(analysis.credited_names ?? []),
        ],
        createdAt: iso(analysis.created_at)!,
      })),
      forum: data.forum.map((item) => ({
        meetingId: Number(item.meeting_id),
        heldOn: String(item.held_on),
        outcome: item.outcome,
        note: item.note,
      })),
      practices: data.practices.map((practice) => ({
        id: Number(practice.id),
        title: practice.title,
        type: practice.type,
        authors: practice.authors ?? [],
        link: practice.link,
      })),
      merged: data.merged.map((item) => ({
        id: Number(item.id),
        number: problemNumber(Number(item.id)),
        title: item.title,
      })),
      moves: await allowedMoves(staff, row),
      can: {
        triage: canTriage,
        analyse: canAnalyse,
        forum: staffCan(staff, 'forum.view'),
      },
      regions: canTriage ? await this.#regionOptions(staff, 'problems.triage') : null,
      levels: [...PROBLEM_LEVELS],
      researchers: canAnalyse ? await this.#researchers() : [],
      mergeTargets: canTriage ? await this.#mergeTargets(row.id) : [],
    })
  }

  async update(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'problems.triage')
    const problemId = Number(ctx.params.problem)
    const input = await ctx.request.validateUsing(updateProblemValidator)
    await this.#run(ctx, async () => {
      await updateProblem(staff, problemId, {
        title: input.title,
        description: input.description,
        regionId: input.region_id ?? null,
        level: input.level ?? null,
      })
      return ctx.i18n.t('problems.flash.saved')
    })
    return ctx.response.redirect().toPath(`/bank-masalah/${problemId}`)
  }

  async move(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'problems.view')
    const problemId = Number(ctx.params.problem)
    const { status, release_note: releaseNote } =
      await ctx.request.validateUsing(moveProblemValidator)
    await this.#run(ctx, async () => {
      await moveProblem(staff, problemId, status as ProblemStatus, {
        releaseNote: releaseNote || null,
      })
      return ctx.i18n.t('problems.flash.moved', {
        status: ctx.i18n.t(`problems.statuses.${status}`),
      })
    })
    return ctx.response.redirect().toPath(`/bank-masalah/${problemId}`)
  }

  async merge(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'problems.triage')
    const problemId = Number(ctx.params.problem)
    const { target_id: targetId } = await ctx.request.validateUsing(mergeProblemValidator)
    let target = problemId
    await this.#run(ctx, async () => {
      target = await mergeProblem(staff, problemId, targetId)
      return ctx.i18n.t('problems.flash.merged', { number: problemNumber(target) })
    })
    return ctx.response.redirect().toPath(`/bank-masalah/${target}`)
  }

  async analyse(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'problems.analyse')
    const problemId = Number(ctx.params.problem)
    const input = await ctx.request.validateUsing(analysisValidator)
    const links = await evidenceLinks(input.evidence_links)
    if (links === null) {
      throw new vineErrors.E_VALIDATION_ERROR([
        {
          field: 'evidence_links',
          message: ctx.i18n.t('problems.errors.evidence_links'),
          rule: 'url',
        },
      ])
    }
    await this.#run(ctx, async () => {
      await addAnalysis(staff, problemId, {
        rootCause: input.root_cause,
        regulations: input.regulations || null,
        evidenceLinks: links,
        creditedStaffIds: input.credited_staff_ids ?? [],
        creditedNames: lines(input.credited_names).slice(0, 10),
      })
      return ctx.i18n.t('problems.flash.analysed')
    })
    return ctx.response.redirect().toPath(`/bank-masalah/${problemId}`)
  }

  /** Runs a change and flashes its message, or the refusal's. */
  async #run(ctx: HttpContext, work: () => Promise<string>) {
    try {
      ctx.session.flash('success', await work())
    } catch (error) {
      if (!(error instanceof ProblemChangeRefusedException)) throw error
      ctx.session.flash('error', ctx.i18n.t(`problems.errors.${error.reason}`))
    }
  }

  /** Kabupaten/kota a staff member may pick for a problem (inside the area). */
  async #regionOptions(
    staff: StaffUser,
    ability: 'problems.record' | 'problems.triage'
  ): Promise<{ regions: RegionOption[]; unlimited: boolean }> {
    const inScope = await regenciesInScope(staff, ability)
    const query = db
      .from('regions')
      .where('level', 'regency')
      .where('status', 'active')
      .orderBy('name', 'asc')
      .limit(1000)
      .select('id', 'name', 'regency_kind')
    if (inScope !== null) query.whereIn('id', inScope)
    const rows = (await query) as { id: number; name: string; regency_kind: string | null }[]
    return {
      regions: rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        kind: row.regency_kind ?? 'kabupaten',
      })),
      unlimited: inScope === null,
    }
  }

  async #researchers() {
    // Staff who may be credited: anyone active holding a research-team role.
    const rows = (await db
      .from('staff_users as s')
      .join('staff_role_assignments as a', 'a.staff_user_id', 's.id')
      .whereNull('s.disabled_at')
      .whereIn('a.role', ['validator', 'content', 'curriculum', 'researcher', 'owner'])
      .distinct('s.id', 's.name')
      .orderBy('s.name', 'asc')
      .limit(200)) as { id: number; name: string }[]
    return rows.map((row) => ({ id: Number(row.id), name: row.name }))
  }

  async #mergeTargets(problemId: number) {
    const rows = (await db
      .from('problems')
      .whereNot('id', problemId)
      .whereNot('status', 'closed')
      .whereNull('merged_into_id')
      .orderBy('updated_at', 'desc')
      .limit(100)
      .select('id', 'title')) as { id: number; title: string }[]
    return rows.map((row) => ({
      id: Number(row.id),
      number: problemNumber(Number(row.id)),
      title: row.title,
    }))
  }

  async #reachesRequest(staff: StaffUser, schoolId: number | null) {
    return staffReaches(staff, 'help_requests.view', { schoolId })
  }
}
