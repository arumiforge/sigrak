import {
  layerRank,
  type Force,
  type ItemShape,
  type Layer,
  type Line,
  type Origin,
  type PackageKind,
  type SourceRef,
} from '../types.js'

/**
 * The layer resolver's algorithm (docs/drafts/regional-layers.md §5.2)
 * on plain data, with no database: the loader (layer_resolver.ts)
 * collects the packages in scope and calls `resolveLayers()`. Keeping
 * it pure makes the 14 cases of §11.3 and the property checks cheap.
 */

export interface PackageInput {
  id: number
  code: string
  name: string
  layer: Layer
  kind: PackageKind
  line: Line
  version: number
  /** Area name for the badge ("Jawa Tengah", "Kudus", "Jati"); null for national and school. */
  regionName: string | null
  /** `kabupaten` or `kota` for a regency, for "Kabupaten Kudus" / "Kota Semarang". */
  regionKind: string | null
  /** Evidence summary for "Asal data" (regulation or agreement, checked on). */
  evidence: Record<string, unknown> | null
}

export interface ItemInput<V = Record<string, unknown>> {
  packageId: number
  itemKey: string
  matchKey: string
  shape: ItemShape
  force: Force
  origin: Origin
  groupKey: string | null
  sourceRef: SourceRef | null
  revision: number
  /** The domain row, as the adapter maps it. */
  value: V
}

export interface HideInput {
  packageId: number
  targetItemKey: string
  reason: string | null
}

export interface GroupRuleInput {
  groupKey: string
  label: string
  min: number
  defaultItemKey: string
  line: Line
}

export interface ItemSource {
  layer: Layer
  regionName: string | null
  regionKind: string | null
  line: Line
  packageCode: string
  packageName: string
  packageKind: PackageKind
  origin: Origin
  sourceRef: SourceRef | null
  evidence: Record<string, unknown> | null
}

export interface ResolvedItem<V = Record<string, unknown>> {
  itemKey: string
  matchKey: string
  shape: ItemShape
  force: Force
  groupKey: string | null
  revision: number
  value: V
  source: ItemSource
}

export interface HiddenItem<V = Record<string, unknown>> extends ResolvedItem<V> {
  hiddenBy: {
    layer: Layer
    packageCode: string
    packageKind: PackageKind
    regionName: string | null
    regionKind: string | null
    reason: string | null
  }
}

export interface ShadowedItem<V = Record<string, unknown>> extends ResolvedItem<V> {
  /** `duplicate`: a higher or stronger item has the key or match key; `overridden`: a lower setting won. */
  shadowReason: 'duplicate' | 'overridden'
  /** Item key of the item that won. */
  shadowedBy: string
}

export type LayerWarning =
  | { kind: 'hide_on_mandatory'; itemKey: string; packageCode: string }
  | { kind: 'setting_on_mandatory'; itemKey: string; packageCode: string }
  | { kind: 'duplicate_of_higher'; itemKey: string; packageCode: string; layer: Layer }
  | {
      kind: 'group_minimum'
      groupKey: string
      restoredItemKey: string
      /** The lowest hide that was overruled; the publisher voids it (§3.4). */
      overruledHide: { packageCode: string; layer: Layer } | null
    }
  | { kind: 'group_minimum_unmet'; groupKey: string }
  | { kind: 'missing_district' }

export interface Resolution<V = Record<string, unknown>> {
  items: ResolvedItem<V>[]
  hidden: HiddenItem<V>[]
  shadowed: ShadowedItem<V>[]
  warnings: LayerWarning[]
  /** Package code → version of every package that took part; documents store it (§2.3). */
  stamp: Record<string, number>
}

export interface ResolveInput<V = Record<string, unknown>> {
  /** Packages already filtered for scope, status, line, level, dates and choices. */
  packages: PackageInput[]
  /** Live items (not retired) of those packages. */
  items: ItemInput<V>[]
  /** Active hides of those packages. */
  hides: HideInput[]
  /** Group rules of the domain for `all` and the school's line. */
  groupRules: GroupRuleInput[]
  /** The school's line (from its Profil Jenjang); null for an area view of both lines. */
  line: Line | null
  /** Extra warnings from the loader (missing kecamatan). */
  warnings?: LayerWarning[]
}

const kindRank: Record<PackageKind, number> = {
  base: 0,
  official: 0,
  local_agreement: 1,
  school: 2,
}

/**
 * Order inside the walk: layer top-down; inside a layer `base`/`official`
 * → `local_agreement` → `school`; at equal kind `all` before the
 * line-specific package (so the line-specific one wins), then by code so
 * the input order never matters.
 */
