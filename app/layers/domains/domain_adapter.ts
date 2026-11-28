import { randomBytes } from 'node:crypto'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { ItemInput, ResolvedItem } from '../resolver/resolve_core.js'
import type { SchoolResolution } from '../resolver/layer_resolver.js'
import type { Force, ItemShape, Origin, SourceRef } from '../types.js'

/**
 * One adapter per layered domain (docs/drafts/regional-layers.md §5.6).
 * The resolver, the rules and the proposal flow are the same for every
 * domain; the adapter knows the domain's table, its own fields, how a
 * duplicate is recognised (`match_key`) and how a proposed item is
 * validated. A new domain is a table made with `layeredColumns()`, a
 * `layer_domains` row and an adapter registered in `domains/registry.ts`.
 */
export interface DomainAdapter<V = Record<string, unknown>, P = Record<string, unknown>> {
  domain: string
  /** The layered table (the same name as in `layer_domains`). */
  itemTable: string
  /** Prefix of item keys made for new items (`EKS` → `EKS-SCH-…`). */
  keyPrefix: string
  /** Reads the live (not retired) items of the given packages. */
  loadItems(client: QueryClientContract, packageIds: number[]): Promise<ItemInput<V>[]>
  /** Validates a proposed or added item's fields; throws a VineJS error. */
  validatePayload(payload: unknown): Promise<P>
  /** The normalised duplicate key of a payload (calendar: date + kind; catalog: label). */
  matchKeyOf(payload: P): string
  /** The group a new item joins, if any (a school-added kepanduan joins `scouting`). */
  groupKeyOf(payload: P): string | null
  /** The domain's own columns for a new row. */
  columnsOf(payload: P): Record<string, unknown>
  /** A short label people recognise (notices, proposal lists). */
  labelOf(value: V | P): string
  /** Display order of resolved items. */
  compare(a: ResolvedItem<V>, b: ResolvedItem<V>): number
  /**
   * The domain's own rules for a school addition or change (calendar:
   * the conflict checker, D-260), run with the layer rules when the
   * operator saves, when a proposal is sent and again when it is
   * approved. `replacing` is the item key a change replaces. Throws a
   * LayerRuleException.
   */
  checkChange?(
    client: QueryClientContract,
    resolution: SchoolResolution<V>,
    payload: P,
    options: { replacing: string | null }
  ): Promise<void>
}

/**
 * The shared layered columns of a row read from a layered table.
 */
export interface LayeredRow {
  package_id: number
  item_key: string
  match_key: string
  shape: ItemShape
  force: Force
  origin: Origin
  group_key: string | null
  source_ref: SourceRef | null
  revision: number
}

export function itemInput<V>(row: LayeredRow, value: V): ItemInput<V> {
  return {
    packageId: Number(row.package_id),
    itemKey: row.item_key,
    matchKey: row.match_key,
    shape: row.shape,
    force: row.force,
    origin: row.origin,
    groupKey: row.group_key,
    sourceRef: row.source_ref,
    revision: row.revision,
    value,
  }
}

/**
 * Lower-cased letters and digits only: "Bulu Tangkis" = "bulutangkis".
 */
export function normaliseLabel(label: string) {
  return label
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/**
 * A fresh item key for an item added below the national layer:
 * `<prefix>-<tag>-<random>`, e.g. `EKS-SCH-3f9a1c0b2d`.
 */
export function newItemKey(prefix: string, tag: string) {
  return `${prefix}-${tag}-${randomBytes(5).toString('hex')}`
}
