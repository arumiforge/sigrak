import { Exception } from '@adonisjs/core/exceptions'
import i18nManager from '@adonisjs/i18n/services/main'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { logStaffActivity } from '#accounts/activity_log'
import type StaffUser from '#models/staff_user'
import { staffCan, StaffForbiddenException } from '#staff/access'
import { staffTransaction } from '#tenancy/tenant_transaction'
import { noticeToSender, staffReaches } from '#help/help_requests'
import { reachesProblem } from './access.js'
import {
  OPEN_STATUSES,
  TRANSITIONS,
  type ProblemLevel,
  type ProblemSource,
  type ProblemStatus,
} from './catalog.js'

/**
 * Bank Masalah (R2-07, D-439, D-477): Tim Lapangan records problems by
 * hand or from a Minta Bantuan request and triages them, Tim Kurikulum
 * & Riset adds analyses, the forum decides (forum.ts) and Tim Produk
 * builds and releases. When a problem reaches Rilis, every reporter
 * (the sender of each linked help request) is told in the app once.
 *
 * Every function checks the ability and its scope first (access.ts),
 * then changes rows as staff (`staffTransaction`) and logs each change
 * (`problem.*`, and `help_request.*` on the reporters' requests).
 */

export class ProblemNotFoundException extends Exception {
  static status = 404
  static code = 'E_PROBLEM_NOT_FOUND'
  static message = 'Problem not found.'
}

export type ProblemRefusal =
  | 'transition'
  | 'forum_only'
  | 'needs_analysis'
  | 'merge_self'
  | 'merge_closed'
  | 'not_open'
  | 'already_linked'
  | 'region_scope'

/** A change the rules do not allow; `reason` is a key under `problems.errors.*`. */
export class ProblemChangeRefusedException extends Exception {
  static status = 422
  static code = 'E_PROBLEM_CHANGE_REFUSED'

  constructor(readonly reason: ProblemRefusal) {
    super(`Problem change refused: ${reason}`)
  }
}

export type ProblemRow = {
  id: number
  title: string
  description: string
  source: ProblemSource
  region_id: number | null
  level: ProblemLevel | null
  status: ProblemStatus
  merged_into_id: number | null
  release_note: string | null
}

export type ProblemInput = {
  title: string
  description: string
  regionId: number | null
  level: ProblemLevel | null
}

const t = (key: string, data?: Record<string, unknown>) => i18nManager.locale('id').t(key, data)

/** Loads and locks a problem inside a staff transaction (404 when missing). */
export async function lockProblem(trx: TransactionClientContract, problemId: number) {
  const row = (await trx.from('problems').where('id', problemId).forUpdate().first()) as
    ProblemRow | undefined
  if (!row) throw new ProblemNotFoundException()
  return { ...row, id: Number(row.id), region_id: row.region_id ? Number(row.region_id) : null }
}

const placeOf = (row: Pick<ProblemRow, 'region_id' | 'level'>) => ({
  regionId: row.region_id === null ? null : Number(row.region_id),
  level: row.level,
})

async function requireReach(
  staff: StaffUser,
  ability: Parameters<typeof reachesProblem>[1],
  place: Parameters<typeof reachesProblem>[2]
) {
  if (!(await reachesProblem(staff, ability, place))) throw new StaffForbiddenException()
}

/** Records a new problem by hand (Tim Lapangan: visits, chats, webinars). */
export async function recordProblem(
  staff: StaffUser,
  input: ProblemInput & { source: ProblemSource }
) {
  await requireReach(staff, 'problems.record', input)
  return staffTransaction((trx) => insertProblem(trx, staff, input))
}

async function insertProblem(
  trx: TransactionClientContract,
  staff: StaffUser,
  input: ProblemInput & { source: ProblemSource }
) {
  const now = new Date()
  const [row] = await trx
    .table('problems')
    .insert({
      title: input.title,
      description: input.description,
      source: input.source,
      region_id: input.regionId,
      level: input.level,
      status: 'new',
      status_changed_at: now,
      recorded_by_staff_id: staff.id,
      created_at: now,
      updated_at: now,
    })
    .returning('id')
  const id = Number(row.id ?? row)
  await logStaffActivity(
    staff,
    'problem.create',
    'problem',
    id,
    { source: input.source, region_id: input.regionId, level: input.level },
    trx
  )
  return id
}

