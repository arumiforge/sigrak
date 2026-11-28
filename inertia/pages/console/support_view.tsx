import { Form } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section } from '~/components/section'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatShortDate, formatTime } from '~/lib/format'
import { formatRange } from '~/lib/dates'

type Props = {
  session: { id: number; startedAt: string; expiresAt: string; hours: number }
  school: {
    id: number
    name: string
    npsn: string | null
    level: 'sd' | 'mi'
    address: string | null
    regionName: string | null
    regionKind: string
    districtName: string | null
  }
  members: {
    publicId: string
    name: string
    email: string
    role: 'principal' | 'operator' | 'teacher'
    status: 'active' | 'ended'
    startedOn: string | null
  }[]
  years: {
    publicId: string
    name: string
    startsOn: string | null
    endsOn: string | null
    closed: boolean
  }[]
  classes: {
    publicId: string
    grade: number
    name: string
    yearName: string
    homeroomName: string | null
    assignments: number
  }[]
  events: { id: number; title: string; startsOn: string | null; endsOn: string | null }[]
}

/**
 * Konsol /lihat-sekolah (R2-06, D-341): the school's view during a
 * support session, read-only, with religion and health data left out
 * on the server. The banner above (console layout) and the button here
 * end the session.
 */
export default function SupportView({ session, school, members, years, classes, events }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader
        title={school.name}
        headTitle={`${t('help.support.title')}: ${school.name}`}
        description={t('help.support.intro', { time: formatTime(session.expiresAt) })}
        actions={
          <Form action="/lihat-sekolah/akhiri" method="post">
            {({ processing }) => (
              <Button type="submit" disabled={processing}>
                {t('help.support.end')}
              </Button>
            )}
          </Form>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t('help.support.profile_title')}>
          <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-muted">{t('help.support.level')}</dt>
            <dd>{t(`console.levels.${school.level}`)}</dd>
            <dt className="text-muted">{t('help.support.npsn')}</dt>
            <dd>{school.npsn ?? '–'}</dd>
            <dt className="text-muted">{t('help.support.region')}</dt>
            <dd className="min-w-0 break-words">
              {[
                school.districtName
                  ? t('regions.kinds.district', { name: school.districtName })
                  : null,
                school.regionName
                  ? t(`regions.kinds.${school.regionKind}`, { name: school.regionName })
                  : null,
              ]
                .filter(Boolean)
                .join(', ') || '–'}
            </dd>
            <dt className="text-muted">{t('help.support.address')}</dt>
            <dd className="min-w-0 break-words">{school.address ?? '–'}</dd>
          </dl>
        </Section>

        <Section title={t('help.support.members_title')}>
          {members.length === 0 ? (
            <p className="text-muted">{t('help.support.members_empty')}</p>
          ) : (
            <ul className="divide-y" data-testid="support-members">
              {members.map((member) => (
                <li key={member.publicId} className="py-2.5">
                  <p className="font-semibold break-words">{member.name}</p>
                  <p className="text-sm break-all text-muted">{member.email}</p>
                  <p className="text-xs text-muted">
                    {t(`accounts.roles.${member.role}`)} · {t(`accounts.statuses.${member.status}`)}
                    {member.startedOn &&
                      ` · ${t('console.school.since', { date: formatShortDate(member.startedOn) })}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('help.support.years_title')}>
          {years.length === 0 ? (
            <p className="text-muted">{t('help.support.years_empty')}</p>
          ) : (
            <ul className="divide-y">
              {years.map((year) => (
                <li key={year.publicId} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="font-semibold">{year.name}</span>
                  {year.startsOn && year.endsOn && (
                    <span className="text-sm text-muted">
                      {formatRange(year.startsOn, year.endsOn)}
                    </span>
                  )}
                  <StatusChip tone={year.closed ? 'neutral' : 'ok'}>
                    {year.closed ? t('help.support.year_closed') : t('help.support.year_open')}
                  </StatusChip>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('help.support.classes_title')}>
          {classes.length === 0 ? (
            <p className="text-muted">{t('help.support.classes_empty')}</p>
          ) : (
            <ul className="divide-y">
              {classes.map((row) => (
                <li key={row.publicId} className="py-2.5">
                  <p className="font-semibold">
                    {t('help.support.class_name', { grade: row.grade, name: row.name })}{' '}
                    <span className="font-normal text-muted">· {row.yearName}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {row.homeroomName
                      ? t('help.support.homeroom', { name: row.homeroomName })
                      : t('help.support.no_homeroom')}{' '}
                    · {t('help.support.assignments', { count: row.assignments })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('help.support.events_title')} className="lg:col-span-2">
          {events.length === 0 ? (
            <p className="text-muted">{t('help.support.events_empty')}</p>
          ) : (
            <ul className="divide-y">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap gap-x-3 py-2.5">
                  <span className="font-semibold break-words">{event.title}</span>
                  {event.startsOn && event.endsOn && (
                    <span className="text-sm text-muted">
                      {formatRange(event.startsOn, event.endsOn)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}
