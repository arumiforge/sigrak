import type { HttpContext } from '@adonisjs/core/http'
import { schoolUser } from '#accounts/http'
import { HELP_CATEGORIES, MESSAGE_MAX, MESSAGE_MIN } from '../catalog.js'
import { myHelpRequests, openMyHelpRequest, sendHelpRequest } from '../help_requests.js'
import { cleanPageUrl, helpFormQueryValidator, helpRequestValidator } from '../validators.js'

/**
 * app.: Minta bantuan and Bantuan saya (R2-06, D-320). Every school
 * user may send a request, with or without a school (D-459); it goes
 * to Tim SIGRAK with the school and role of the active membership and
 * the page the user came from. Bantuan saya lists only the user's own
 * requests with their status and Tim SIGRAK's replies.
 */
export default class HelpController {
  async create(ctx: HttpContext) {
    const { halaman } = await helpFormQueryValidator.validate(ctx.request.qs())
    return ctx.inertia.render('help/ask', {
      categories: [...HELP_CATEGORIES],
      pageUrl: cleanPageUrl(halaman),
      messageMin: MESSAGE_MIN,
      messageMax: MESSAGE_MAX,
    })
  }

  async store(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const input = await ctx.request.validateUsing(helpRequestValidator)
    const request = await sendHelpRequest(user, ctx.membership, {
      category: input.category,
      message: input.message,
      pageUrl: cleanPageUrl(input.page_url),
    })
    ctx.session.flash('success', ctx.i18n.t('help.ask.sent'))
    return ctx.response.redirect().toPath(`/bantuan-saya/${request.publicId}`)
  }

  async index(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const rows = await myHelpRequests(user.id)
    return ctx.inertia.render('help/mine', {
      requests: rows.map(({ request, replies }) => ({
        publicId: request.publicId,
        category: request.category,
        status: request.status,
        excerpt:
          request.message.length > 140 ? `${request.message.slice(0, 137)}…` : request.message,
        createdAt: request.createdAt.toISO()!,
        unread: request.senderUnreadAt !== null,
        replies,
      })),
    })
  }

  async show(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const { request, notes } = await openMyHelpRequest(user.id, ctx.params.helpRequest)
    return ctx.inertia.render('help/request', {
      request: {
        publicId: request.publicId,
        category: request.category,
        status: request.status,
        message: request.message,
        pageUrl: request.pageUrl,
        createdAt: request.createdAt.toISO()!,
      },
      entries: notes.map((note) => ({
        kind: note.kind as 'reply' | 'status',
        body: note.body,
        status: note.status,
        at: note.createdAt.toISO()!,
      })),
    })
  }
}
