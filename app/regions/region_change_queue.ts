import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import RegionChangeReview, { type RegionChangeApplyFrom } from '#models/region_change_review'
import type StaffUser from '#models/staff_user'
import { staffTransaction } from '#tenancy/tenant_transaction'
import { effectiveOn, todayInJakarta } from './effective_dates.js'

/**
 * The review is gone, or someone already decided it.
 */
export class ReviewNotPendingException extends Exception {
  static status = 409
  static code = 'E_REVIEW_NOT_PENDING'
  static message = 'The region change is no longer waiting for a decision.'
}

type Place = { regionId: number; districtId: number | null }

const samePlace = (a: Place, b: Place) => a.regionId === b.regionId && a.districtId === b.districtId

/**
 * Compares the directory with the schools that carry one of `npsns` and
 * queues a "Perubahan wilayah" review for every school whose directory
 * region differs (D-466, docs/drafts/regional-layers.md §8). Nothing
 * changes on the school itself.
 *
 * The comparison is against the place the school is heading to: an
 * accepted change waiting for its date, else the school's own region.
 * An open review that the directory no longer supports is superseded;
 * one with another target is replaced. Directory rows without a
 * matching kabupaten/kota, and removed rows, are skipped.
 *
 * Runs inside the import transaction (owner connection). Returns the
 * number of reviews created.
 */
export async function detectRegionChanges(client: QueryClientContract, npsns: string[]) {
  if (npsns.length === 0) return 0

  const rows = (await client
    .from('schools as s')
    .join('school_directory_entries as e', 'e.npsn', 's.npsn')
    .leftJoin('region_change_reviews as scheduled', (join) => {
      join
        .on('scheduled.school_id', 's.id')
        .andOnVal('scheduled.status', 'accepted')
        .andOnNull('scheduled.applied_at')
    })
    .leftJoin('region_change_reviews as pending', (join) => {
      join.on('pending.school_id', 's.id').andOnVal('pending.status', 'pending')
    })
    .whereIn('e.npsn', npsns)
    .whereNotNull('e.region_id')
    .whereNull('e.removed_at')
    .select(
      's.id as school_id',
      's.region_id',
      's.district_id',
      'e.id as entry_id',
      'e.region_id as entry_region_id',
      'e.district_id as entry_district_id',
      'scheduled.to_region_id as scheduled_region_id',
      'scheduled.to_district_id as scheduled_district_id',
      'pending.id as pending_id',
      'pending.to_region_id as pending_region_id',
      'pending.to_district_id as pending_district_id'
    )) as {
    school_id: number
    region_id: number
    district_id: number | null
    entry_id: number
    entry_region_id: number
    entry_district_id: number | null
    scheduled_region_id: number | null
    scheduled_district_id: number | null
    pending_id: number | null
    pending_region_id: number | null
    pending_district_id: number | null
  }[]

  const now = new Date()
  let created = 0

  for (const row of rows) {
    const target: Place = { regionId: row.entry_region_id, districtId: row.entry_district_id }
    const baseline: Place =
      row.scheduled_region_id !== null
        ? { regionId: row.scheduled_region_id, districtId: row.scheduled_district_id }
        : { regionId: row.region_id, districtId: row.district_id }
    const pending: Place | null =
      row.pending_id !== null
        ? { regionId: row.pending_region_id!, districtId: row.pending_district_id }
        : null

    if (pending && samePlace(pending, target)) continue
    if (pending) {
      await client
        .from('region_change_reviews')
        .where('id', row.pending_id!)
        .update({ status: 'superseded', updated_at: now })
    }
    if (samePlace(baseline, target)) continue

    // Staff already rejected this move: ask again only for another target.
    const rejected = await client
      .from('region_change_reviews')
      .where('school_id', row.school_id)
      .where('status', 'rejected')
      .where('from_region_id', baseline.regionId)
      .where('to_region_id', target.regionId)
      .where((q) =>
        baseline.districtId === null
          ? q.whereNull('from_district_id')
          : q.where('from_district_id', baseline.districtId)
      )
      .where((q) =>
        target.districtId === null
          ? q.whereNull('to_district_id')
          : q.where('to_district_id', target.districtId)
      )
      .select('id')
      .first()
    if (rejected) continue

    await client.table('region_change_reviews').insert({
      school_id: row.school_id,
      directory_entry_id: row.entry_id,
      from_region_id: baseline.regionId,
      from_district_id: baseline.districtId,
      to_region_id: target.regionId,
      to_district_id: target.districtId,
      status: 'pending',
      detected_at: now,
      created_at: now,
      updated_at: now,
    })
    created++
  }

  return created
}

