import { Form } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { useSourceLabel } from '~/components/layers/source'
import { formatDate, formatRange } from '~/lib/dates'
import { useT } from '~/lib/i18n'

type Problem = { key: string; values?: Record<string, string | number> }

type DataFile =
  | {
      file: string
      kind: 'holidays'
      ok: boolean
      problems: Problem[]
      summary: {
        code: string | null
        checkedOn: string | null
        officialSources: number
        decrees: string[]
        days: number
        differences: number
        years: string[]
      }
    }
  | {
      file: string
      kind: 'region'
      ok: boolean
      problems: Problem[]
      summary: {
        code: string | null
        name: string | null
        area: string | null
        schoolYear: string | null
        decree: string | null
        events: number
        notes: number
        schoolDays: number
      }
    }

type Package = {
  id: string
  code: string
  name: string
  layer: 'national' | 'province' | 'regency' | 'district'
  area: { name: string; kind: string } | null
  status: 'draft' | 'active' | 'retired'
  version: number
  schoolYears: string
  openEnded: boolean
  items: {
    key: string
    kind: string
    examType: string | null
    title: string
    startsOn: string | null
    endsOn: string | null
    mandatory: boolean
    value: string | null
  }[]
  hides: string[]
}

type Props = {
  canImport: boolean
  canActivate: boolean
  files: DataFile[]
  packages: Package[]
}

/**
 * Kalender on admin. (D-253, D-254, D-323): the repository's calendar
 * data with its check, import as draft, and activation after Tim
 * Validasi's sign-off.
 */
