import type { HttpContext } from '@adonisjs/core/http'
import RegionChangeReview from '#models/region_change_review'
import { regionReviewer } from '#regions/access'
import { effectiveOn, todayInJakarta } from '#regions/effective_dates'
import { RegionChangeQueue, ReviewNotPendingException } from '#regions/region_change_queue'
import { regionRef } from '#regions/school_directory'
import { acceptRegionChangeValidator, rejectRegionChangeValidator } from '#regions/validators'
import { staffTransaction } from '#tenancy/tenant_transaction'

/**
 * Perubahan wilayah on admin. (D-466): region differences found by a
 * directory import wait here; staff accept them from tomorrow or from
 * the next school year, or reject them.
 */
export default class RegionChangesController {
  async index(ctx: HttpContext) {
    regionReviewer(ctx)
    const today = todayInJakarta()

    const [pending, scheduled, decided] = await staffTransaction(async () => {
      const base = () =>
        RegionChangeReview.query()
          .preload('school')
          .preload('fromRegion')
          .preload('fromDistrict')
          .preload('toRegion')
          .preload('toDistrict')
          .preload('decidedBy')
      // One transaction client: the queries run one after another.
      return [
        await base().where('status', 'pending').orderBy('detected_at'),
        await base().where('status', 'accepted').whereNull('applied_at').orderBy('effective_on'),
        await base()
          .where((q) => q.where('status', 'rejected').orWhereNotNull('applied_at'))
          .orderBy('decided_at', 'desc')
          .limit(10),
      ] as const
    })

    return ctx.inertia.render('admin/region_changes', {
      dates: {
        nextDay: effectiveOn('next_day', today),
        nextSchoolYear: effectiveOn('next_school_year', today),
      },
      pending: pending.map(present),
      scheduled: scheduled.map(present),
      decided: decided.map(present),
    })
  }

  async accept(ctx: HttpContext) {
    const staff = regionReviewer(ctx)
    const { apply_from: applyFrom } = await ctx.request.validateUsing(acceptRegionChangeValidator)
    try {
      const review = await RegionChangeQueue.accept(ctx.params.review, staff, applyFrom)
      ctx.session.flash(
        'success',
        ctx.i18n.t('regions.changes.toasts.accepted', {
          date: review.effectiveOn!.toFormat('dd/MM/yyyy'),
        })
      )
    } catch (error) {
      if (!(error instanceof ReviewNotPendingException)) throw error
      ctx.session.flash('error', ctx.i18n.t('regions.changes.errors.not_pending'))
    }
    return ctx.response.redirect().toPath('/perubahan-wilayah')
  }

  async reject(ctx: HttpContext) {
    const staff = regionReviewer(ctx)
    const { note } = await ctx.request.validateUsing(rejectRegionChangeValidator)
    try {
      await RegionChangeQueue.reject(ctx.params.review, staff, note ?? null)
      ctx.session.flash('success', ctx.i18n.t('regions.changes.toasts.rejected'))
    } catch (error) {
      if (!(error instanceof ReviewNotPendingException)) throw error
      ctx.session.flash('error', ctx.i18n.t('regions.changes.errors.not_pending'))
    }
    return ctx.response.redirect().toPath('/perubahan-wilayah')
  }
}

function present(review: RegionChangeReview) {
  return {
    id: review.publicId,
    status: review.status,
    school: { name: review.school.name, npsn: review.school.npsn },
    from: {
      regency: regionRef(review.fromRegion),
      district: review.fromDistrict ? regionRef(review.fromDistrict) : null,
    },
    to: {
      regency: regionRef(review.toRegion),
      district: review.toDistrict ? regionRef(review.toDistrict) : null,
    },
    detectedOn: review.detectedAt.setZone('Asia/Jakarta').toISODate()!,
    applyFrom: review.applyFrom,
    effectiveOn: review.effectiveOn?.toISODate() ?? null,
    applied: review.appliedAt !== null,
    decidedBy: review.decidedBy?.name ?? null,
    note: review.note,
  }
}
