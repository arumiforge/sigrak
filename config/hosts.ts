import env from '#start/env'

/**
 * The three areas of SIGRAK, each on its own hostname with its own
 * guard and session cookie (D-388, D-392):
 *
 * - app:   school users (teachers, principals, operators, supervisors)
 * - admin: Tim SIGRAK staff
 * - exam:  exam participants on the TKA practice site
 */
export type Area = 'app' | 'admin' | 'exam'

export const areas: readonly Area[] = ['app', 'admin', 'exam'] as const

const domain = env.get('APP_DOMAIN')

export const hosts: Record<Area, string> = {
  app: `app.${domain}`,
  admin: `admin.${domain}`,
  exam: `ujian.${domain}`,
}

/**
 * Returns the area served on a hostname, or null for any other host.
 */
export function areaForHost(hostname: string | null | undefined): Area | null {
  if (!hostname) {
    return null
  }
  const host = hostname.toLowerCase()
  return areas.find((area) => hosts[area] === host) ?? null
}

/**
 * Absolute URL of a path on an area's host.
 */
export function areaUrl(area: Area, path = '/'): string {
  return `${env.get('APP_SCHEME')}://${hosts[area]}${path}`
}