export function comparePackages(a: PackageInput, b: PackageInput) {
  return (
    layerRank(a.layer) - layerRank(b.layer) ||
    kindRank[a.kind] - kindRank[b.kind] ||
    Number(a.line !== 'all') - Number(b.line !== 'all') ||
    (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
  )
}

function sourceOf(pkg: PackageInput, item: ItemInput<unknown>): ItemSource {
  return {
    layer: pkg.layer,
    regionName: pkg.regionName,
    regionKind: pkg.regionKind,
    line: pkg.line,
    packageCode: pkg.code,
    packageName: pkg.name,
    packageKind: pkg.kind,
    origin: item.origin,
    sourceRef: item.sourceRef,
    evidence: pkg.evidence,
  }
}

/** True when `challenger` beats `holder` at the same layer (official over agreement, line over all). */
function beatsWithinLayer(challenger: ResolvedItem<unknown>, holder: ResolvedItem<unknown>) {
  const a = kindRank[challenger.source.packageKind]
  const b = kindRank[holder.source.packageKind]
  if (a !== b) return a < b
  return holder.source.line === 'all' && challenger.source.line !== 'all'
}

export function resolveLayers<V>(input: ResolveInput<V>): Resolution<V> {
  const packages = [...input.packages].sort(comparePackages)
  const byPackage = new Map<number, ItemInput<V>[]>()
  for (const item of input.items) {
    const list = byPackage.get(item.packageId) ?? []
    list.push(item)
    byPackage.set(item.packageId, list)
  }
  for (const list of byPackage.values()) {
    list.sort((a, b) => (a.itemKey < b.itemKey ? -1 : a.itemKey > b.itemKey ? 1 : 0))
  }
  const hidesByPackage = new Map<number, HideInput[]>()
  for (const hide of input.hides) {
    const list = hidesByPackage.get(hide.packageId) ?? []
    list.push(hide)
    hidesByPackage.set(hide.packageId, list)
  }

  const current = new Map<string, ResolvedItem<V>>()
  const byMatch = new Map<string, string>()
  const hidden = new Map<string, HiddenItem<V>>()
  const shadowed: ShadowedItem<V>[] = []
  const warnings: LayerWarning[] = [...(input.warnings ?? [])]

  const put = (item: ResolvedItem<V>) => {
    current.set(item.itemKey, item)
    byMatch.set(item.matchKey, item.itemKey)
  }
  const take = (item: ResolvedItem<V>) => {
    current.delete(item.itemKey)
    if (byMatch.get(item.matchKey) === item.itemKey) byMatch.delete(item.matchKey)
  }
  const shadow = (
    item: ResolvedItem<V>,
    by: ResolvedItem<V>,
    reason: ShadowedItem<V>['shadowReason']
  ) => shadowed.push({ ...item, shadowReason: reason, shadowedBy: by.itemKey })

  for (const pkg of packages) {
    for (const hide of hidesByPackage.get(pkg.id) ?? []) {
      const target = current.get(hide.targetItemKey)
      if (!target) continue // unknown, retired or already hidden: nothing to do
      if (target.force === 'mandatory') {
        warnings.push({
          kind: 'hide_on_mandatory',
          itemKey: hide.targetItemKey,
          packageCode: pkg.code,
        })
        continue
      }
      take(target)
      hidden.set(hide.targetItemKey, {
        ...target,
        hiddenBy: {
          layer: pkg.layer,
          packageCode: pkg.code,
          packageKind: pkg.kind,
          regionName: pkg.regionName,
          regionKind: pkg.regionKind,
          reason: hide.reason,
        },
      })
    }

    for (const raw of byPackage.get(pkg.id) ?? []) {
      const item: ResolvedItem<V> = {
        itemKey: raw.itemKey,
        matchKey: raw.matchKey,
        shape: raw.shape,
        force: raw.force,
        groupKey: raw.groupKey,
        revision: raw.revision,
        value: raw.value,
        source: sourceOf(pkg, raw),
      }
      const existingKey = current.has(item.itemKey) ? item.itemKey : byMatch.get(item.matchKey)
      const existing = existingKey === undefined ? undefined : current.get(existingKey)
      if (!existing) {
        put(item)
        continue
      }
      if (existing.source.layer === pkg.layer) {
        if (beatsWithinLayer(item, existing)) {
          take(existing)
          put(item)
          shadow(existing, item, 'duplicate')
        } else {
          shadow(item, existing, 'duplicate')
        }
        continue
      }
      if (item.shape === 'setting') {
        if (existing.force === 'mandatory') {
          warnings.push({ kind: 'setting_on_mandatory', itemKey: item.itemKey, packageCode: pkg.code })
          shadow(item, existing, 'duplicate')
        } else {
          take(existing)
          put(item)
          shadow(existing, item, 'overridden')
        }
        continue
      }
      warnings.push({
        kind: 'duplicate_of_higher',
        itemKey: item.itemKey,
        packageCode: pkg.code,
        layer: existing.source.layer,
      })
      shadow(item, existing, 'duplicate')
    }
  }

  // Group minimums: a line-specific rule replaces the `all` rule of the same group.
  const rules = new Map<string, GroupRuleInput>()
  for (const rule of input.groupRules) {
    if (rule.line !== 'all' && rule.line !== input.line) continue
    const held = rules.get(rule.groupKey)
    if (!held || (held.line === 'all' && rule.line !== 'all')) rules.set(rule.groupKey, rule)
  }
  for (const rule of [...rules.values()].sort((a, b) => (a.groupKey < b.groupKey ? -1 : 1))) {
    let visible = 0
    for (const item of current.values()) if (item.groupKey === rule.groupKey) visible++
    if (visible >= rule.min) continue
    const restorable = hidden.get(rule.defaultItemKey)
    if (!restorable) {
      warnings.push({ kind: 'group_minimum_unmet', groupKey: rule.groupKey })
      continue
    }
    hidden.delete(rule.defaultItemKey)
    const { hiddenBy, ...item } = restorable
    put(item)
    warnings.push({
      kind: 'group_minimum',
      groupKey: rule.groupKey,
      restoredItemKey: rule.defaultItemKey,
      overruledHide: { packageCode: hiddenBy.packageCode, layer: hiddenBy.layer },
    })
  }

  const order = new Map(packages.map((pkg, index) => [pkg.code, index]))
  const byWalk = (a: ResolvedItem<V>, b: ResolvedItem<V>) =>
    order.get(a.source.packageCode)! - order.get(b.source.packageCode)! ||
    (a.itemKey < b.itemKey ? -1 : a.itemKey > b.itemKey ? 1 : 0)

  return {
    items: [...current.values()].sort(byWalk),
    hidden: [...hidden.values()].sort(byWalk),
    shadowed: shadowed.sort(byWalk),
    warnings,
    stamp: Object.fromEntries(packages.map((pkg) => [pkg.code, pkg.version])),
  }
}
