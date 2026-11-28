import type { ReactNode } from 'react'
import { Form, Head } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Button } from '~/components/ui/button'
import { LayerNav } from '~/components/layers/layer_nav'
import { SourceBadge } from '~/components/layers/source_badge'
import { useSourceLabel, type LayerSource } from '~/components/layers/source'
import { formatDate } from '~/lib/dates'
import { useT } from '~/lib/i18n'

type RegionLink = { id: number; name: string; kind: string | null }

type AreaPackage = {
  id: string
  domain: string
  name: string
  kind: 'official' | 'local_agreement'
  line: LayerSource['line']
  source: LayerSource
  chosen: { since: string; by: string | null } | null
}

type Notice = {
  id: string
  kind: string
  createdOn: string
  item: string | null
  label: string | null
  packageName: string | null
  actorName: string | null
  status: string | null
  schoolYear: string | null
  carriedPackages: string[]
  endedPackages: string[]
}

type Props = {
  schoolYear: string
  canEdit: boolean
  region: { province: RegionLink | null; regency: RegionLink | null; district: RegionLink | null }
  official: AreaPackage[]
  agreements: AreaPackage[]
  notices: Notice[]
}

/**
 * Paket daerah (§7, D-466): official packages apply by themselves; the
 * operator follows or leaves local agreements of the school's own areas,
 * and the principal is told.
 */
export default function Packages({ canEdit, region, official, agreements, notices }: Props) {
  const t = useT()
  const label = useSourceLabel()
  const area = [
    region.district
      ? label({
          layer: 'district',
          regionName: region.district.name,
          regionKind: null,
          packageKind: 'official',
        })
      : null,
    region.regency
      ? label({
          layer: 'regency',
          regionName: region.regency.name,
          regionKind: region.regency.kind,
          packageKind: 'official',
        })
      : null,
    region.province
      ? label({
          layer: 'province',
          regionName: region.province.name,
          regionKind: null,
          packageKind: 'official',
        })
      : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <Head title={t('layers.packages.title')} />
      <LayerNav />
      <h1 className="text-2xl font-bold">{t('layers.packages.title')}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t('layers.packages.intro')}</p>
      <div className="mt-4 rounded-md border bg-surface p-4 text-sm">
        <p className="font-semibold break-words">{t('layers.packages.region', { area })}</p>
        <p className="text-muted">{t('layers.packages.region_hint')}</p>
        {!region.district && <p className="mt-2 text-warn">{t('layers.packages.no_district')}</p>}
      </div>

      {notices.length > 0 && <NoticeList notices={notices} />}

      <section aria-labelledby="official-title" className="mt-8">
        <h2 id="official-title" className="text-lg font-bold">
          {t('layers.packages.official_title')}
        </h2>
        {official.length === 0 ? (
          <p className="mt-2 rounded-md border bg-surface p-4 text-muted">
            {t('layers.packages.official_empty')}
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {official.map((pkg) => (
              <li key={pkg.id} className="rounded-xl border bg-surface p-4">
                <PackageSummary pkg={pkg} />
                <p className="mt-3 text-sm font-semibold text-brand-strong">
                  {t('layers.packages.always_on')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="agreement-title" className="mt-8">
        <h2 id="agreement-title" className="text-lg font-bold">
          {t('layers.packages.agreement_title')}
        </h2>
        {!canEdit && (
          <p className="mt-1 text-sm text-muted">{t('layers.packages.operator_only')}</p>
        )}
        {agreements.length === 0 ? (
          <p className="mt-2 rounded-md border bg-surface p-4 text-muted">
            {t('layers.packages.agreement_empty')}
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {agreements.map((pkg) => (
              <li key={pkg.id} className="flex flex-col rounded-xl border bg-surface p-4">
                <PackageSummary pkg={pkg} />
                {pkg.chosen && (
                  <p className="mt-3 text-sm font-semibold text-ok">
                    {t('layers.packages.followed_since', { date: formatDate(pkg.chosen.since) })}
                    {pkg.chosen.by
                      ? `, ${t('layers.packages.followed_by', { name: pkg.chosen.by })}`
                      : ''}
                  </p>
                )}
                {canEdit && (
                  <Form
                    action={`/paket-daerah/${pkg.id}/${pkg.chosen ? 'berhenti' : 'ikuti'}`}
                    method="post"
                    options={{ preserveScroll: true }}
                    onBefore={() =>
                      !pkg.chosen || window.confirm(t('layers.packages.unfollow_confirm'))
                    }
                    className="mt-auto pt-3"
                  >
                    {({ processing }) => (
                      <Button
                        type="submit"
                        variant={pkg.chosen ? 'outline' : 'default'}
                        disabled={processing}
                        className="w-full sm:w-auto"
                      >
                        {t(pkg.chosen ? 'layers.packages.unfollow' : 'layers.packages.follow')}
                      </Button>
                    )}
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function PackageSummary({ pkg }: { pkg: AreaPackage }) {
  const t = useT()
  return (
    <>
      <h3 className="font-bold break-words">{pkg.name}</h3>
      <p className="text-sm text-muted">
        {t('layers.packages.domain', { domain: t(`layers.packages.domains.${pkg.domain}`) })}
      </p>
      <div className="mt-2">
        <SourceBadge source={pkg.source} />
      </div>
    </>
  )
}

function NoticeList({ notices }: { notices: Notice[] }) {
  const t = useT()
  const text = (notice: Notice) => {
    switch (notice.kind) {
      case 'became_mandatory':
        return t('layers.notices.became_mandatory', {
          item: notice.label ?? notice.item ?? '',
          package: notice.packageName ?? '',
        })
      case 'region_changed':
        return notice.endedPackages.length > 0
          ? t('layers.notices.region_changed', { packages: notice.endedPackages.join(', ') })
          : t('layers.notices.region_changed_none')
      case 'package_chosen':
      case 'package_left':
        return t(`layers.notices.${notice.kind}`, {
          name: notice.actorName ?? t('layers.notices.someone'),
          package: notice.packageName ?? '',
        })
      case 'package_retired':
        return t('layers.notices.package_retired', { package: notice.packageName ?? '' })
      case 'package_carried_over':
        return t('layers.notices.package_carried_over', {
          year: notice.schoolYear ?? '',
          packages: notice.carriedPackages.join(', '),
        })
      default:
        return t(
          notice.status === 'approved'
            ? 'layers.notices.proposal_decided_approved'
            : 'layers.notices.proposal_decided_rejected',
          { label: notice.label ?? '' }
        )
    }
  }
  return (
    <section aria-labelledby="notices-title" className="mt-6">
      <h2 id="notices-title" className="text-lg font-bold">
        {t('layers.notices.title')}
      </h2>
      <ul className="mt-3 space-y-2">
        {notices.map((notice) => (
          <li
            key={notice.id}
            className="flex flex-col gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              <span className="text-muted">{formatDate(notice.createdOn)} · </span>
              {text(notice)}
            </p>
            <Form
              action={`/pemberitahuan/${notice.id}/dibaca`}
              method="post"
              options={{ preserveScroll: true }}
            >
              {({ processing }) => (
                <Button
                  type="submit"
                  variant="ghost"
                  disabled={processing}
                  className="w-full sm:w-auto"
                >
                  {t('layers.notices.mark_read')}
                </Button>
              )}
            </Form>
          </li>
        ))}
      </ul>
    </section>
  )
}

Packages.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
