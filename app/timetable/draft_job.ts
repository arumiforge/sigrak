import type { Job } from 'bullmq'
import logger from '@adonisjs/core/services/logger'
import { CpuPoolClosedError, CpuTaskInterruptedError, cpuPool } from '#services/cpu_pool/main'
import { dispatch } from '#services/queue/queues'
import { SchoolContext } from '#tenancy/school_context'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { ClassSubjects, schoolPolicyInput } from '../school_year/class_subjects.js'
import AcademicYear from '../school_year/models/academic_year.js'
import type { GeneratorInput, GeneratorResult } from './draft_generator.js'
import { generatorInput } from './drafts.js'
import TimetableDraft from './models/timetable_draft.js'
import { loadYearState } from './year_state.js'

/**
 * `default` queue job "Susun draf jadwal" (D-262): reads the year in the
 * school's tenant transaction, runs the pure generator in the CPU pool
 * (R1-10) so the worker's event loop stays free, and stores the result
 * on the draft. Shutdown mid-run puts the job back in the queue.
 */

export const GENERATE_TIMETABLE_DRAFT_JOB = 'generate-timetable-draft'

export type GenerateTimetableDraftData = { draftId: number; schoolId: number }

export function queueDraft(draft: TimetableDraft) {
  return dispatch<GenerateTimetableDraftData>('default', GENERATE_TIMETABLE_DRAFT_JOB, {
    draftId: draft.id,
    schoolId: draft.schoolId,
  })
}

function inSchool<T>(schoolId: number, work: () => Promise<T>) {
  return SchoolContext.runFor(schoolId, () => tenantTransaction(work))
}

async function finish(
  schoolId: number,
  draftId: number,
  values: Partial<Pick<TimetableDraft, 'status' | 'result' | 'error'>>
) {
  await inSchool(schoolId, async () => {
    const draft = await TimetableDraft.find(draftId)
    if (!draft) return
    draft.merge(values)
    await draft.save()
  })
}

/**
 * Makes the draft. A draft that is gone, or already done, is skipped; a
 * running draft is picked up again after a crash (stalled job).
 */
export async function runDraft(
  draftId: number,
  schoolId: number,
  options: { signal?: AbortSignal } = {}
) {
  const input = await inSchool(schoolId, async (): Promise<GeneratorInput | null> => {
    const draft = await TimetableDraft.find(draftId)
    if (!draft || (draft.status !== 'queued' && draft.status !== 'running')) return null
    const year = await AcademicYear.findOrFail(draft.academicYearId)
    const deps = { classSubjects: new ClassSubjects(), school: await schoolPolicyInput(schoolId) }
    const state = await loadYearState(deps, year)
    draft.status = 'running'
    await draft.save()
    return generatorInput(state, draft.classIds, draft.input!, draft.seed)
  })
  if (!input) return { skipped: true }

  let result: GeneratorResult
  try {
    result = await cpuPool().run('timetableDraft', input, { signal: options.signal })
  } catch (error) {
    if (error instanceof CpuPoolClosedError || error instanceof CpuTaskInterruptedError) {
      await finish(schoolId, draftId, { status: 'queued' })
      throw error
    }
    logger.error({ err: error, draftId }, 'Draft timetable failed')
    await finish(schoolId, draftId, { status: 'failed', error: 'generator_failed' })
    return { failed: true }
  }
  await finish(schoolId, draftId, { status: 'ready', result })
  return { unplacedJp: result.unplacedJp, penalty: result.penalty }
}

export const generateTimetableDraft = {
  jobName: GENERATE_TIMETABLE_DRAFT_JOB,
  handle(job: Job, signal?: AbortSignal) {
    const { draftId, schoolId } = job.data as GenerateTimetableDraftData
    return runDraft(draftId, schoolId, { signal })
  },
}
