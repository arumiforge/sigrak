import type { HttpContext } from '@adonisjs/core/http'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { canEditSchoolLayer, membershipOf, schoolLayerEditor } from '../access.js'
import { Notices } from '../notices.js'
import { PackageChoices } from '../package_choices.js'
import { schoolFrame } from '../resolver/layer_resolver.js'
import { currentSchoolYear } from '../school_years.js'
import { runAndRedirect } from './respond.js'
import { actorOf } from './school_list_controller.js'

const PATH = '/paket-daerah'

/**
 * Paket daerah (§7, D-466): official packages of the school's areas
 * (always on) and local agreements the operator may follow; notices for
 * the operator and principal.
 */
export default class SchoolPackagesController {
  async index(ctx: HttpContext) {
    const membership = membershipOf(ctx)
    const schoolYear = currentSchoolYear()
    const { packages, chain, notices } = await tenantTransaction(async (trx) => {
      const frame = await schoolFrame(trx, membership.schoolId)
      return {
        packages: await PackageChoices.list(membership.schoolId, schoolYear),
        chain: frame.chain,
        notices: await Notices.unread(membership.role),
      }
    })

    const present = (pkg: (typeof packages)[number]) => ({
      id: pkg.publicId,
      domain: pkg.domain,
      name: pkg.name,
      kind: pkg.kind as 'official' | 'local_agreement',
      line: pkg.line,
      source: {
        layer: pkg.layer,
        regionName: pkg.regionName,
        regionKind: pkg.regionKind,
        line: pkg.line,
        packageName: pkg.name,
        packageKind: pkg.kind,
        origin: pkg.kind === 'official' ? ('official' as const) : ('local_agreement' as const),
        force: 'free' as const,
        basis: {
          regulation: (pkg.evidence?.regulation_code as string | undefined) ?? null,
          document: (pkg.evidence?.document_title as string | undefined) ?? null,
          article: null,
          pages: Array.isArray(pkg.evidence?.pages) ? (pkg.evidence!.pages as number[]) : [],
          url: (pkg.evidence?.source_url as string | undefined) ?? null,
          checkedOn: (pkg.evidence?.checked_on as string | undefined) ?? null,
        },
      },
      chosen: pkg.chosen,
    })

    return ctx.inertia.render('school/layers/packages', {
      schoolYear,
      canEdit: canEditSchoolLayer(membership.role),
      region: {
        province: chain.province,
        regency: chain.regency,
        district: chain.district,
      },
      official: packages.filter((pkg) => pkg.kind === 'official').map(present),
      agreements: packages.filter((pkg) => pkg.kind === 'local_agreement').map(present),
      notices,
    })
  }

  async follow(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    return runAndRedirect(ctx, PATH, 'layers.toasts.followed', () =>
      tenantTransaction(() =>
        PackageChoices.choose(actorOf(membership), ctx.params.package, currentSchoolYear())
      )
    )
  }

  async unfollow(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    return runAndRedirect(ctx, PATH, 'layers.toasts.unfollowed', () =>
      tenantTransaction(() =>
        PackageChoices.leave(actorOf(membership), ctx.params.package, currentSchoolYear())
      )
    )
  }

  async markRead(ctx: HttpContext) {
    const membership = membershipOf(ctx)
    return runAndRedirect(ctx, PATH, 'layers.toasts.read', () =>
      tenantTransaction(() => Notices.markRead(ctx.params.notice, membership.userId))
    )
  }
}
