import { BaseMail } from '@adonisjs/mail'

/**
 * What a transactional mail says: a title, a few paragraphs, one button
 * and a closing note. Every string comes from resources/lang/id and is
 * filled in before the mail is queued, so the worker only renders.
 */
export type ActionMailContent = {
  subject: string
  heading: string
  paragraphs: string[]
  action: { label: string; url: string }
  footnotes: string[]
}

/**
 * One layout for every transactional mail (resources/views/emails/
 * action_html.edge and action_text.edge). Sent through the queue with
 * `mail.sendLater()`.
 */
export abstract class ActionMail extends BaseMail {
  constructor(
    readonly recipient: string,
    readonly content: ActionMailContent
  ) {
    super()
  }

  prepare() {
    this.message
      .to(this.recipient)
      .subject(this.content.subject)
      .htmlView('emails/action_html', this.content)
      .textView('emails/action_text', this.content)
  }
}
