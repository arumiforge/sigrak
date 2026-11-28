import { Exception } from '@adonisjs/core/exceptions'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { Resolution, ResolvedItem } from './resolver/resolve_core.js'
import { layerRank, type Layer } from './types.js'

/**
 * A layer rule refused a change (§4, wall 1). `messageKey` is a key of
 * resources/lang/id/layers.json; controllers flash it, tests read it.
 */
export class LayerRuleException extends Exception {
  static status = 422
  static code = 'E_LAYER_RULE'

  constructor(
    readonly messageKey: string,
    readonly values: Record<string, string | number> = {}
  ) {
    super(`Layer rule: ${messageKey}`, { status: 422, code: 'E_LAYER_RULE' })
  }
}

export interface RuleGroup {
  groupKey: string
  label: string
  min: number
}

/**
 * The app wall of the layer model (`LayerRules`, §4): runs when a
 * proposal is sent, again when it is approved, and on every direct
 * change by the operator. The database guards and the resolver are the
 * other two walls.
 */
export const LayerRules = {
  /**
   * A hide of `itemKey` by a package of `layer`, given the resolution as
   * that package sees it.
   */
  checkHide(
    resolution: Resolution<unknown>,
    itemKey: string,
    layer: Layer,
    groups: RuleGroup[]
  ): ResolvedItem<unknown> {
    const target = resolution.items.find((item) => item.itemKey === itemKey)
    if (!target) {
      if (resolution.hidden.some((item) => item.itemKey === itemKey)) {
        throw new LayerRuleException('layers.errors.already_hidden')
      }
      throw new LayerRuleException('layers.errors.item_not_found')
    }
    if (target.force === 'mandatory') {
      throw new LayerRuleException('layers.errors.mandatory')
    }
    if (layerRank(target.source.layer) >= layerRank(layer)) {
      // Own items are retired, not hidden.
      throw new LayerRuleException('layers.errors.hide_own_item')
    }
    if (target.groupKey) {
      const group = groups.find((rule) => rule.groupKey === target.groupKey)
      if (group) {
        const visible = resolution.items.filter((item) => item.groupKey === group.groupKey).length
        if (visible - 1 < group.min) {
          throw new LayerRuleException(`layers.errors.group_minimum.${group.groupKey}`, {
            group: group.label,
            min: group.min,
          })
        }
      }
    }
    return target
  },

  /**
   * Retiring an item of the package itself: the group minimum still
   * holds, and a mandatory item is never retired by a lower layer.
   */
  checkRetire(resolution: Resolution<unknown>, itemKey: string, groups: RuleGroup[]) {
    const target = resolution.items.find((item) => item.itemKey === itemKey)
    if (!target) return
    if (target.groupKey) {
      const group = groups.find((rule) => rule.groupKey === target.groupKey)
      if (group) {
        const visible = resolution.items.filter((item) => item.groupKey === group.groupKey).length
        if (visible - 1 < group.min) {
          throw new LayerRuleException(`layers.errors.group_minimum.${group.groupKey}`, {
            group: group.label,
            min: group.min,
          })
        }
      }
    }
  },

  /**
   * An addition with `matchKey` (and, for a setting, its key): a visible
   * item with the same match key already covers it (§3.4); a mandatory
   * setting of a higher layer cannot be replaced.
   */
  checkAddition(
    resolution: Resolution<unknown>,
    addition: { matchKey: string; itemKey?: string; shape?: 'list' | 'setting' }
  ) {
    if (addition.shape === 'setting' && addition.itemKey) {
      const held = resolution.items.find((item) => item.itemKey === addition.itemKey)
      if (held?.force === 'mandatory') {
        throw new LayerRuleException('layers.errors.setting_mandatory', {
          layer: held.source.layer,
        })
      }
      return
    }
    const duplicate = resolution.items.find((item) => item.matchKey === addition.matchKey)
    if (duplicate) {
      throw new LayerRuleException('layers.errors.duplicate', {
        label: String((duplicate.value as { label?: string }).label ?? duplicate.itemKey),
      })
    }
  },

  /**
   * The group rules of a domain, for the checks above.
   */
  async groups(client: QueryClientContract, domain: string): Promise<RuleGroup[]> {
    const rows = (await client
      .from('layer_group_rules')
      .where('domain', domain)
      .select('group_key', 'label', 'min')) as { group_key: string; label: string; min: number }[]
    return rows.map((row) => ({ groupKey: row.group_key, label: row.label, min: row.min }))
  },
}

/**
 * Turns a database guard's refusal (trigger HINT) into the same
 * LayerRuleException the app wall throws.
 */
export function asLayerRuleError(error: unknown): unknown {
  const hint = (error as { hint?: string }).hint
  if (hint === 'layer_hide_on_mandatory') return new LayerRuleException('layers.errors.mandatory')
  if (hint === 'layer_choice_outside_area') return new LayerRuleException('layers.errors.not_found')
  if (hint === 'layer_choice_not_agreement') return new LayerRuleException('layers.errors.not_found')
  if (hint === 'layer_choice_school_year')
    return new LayerRuleException('layers.errors.choice_school_year')
  return error
}