/**
 * Staff decisions on the queue. Every method runs in one staff
 * transaction (`SET LOCAL ROLE sigrak_staff`); the caller has checked
 * the staff member's role (`canReviewRegions`).
 */
export const RegionChangeQueue = {
  /**
   * Accepts a pending review: it takes effect on the next day or the
   * first day of the next school year (D-466). A change already waiting
   * for its date is superseded, since the new one starts from its target.
   */
  async accept(
    publicId: string,
    staff: StaffUser,
    applyFrom: RegionChangeApplyFrom,
    today = todayInJakarta()
  ): Promise<RegionChangeReview> {
    return staffTransaction(async (trx) => {
      const review = await lockPending(publicId)
      const now = new Date()
      await trx
        .from('region_change_reviews')
        .where('school_id', review.schoolId)
        .where('status', 'accepted')
        .whereNull('applied_at')
        .update({ status: 'superseded', updated_at: now })

      review.merge({
        status: 'accepted',
        applyFrom,
        effectiveOn: DateTime.fromISO(effectiveOn(applyFrom, today)),
        decidedByStaffId: staff.id,
        decidedAt: DateTime.now(),
      })
      await review.save()
      return review
    })
  },

  /**
   * Rejects a pending review; the school keeps its region. A later
   * import that still finds the difference queues it again only when
   * the directory changes once more.
   */
  async reject(publicId: string, staff: StaffUser, note: string | null) {
    return staffTransaction(async () => {
      const review = await lockPending(publicId)
      review.merge({
        status: 'rejected',
        decidedByStaffId: staff.id,
        decidedAt: DateTime.now(),
        note,
      })
      await review.save()
      return review
    })
  },

  /**
   * Applies every accepted change whose day has come: the school gets
   * the new kabupaten/kota and kecamatan, `region_source`
   * `npsn_directory` and a fresh `region_checked_at`. Run daily by
   * `node ace regions:apply-changes`. Returns the number applied.
   */
  async applyDue(today = todayInJakarta()) {
    return staffTransaction(async (trx) => {
      const due = (await trx
        .from('region_change_reviews as r')
        .leftJoin('regions as d', 'd.id', 'r.to_district_id')
        .where('r.status', 'accepted')
        .whereNull('r.applied_at')
        .where('r.effective_on', '<=', today)
        .forUpdate('r')
        .select(
          'r.id',
          'r.school_id',
          'r.to_region_id',
          'r.to_district_id',
          'd.name as district'
        )) as {
        id: number
        school_id: number
        to_region_id: number
        to_district_id: number | null
        district: string | null
      }[]

      const now = new Date()
      for (const change of due) {
        await trx.from('schools').where('id', change.school_id).update({
          region_id: change.to_region_id,
          district_id: change.to_district_id,
          district: change.district,
          region_source: 'npsn_directory',
          region_checked_at: now,
          updated_at: now,
        })
        await trx
          .from('region_change_reviews')
          .where('id', change.id)
          .update({ applied_at: now, updated_at: now })
      }
      return due.length
    })
  },
}

async function lockPending(publicId: string) {
  const review = await RegionChangeReview.withoutSchoolScope()
    .where('public_id', publicId)
    .forUpdate()
    .first()
  if (!review || review.status !== 'pending') throw new ReviewNotPendingException()
  return review
}
