import { Form } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { useRegionLabel, type RegionRef } from '~/components/regions/region_nav'
import { formatDate } from '~/lib/dates'
import { useT } from '~/lib/i18n'

type Place = { regency: RegionRef; district: RegionRef | null }

type Change = {
  id: string
  status: 'pending' | 'accepted' | 'rejected' | 'superseded'
  school: { name: string; npsn: string | null }
  from: Place
  to: Place
  detectedOn: string
  applyFrom: 'next_day' | 'next_school_year' | null
  effectiveOn: string | null
  applied: boolean
  decidedBy: string | null
  note: string | null
}

type Props = {
  dates: { nextDay: string; nextSchoolYear: string }
  pending: Change[]
  scheduled: Change[]
  decided: Change[]
}

/**
 * Perubahan wilayah (staff console, D-466): region differences found
 * by a directory import. Nothing changes on the school until staff
 * accept, from tomorrow or from the next school year.
 */
export default function RegionChanges({ dates, pending, scheduled, decided }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader title={t('regions.changes.title')} description={t('regions.changes.intro')} />

      <section aria-labelledby="changes-pending">
        <h2 id="changes-pending" className="text-lg font-bold">
          {t('regions.changes.pending_title')}
        </h2>
        {pending.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="region"
            description={t('regions.changes.pending_empty')}
          />
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {t('regions.changes.accept_hint', {
                next_day: formatDate(dates.nextDay),
                next_school_year: formatDate(dates.nextSchoolYear),
              })}
            </p>
            <ul className="mt-3 space-y-3">
              {pending.map((change) => (
                <li key={change.id} className="rounded-lg border bg-surface p-4">
                  <ChangeSummary change={change} />
                  <Decision change={change} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {scheduled.length > 0 && (
        <section aria-labelledby="changes-scheduled" className="mt-8">
          <h2 id="changes-scheduled" className="text-lg font-bold">
            {t('regions.changes.scheduled_title')}
          </h2>
          <ul className="mt-3 space-y-3">
            {scheduled.map((change) => (
              <li key={change.id} className="rounded-lg border bg-surface p-4">
                <ChangeSummary change={change} />
                <p className="mt-3 text-sm font-semibold text-brand-strong">
                  {t('regions.changes.effective_on', { date: formatDate(change.effectiveOn!) })}
                </p>
                {change.decidedBy && (
                  <p className="text-sm text-muted">
                    {t('regions.changes.decided_by', { name: change.decidedBy })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {decided.length > 0 && (
        <section aria-labelledby="changes-decided" className="mt-8">
          <h2 id="changes-decided" className="text-lg font-bold">
            {t('regions.changes.decided_title')}
          </h2>
          <ul className="mt-3 space-y-3">
            {decided.map((change) => (
              <li key={change.id} className="rounded-lg border bg-surface p-4">
                <ChangeSummary change={change} />
                <p className="mt-3 text-sm font-semibold">
                  {change.status === 'rejected'
                    ? t('regions.changes.rejected')
                    : t('regions.changes.applied_on', { date: formatDate(change.effectiveOn!) })}
                </p>
                {change.note && <p className="text-sm text-muted">{change.note}</p>}
                {change.decidedBy && (
                  <p className="text-sm text-muted">
                    {t('regions.changes.decided_by', { name: change.decidedBy })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function ChangeSummary({ change }: { change: Change }) {
  const t = useT()

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-bold">{change.school.name}</h3>
        <p className="text-sm text-muted">
          {change.school.npsn
            ? t('regions.changes.npsn', { npsn: change.school.npsn })
            : t('regions.changes.no_npsn')}
        </p>
      </div>
      <p className="text-sm text-muted">
        {t('regions.changes.detected_on', { date: formatDate(change.detectedOn) })}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <PlaceBox title={t('regions.changes.from')} place={change.from} />
        <PlaceBox title={t('regions.changes.to')} place={change.to} highlight />
      </div>
    </>
  )
}

function PlaceBox({
  title,
  place,
  highlight = false,
}: {
  title: string
  place: Place
  highlight?: boolean
}) {
  const t = useT()
  const label = useRegionLabel()

  return (
    <div className={highlight ? 'rounded-md bg-brand-tint p-3' : 'rounded-md border p-3'}>
      <p className="text-xs font-semibold text-muted uppercase">{title}</p>
      <p className="mt-1 font-semibold">
        {place.district ? label(place.district) : t('regions.changes.no_district')}
      </p>
      <p className="text-sm">{label(place.regency)}</p>
    </div>
  )
}

function Decision({ change }: { change: Change }) {
  const t = useT()

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {(['next_day', 'next_school_year'] as const).map((applyFrom) => (
          <Form
            key={applyFrom}
            action={`/perubahan-wilayah/${change.id}/terima`}
            method="post"
            options={{ preserveScroll: true }}
          >
            {({ processing }) => (
              <>
                <input type="hidden" name="apply_from" value={applyFrom} />
                <Button
                  type="submit"
                  variant={applyFrom === 'next_day' ? 'default' : 'outline'}
                  disabled={processing}
                  className="w-full sm:w-auto"
                >
                  {t(
                    applyFrom === 'next_day'
                      ? 'regions.changes.accept_next_day'
                      : 'regions.changes.accept_next_school_year'
                  )}
                </Button>
              </>
            )}
          </Form>
        ))}
      </div>
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-danger">
          {t('regions.changes.reject')}
        </summary>
        <Form
          action={`/perubahan-wilayah/${change.id}/tolak`}
          method="post"
          options={{ preserveScroll: true }}
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          {({ processing }) => (
            <>
              <label className="flex-1 space-y-1.5">
                <span className="block font-semibold">{t('regions.changes.reject_note')}</span>
                <input
                  name="note"
                  maxLength={500}
                  className="block h-11 w-full rounded-md border bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
                />
              </label>
              <Button type="submit" variant="destructive" disabled={processing}>
                {t('regions.changes.reject')}
              </Button>
            </>
          )}
        </Form>
      </details>
    </div>
  )
}
