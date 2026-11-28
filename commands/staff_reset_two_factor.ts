import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Resets a staff member's 2FA from the server (R2-02, D-343), for when
 * nobody can do it in the console: the only owner lost their
 * authenticator. In every other case an owner or admin uses "Atur
 * ulang 2FA" on the Staf page. The reset is logged without a staff
 * member; the account enrols again at its next sign-in.
 */
export default class StaffResetTwoFactor extends BaseCommand {
  static commandName = 'staff:reset-2fa'
  static description = "Reset a staff member's two-factor sign-in so they enrol again"

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Email address of the staff account' })
  declare email?: string

  async run() {
    const { default: StaffUser } = await import('#models/staff_user')
    const { byEmail } = await import('#models/email_lookup')
    const { resetTwoFactorFromServer } = await import('#staff/two_factor')

    const email = (this.email || (await this.prompt.ask('Email of the staff account')) || '')
      .trim()
      .toLowerCase()
    const staff = email ? await byEmail(StaffUser, email).first() : null
    if (!staff) {
      this.logger.error('No staff account with that email')
      this.exitCode = 1
      return
    }
    if (!staff.twoFactorSecret) {
      this.logger.info('This account has no 2FA to reset')
      return
    }
    await resetTwoFactorFromServer(staff)
    this.logger.success(`2FA reset for ${staff.email}; they enrol again at their next sign-in`)
  }
}
