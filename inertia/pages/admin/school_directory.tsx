import { Form } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useRegionLabel, type RegionRef } from '~/components/regions/region_nav'
import { formatDate } from '~/lib/dates'
import { formatNumber } from '~/lib/format'
import { useT } from '~/lib/i18n'

type Lookup = {
  npsn: string
  name: string
  level: 'sd' | 'mi'
  address: string
  village: string | null
  province: string
  regency: RegionRef | null
  regencyName: string
  district: RegionRef | null
  districtName: string
  latitude: number | null
  longitude: number | null
  fetchedOn: string
  removed: boolean
  school: { id: number; name: string } | null
}

type RegencyRow = {
  regency: string
  province: string
  code: string | null
  total: number
  sd: number
  mi: number
  withoutDistrict: number
  customers: number
  fetchedOn: string
}

type Props = {
  query: string
  invalid: boolean
  result: Lookup | null
  regencies: RegencyRow[]
}

/**
 * Direktori Sekolah (staff console): NPSN lookup showing what the
 * school form fills (D-169), and the directory size per kabupaten/kota.
 */
export default function SchoolDirectory({ query, invalid, result, regencies }: Props) {
  const t = useT()
  const label = useRegionLabel()
  const notFound = query !== '' && !invalid && result === null

  return (
    <>
      <PageHeader title={t('regions.directory.title')} description={t('regions.directory.intro')} />

      <Form
        action="/direktori-sekolah"
        method="get"
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
      >
        {({ processing }) => (
          <>
            <div className="sm:w-72">
              <TextField
                label={t('regions.directory.search_label')}
                name="npsn"
                defaultValue={query}
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                hint={t('regions.directory.search_hint')}
                error={invalid ? t('regions.directory.invalid') : undefined}
              />
            </div>
            <Button type="submit" disabled={processing} className="sm:mt-7">
              {t('regions.directory.search')}
            </Button>
          </>
        )}
      </Form>

      {notFound && (
        <p role="status" className="mt-4 rounded-md border bg-surface p-4">
          {t('regions.directory.not_found')}
        </p>
      )}

      {result && (
        <section
          aria-labelledby="directory-result"
          className="mt-6 rounded-lg border bg-surface p-4 sm:p-6"
        >
          <h2 id="directory-result" className="text-lg font-bold">
            {t('regions.directory.result_title')}
          </h2>
          {result.school && (
            <p className="mt-2 rounded-md bg-brand-tint p-3 text-sm text-brand-strong">
              {t('regions.directory.already_registered', { name: result.school.name })}
            </p>
          )}
          {result.removed && (
            <p className="mt-2 rounded-md border border-warn/35 bg-warn-tint p-3 text-sm">
              {t('regions.directory.removed')}
            </p>
          )}
          <dl className="mt-4 space-y-3 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-x-6 sm:gap-y-3 sm:space-y-0">
            <Row term={t('regions.directory.search_label')} value={result.npsn} />
            <Row term={t('regions.directory.fields.name')} value={result.name} />
            <Row
              term={t('regions.directory.fields.level')}
              value={t(`regions.levels.${result.level}`)}
            />
            <Row term={t('regions.directory.fields.address')} value={result.address} />
            <Row
              term={t('regions.directory.fields.village')}
              value={result.village ?? t('regions.directory.empty_value')}
            />
            <Row
              term={t('regions.directory.fields.district')}
              value={
                result.district
                  ? label(result.district)
                  : t('regions.directory.district_unmatched', { name: result.districtName })
              }
            />
            <Row
              term={t('regions.directory.fields.regency')}
              value={
                result.regency
                  ? label(result.regency)
                  : t('regions.directory.regency_unmatched', { name: result.regencyName })
              }
            />
            <Row term={t('regions.directory.fields.province')} value={result.province} />
            <Row
              term={t('regions.directory.fields.location')}
              value={
                result.latitude !== null && result.longitude !== null
                  ? `${formatNumber(result.latitude, { decimals: 4 })}; ${formatNumber(result.longitude, { decimals: 4 })}`
                  : t('regions.directory.empty_value')
              }
            />
            <Row
              term={t('regions.directory.fields.fetched_on')}
              value={formatDate(result.fetchedOn)}
            />
          </dl>
        </section>
      )}

      <section aria-labelledby="directory-summary" className="mt-8">
        <h2 id="directory-summary" className="text-lg font-bold">
          {t('regions.directory.summary_title')}
        </h2>
        {regencies.length === 0 ? (
          <p className="mt-2 text-muted">{t('regions.directory.empty')}</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regencies.map((row) => (
              <li key={row.regency} className="rounded-lg border bg-surface p-4">
                <p className="font-bold">{row.regency}</p>
                <p className="text-sm text-muted">
                  {row.province}
                  {row.code ? ` · ${row.code}` : ''}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Stat term={t('regions.directory.summary.total')} value={row.total} />
                  <Stat term={t('regions.directory.summary.customers')} value={row.customers} />
                  <Stat term={t('regions.directory.summary.sd')} value={row.sd} />
                  <Stat term={t('regions.directory.summary.mi')} value={row.mi} />
                  {row.withoutDistrict > 0 && (
                    <Stat
                      term={t('regions.directory.summary.without_district')}
                      value={row.withoutDistrict}
                    />
                  )}
                </dl>
                <p className="mt-3 text-xs text-muted">
                  {t('regions.directory.summary.fetched_on')}: {formatDate(row.fetchedOn)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="sm:contents">
      <dt className="text-sm font-semibold text-muted">{term}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )
}

function Stat({ term, value }: { term: string; value: number }) {
  return (
    <div>
      <dt className="text-muted">{term}</dt>
      <dd className="text-lg font-bold tabular-nums">{formatNumber(value)}</dd>
    </div>
  )
}
