import { Exception } from '@adonisjs/core/exceptions'
import { logStaffActivity } from '#accounts/activity_log'
import type StaffUser from '#models/staff_user'
import { staffCan, StaffForbiddenException } from '#staff/access'
import { staffTransaction } from '#tenancy/tenant_transaction'
import type { GoodPracticeType, ProblemLevel } from './catalog.js'

/**
 * Bank Praktik Baik (R2-07, D-439): Tim Kurikulum & Riset keeps good
 * practice, PTK, skripsi, seminars and webinars, each with its authors
 * credited by name and a link (F-034). Optionally tied to a problem it
 * helps answer. `good_practices.manage` adds, edits and removes; every
 * change is logged (`good_practice.*`).
 */

export class GoodPracticeNotFoundException extends Exception {
  static status = 404
  static code = 'E_GOOD_PRACTICE_NOT_FOUND'
  static message = 'Good practice not found.'
}

export type GoodPracticeInput = {
  title: string
  summary: string
  type: GoodPracticeType
  authors: string[]
  link: string | null
  level: ProblemLevel | null
  year: number | null
  problemId: number | null
}

function requireManage(staff: StaffUser) {
  if (!staffCan(staff, 'good_practices.manage')) throw new StaffForbiddenException()
}

const columns = (input: GoodPracticeInput) => ({
  title: input.title,
  summary: input.summary,
  type: input.type,
  authors: input.authors,
  link: input.link,
  level: input.level,
  year: input.year,
  problem_id: input.problemId,
})

export async function createGoodPractice(staff: StaffUser, input: GoodPracticeInput) {
  requireManage(staff)
  return staffTransaction(async (trx) => {
    const now = new Date()
    const [row] = await trx
      .table('good_practices')
      .insert({ ...columns(input), added_by_staff_id: staff.id, created_at: now, updated_at: now })
      .returning('id')
    const id = Number(row.id ?? row)
    await logStaffActivity(
      staff,
      'good_practice.create',
      'good_practice',
      id,
      { type: input.type, authors: input.authors, problem_id: input.problemId },
      trx
    )
    return id
  })
}

export async function updateGoodPractice(staff: StaffUser, id: number, input: GoodPracticeInput) {
  requireManage(staff)
  return staffTransaction(async (trx) => {
    const updated = await trx
      .from('good_practices')
      .where('id', id)
      .update({ ...columns(input), updated_at: new Date() })
    if (!updated) throw new GoodPracticeNotFoundException()
    await logStaffActivity(
      staff,
      'good_practice.update',
      'good_practice',
      id,
      { type: input.type, authors: input.authors, problem_id: input.problemId },
      trx
    )
  })
}

export async function deleteGoodPractice(staff: StaffUser, id: number) {
  requireManage(staff)
  return staffTransaction(async (trx) => {
    const row = await trx.from('good_practices').where('id', id).select('title').first()
    if (!row) throw new GoodPracticeNotFoundException()
    await trx.from('good_practices').where('id', id).delete()
    await logStaffActivity(
      staff,
      'good_practice.delete',
      'good_practice',
      id,
      { title: row.title },
      trx
    )
  })
}