export default function ConsoleCalendar({ canImport, canActivate, files, packages }: Props) {
  const t = useT()
  const sourceLabel = useSourceLabel()

  return (
    <>
      <PageHeader title={t('calendar.console.title')} description={t('calendar.console.intro')} />

      <section aria-labelledby="files-title">
        <h2 id="files-title" className="text-lg font-bold">
          {t('calendar.console.files_title')}
        </h2>
        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {files.map((file) => (
            <li key={file.file} className="flex flex-col rounded-lg border bg-surface p-4">
              <p className="text-sm text-muted">
                {t(
                  file.kind === 'holidays'
                    ? 'calendar.console.file_holidays'
                    : 'calendar.console.file_region'
                )}
              </p>
              <h3 className="font-bold break-words">
                {file.kind === 'region'
                  ? (file.summary.name ?? file.file)
                  : (file.summary.code ?? file.file)}
              </h3>
              <p className="text-xs break-all text-muted">{file.file}</p>
              <div className="mt-2">
                <StatusChip tone={file.ok ? 'ok' : 'danger'} icon>
                  {t(file.ok ? 'calendar.console.check_ok' : 'calendar.console.check_problems')}
                </StatusChip>
              </div>
              {file.kind === 'holidays' ? (
                <ul className="mt-1 space-y-0.5 text-sm">
                  {file.summary.checkedOn && (
                    <li>
                      {t('calendar.console.checked_on', {
                        date: formatDate(file.summary.checkedOn),
                      })}
                    </li>
                  )}
                  <li>
                    {t('calendar.console.official_sources', {
                      count: file.summary.officialSources,
                    })}
                  </li>
                  <li className="break-words">{file.summary.decrees.join('; ')}</li>
                  <li>{t('calendar.console.days', { count: file.summary.days })}</li>
                  <li>{t('calendar.console.differences', { count: file.summary.differences })}</li>
                </ul>
              ) : (
                <ul className="mt-1 space-y-0.5 text-sm">
                  {file.summary.decree && <li className="break-words">{file.summary.decree}</li>}
                  {file.summary.schoolYear && (
                    <li>
                      {t('calendar.console.school_years', { years: file.summary.schoolYear })}
                    </li>
                  )}
                  <li>
                    {t('calendar.console.events', {
                      count: file.summary.events,
                      notes: file.summary.notes,
                      days: file.summary.schoolDays,
                    })}
                  </li>
                </ul>
              )}
              {file.problems.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-danger">
                  {file.problems.slice(0, 6).map((problem, index) => (
                    <li key={index}>
                      {t(`calendar.console.problems.${problem.key}`, problem.values ?? {})}
                    </li>
                  ))}
                </ul>
              )}
              {canImport && (
                <Form
                  action="/kalender/impor"
                  method="post"
                  options={{ preserveScroll: true }}
                  className="mt-auto pt-3"
                >
                  {({ processing }) => (
                    <>
                      <input type="hidden" name="file" value={file.file} />
                      <Button
                        type="submit"
                        disabled={processing || !file.ok}
                        className="w-full sm:w-auto"
                      >
                        {t('calendar.console.import')}
                      </Button>
                    </>
                  )}
                </Form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="packages-title" className="mt-8">
        <h2 id="packages-title" className="text-lg font-bold">
          {t('calendar.console.packages_title')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('calendar.console.changes_hint')}</p>
        {!canActivate && (
          <p className="mt-1 text-sm text-muted">{t('calendar.console.approver_only')}</p>
        )}
        {packages.length === 0 ? (
          <EmptyState
            icon="calendar"
            description={t('calendar.console.packages_empty')}
            className="mt-3"
          />
        ) : (
          <ul className="mt-3 space-y-3">
            {packages.map((pkg) => (
              <li key={pkg.id} className="rounded-lg border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold break-words">{pkg.name}</h3>
                    <p className="text-sm text-muted">
                      {sourceLabel({
                        layer: pkg.layer,
                        regionName: pkg.area?.name ?? null,
                        regionKind: pkg.area?.kind ?? null,
                        packageKind: pkg.layer === 'national' ? 'base' : 'official',
                        origin: 'official',
                      })}
                      {' · '}
                      {pkg.openEnded
                        ? t('calendar.console.open_ended', { year: pkg.schoolYears })
                        : t('calendar.console.school_years', { years: pkg.schoolYears })}
                      {' · '}
                      {t('calendar.console.version', { version: pkg.version })}
                    </p>
                  </div>
                  <StatusChip
                    tone={
                      pkg.status === 'active' ? 'ok' : pkg.status === 'draft' ? 'warn' : 'neutral'
                    }
                  >
                    {t(`calendar.console.status.${pkg.status}`)}
                  </StatusChip>
                </div>
                <p className="mt-1 text-sm">
                  {t('calendar.console.items', { count: pkg.items.length })}
                  {pkg.hides.length > 0 && (
                    <> · {t('calendar.console.hides', { count: pkg.hides.length })}</>
                  )}
                </p>
                {pkg.status === 'draft' && canActivate && (
                  <Form
                    action={`/kalender/paket/${pkg.id}/aktifkan`}
                    method="post"
                    options={{ preserveScroll: true }}
                    className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
                  >
                    {({ processing }) => (
                      <>
                        <Button type="submit" disabled={processing} className="w-full sm:w-auto">
                          {t('calendar.console.activate')}
                        </Button>
                        <span className="text-sm text-muted">
                          {t('calendar.console.activate_hint')}
                        </span>
                      </>
                    )}
                  </Form>
                )}
                <details className="mt-2 text-sm">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-strong">
                    {t('calendar.console.show_items')}
                  </summary>
                  <ul className="mt-2 divide-y rounded-md border">
                    {pkg.items.map((item) => (
                      <li
                        key={item.key}
                        className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3"
                      >
                        <span className="text-muted tabular-nums sm:w-56 sm:shrink-0">
                          {item.startsOn
                            ? formatRange(item.startsOn, item.endsOn ?? item.startsOn)
                            : t('calendar.console.setting')}
                        </span>
                        <span className="min-w-0 flex-1 break-words">
                          {item.title}
                          {item.value && <>: {item.value}</>}
                          {item.kind !== 'setting' && (
                            <span className="text-muted">
                              {' '}
                              · {t(`calendar.kinds.${item.kind}`)}
                            </span>
                          )}
                          {item.mandatory && (
                            <span className="text-muted"> · {t('calendar.console.mandatory')}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
