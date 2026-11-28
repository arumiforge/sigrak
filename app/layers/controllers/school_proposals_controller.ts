import type { HttpContext } from '@adonisjs/core/http'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { canEditSchoolLayer, membershipOf, schoolLayerEditor } from '../access.js'
import LayerProposal from '../models/layer_proposal.js'
import { SchoolProposals } from '../proposals.js'
import { decisionValidator } from '../validators.js'
import { runAndRedirect } from './respond.js'
import { actorOf } from './school_list_controller.js'

const PATH = '/usulan'

/**
 * Usulan (D-380): the operator's queue of school proposals; teachers and
 * the principal see their own proposals and can take one back.
 */
export default class SchoolProposalsController {
  async index(ctx: HttpContext) {
    const membership = membershipOf(ctx)
    const operator = canEditSchoolLayer(membership.role)
    const proposals = await tenantTransaction(async () => {
      const query = LayerProposal.query()
        .where('school_id', membership.schoolId)
        .where('target_layer', 'school')
        .preload('proposedByUser')
        .preload('decidedByUser')
        .orderBy('created_at', 'desc')
        .limit(50)
      if (!operator) query.where('proposed_by_user_id', membership.userId)
      return query
    })

    const present = (proposal: LayerProposal) => ({
      id: proposal.publicId,
      domain: proposal.domain,
      action: proposal.action,
      label: (proposal.payload.label as string | undefined) ?? proposal.itemKey ?? '',
      reason: proposal.reason,
      status: proposal.status,
      proposedBy: proposal.proposedByUser?.name ?? null,
      own: proposal.proposedByUserId === membership.userId,
      decidedBy: proposal.decidedByUser?.name ?? null,
      decisionNote: proposal.decisionNote,
      createdOn: proposal.createdAt.setZone('Asia/Jakarta').toISODate()!,
    })

    return ctx.inertia.render('school/layers/proposals', {
      canDecide: operator,
      waiting: proposals.filter((p) => p.status === 'submitted').map(present),
      decided: proposals.filter((p) => p.status !== 'submitted').map(present),
    })
  }

  async approve(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const { note } = await ctx.request.validateUsing(decisionValidator)
    return runAndRedirect(ctx, PATH, 'layers.toasts.approved', () =>
      tenantTransaction(() =>
        SchoolProposals.approve(actorOf(membership), ctx.params.proposal, note ?? null)
      )
    )
  }

  async reject(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const { note } = await ctx.request.validateUsing(decisionValidator)
    return runAndRedirect(ctx, PATH, 'layers.toasts.rejected', () =>
      tenantTransaction(() =>
        SchoolProposals.reject(actorOf(membership), ctx.params.proposal, note ?? null)
      )
    )
  }

  async withdraw(ctx: HttpContext) {
    const membership = membershipOf(ctx)
    return runAndRedirect(ctx, PATH, 'layers.toasts.withdrawn', () =>
      tenantTransaction(() => SchoolProposals.withdraw(actorOf(membership), ctx.params.proposal))
    )
  }
}
