import { readFileSync } from 'node:fs'
import app from '@adonisjs/core/services/app'
import type { RegencyKind } from '#models/region'
import type { RegionSeed } from './region_list.js'

/**
 * Region list files in `docs/data/regions/` (D-466, D-469): owner data
 * with its source, status `draft` until Tim Validasi checks it (D-113).
 * The README there lists the open points of the last check (D-447).
 */

export class RegionFileError extends Error {}

interface RegionFileNode {
  kemendagri_code: string
  dapodik_code?: string | null
  name: string
  regency_kind?: RegencyKind
  children?: RegionFileNode[]
}

const CODE_PATTERN = [/^\d{2}$/, /^\d{2}\.\d{2}$/, /^\d{2}\.\d{2}\.\d{2}$/]

function toSeed(node: RegionFileNode, depth: number, parent: string | null, file: string) {
  const where = `${file} ${node?.kemendagri_code ?? '(no code)'}`
  if (depth > 2) throw new RegionFileError(`${where}: the list is deeper than kecamatan`)
  if (typeof node.kemendagri_code !== 'string' || !CODE_PATTERN[depth].test(node.kemendagri_code)) {
    throw new RegionFileError(`${where}: kemendagri_code does not fit its level`)
  }
  if (parent && !node.kemendagri_code.startsWith(`${parent}.`)) {
    throw new RegionFileError(`${where}: code does not start with the parent's ${parent}`)
  }
  if (typeof node.name !== 'string' || node.name.trim() === '') {
    throw new RegionFileError(`${where}: name is missing`)
  }
  if (
    node.dapodik_code !== undefined &&
    node.dapodik_code !== null &&
    !/^\d{6}$/.test(node.dapodik_code)
  ) {
    throw new RegionFileError(`${where}: dapodik_code must have 6 digits`)
  }
  if (node.regency_kind !== undefined && !['kabupaten', 'kota'].includes(node.regency_kind)) {
    throw new RegionFileError(`${where}: regency_kind must be kabupaten or kota`)
  }
  const seed: RegionSeed = {
    kemendagriCode: node.kemendagri_code,
    dapodikCode: node.dapodik_code ?? null,
    name: node.name,
  }
  if (node.regency_kind) seed.regencyKind = node.regency_kind
  if (node.children) {
    seed.children = node.children.map((child) =>
      toSeed(child, depth + 1, node.kemendagri_code, file)
    )
  }
  return seed
}

/** Reads one region list file (`dataset: region_list`) as a seed tree. */
export function loadRegionList(path: string): RegionSeed {
  const data = JSON.parse(readFileSync(path, 'utf8')) as {
    dataset?: string
    regions?: RegionFileNode
  }
  if (data.dataset !== 'region_list' || !data.regions) {
    throw new RegionFileError(`${path}: not a region list (dataset "region_list" with "regions")`)
  }
  return toSeed(data.regions, 0, null, path)
}

let jawaTengah: RegionSeed | undefined

/**
 * Jawa Tengah, first part of the region list: the province and the
 * three regencies of the school directory (Kudus, Jepara, Pati, D-169,
 * D-170) with their kecamatan, from `docs/data/regions/jawa-tengah.json`.
 */
export function jawaTengahRegions(): RegionSeed {
  jawaTengah ??= loadRegionList(app.makePath('docs/data/regions/jawa-tengah.json'))
  return jawaTengah
}
