import emitter from '@adonisjs/core/services/emitter'
import mail from '@adonisjs/mail/services/main'
import { FakeMailer, Mailer } from '@adonisjs/mail'
import { SMTPTransport } from '@adonisjs/mail/transports/smtp'
import type { MailersList, MailTransportContract, SMTPConfig } from '@adonisjs/mail/types'
import env from '#start/env'
import type StaffUser from '#models/staff_user'
import IntegrationTestMail from '#mails/integration_test_mail'
import { logStaffActivity } from '#accounts/activity_log'
import {
  diffFields,
  hintOf,
  readIntegration,
  writeIntegration,
  type MailSecurity,
  type MailSettings,
} from './store.js'

/**
 * Where mail settings come from (D-431, F-005):
 *
 * - `env`: MAIL_MAILER is set in env. Env wins; console values are kept
 *   but not used.
 * - `console`: MAIL_MAILER is empty and the console holds complete SMTP
 *   values; worker-default sends with them.
 * - `none`: neither; the `json` mailer renders mail and sends nothing.
 */
export type MailSource = 'env' | 'console' | 'none'

const MAIL_SECRET_FIELDS = ['password'] as const

/* ----------------------------------------------------------------------
 * Test seams: the env value and the SMTP transport.
 * -------------------------------------------------------------------- */

let envMailerOverride: { value: string | undefined } | null = null
type TransportFactory = (config: SMTPConfig) => MailTransportContract
const smtpTransport: TransportFactory = (config) => new SMTPTransport(config)
let transportFactory: TransportFactory = smtpTransport

export const mailSeams = {
  /** Pretends MAIL_MAILER is `value` (undefined: empty) until restored. */
  envMailer(value: string | undefined) {
    envMailerOverride = { value }
  },
  /** Sends console-configured mail through `factory` instead of SMTP. */
  transport(factory: TransportFactory) {
    transportFactory = factory
    resetConsoleMailer()
  },
  restore() {
    envMailerOverride = null
    transportFactory = smtpTransport
    resetConsoleMailer()
  },
}

function envMailer(): string | undefined {
  if (envMailerOverride) return envMailerOverride.value
  return env.get('MAIL_MAILER') || undefined
}

/* ----------------------------------------------------------------------
 * Reading
 * -------------------------------------------------------------------- */

export function isCompleteMail(value: MailSettings | null | undefined): value is MailSettings {
  return Boolean(value?.host && value.port && value.username && value.password && value.fromAddress)
}

export async function mailSource(): Promise<MailSource> {
  if (envMailer()) return 'env'
  const saved = await readIntegration('mail')
  return isCompleteMail(saved?.value) ? 'console' : 'none'
}

/**
 * Where mail comes from and whether it really leaves the server: env
 * with a real mailer (not `json`), or complete console values
 * (Kesehatan sistem, R2-09).
 */
export async function mailDelivery(): Promise<{ source: MailSource; sends: boolean }> {
  const source = await mailSource()
  const sends = source === 'console' || (source === 'env' && envMailer() !== 'json')
  return { source, sends }
}

/** What the console page shows: values without the password, and which source is used. */
export async function presentMail() {
  const saved = await readIntegration('mail')
  const value = saved?.value ?? null
  return {
    source: await mailSource(),
    envMailer: envMailer() ?? null,
    saved: value !== null,
    complete: isCompleteMail(value),
    values: {
      host: value?.host ?? '',
      port: value?.port ?? 587,
      security: value?.security ?? ('starttls' as MailSecurity),
      username: value?.username ?? '',
      fromAddress: value?.fromAddress ?? '',
      fromName: value?.fromName ?? 'SIGRAK',
    },
    password: hintOf(value?.password),
  }
}

/* ----------------------------------------------------------------------
 * Writing
 * -------------------------------------------------------------------- */

export type MailInput = Omit<MailSettings, 'password'> & { password?: string | null }

/** Saves the console SMTP values; an empty password keeps the saved one. */
export async function saveMail(staff: StaffUser, input: MailInput) {
  return writeIntegration(staff, 'mail', (before) => {
    const value: MailSettings = {
      host: input.host,
      port: input.port,
      security: input.security,
      username: input.username,
      password: input.password || before?.password || '',
      fromAddress: input.fromAddress,
      fromName: input.fromName,
    }
    return { value, changes: diffFields(before, value, MAIL_SECRET_FIELDS) }
  })
}

/* ----------------------------------------------------------------------
 * Sending
 * -------------------------------------------------------------------- */

let consoleMailer: { stamp: number; mailer: Mailer<MailTransportContract> } | null = null

function resetConsoleMailer() {
  const previous = consoleMailer
  consoleMailer = null
  void previous?.mailer.close()
}

function smtpConfigOf(value: MailSettings): SMTPConfig {
  return {
    host: value.host,
    port: value.port,
    secure: value.security === 'tls',
    requireTLS: value.security === 'starttls',
    auth: { type: 'login', user: value.username, pass: value.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  }
}

async function consoleMailerFor(saved: { value: MailSettings; updatedAt: Date }) {
  const stamp = saved.updatedAt.getTime()
  if (consoleMailer?.stamp === stamp) return consoleMailer.mailer
  resetConsoleMailer()
  const mailer = new Mailer('console', transportFactory(smtpConfigOf(saved.value)), emitter, {
    from: { address: saved.value.fromAddress, name: saved.value.fromName || 'SIGRAK' },
  })
  consoleMailer = { stamp, mailer }
  return mailer
}

/**
 * The mailer a queued mail is sent with (worker-default, app/jobs/
 * send_mail.ts). A mail queued on the default mailer uses the console
 * SMTP values while MAIL_MAILER is empty in env; any other mailer, and
 * the fake mailer of the tests, is used as queued.
 */
export async function mailerFor(mailerName?: string) {
  const name = (mailerName ?? undefined) as keyof MailersList | undefined
  const configured = mail.use(name)
  if (configured instanceof FakeMailer || envMailer()) return configured
  if (mailerName && mailerName !== mail.use().name) return configured
  const saved = await readIntegration('mail')
  if (!saved || !isCompleteMail(saved.value)) return configured
  return consoleMailerFor({ value: saved.value, updatedAt: saved.updatedAt })
}

export type TestMailResult = { ok: true; source: MailSource } | { ok: false; reason: string }

/**
 * "Kirim email uji": sends one mail now (not through the queue) to the
 * staff member who asked, with the settings in use, and logs the try.
 */
export async function sendTestMail(staff: StaffUser): Promise<TestMailResult> {
  const source = await mailSource()
  let result: TestMailResult
  try {
    const mailer = await mailerFor()
    await mailer.send(new IntegrationTestMail({ email: staff.email, name: staff.name, source }))
    result = { ok: true, source }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    result = { ok: false, reason: reason.slice(0, 200) }
  }
  await logStaffActivity(staff, 'integration.mail_tested', 'integration', 'mail', {
    source,
    ok: result.ok,
  })
  return result
}
