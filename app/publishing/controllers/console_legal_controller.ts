import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import LegalDocument from '#models/legal_document'
import { backWithFieldError } from '#accounts/http'
import { authorizeStaff } from '#staff/access'
import {
  LEGAL_KEYS,
  LEGAL_PATHS,
  LegalChangeRefusedException,
  currentVersion,
  discardDraft,
  isLegalKey,
  publishDraft,
  startDraft,
  todayInJakarta,
  updateDraft,
} from '../legal.js'
import { legalDocumentValidator } from '../validators.js'
import { isoOrNull, publicUrl } from '../views.js'

/**
 * Konsol: Halaman legal (R2-05, D-435): Syarat penggunaan, Kebijakan
 * privasi and Perlindungan data murid, each with its versions. A new
 * version starts as a draft from the newest text; publishing fixes its
 * version and "berlaku sejak" date for good. Ability
 * `legal_pages.manage` (owner, admin).
 */
export default class ConsoleLegalController {
  async index(ctx: HttpContext) {
    await authorizeStaff(ctx, 'legal_pages.manage')
    const rows = await LegalDocument.query().orderBy('key').orderBy('version', 'desc')
    const pages = []
    for (const key of LEGAL_KEYS) {
      const current = await currentVersion(key)
      pages.push({
        key,
        publicUrl: publicUrl(LEGAL_PATHS[key]),
        currentId: current?.id ?? null,
        versions: rows
          .filter((row) => row.key === key)
          .map((row) => ({
            id: row.id,
            version: row.version,
            title: row.title,
            status: row.status,
            effectiveOn: row.effectiveOn.toISODate()!,
            publishedAt: isoOrNull(row.publishedAt),
          })),
      })
    }
    return ctx.inertia.render('console/legal_pages', { pages, today: todayInJakarta() })
  }

  async start(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'legal_pages.manage')
    const key = String(ctx.params.key)
    if (!isLegalKey(key)) return ctx.response.notFound()
    try {
      const draft = await startDraft(staff, key, {
        title: ctx.i18n.t(`publishing.legal.titles.${key}`),
        body: ctx.i18n.t(`publishing.legal.placeholders.${key}`),
      })
      ctx.session.flash('success', ctx.i18n.t('publishing.legal.toasts.draft_started'))
      return ctx.response.redirect().toPath(`/halaman-legal/versi/${draft.id}`)
    } catch (error) {
      if (!(error instanceof LegalChangeRefusedException)) throw error
      ctx.session.flash('error', ctx.i18n.t(`publishing.legal.errors.${error.reason}`))
      return ctx.response.redirect().toPath('/halaman-legal')
    }
  }

  async edit(ctx: HttpContext) {
    await authorizeStaff(ctx, 'legal_pages.manage')
    const document = await LegalDocument.findOrFail(Number(ctx.params.document))
    return ctx.inertia.render('console/legal_document_form', {
      document: {
        id: document.id,
        key: document.key,
        publicUrl:
          document.status === 'published'
            ? publicUrl(`${LEGAL_PATHS[document.key]}?versi=${document.version}`)
            : null,
        version: document.version,
        title: document.title,
        body: document.body,
        effectiveOn: document.effectiveOn.toISODate()!,
        changeNote: document.changeNote ?? '',
        status: document.status,
        publishedAt: isoOrNull(document.publishedAt),
      },
      today: todayInJakarta(),
    })
  }

  async update(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'legal_pages.manage')
    const document = await LegalDocument.findOrFail(Number(ctx.params.document))
    const back = `/halaman-legal/versi/${document.id}`
    const data = await ctx.request.validateUsing(legalDocumentValidator)
    if (!DateTime.fromISO(data.effective_on).isValid) {
      return backWithFieldError(ctx, back, 'effective_on', ctx.i18n.t('publishing.errors.date'))
    }
    return this.#guard(ctx, back, async () => {
      await updateDraft(staff, document, {
        title: data.title,
        body: data.body,
        effectiveOn: data.effective_on,
        changeNote: data.change_note ?? null,
      })
      return ctx.i18n.t('publishing.legal.toasts.saved')
    })
  }

  async publish(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'legal_pages.manage')
    const document = await LegalDocument.findOrFail(Number(ctx.params.document))
    return this.#guard(ctx, `/halaman-legal/versi/${document.id}`, async () => {
      await publishDraft(staff, document)
      return ctx.i18n.t('publishing.legal.toasts.published', { version: document.version })
    })
  }

  async destroy(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'legal_pages.manage')
    const document = await LegalDocument.findOrFail(Number(ctx.params.document))
    return this.#guard(ctx, '/halaman-legal', async () => {
      await discardDraft(staff, document)
      return ctx.i18n.t('publishing.legal.toasts.discarded')
    })
  }

  async #guard(ctx: HttpContext, back: string, work: () => Promise<string>) {
    try {
      ctx.session.flash('success', await work())
    } catch (error) {
      if (!(error instanceof LegalChangeRefusedException)) throw error
      ctx.session.flash('error', ctx.i18n.t(`publishing.legal.errors.${error.reason}`))
    }
    return ctx.response.redirect().toPath(back)
  }
}
