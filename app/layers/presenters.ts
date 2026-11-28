import type { HiddenItem, ItemSource, ResolvedItem } from './resolver/resolve_core.js'
import type { Force } from './types.js'

/**
 * What the shared source badge and the "Asal data" sheet need
 * (inertia/components/layers/source_badge.tsx). Every layered value the
 * UI shows carries one (§5.5, §9.1).
 */
export type SourceProps = {
  layer: ItemSource['layer']
  regionName: string | null
  regionKind: string | null
  line: ItemSource['line']
  packageName: string
  packageKind: ItemSource['packageKind']
  origin: ItemSource['origin']
  force: Force
  basis: {
    regulation: string | null
    document: string | null
    article: string | null
    pages: number[]
    url: string | null
    checkedOn: string | null
  }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value : null)
const pages = (value: unknown) =>
  Array.isArray(value) ? value.filter((page): page is number => typeof page === 'number') : []

export function sourceProps(item: ResolvedItem<unknown>): SourceProps {
  const { source } = item
  const ref = source.sourceRef ?? {}
  const evidence = source.evidence ?? {}
  return {
    layer: source.layer,
    regionName: source.regionName,
    regionKind: source.regionKind,
    line: source.line,
    packageName: source.packageName,
    packageKind: source.packageKind,
    origin: source.origin,
    force: item.force,
    basis: {
      regulation: text(ref.regulation) ?? text(evidence.regulation_code),
      document: text(evidence.document_title),
      article: text(ref.article),
      pages: pages(ref.pages).length > 0 ? pages(ref.pages) : pages(evidence.pages),
      url: text(evidence.source_url),
      checkedOn: text(evidence.checked_on),
    },
  }
}

export type HiddenByProps = {
  layer: HiddenItem<unknown>['hiddenBy']['layer']
  regionName: string | null
  regionKind: string | null
  packageKind: HiddenItem<unknown>['hiddenBy']['packageKind']
  reason: string | null
  own: boolean
}

export function hiddenByProps(item: HiddenItem<unknown>): HiddenByProps {
  return {
    layer: item.hiddenBy.layer,
    regionName: item.hiddenBy.regionName,
    regionKind: item.hiddenBy.regionKind,
    packageKind: item.hiddenBy.packageKind,
    reason: item.hiddenBy.reason,
    own: item.hiddenBy.layer === 'school',
  }
}
