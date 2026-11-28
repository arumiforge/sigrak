import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Region from '#models/region'
import type { RegionKind } from '#models/region'
import type School from '#models/school'
import type { SchoolLevel } from '#models/school'
import SchoolDirectoryEntry from '#models/school_directory_entry'

export type RegionRef = { id: number; name: string; kind: RegionKind; code: string }

/**
 * What the staff console's school form fills from an NPSN (D-169):
 * name, level, address, kabupaten/kota and kecamatan. `school` is set
 * when a SIGRAK school already has this NPSN.
 */
export interface DirectoryLookup {
  npsn: string
  name: string
  level: SchoolLevel
  address: string
  village: string | null
  province: string
  regency: RegionRef | null
  regencyName: string
  district: RegionRef | null
  districtName: string
  latitude: number | null
  longitude: number | null
  fetchedOn: string
  removed: boolean
  school: { id: number; name: string } | null
}

export const regionRef = (region: Region): RegionRef => ({
  id: region.id,
  name: region.name,
  kind: region.kind,
  code: region.kemendagriCode,
})

/**
 * The directory side of schools: NPSN lookup for the school form and
 * the region a school gets from its directory row.
 */
export const SchoolDirectory = {
  async find(npsn: string) {
    if (!/^\d{8}$/.test(npsn)) return null
    return SchoolDirectoryEntry.query()
      .where('npsn', npsn)
      .preload('region')
      .preload('district')
      .first()
  },

  async lookup(npsn: string): Promise<DirectoryLookup | null> {
    const entry = await this.find(npsn)
    if (!entry) return null
    const school = (await db.from('schools').where('npsn', npsn).select('id', 'name').first()) as {
      id: number
      name: string
    } | null

    return {
      npsn: entry.npsn,
      name: entry.name,
      level: entry.level,
      address: entry.address,
      village: entry.village,
      province: entry.provinceName,
      regency: entry.region ? regionRef(entry.region) : null,
      regencyName: entry.regencyName,
      district: entry.district ? regionRef(entry.district) : null,
      districtName: entry.districtName,
      latitude: entry.latitude,
      longitude: entry.longitude,
      fetchedOn: entry.fetchedOn.toISODate()!,
      removed: entry.removedAt !== null,
      school: school ?? null,
    }
  },

  /**
   * Puts a school where its directory row says (regional-layers.md §8):
   * kabupaten/kota, kecamatan, `region_source = npsn_directory`, checked
   * now. The caller saves the school in its own transaction. Throws when
   * the row's kabupaten/kota is not in the region list.
   */
  assignRegion(school: School, entry: SchoolDirectoryEntry) {
    if (entry.regionId === null) {
      throw new Error(
        `NPSN ${entry.npsn}: the directory row has no kabupaten/kota in the region list`
      )
    }
    school.merge({
      npsn: entry.npsn,
      regionId: entry.regionId,
      districtId: entry.districtId,
      district: entry.districtName,
      regionSource: 'npsn_directory',
      regionCheckedAt: DateTime.now(),
    })
    return school
  },
}
