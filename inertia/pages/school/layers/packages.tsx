import { Form } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
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
      <PageHeader title={t('layers.packages.title')} description={t('layers.packages.intro')} />
      <div className="rounded-lg border bg-surface p-4 text-sm">
        <p className="font-semibold break-words">{t('layers.packages.region', { area })}</p>
        <p className="text-muted">{t('layers.packages.region_hint')}</p>
        {!region.district && (
          <p className="mt-2 rounded-md border border-warn/35 bg-warn-tint p-2.5 text-text">
            {t('layers.packages.no_district')}
          </p>
        )}
      </div>

      {notices.length > 0 && <NoticeList notices={notices} />}

      <section aria-labelledby="official-title" className="mt-8">
        <h2 id="official-title" className="text-lg font-bold">
          {t('layers.packages.official_title')}
        </h2>
        {official.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="packages"
            description={t('layers.packages.official_empty')}
          />
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {official.map((pkg) => (
              <li key={pkg.id} className="rounded-lg border bg-surface p-4">
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
          <EmptyState
            className="mt-3"
            icon="packages"
            description={t('layers.packages.agreement_empty')}
          />
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {agreements.map((pkg) => (
              <li key={pkg.id} className="flex flex-col rounded-lg border bg-surface p-4">
                <PackageSummary pkg={pkg} />
                {pkg.chosen && (
                  <p className="mt-3 text-sm font-semibold text-ok">
                    {t('layers.packages.followed_since', { date: formatDate(pkg.chosen.since) })}
                    {pkg.chosen.by
                      ? `, ${t('layers.packages.followed_by', { name: pkg.chosen.by })}`
                      : ''}
                  </p>
                )}
                {canEdit && pkg.chosen && (
                  <div className="mt-auto pt-3">
                    <ConfirmAction
                      action={`/paket-daerah/${pkg.id}/berhenti`}
                      label={t('layers.packages.unfollow')}
                      className="w-full sm:w-auto"
                      title={t('layers.packages.unfollow_confirm_title', { package: pkg.name })}
                      description={t('layers.packages.unfollow_confirm_body')}
                      confirmLabel={t('layers.packages.unfollow')}
                    />
                  </div>
                )}
                {canEdit && !pkg.chosen && (
                  <Form
                    action={`/paket-daerah/${pkg.id}/ikuti`}
                    method="post"
                    options={{ preserveScroll: true }}
                    className="mt-auto pt-3"
                  >
                    {({ processing }) => (
                      <Button type="submit" disabled={processing} className="w-full sm:w-auto">
                        {t('layers.packages.follow')}
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
            className="flex flex-col gap-2 rounded-md border border-info/30 bg-info-tint p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
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
