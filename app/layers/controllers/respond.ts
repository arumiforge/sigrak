import type { HttpContext } from '@adonisjs/core/http'
import { LayerRuleException } from '../layer_rules.js'

/**
 * Runs a layer change and answers the way every layer form expects: a
 * success toast, or the rule's Indonesian message as an error toast,
 * then back to the page. Other errors (403, validation) pass through.
 */
export async function runAndRedirect(
  ctx: HttpContext,
  path: string,
  successKey: string,
  work: () => Promise<unknown>
) {
  try {
    await work()
    ctx.session.flash('success', ctx.i18n.t(successKey))
  } catch (error) {
    if (!(error instanceof LayerRuleException)) throw error
    ctx.session.flash('error', ctx.i18n.t(error.messageKey, error.values))
  }
  return ctx.response.redirect().toPath(path)
}
