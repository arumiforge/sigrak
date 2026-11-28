import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import Region from '#models/region'
import School from '#models/school'
import { jawaTengah } from '#regions/data/jawa_tengah'
import { seedRegionList } from '#regions/region_list'

/**
 * Test helpers for regions and the school directory (R1-04).
 */

export type DirectoryFile = {
  source: string
  fetched_on: string
  province: string
  regency: string
  schools: {
    npsn: string
    name: string
    address: string
    village: string
    level: 'sd' | 'mi'
    district: string
    latitude?: number | null
    longitude?: number | null
  }[]
}

export async function seedJawaTengah() {
  await seedRegionList(db.connection(), jawaTengah)
}

export function region(code: string) {
  return Region.findByOrFail('kemendagriCode', code)
}

export async function readDirectoryFile(name: 'kudus' | 'jepara' | 'pati') {
  return JSON.parse(
    await readFile(app.makePath(`docs/data/schools/${name}.json`), 'utf8')
  ) as DirectoryFile
}

/**
 * Writes a directory file to a fresh temporary folder and returns its
 * path.
 */
export async function writeDirectoryFile(file: DirectoryFile) {
  const dir = await mkdtemp(join(tmpdir(), 'sigrak-directory-'))
  const path = join(dir, 'directory.json')
  await writeFile(path, JSON.stringify(file))
  return path
}

/**
 * A small Kudus directory file: three schools in Jati, Bae and Dawe.
 */
export function smallKudusFile(): DirectoryFile {
  return {
    source: 'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikdas/031900/2',
    fetched_on: '2026-11-03',
    province: 'Jawa Tengah',
    regency: 'Kabupaten Kudus',
    schools: [
      {
        npsn: '90000001',
        name: 'SD Uji Satu',
        address: 'Jalan Uji 1',
        village: 'Uji',
        level: 'sd',
        district: 'Jati',
        latitude: -6.8,
        longitude: 110.8,
      },
      {
        npsn: '90000002',
        name: 'MI Uji Dua',
        address: 'Jalan Uji 2',
        village: 'Uji',
        level: 'mi',
        district: 'Bae',
        latitude: null,
        longitude: null,
      },
      {
        npsn: '90000003',
        name: 'SD Uji Tiga',
        address: 'Jalan Uji 3',
        village: 'Uji',
        level: 'sd',
        district: 'Dawe',
      },
    ],
  }
}

/**
 * A SIGRAK school with an NPSN, placed in the given kecamatan (owner
 * connection).
 */
export async function createSchoolIn(name: string, npsn: string, districtCode: string) {
  const district = await region(districtCode)
  return School.create({
    name,
    npsn,
    level: 'sd',
    regionId: district.parentId!,
    districtId: district.id,
    district: district.name,
    address: 'Jalan Uji',
    regionSource: 'npsn_directory',
  })
}
