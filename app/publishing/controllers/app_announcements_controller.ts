import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { schoolUser } from '#accounts/http'
import { markRead, visibleInApp } from '../announcement_feed.js'
import { markdownToText, renderMarkdown } from '../markdown.js'

const PER_PAGE = 50

type Row = {
  id: number
  slug: string
  title: string
  summary: string | null
  body: string
  kind: string
  shown_at: Date
  read_at: Date | null
}

/**
 * App: Kabar (R2-05, D-319). The Kabar from Tim SIGRAK that reach the
 * signed-in user (announcement_feed.ts), newest first, with what is
 * still unread; opening one marks it read. Every school user may look.
 */
export default class AppAnnouncementsController {
  async index(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const rows = (await this.#query(user.id)
      .orderBy('shown_at', 'desc')
      .orderBy('a.id', 'desc')
      .limit(PER_PAGE)) as Row[]
    return ctx.inertia.render('announcements/index', {
      announcements: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        summary: row.summary ?? markdownToText(row.body, 180),
        kind: row.kind,
        shownAt: new Date(row.shown_at).toISOString(),
        unread: row.read_at === null,
      })),
    })
  }

  async show(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const row = (await this.#query(user.id).where('a.slug', String(ctx.params.slug)).first()) as
      Row | undefined
    if (!row) return ctx.response.notFound()
    await markRead(user.id, [Number(row.id)])
    return ctx.inertia.render('announcements/show', {
      announcement: {
        slug: row.slug,
        title: row.title,
        kind: row.kind,
        shownAt: new Date(row.shown_at).toISOString(),
        html: renderMarkdown(row.body),
      },
    })
  }

  /** "Tandai semua sudah dibaca". */
  async markAllRead(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const ids = (await visibleInApp(user.id).select('a.id')) as { id: number }[]
    await markRead(
      user.id,
      ids.map((row) => Number(row.id))
    )
    ctx.session.flash('success', ctx.i18n.t('publishing.app.all_read'))
    return ctx.response.redirect().toPath('/kabar')
  }

  #query(userId: number) {
    return visibleInApp(userId)
      .leftJoin('announcement_reads as ar', (join) =>
        join.on('ar.announcement_id', 'a.id').andOnVal('ar.user_id', userId)
      )
      .select(
        'a.id',
        'a.slug',
        'a.title',
        'a.summary',
        'a.body',
        'a.kind',
        db.raw('greatest(a.starts_at, a.published_at) as shown_at'),
        'ar.read_at'
      )
  }
}
