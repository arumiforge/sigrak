import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Story from '#models/story'
import { authorizeStaff } from '#staff/access'
import { PostStateException, deletePost, savePost, unpublishPost } from '../posts.js'
import { storyValidator } from '../validators.js'
import { isoOrNull, publicUrl } from '../views.js'

/**
 * Konsol: Cerita Sekolah (R2-05, D-435): a school's story on
 * sigrak.com/cerita-sekolah. The school is named only with its consent,
 * so the consent note and date are required. Ability `stories.manage`
 * (owner, admin, Pemasaran).
 */
export default class ConsoleStoriesController {
  async index(ctx: HttpContext) {
    await authorizeStaff(ctx, 'stories.manage')
    const rows = await Story.query().orderBy('updated_at', 'desc').limit(300)
    return ctx.inertia.render('console/stories', {
      stories: rows.map((row) => ({
        id: row.id,
        title: row.title,
        schoolName: row.schoolName,
        status: row.status,
        updatedAt: row.updatedAt.toISO()!,
      })),
    })
  }

  async create(ctx: HttpContext) {
    await authorizeStaff(ctx, 'stories.manage')
    return ctx.inertia.render('console/story_form', { story: null })
  }

  async edit(ctx: HttpContext) {
    await authorizeStaff(ctx, 'stories.manage')
    const story = await Story.findOrFail(Number(ctx.params.story))
    return ctx.inertia.render('console/story_form', {
      story: {
        id: story.id,
        slug: story.slug,
        title: story.title,
        summary: story.summary ?? '',
        body: story.body,
        schoolName: story.schoolName,
        consentNote: story.consentNote,
        consentOn: story.consentOn.toISODate()!,
        status: story.status,
        publishedAt: isoOrNull(story.publishedAt),
        publicUrl: story.status === 'published' ? publicUrl(`/cerita-sekolah/${story.slug}`) : null,
      },
    })
  }

  async store(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'stories.manage')
    return this.#save(ctx, staff, new Story())
  }

  async update(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'stories.manage')
    return this.#save(ctx, staff, await Story.findOrFail(Number(ctx.params.story)))
  }

  async unpublish(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'stories.manage')
    const story = await Story.findOrFail(Number(ctx.params.story))
    await this.#simple(ctx, () => unpublishPost(staff, 'story', story), 'unpublished')
    return ctx.response.redirect().toPath(`/cerita-sekolah/${story.id}`)
  }

  async destroy(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'stories.manage')
    const story = await Story.findOrFail(Number(ctx.params.story))
    const done = await this.#simple(ctx, () => deletePost(staff, 'story', story), 'deleted')
    return ctx.response.redirect().toPath(done ? '/cerita-sekolah' : `/cerita-sekolah/${story.id}`)
  }

  async #save(ctx: HttpContext, staff: Awaited<ReturnType<typeof authorizeStaff>>, story: Story) {
    const data = await ctx.request.validateUsing(storyValidator)
    const publishing = story.status !== 'published' && (data.publish ?? false)
    await savePost(
      staff,
      'story',
      story,
      {
        title: data.title,
        summary: data.summary ?? null,
        body: data.body,
        schoolName: data.school_name,
        consentNote: data.consent_note,
        consentOn: DateTime.fromISO(data.consent_on),
      },
      data.publish ?? false
    )
    ctx.session.flash(
      'success',
      ctx.i18n.t(
        publishing
          ? 'publishing.toasts.published'
          : story.status === 'draft'
            ? 'publishing.toasts.draft_saved'
            : 'publishing.toasts.saved',
        { title: story.title }
      )
    )
    return ctx.response.redirect().toPath(`/cerita-sekolah/${story.id}`)
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
