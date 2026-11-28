import type { HttpContext } from '@adonisjs/core/http'
import { staffTransaction } from '#tenancy/tenant_transaction'
import { canApproveAreaChange, layerStaff } from '../access.js'
import { layerDomains } from '../domains/registry.js'
import LayerPackage from '../models/layer_package.js'
import LayerProposal from '../models/layer_proposal.js'
import { AreaProposals } from '../proposals.js'
import { currentSchoolYear } from '../school_years.js'
import type { Evidence } from '../types.js'
import { areaDecisionValidator, areaProposalValidator } from '../validators.js'
import { runAndRedirect } from './respond.js'

const PATH = '/usulan-wilayah'

/**
 * Usulan wilayah on admin. (§6, §9.3): staff send area proposals with
 * evidence; an approver who is not the proposer approves, returns or
 * rejects them.
 */
export default class AreaProposalsController {
  async index(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    const { proposals, regions, packages } = await staffTransaction(async (trx) => ({
      proposals: await LayerProposal.query()
        .whereNot('target_layer', 'school')
        .preload('region')
        .preload('package')
        .preload('proposedByStaff')
        .preload('decidedByStaff')
        .orderBy('created_at', 'desc')
        .limit(60),
      regions: (await trx
        .from('regions as r')
        .leftJoin('regions as p', 'p.id', 'r.parent_id')
        .where('r.status', 'active')
        .select(
          'r.id',
          'r.level',
          'r.name',
          'r.regency_kind',
          'r.kemendagri_code',
          'p.name as parent'
        )
        .orderBy('r.kemendagri_code')) as {
        id: number
        level: string
        name: string
        regency_kind: string | null
        kemendagri_code: string
        parent: string | null
      }[],
      packages: await LayerPackage.query()
        .whereNotNull('region_id')
        .whereNot('status', 'retired')
        .preload('region')
        .orderBy('name'),
    }))

    const present = (proposal: LayerProposal) => ({
      id: proposal.publicId,
      domain: proposal.domain,
      action: proposal.action,
      status: proposal.status,
      label: (proposal.payload.label as string | undefined) ?? proposal.itemKey ?? '',
      itemKey: proposal.itemKey,
      reason: proposal.reason,
      evidence: proposal.evidence
        ? {
            regulation_code: proposal.evidence.regulation_code ?? null,
            document_title: proposal.evidence.document_title ?? null,
            source_url: proposal.evidence.source_url ?? null,
            pages: proposal.evidence.pages ?? null,
            checked_on: proposal.evidence.checked_on ?? null,
          }
        : null,
      area: regionLabel(proposal.region),
      packageName: proposal.package?.name ?? null,
      proposedBy: proposal.proposedByStaff?.name ?? null,
      own: proposal.proposedByStaffId === staff.id,
      decidedBy: proposal.decidedByStaff?.name ?? null,
      decisionNote: proposal.decisionNote,
      schoolsAffected: (proposal.impact?.schools as number | undefined) ?? null,
      createdOn: proposal.createdAt.setZone('Asia/Jakarta').toISODate()!,
    })

    return ctx.inertia.render('admin/layers/area_proposals', {
      canApprove: canApproveAreaChange(staff),
      domains: layerDomains(),
      schoolYear: currentSchoolYear(),
      regions: regions.map((region) => ({
        id: Number(region.id),
        level: region.level,
        name: region.name,
        kind: region.level === 'regency' ? (region.regency_kind ?? 'kabupaten') : region.level,
        parent: region.parent,
      })),
      packages: packages.map((pkg) => ({
        id: pkg.publicId,
        regionId: pkg.regionId!,
        domain: pkg.domain,
        name: pkg.name,
        kind: pkg.kind,
      })),
      waiting: proposals.filter((p) => p.status === 'submitted').map(present),
      returned: proposals.filter((p) => p.status === 'returned').map(present),
      decided: proposals
        .filter((p) => !['submitted', 'returned'].includes(p.status))
        .slice(0, 20)
        .map(present),
    })
  }

  async store(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    const input = await ctx.request.validateUsing(areaProposalValidator)
    const evidence: Evidence = {
      regulation_code: input.evidence_regulation ?? null,
      document_title: input.evidence_document ?? null,
      source_url: input.evidence_url ?? null,
      pages: input.evidence_pages
        ? input.evidence_pages
            .split(/[^0-9]+/)
            .filter(Boolean)
            .map(Number)
        : null,
    }
    const hasEvidence = !!(
      evidence.regulation_code ||
      evidence.document_title ||
      evidence.source_url
    )
    const payload =
      input.action === 'create_package'
        ? {
            kind: input.kind,
            name: input.name,
            line: input.line ?? 'all',
            level_scope: input.level_scope ?? 'both',
            applies_from_school_year: input.applies_from_school_year ?? currentSchoolYear(),
          }
        : input.action === 'add'
          ? { item: { label: input.label, category: input.category || undefined } }
          : {}
    return runAndRedirect(ctx, PATH, 'layers.toasts.area_proposed', () =>
      AreaProposals.propose(staff, {
        domain: input.domain,
        regionId: input.region_id,
        action: input.action,
        packagePublicId: input.package_id ?? null,
        itemKey: input.item_key ?? null,
        payload,
        reason: input.reason ?? null,
        evidence: hasEvidence ? evidence : null,
        schoolYear: currentSchoolYear(),
      })
    )
  }

  async approve(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    const { note, evidence_checked: evidenceChecked } =
      await ctx.request.validateUsing(areaDecisionValidator)
    return runAndRedirect(ctx, PATH, 'layers.toasts.approved', () =>
      AreaProposals.approve(staff, ctx.params.proposal, {
        evidenceChecked: evidenceChecked ?? false,
        note: note ?? null,
      })
    )
  }

  async return(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    const { note } = await ctx.request.validateUsing(areaDecisionValidator)
    return runAndRedirect(ctx, PATH, 'layers.toasts.returned', () =>
      AreaProposals.return(staff, ctx.params.proposal, note ?? null)
    )
  }

  async reject(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    const { note } = await ctx.request.validateUsing(areaDecisionValidator)
    return runAndRedirect(ctx, PATH, 'layers.toasts.rejected', () =>
      AreaProposals.reject(staff, ctx.params.proposal, note ?? null)
    )
  }

  async resubmit(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    return runAndRedirect(ctx, PATH, 'layers.toasts.resubmitted', () =>
      AreaProposals.resubmit(staff, ctx.params.proposal)
    )
  }

  async withdraw(ctx: HttpContext) {
    const staff = layerStaff(ctx)
    return runAndRedirect(ctx, PATH, 'layers.toasts.withdrawn', () =>
      AreaProposals.withdraw(staff, ctx.params.proposal)
    )
  }
}

function regionLabel(region: LayerProposal['region'] | null) {
  if (!region) return null
  return {
    name: region.name,
    kind: region.level === 'regency' ? (region.regencyKind ?? 'kabupaten') : region.level,
  }
}
