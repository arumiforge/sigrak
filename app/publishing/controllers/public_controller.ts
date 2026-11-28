import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Announcement from '#models/announcement'
import Event from '#models/event'
import Story from '#models/story'
import type LegalDocument from '#models/legal_document'
import { areaUrl } from '#config/hosts'
import { visiblePublicly } from '../announcement_feed.js'
import {
  LEGAL_KEYS,
  LEGAL_PATHS,
  currentVersion,
  publishedVersions,
  upcomingVersion,
  type LegalKey,
} from '../legal.js'
import { markdownToText, renderMarkdown } from '../markdown.js'
import { pageValidator } from '../validators.js'

const ZONE = 'Asia/Jakarta'
const PER_PAGE = 20

/** "25 November 2026" (letters and public pages write the date in full, D-472). */
export function longDate(value: DateTime) {
  return value.setZone(ZONE).setLocale('id').toFormat('d LLLL yyyy')
}

/** "08.00 WIB" (EYD: a period between hours and minutes). */
export function clockTime(value: DateTime) {
  return `${value.setZone(ZONE).toFormat('HH.mm')} WIB`
}

/**
 * sigrak.com (D-435): Kabar, Acara, Cerita Sekolah and the legal pages,
 * server-rendered with a simple public layout (resources/views/public).
 * No session, no sign-in; only published content inside its window.
 * The product pages of the marketing site come in their own task.
 */
