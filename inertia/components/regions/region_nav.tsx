import { useT } from '~/lib/i18n'

export type RegionRef = {
  id: number
  name: string
  kind: 'province' | 'kabupaten' | 'kota' | 'district'
  code: string
}

/**
 * "Kabupaten Kudus", "Kecamatan Jati": the kind word comes from
 * regions.kinds.
 */
export function useRegionLabel() {
  const t = useT()
  return (region: RegionRef) => t(`regions.kinds.${region.kind}`, { name: region.name })
}
