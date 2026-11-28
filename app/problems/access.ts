import db from '@adonisjs/lucid/services/db'
import type StaffUser from '#models/staff_user'
import { coversLevel, regionScopeOf, staffCan } from '#staff/access'
import type { StaffAbility } from '#staff/abilities'
import type { ProblemLevel } from './catalog.js'

/**
 * Who reaches which problem (R2-07, D-439).
 *
 * - Reading Bank Masalah (`problems.view`) is not limited by area: the
 *   three teams work on one shared bank. Reporters show as school and
 *   role only; names stay on the help request, under its own scope.
 * - Tim Lapangan's work (`problems.record`, `problems.triage`) follows
 *   the area scope (D-338): a problem about a kabupaten/kota is reached
 *   when the scope names it, its province, or one of its kecamatan; a
 *   problem without a region only by an unlimited scope.
 * - Tim Kurikulum & Riset's analysis (`problems.analyse`) follows the
 *   level scope when the problem names a level.
 * - Deciding and delivering have no scope (owner, engineer).
 */

export type ProblemPlace = { regionId: number | null; level: ProblemLevel | null }

const AREA_ABILITIES: readonly StaffAbility[] = ['problems.record', 'problems.triage']

/**
 * The kabupaten/kota ids an area scope reaches, or null for every one.
 * A scoped province reaches its kabupaten/kota; a scoped kecamatan
 * reaches the kabupaten/kota it lies in.
 */
export async function regenciesInScope(
  staff: StaffUser,
  ability: StaffAbility
): Promise<number[] | null> {
  const regionIds = regionScopeOf(staff, ability)
  if (regionIds === null) return null
  if (regionIds.length === 0) return []
  const rows = (await db
    .from('regions as r')
    .where('r.level', 'regency')
    .where((where) =>
      where
        .whereRaw('r.id = ANY(?::bigint[])', [regionIds])
        .orWhereRaw('r.parent_id = ANY(?::bigint[])', [regionIds])
        .orWhereExists((sub) =>
          sub
            .from('regions as d')
            .whereColumn('d.parent_id', 'r.id')
            .whereRaw('d.id = ANY(?::bigint[])', [regionIds])
        )
    )
    .select('r.id')) as { id: number }[]
  return rows.map((row) => Number(row.id))
}

/** Whether `ability` reaches a problem with this region and level. */
export async function reachesProblem(
  staff: StaffUser,
  ability: StaffAbility,
  place: ProblemPlace
): Promise<boolean> {
  if (!staffCan(staff, ability)) return false
  if (AREA_ABILITIES.includes(ability)) {
    const regencies = await regenciesInScope(staff, ability)
    if (regencies === null) return true
    return place.regionId !== null && regencies.includes(place.regionId)
  }
  if (ability === 'problems.analyse' && place.level) {
    return coversLevel(staff, ability, place.level)
  }
  return true
}