/** Edits title, description, region and level (triage, inside its area). */
export async function updateProblem(staff: StaffUser, problemId: number, input: ProblemInput) {
  return staffTransaction(async (trx) => {
    const problem = await lockProblem(trx, problemId)
    await requireReach(staff, 'problems.triage', placeOf(problem))
    if (input.regionId !== problem.region_id) {
      // The new region must lie inside the area too.
      if (!(await reachesProblem(staff, 'problems.triage', input))) {
        throw new ProblemChangeRefusedException('region_scope')
      }
    }
    const changes: Record<string, unknown> = {}
    const next = {
      title: input.title,
      description: input.description,
      region_id: input.regionId,
      level: input.level,
    }
    for (const [key, value] of Object.entries(next)) {
      const before = problem[key as keyof typeof next]
      if (before !== value) {
        changes[key] = key === 'description' ? { changed: true } : { from: before, to: value }
      }
    }
    if (Object.keys(changes).length === 0) return problem.id
    await trx
      .from('problems')
      .where('id', problem.id)
      .update({ ...next, updated_at: new Date() })
    await logStaffActivity(staff, 'problem.update', 'problem', problem.id, changes, trx)
    return problem.id
  })
}

/** The status buttons a staff member may use on a problem (the console shows these). */
export async function allowedMoves(staff: StaffUser, problem: ProblemRow) {
  if (problem.merged_into_id) return []
  const moves: ProblemStatus[] = []
  for (const [to, ability] of Object.entries(TRANSITIONS[problem.status])) {
    if (ability && (await reachesProblem(staff, ability, placeOf(problem)))) {
      moves.push(to as ProblemStatus)
    }
  }
  return moves
}

/** Status change inside an open staff transaction; tells reporters on Rilis. */
export async function applyProblemStatus(
  trx: TransactionClientContract,
  staff: StaffUser,
  problem: ProblemRow,
  status: ProblemStatus,
  extra: { via?: 'forum'; meetingId?: number; releaseNote?: string | null } = {}
) {
  if (problem.status === status) return
  const now = new Date()
  const update: Record<string, unknown> = { status, status_changed_at: now, updated_at: now }
  if (status === 'released' && extra.releaseNote !== undefined) {
    update.release_note = extra.releaseNote
  }
  await trx.from('problems').where('id', problem.id).update(update)
  await logStaffActivity(
    staff,
    'problem.status',
    'problem',
    problem.id,
    {
      from: problem.status,
      to: status,
      ...(extra.via ? { via: extra.via, meeting_id: extra.meetingId } : {}),
    },
    trx
  )
  if (status === 'released') {
    const note = extra.releaseNote !== undefined ? extra.releaseNote : problem.release_note
    await notifyReporters(trx, staff, problem.id, note)
  }
}

/**
 * Moves a problem along the flow (TRANSITIONS): only the team whose
 * step it is, inside its scope. Into Dianalisis needs an analysis;
 * Diputuskan only comes from a forum decision.
 */
export async function moveProblem(
  staff: StaffUser,
  problemId: number,
  status: ProblemStatus,
  input: { releaseNote?: string | null } = {}
) {
  return staffTransaction(async (trx) => {
    const problem = await lockProblem(trx, problemId)
    if (problem.merged_into_id) throw new ProblemChangeRefusedException('transition')
    const ability = TRANSITIONS[problem.status][status]
    if (!ability) {
      const forumOnly =
        problem.status === 'analysed' && (status === 'decided' || status === 'closed')
      throw new ProblemChangeRefusedException(forumOnly ? 'forum_only' : 'transition')
    }
    await requireReach(staff, ability, placeOf(problem))
    if (status === 'analysed') {
      const analysis = await trx.from('problem_analyses').where('problem_id', problem.id).first()
      if (!analysis) throw new ProblemChangeRefusedException('needs_analysis')
    }
    await applyProblemStatus(trx, staff, problem, status, {
      releaseNote: status === 'released' ? (input.releaseNote ?? null) : undefined,
    })
    return problem.id
  })
}

