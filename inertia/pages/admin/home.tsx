import { Link, usePage } from '@inertiajs/react'
import { Icon, type IconName } from '~/components/icon'
import { PageHeader } from '~/components/patterns/page_header'
import { DeferredSection, SkeletonCards } from '~/components/patterns/skeletons'
import { formatNumber } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { consoleNav, groupBySection } from '~/lib/navigation'
import { cn } from '~/lib/utils'

type AttentionKey =
  | 'help_new'
  | 'problems_new'
  | 'problems_triaged'
  | 'curriculum_signoff'
  | 'curriculum_publish'
  | 'failed_jobs'

type AttentionItem = { key: AttentionKey; count: number; href: string }

type Props = {
  /** Deferred: the counts the viewer's roles can act on. */
  attention?: AttentionItem[]
}

const attentionIcons: Record<AttentionKey, IconName> = {
  help_new: 'support',
  problems_new: 'problem',
  problems_triaged: 'problem',
  curriculum_signoff: 'curriculum',
  curriculum_publish: 'curriculum',
  failed_jobs: 'health',
}

function Attention({ items }: { items: AttentionItem[] }) {
  const t = useT()
  if (items.length === 0) return null
  const waiting = items.filter((item) => item.count > 0)

  return (
    <section aria-labelledby="attention-title" className="mb-8">
      <h2 id="attention-title" className="text-xl font-bold">
        {t('console.home.attention_title')}
      </h2>
      {waiting.length === 0 && (
        <p className="mt-1 text-sm text-muted">{t('console.home.attention_empty')}</p>
      )}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              prefetch
              data-testid={`attention-${item.key}`}
              className={cn(
                'flex min-h-20 items-center gap-4 rounded-lg border bg-surface p-4 hover:border-brand hover:bg-brand-tint',
                item.count > 0 && 'border-warn/45'
              )}
            >
              <span
                className={cn(
                  'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
                  item.count > 0 ? 'bg-warn-tint text-warn' : 'bg-ok-tint text-ok'
                )}
              >
                <Icon name={attentionIcons[item.key]} />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-bold tabular-nums">
                  {formatNumber(item.count)}
                </span>
                <span className="block text-sm font-medium">
                  {t(`console.home.attention.${item.key}`)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Konsol home (R2-09): "Perlu ditindaklanjuti" with the counts the
 * viewer's roles act on, then every console page they may open,
 * grouped like the sidebar.
 */
export default function AdminHome({ attention }: Props) {
  const t = useT()
  const { viewer, staffAbilities } = usePage().props
  const groups = groupBySection(consoleNav(staffAbilities).filter((item) => item.href !== '/'))

  return (
    <>
      <PageHeader
        title={t('areas.admin.title')}
        description={t('areas.admin.greeting', { name: viewer?.name ?? '' })}
      >
        <p className="mt-1 max-w-3xl text-muted">{t('console.home.intro')}</p>
      </PageHeader>

      <DeferredSection
        data="attention"
        fallback={<SkeletonCards cards={3} className="mb-8 lg:grid-cols-3" />}
      >
        <Attention items={attention ?? []} />
      </DeferredSection>

      <div className="space-y-6">
        {groups.map((group) => (
          <section
            key={group.section ?? 'main'}
            aria-label={group.section ? t(group.section) : undefined}
          >
            {group.section && (
              <h2 className="mb-2 text-sm font-semibold text-muted">{t(group.section)}</h2>
            )}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    prefetch
                    className="flex min-h-14 items-center gap-3 rounded-lg border bg-surface p-4 font-semibold hover:border-brand hover:bg-brand-tint hover:text-brand-strong"
                  >
                    <Icon name={item.icon} />
                    {t(item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
