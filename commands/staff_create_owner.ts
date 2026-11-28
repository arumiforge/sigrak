import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Creates the first Pemilik (owner) account of the console (R2-01).
 * Runs only while no active owner exists; later owners are added in the
 * console by an owner. Name, email and password come from the flags,
 * from STAFF_OWNER_NAME / STAFF_OWNER_EMAIL / STAFF_OWNER_PASSWORD, or
 * from prompts, so no personal data lives in the repository. An
 * existing staff account with that email gets the owner role and the
 * new password.
 */
export default class StaffCreateOwner extends BaseCommand {
  static commandName = 'staff:create-owner'
  static description = 'Create the first owner account of the staff console'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Full name of the owner' })
  declare name?: string

  @flags.string({ description: 'Email address the owner signs in with' })
  declare email?: string

  async run() {
    const { default: env } = await import('#start/env')
    const { createFirstOwner, StaffChangeRefusedException } = await import('#staff/staff_accounts')

    const name =
      this.name ||
      env.get('STAFF_OWNER_NAME') ||
      (await this.prompt.ask('Full name', {
        validate: (value) => value.trim().length >= 2 || 'At least 2 characters',
      })) ||
      ''
    const email = (
      this.email ||
      env.get('STAFF_OWNER_EMAIL') ||
      (await this.prompt.ask('Email', {
        validate: (value) => EMAIL.test(value.trim()) || 'Not an email',
      })) ||
      ''
    )
      .trim()
      .toLowerCase()
    const password =
      env.get('STAFF_OWNER_PASSWORD')?.release() ||
      (await this.prompt.secure('Password (at least 12 characters, letters and numbers)', {
        validate: (value) =>
          validPassword(value) || 'At least 12 characters with letters and numbers',
      })) ||
      ''
    if (name.trim().length < 2 || !EMAIL.test(email)) {
      this.logger.error('A name and a valid email are needed')
      this.exitCode = 1
      return
    }
    if (!validPassword(password)) {
      this.logger.error('The password needs at least 12 characters with letters and numbers')
      this.exitCode = 1
      return
    }

    try {
      const owner = await createFirstOwner({ name: name.trim(), email, password })
      this.logger.success(`Owner account ready: ${owner.email}`)
    } catch (error) {
      if (error instanceof StaffChangeRefusedException) {
        this.logger.error('An active owner already exists; add more owners in the console')
        this.exitCode = 1
        return
      }
      throw error
    }
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validPassword(value: string) {
  return value.length >= 12 && value.length <= 200 && /\p{L}/u.test(value) && /\p{N}/u.test(value)
}