/**
 * Tells every reporter of a problem who was not told yet that the
 * solution shipped: a reply on their help request (the in-app notice
 * on "Bantuan saya"), the request set to Selesai. Logged per request
 * and once on the problem.
 */
async function notifyReporters(
  trx: TransactionClientContract,
  staff: StaffUser,
  problemId: number,
  releaseNote: string | null
) {
  const reports = (await trx
    .from('problem_reports')
    .where('problem_id', problemId)
    .whereNull('notified_at')
    .orderBy('id')
    .forUpdate()
    .select('id', 'help_request_id')) as { id: number; help_request_id: number }[]
  if (reports.length === 0) return 0
  const body = [
    t('problems.notice.released'),
    releaseNote ? t('problems.notice.release_note', { note: releaseNote }) : null,
  ]
    .filter(Boolean)
    .join('\n\n')
  for (const report of reports) {
    await noticeToSender(trx, staff, Number(report.help_request_id), {
      body,
      status: 'done',
      action: 'help_request.problem_released',
      changes: { problem_id: problemId },
    })
  }
  await trx
    .from('problem_reports')
    .whereIn(
      'id',
      reports.map((report) => report.id)
    )
    .update({ notified_at: new Date() })
  await logStaffActivity(
    staff,
    'problem.reporters_notified',
    'problem',
    problemId,
    { count: reports.length },
    trx
  )
  return reports.length
}

/** Adds the reporter of a help request to a problem inside an open transaction. */
async function linkReport(
  trx: TransactionClientContract,
  staff: StaffUser,
  problem: ProblemRow,
  helpRequestId: number,
  created: boolean
) {
  const existing = await trx.from('problem_reports').where('help_request_id', helpRequestId).first()
  if (existing) throw new ProblemChangeRefusedException('already_linked')
  await trx.table('problem_reports').insert({
    problem_id: problem.id,
    help_request_id: helpRequestId,
    linked_by_staff_id: staff.id,
    created_at: new Date(),
  })
  await noticeToSender(trx, staff, helpRequestId, {
    body: t('problems.notice.recorded'),
    status: 'in_progress',
    action: 'help_request.to_problem',
    changes: { problem_id: problem.id, created },
  })
  await logStaffActivity(
    staff,
    'problem.report_linked',
    'problem',
    problem.id,
    { help_request_id: helpRequestId },
    trx
  )
}

/**
 * "Jadikan masalah" (D-477, the R2-06 hook): support turns a help
 * request into a new problem (source `help_request`, region and level
 * from the sender's school) or links it to an open problem. The
 * request moves to Diproses and the sender is told it was recorded.
 */
export async function helpRequestToProblem(
  staff: StaffUser,
  helpRequestId: number,
  input: { mode: 'new'; title: string; description: string } | { mode: 'link'; problemId: number }
): Promise<{ problemId: number }> {
  if (!staffCan(staff, 'problems.record')) throw new StaffForbiddenException()
  return staffTransaction(async (trx) => {
    const request = (await trx
      .from('help_requests as h')
      .leftJoin('schools as s', 's.id', 'h.school_id')
      .where('h.id', helpRequestId)
      .select('h.id', 'h.school_id', 's.region_id', 's.level')
      .first()) as
      | { id: number; school_id: number | null; region_id: number | null; level: string | null }
      | undefined
    if (!request) throw new ProblemNotFoundException()
    const schoolId = request.school_id === null ? null : Number(request.school_id)
    if (!(await staffReaches(staff, 'problems.record', { schoolId }))) {
      throw new StaffForbiddenException()
    }

    if (input.mode === 'link') {
      const problem = await lockProblem(trx, input.problemId)
      if (!OPEN_STATUSES.includes(problem.status) || problem.merged_into_id) {
        throw new ProblemChangeRefusedException('not_open')
      }
      await linkReport(trx, staff, problem, Number(request.id), false)
      return { problemId: problem.id }
    }

    const level = request.level === 'sd' || request.level === 'mi' ? request.level : null
    const problemId = await insertProblem(trx, staff, {
      title: input.title,
      description: input.description,
      source: 'help_request',
      regionId: request.region_id === null ? null : Number(request.region_id),
      level,
    })
    const problem = await lockProblem(trx, problemId)
    await linkReport(trx, staff, problem, Number(request.id), true)
    return { problemId }
  })
}

