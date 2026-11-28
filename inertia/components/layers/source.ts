import { useT } from '~/lib/i18n'

/**
 * The source of a layered value as the server sends it
 * (app/layers/presenters.ts `SourceProps`). Every layered value the UI
 * shows carries one (D-456: "every value shown names its source and
 * layer").
 */
export type LayerName = 'national' | 'province' | 'regency' | 'district' | 'school'
export type LineName = 'kemendikdasmen' | 'kemenag' | 'all'
export type PackageKindName = 'base' | 'official' | 'local_agreement' | 'school'
export type ForceName =
  | 'mandatory'
  | 'minimum'
  | 'maximum'
  | 'recommended'
  | 'not_recommended'
  | 'example'
  | 'school_discretion'
  | 'teacher_discretion'
  | 'free'

export type LayerSource = {
  layer: LayerName
  regionName: string | null
  regionKind: string | null
  line: LineName
  packageName: string
  packageKind: PackageKindName
  origin: 'official' | 'sigrak' | 'local_agreement' | 'school'
  force: ForceName
  basis: {
    regulation: string | null
    document: string | null
    article: string | null
    pages: number[]
    url: string | null
    checkedOn: string | null
  }
}

/** Who set or hid something: enough for the badge text. */
export type LayerOwner = Pick<
  LayerSource,
  'layer' | 'regionName' | 'regionKind' | 'packageKind'
> & {
  origin?: LayerSource['origin']
}

function areaKind(owner: LayerOwner) {
  if (owner.layer === 'regency') return owner.regionKind === 'kota' ? 'kota' : 'kabupaten'
  return owner.layer
}

/**
 * Badge text (docs/drafts/regional-layers.md §9.1): "Bawaan SIGRAK",
 * "Nasional", "Provinsi Jawa Tengah", "Kabupaten Kudus", "Kecamatan
 * Jati", "Kesepakatan Kecamatan Jati", "Sekolah".
 */
export function useSourceLabel() {
  const t = useT()
  return (owner: LayerOwner) => {
    if (owner.layer === 'national') {
      return t(
        owner.origin === 'official' ? 'layers.badge.national_official' : 'layers.badge.sigrak'
      )
    }
    if (owner.layer === 'school') return t('layers.badge.school')
    const group = owner.packageKind === 'local_agreement' ? 'agreement' : 'area'
    return t(`layers.badge.${group}.${areaKind(owner)}`, { name: owner.regionName ?? '' })
  }
}
