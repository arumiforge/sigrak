import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import { backWithFieldError } from '#accounts/http'
import { authorizeStaff } from '#staff/access'
import { parseLocal } from '../announcements.js'
import { PostStateException, deletePost, savePost, unpublishPost } from '../posts.js'
import { eventValidator } from '../validators.js'
import { isoOrNull, localInput, publicUrl } from '../views.js'

/**
 * Konsol: Acara (R2-05, D-435): webinars, workshops and visits shown on
 * sigrak.com/acara once published. Ability `events.manage` (owner,
 * admin, Pemasaran).
 */
export default class ConsoleEventsController {
  async index(ctx: HttpContext) {
    await authorizeStaff(ctx, 'events.manage')
    const rows = await Event.query().orderBy('starts_at', 'desc').limit(300)
    const now = Date.now()
    return ctx.inertia.render('console/events', {
      events: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        past: (row.endsAt ?? row.startsAt).toMillis() < now,
        startsAt: row.startsAt.toISO()!,
        place: row.place,
        online: row.onlineUrl !== null,
      })),
    })
  }

  async create(ctx: HttpContext) {
    await authorizeStaff(ctx, 'events.manage')
    return ctx.inertia.render('console/event_form', { event: null })
  }

  async edit(ctx: HttpContext) {
    await authorizeStaff(ctx, 'events.manage')
    const event = await Event.findOrFail(Number(ctx.params.event))
    return ctx.inertia.render('console/event_form', {
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        summary: event.summary ?? '',
        body: event.body,
        status: event.status,
        eventStart: localInput(event.startsAt),
        eventEnd: localInput(event.endsAt),
        place: event.place ?? '',
        onlineUrl: event.onlineUrl ?? '',
        registrationUrl: event.registrationUrl ?? '',
        publishedAt: isoOrNull(event.publishedAt),
        publicUrl: event.status === 'published' ? publicUrl(`/acara/${event.slug}`) : null,
      },
    })
  }

  async store(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'events.manage')
    return this.#save(ctx, staff, new Event(), '/acara/baru')
  }

  async update(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'events.manage')
    const event = await Event.findOrFail(Number(ctx.params.event))
    return this.#save(ctx, staff, event, `/acara/${event.id}`)
  }

  async unpublish(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'events.manage')
    const event = await Event.findOrFail(Number(ctx.params.event))
    await this.#simple(ctx, () => unpublishPost(staff, 'event', event), 'unpublished')
    return ctx.response.redirect().toPath(`/acara/${event.id}`)
  }

  async destroy(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'events.manage')
    const event = await Event.findOrFail(Number(ctx.params.event))
    const done = await this.#simple(ctx, () => deletePost(staff, 'event', event), 'deleted')
    return ctx.response.redirect().toPath(done ? '/acara' : `/acara/${event.id}`)
  }

  async #save(
    ctx: HttpContext,
    staff: Awaited<ReturnType<typeof authorizeStaff>>,
    event: Event,
    back: string
  ) {
    const data = await ctx.request.validateUsing(eventValidator)
    const startsAt = parseLocal(data.event_start)!
    const endsAt = parseLocal(data.event_end ?? null)
    if (!startsAt.isValid || (endsAt && (!endsAt.isValid || endsAt <= startsAt))) {
      return backWithFieldError(
        ctx,
        back,
        'event_end',
        ctx.i18n.t('publishing.events.errors.window')
      )
    }
    if (!data.place && !data.online_url) {
      return backWithFieldError(ctx, back, 'place', ctx.i18n.t('publishing.events.errors.where'))
    }
    const publishing = event.status !== 'published' && (data.publish ?? false)
    await savePost(
      staff,
      'event',
      event,
      {
        title: data.title,
        summary: data.summary ?? null,
        body: data.body ?? '',
        startsAt,
        endsAt,
        place: data.place ?? null,
        onlineUrl: data.online_url ?? null,
        registrationUrl: data.registration_url ?? null,
      },
      data.publish ?? false
    )
    ctx.session.flash(
      'success',
      ctx.i18n.t(
        publishing
          ? 'publishing.toasts.published'
          : event.status === 'draft'
            ? 'publishing.toasts.draft_saved'
            : 'publishing.toasts.saved',
        { title: event.title }
      )
    )
    return ctx.response.redirect().toPath(`/acara/${event.id}`)
  }

  async #simple(ctx: HttpContext, work: () => Promise<void>, toast: 'unpublished' | 'deleted') {
    try {
      await work()
      ctx.session.flash('success', ctx.i18n.t(`publishing.toasts.${toast}`))
      return true
    } catch (error) {
      if (!(error instanceof PostStateException)) throw error
      ctx.session.flash('error', ctx.i18n.t('publishing.errors.state'))
      return false
    }
  }
}