export default class PublicController {
  async announcements(ctx: HttpContext) {
    const { halaman } = await ctx.request.validateUsing(pageValidator, { data: ctx.request.qs() })
    const page = halaman ?? 1
    const query = visiblePublicly()
    const total = Number(
      ((await query.clone().count('* as count').first()) as { count: string }).count
    )
    const rows = (await query
      .select('a.slug', 'a.title', 'a.summary', 'a.body', 'a.starts_at', 'a.published_at')
      .orderByRaw('greatest(a.starts_at, a.published_at) desc')
      .orderBy('a.id', 'desc')
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE)) as {
      slug: string
      title: string
      summary: string | null
      body: string
      starts_at: Date | null
      published_at: Date
    }[]
    const lastPage = Math.max(1, Math.ceil(total / PER_PAGE))
    return this.#render(ctx, 'public/announcements', {
      title: ctx.i18n.t('publishing.public.announcements.title'),
      items: rows.map((row) => ({
        href: `/kabar/${row.slug}`,
        title: row.title,
        summary: row.summary ?? markdownToText(row.body),
        date: longDate(
          DateTime.fromJSDate(
            row.starts_at && row.starts_at > row.published_at ? row.starts_at : row.published_at
          )
        ),
      })),
      previous: page > 1 ? `/kabar?halaman=${page - 1}` : null,
      next: page < lastPage ? `/kabar?halaman=${page + 1}` : null,
    })
  }

  async announcement(ctx: HttpContext) {
    const row = (await visiblePublicly()
      .where('a.slug', String(ctx.params.slug))
      .select('a.id')
      .first()) as { id: number } | null
    if (!row) return this.#notFound(ctx)
    const announcement = await Announcement.findOrFail(row.id)
    const shown =
      announcement.startsAt && announcement.startsAt > announcement.publishedAt!
        ? announcement.startsAt
        : announcement.publishedAt!
    return this.#render(ctx, 'public/article', {
      title: announcement.title,
      description: announcement.summary ?? markdownToText(announcement.body),
      back: { href: '/kabar', label: ctx.i18n.t('publishing.public.announcements.back') },
      meta: [longDate(shown)],
      html: renderMarkdown(announcement.body),
    })
  }

  async events(ctx: HttpContext) {
    const now = DateTime.now()
    const published = Event.query().where('status', 'published')
    const upcoming = await published
      .clone()
      .whereRaw('coalesce(ends_at, starts_at) >= ?', [now.toJSDate()])
      .orderBy('starts_at', 'asc')
      .limit(50)
    const past = await published
      .clone()
      .whereRaw('coalesce(ends_at, starts_at) < ?', [now.toJSDate()])
      .orderBy('starts_at', 'desc')
      .limit(PER_PAGE)
    return this.#render(ctx, 'public/events', {
      title: ctx.i18n.t('publishing.public.events.title'),
      upcoming: upcoming.map((event) => this.#eventCard(ctx, event)),
      past: past.map((event) => this.#eventCard(ctx, event)),
    })
  }

  async event(ctx: HttpContext) {
    const event = await Event.query()
      .where('status', 'published')
      .where('slug', String(ctx.params.slug))
      .first()
    if (!event) return this.#notFound(ctx)
    const card = this.#eventCard(ctx, event)
    return this.#render(ctx, 'public/article', {
      title: event.title,
      description: event.summary ?? markdownToText(event.body),
      back: { href: '/acara', label: ctx.i18n.t('publishing.public.events.back') },
      meta: [card.when, card.where].filter(Boolean),
      links: card.links,
      html: renderMarkdown(event.body),
    })
  }

  async stories(ctx: HttpContext) {
    const rows = await Story.query()
      .where('status', 'published')
      .orderBy('published_at', 'desc')
      .limit(50)
    return this.#render(ctx, 'public/stories', {
      title: ctx.i18n.t('publishing.public.stories.title'),
      items: rows.map((story) => ({
        href: `/cerita-sekolah/${story.slug}`,
        title: story.title,
        school: story.schoolName,
        summary: story.summary ?? markdownToText(story.body),
      })),
    })
  }

  async story(ctx: HttpContext) {
    const story = await Story.query()
      .where('status', 'published')
      .where('slug', String(ctx.params.slug))
      .first()
    if (!story) return this.#notFound(ctx)
    return this.#render(ctx, 'public/article', {
      title: story.title,
      description: story.summary ?? markdownToText(story.body),
      back: { href: '/cerita-sekolah', label: ctx.i18n.t('publishing.public.stories.back') },
      meta: [story.schoolName, longDate(story.publishedAt!)],
      html: renderMarkdown(story.body),
    })
  }

  async terms(ctx: HttpContext) {
    return this.legal(ctx, 'terms')
  }

  async privacy(ctx: HttpContext) {
    return this.legal(ctx, 'privacy')
  }

  async studentData(ctx: HttpContext) {
    return this.legal(ctx, 'student_data')
  }

  /** One legal page: the version in force, or `?versi=N` for any published version. */
  async legal(ctx: HttpContext, key: LegalKey) {
    const { versi } = await ctx.request.validateUsing(pageValidator, { data: ctx.request.qs() })
    const versions = await publishedVersions(key)
    const current = await currentVersion(key)
    const upcoming = await upcomingVersion(key)
    let shown: LegalDocument | null = current ?? null
    if (versi !== undefined) {
      shown = versions.find((version) => version.version === versi) ?? null
      if (!shown) return this.#notFound(ctx)
    }
    const path = LEGAL_PATHS[key]
    const t = (name: string, data?: Record<string, unknown>) =>
      ctx.i18n.t(`publishing.public.legal.${name}`, data)
    return this.#render(ctx, 'public/legal', {
      title: shown?.title ?? ctx.i18n.t(`publishing.legal.titles.${key}`),
      description: t('description'),
      document: shown
        ? {
            version: t('version', { version: shown.version }),
            effective: t('effective_since', { date: longDate(shown.effectiveOn) }),
            html: renderMarkdown(shown.body),
            isCurrent: current?.id === shown.id,
          }
        : null,
      upcoming:
        upcoming && upcoming.id !== shown?.id
          ? {
              text: t('upcoming', {
                version: upcoming.version,
                date: longDate(upcoming.effectiveOn),
              }),
              href: `${path}?versi=${upcoming.version}`,
            }
          : null,
      currentHref: current && shown && current.id !== shown.id ? path : null,
      versions: versions
        .filter((version) => version.id !== shown?.id)
        .map((version) => ({
          href: `${path}?versi=${version.version}`,
          label: t('version_item', {
            version: version.version,
            date: longDate(version.effectiveOn),
          }),
        })),
    })
  }

  #eventCard(ctx: HttpContext, event: Event) {
    const start = event.startsAt
    const end = event.endsAt
    const sameDay = end && end.setZone(ZONE).hasSame(start.setZone(ZONE), 'day')
    const when = end
      ? sameDay
        ? `${longDate(start)}, ${clockTime(start).replace(' WIB', '')}–${clockTime(end)}`
        : `${longDate(start)}, ${clockTime(start)} – ${longDate(end)}, ${clockTime(end)}`
      : `${longDate(start)}, ${clockTime(start)}`
    const where = [
      event.place,
      event.onlineUrl ? ctx.i18n.t('publishing.public.events.online') : null,
    ]
      .filter(Boolean)
      .join(' · ')
    const links = [
      event.registrationUrl
        ? {
            href: event.registrationUrl,
            label: ctx.i18n.t('publishing.public.events.register'),
          }
        : null,
      event.onlineUrl
        ? { href: event.onlineUrl, label: ctx.i18n.t('publishing.public.events.join') }
        : null,
    ].filter((link) => link !== null)
    return {
      href: `/acara/${event.slug}`,
      title: event.title,
      summary: event.summary ?? markdownToText(event.body),
      when,
      where,
      links,
    }
  }

  async #notFound(ctx: HttpContext) {
    ctx.response.status(404)
    return this.#render(
      ctx,
      'public/not_found',
      { title: ctx.i18n.t('publishing.public.not_found.title') },
      false
    )
  }

  /**
   * Renders a public page with the layout's shared parts: the menu, the
   * legal links, the sign-in link and the `t` helper. Public pages may
   * be cached briefly by Cloudflare.
   */
  #render(ctx: HttpContext, view: string, state: Record<string, unknown>, cache = true) {
    if (cache) ctx.response.header('Cache-Control', 'public, max-age=300')
    const path = ctx.request.url()
    const menu = [
      { href: '/kabar', label: ctx.i18n.t('publishing.public.menu.announcements') },
      { href: '/acara', label: ctx.i18n.t('publishing.public.menu.events') },
      { href: '/cerita-sekolah', label: ctx.i18n.t('publishing.public.menu.stories') },
    ].map((item) => ({
      ...item,
      current: path === item.href || path.startsWith(`${item.href}/`),
    }))
    const t = (key: string, data?: Record<string, unknown>) => ctx.i18n.t(key, data)
    return ctx.view.render(view, {
      ...state,
      t,
      layout: {
        title: state.title,
        description: state.description ?? null,
        t,
        menu,
        legalLinks: LEGAL_KEYS.map((key) => ({
          href: LEGAL_PATHS[key],
          label: ctx.i18n.t(`publishing.legal.titles.${key}`),
        })),
        loginUrl: areaUrl('app', '/masuk'),
        year: DateTime.now().setZone(ZONE).year,
      },
    })
  }
}
