import { Link, router } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section } from '~/components/section'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { formatDate } from '~/lib/dates'
import { useT } from '~/lib/i18n'

type Version = {
  id: number
  version: number
  title: string
  status: 'draft' | 'published'
  effectiveOn: string
  publishedAt: string | null
}

type Page = {
  key: string
  publicUrl: string
  currentId: number | null
  versions: Version[]
}

/**
 * Konsol /halaman-legal (R2-05, D-435): the three legal pages of
 * sigrak.com with every version. A page has at most one draft; a
 * published version is kept as it is. Ability `legal_pages.manage`.
 */
export default function ConsoleLegalPages({ pages, today }: { pages: Page[]; today: string }) {
  const t = useT()

  const chip = (page: Page, version: Version) => {
    if (version.status === 'draft') {
      return <StatusChip tone="neutral">{t('publishing.statuses.draft')}</StatusChip>
    }
    if (version.id === page.currentId) {
      return (
        <StatusChip tone="ok" icon>
          {t('publishing.legal.list.current')}
        </StatusChip>
      )
    }
    if (version.effectiveOn > today) {
      return (
        <StatusChip tone="info">
          {t('publishing.legal.list.upcoming', { date: formatDate(version.effectiveOn) })}
        </StatusChip>
      )
    }
    return <StatusChip tone="neutral">{t('publishing.legal.list.older')}</StatusChip>
  }

  return (
    <>
      <PageHeader
        title={t('publishing.legal.list.title')}
        description={t('publishing.legal.list.intro')}
      >
        <p className="mt-3 flex max-w-3xl gap-2 rounded-md border border-warn/35 bg-warn-tint p-3 text-sm text-warn">
          <Icon name="warning" size={18} className="mt-0.5" />
          <span>{t('publishing.legal.list.review_note')}</span>
        </p>
      </PageHeader>

      <div className="space-y-6">
        {pages.map((page) => {
          const title = t(`publishing.legal.titles.${page.key}`)
          const draft = page.versions.find((version) => version.status === 'draft')
          return (
            <Section
              key={page.key}
              title={title}
              description={
                <a
                  href={page.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 font-semibold break-all text-brand-strong hover:underline"
                >
                  {page.publicUrl.replace(/^https?:\/\//, '')}
                  <Icon name="external" size={16} />
                </a>
              }
              actions={
                draft ? (
                  <Button asChild variant="outline">
                    <Link href={`/halaman-legal/versi/${draft.id}`} prefetch>
                      {t('publishing.legal.list.open_draft')}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => router.post(`/halaman-legal/${page.key}/versi-baru`)}
                  >
                    <Icon name="add" />
                    {t('publishing.legal.list.new_version')}
                  </Button>
                )
              }
            >
              {page.versions.length === 0 ? (
                <p className="text-sm text-muted">{t('publishing.legal.list.none')}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {page.versions.map((version) => (
                    <li
                      key={version.id}
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold">
                          {t('publishing.legal.list.version', { version: version.version })}
                        </p>
                        <p className="text-sm text-muted">
                          {t('publishing.legal.list.effective', {
                            date: formatDate(version.effectiveOn),
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {chip(page, version)}
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={`/halaman-legal/versi/${version.id}`}
                            prefetch
                            aria-label={t('publishing.legal.list.view_label', {
                              page: title,
                              version: version.version,
                            })}
                          >
                            {t('publishing.legal.list.view')}
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )
        })}
      </div>
    </>
  )
}
