import type { HttpContext } from '@adonisjs/core/http'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import {
  canEditSchoolLayer,
  canProposeSchoolChange,
  LayerAccessDeniedException,
  membershipOf,
  schoolLayerEditor,
} from '../access.js'
import {
  EXTRACURRICULAR_CATEGORIES,
  type ExtracurricularValue,
} from '../domains/extracurricular.js'
import { LayerRules } from '../layer_rules.js'
import { hiddenByProps, sourceProps } from '../presenters.js'
import { SchoolProposals } from '../proposals.js'
import { LayerResolver } from '../resolver/layer_resolver.js'
import { SchoolLayer } from '../school_layer.js'
import { currentSchoolYear } from '../school_years.js'
import { hideValidator, schoolProposalValidator } from '../validators.js'
import { runAndRedirect } from './respond.js'

const DOMAIN = 'extracurricular'
const PATH = '/ekstrakurikuler'

/**
 * Ekstrakurikuler (R1-07 proof domain): the school's resolved list with
 * a source badge on every row, "Dipakai" / "Tidak dipakai", the
 * operator's direct changes and the others' proposals (D-380).
 */
export default class SchoolListController {
  async index(ctx: HttpContext) {
    const membership = membershipOf(ctx)
    const schoolYear = currentSchoolYear()
    const { resolution, groups } = await tenantTransaction(async (trx) => ({
      resolution: await LayerResolver.resolve<ExtracurricularValue>(
        DOMAIN,
        membership.schoolId,
        schoolYear
      ),
      groups: await LayerRules.groups(trx, DOMAIN),
    }))

    const present = (item: (typeof resolution.items)[number]) => ({
      key: item.itemKey,
      label: item.value.label,
      category: item.value.category,
      description: item.value.description,
      offeredByDefault: item.value.offeredByDefault,
      groupKey: item.groupKey,
      own: item.source.layer === 'school',
      source: sourceProps(item),
    })

    return ctx.inertia.render('school/layers/extracurriculars', {
      schoolYear,
      canEdit: canEditSchoolLayer(membership.role),
      canPropose: canProposeSchoolChange(membership.role),
      categories: [...EXTRACURRICULAR_CATEGORIES],
      groups: groups.map((group) => ({ key: group.groupKey, label: group.label, min: group.min })),
      ready: Object.keys(resolution.stamp).some((code) => !code.startsWith('SCHOOL-')),
      items: resolution.items.map(present),
      hidden: resolution.hidden.map((item) => ({
        ...present(item),
        hiddenBy: hiddenByProps(item),
      })),
    })
  }

  async store(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const input = ctx.request.only(['label', 'category', 'description', 'scouting'])
    return runAndRedirect(ctx, PATH, 'layers.toasts.added', () =>
      tenantTransaction(() =>
        SchoolLayer.add(actorOf(membership), DOMAIN, currentSchoolYear(), clean(input))
      )
    )
  }

  async hide(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const { reason } = await ctx.request.validateUsing(hideValidator)
    return runAndRedirect(ctx, PATH, 'layers.toasts.hidden', () =>
      tenantTransaction(() =>
        SchoolLayer.hide(
          actorOf(membership),
          DOMAIN,
          currentSchoolYear(),
          ctx.params.item,
          reason ?? null
        )
      )
    )
  }

  async unhide(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    return runAndRedirect(ctx, PATH, 'layers.toasts.unhidden', () =>
      tenantTransaction(() =>
        SchoolLayer.unhide(actorOf(membership), DOMAIN, currentSchoolYear(), ctx.params.item)
      )
    )
  }

  async retire(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    return runAndRedirect(ctx, PATH, 'layers.toasts.retired', () =>
      tenantTransaction(() =>
        SchoolLayer.retire(actorOf(membership), DOMAIN, currentSchoolYear(), ctx.params.item)
      )
    )
  }

  async propose(ctx: HttpContext) {
    const membership = membershipOf(ctx)
    if (!canProposeSchoolChange(membership.role)) throw new LayerAccessDeniedException()
    const input = await ctx.request.validateUsing(schoolProposalValidator)
    return runAndRedirect(ctx, PATH, 'layers.toasts.proposed', () =>
      tenantTransaction(() =>
        SchoolProposals.propose(actorOf(membership), {
          domain: DOMAIN,
          schoolYear: currentSchoolYear(),
          action: input.action,
          itemKey: input.item_key ?? null,
          item:
            input.action === 'add'
              ? clean({
                  label: input.label,
                  category: input.category,
                  description: input.description,
                  scouting: input.scouting,
                })
              : undefined,
          reason: input.reason ?? null,
        })
      )
    )
  }
}

export function actorOf(membership: { schoolId: number; userId: number }) {
  return { schoolId: membership.schoolId, userId: membership.userId }
}

/** Drops empty form fields so optional fields stay optional. */
function clean(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  )
}