/**
 * Merges a duplicate into another problem (triage, both inside the
 * area): the duplicate's reporters move over, the duplicate closes
 * with `merged_into_id`, its open forum agenda items are dropped. When
 * the target already shipped, the moved reporters are told now.
 */
export async function mergeProblem(staff: StaffUser, sourceId: number, targetId: number) {
  if (sourceId === targetId) throw new ProblemChangeRefusedException('merge_self')
  return staffTransaction(async (trx) => {
    // Lock in id order so two merges never wait on each other.
    const [first, second] = [sourceId, targetId].sort((a, b) => a - b)
    const locked = new Map([
      [first, await lockProblem(trx, first)],
      [second, await lockProblem(trx, second)],
    ])
    const source = locked.get(sourceId)!
    const target = locked.get(targetId)!
    await requireReach(staff, 'problems.triage', placeOf(source))
    await requireReach(staff, 'problems.triage', placeOf(target))
    if (source.status === 'closed' || target.status === 'closed' || target.merged_into_id) {
      throw new ProblemChangeRefusedException('merge_closed')
    }

    const moved = (await trx
      .from('problem_reports')
      .where('problem_id', source.id)
      .update({ problem_id: target.id })
      .returning('id')) as unknown[]
    await trx.from('forum_decisions').where('problem_id', source.id).whereNull('outcome').delete()
    const now = new Date()
    await trx.from('problems').where('id', source.id).update({
      status: 'closed',
      status_changed_at: now,
      merged_into_id: target.id,
      updated_at: now,
    })
    await logStaffActivity(
      staff,
      'problem.merge',
      'problem',
      source.id,
      { into: target.id, from_status: source.status, reports: moved.length },
      trx
    )
    await logStaffActivity(
      staff,
      'problem.merged_in',
      'problem',
      target.id,
      { from: source.id, reports: moved.length },
      trx
    )
    if (target.status === 'released') {
      await notifyReporters(trx, staff, target.id, target.release_note)
    }
    return target.id
  })
}

/** One analysis by Tim Kurikulum & Riset, with its researchers credited (F-034). */
export async function addAnalysis(
  staff: StaffUser,
  problemId: number,
  input: {
    rootCause: string
    regulations: string | null
    evidenceLinks: string[]
    creditedStaffIds: number[]
    creditedNames: string[]
  }
) {
  return staffTransaction(async (trx) => {
    const problem = await lockProblem(trx, problemId)
    await requireReach(staff, 'problems.analyse', placeOf(problem))
    if (problem.status === 'closed' || problem.merged_into_id) {
      throw new ProblemChangeRefusedException('not_open')
    }
    // Credited staff must be real, active staff; the author is credited unless they chose others.
    const requested = [...new Set(input.creditedStaffIds)]
    const known = requested.length
      ? ((await trx
          .from('staff_users')
          .whereIn('id', requested)
          .whereNull('disabled_at')
          .select('id')) as { id: number }[])
      : []
    let credited = known.map((row) => Number(row.id))
    if (credited.length === 0 && input.creditedNames.length === 0) credited = [staff.id]
    const now = new Date()
    const [row] = await trx
      .table('problem_analyses')
      .insert({
        problem_id: problem.id,
        root_cause: input.rootCause,
        regulations: input.regulations,
        evidence_links: input.evidenceLinks,
        author_staff_id: staff.id,
        credited_staff_ids: credited,
        credited_names: input.creditedNames,
        created_at: now,
        updated_at: now,
      })
      .returning('id')
    const analysisId = Number(row.id ?? row)
    await logStaffActivity(
      staff,
      'problem.analysis',
      'problem',
      problem.id,
      {
        analysis_id: analysisId,
        credited_staff_ids: credited,
        credited_names: input.creditedNames,
      },
      trx
    )
    return analysisId
  })
}
