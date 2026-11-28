import { useState, type ReactNode } from 'react'
import { Form, Head } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Button } from '~/components/ui/button'
import { TextField } from '~/components/text_field'
import { LayerNav } from '~/components/layers/layer_nav'
import { SourceBadge } from '~/components/layers/source_badge'
import { useSourceLabel, type LayerOwner, type LayerSource } from '~/components/layers/source'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

type Item = {
  key: string
  label: string
  category: string | null
  description: string | null
  offeredByDefault: boolean
  groupKey: string | null
  own: boolean
  source: LayerSource
}

type HiddenItem = Item & {
  hiddenBy: LayerOwner & { reason: string | null; own: boolean }
}

type Props = {
  schoolYear: string
  role: 'operator' | 'principal' | 'teacher'
  canEdit: boolean
  canPropose: boolean
  ready: boolean
  categories: string[]
  groups: { key: string; label: string; min: number }[]
  items: Item[]
  hidden: HiddenItem[]
}

const fieldClass =
  'block h-11 w-full rounded-md border bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30'

/**
 * Ekstrakurikuler (R1-07 proof domain of the layer model): "Dipakai" and
 * "Tidak dipakai", a source badge on every row, the operator's own
 * changes and everyone else's proposals.
 */
export default function Extracurriculars(props: Props) {
  const t = useT()
  const [tab, setTab] = useState<'used' | 'unused'>('used')
  const list = tab === 'used' ? props.items : props.hidden

  return (
    <>
      <Head title={t('layers.extracurricular.title')} />
      <LayerNav />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold">{t('layers.extracurricular.title')}</h1>
        <p className="text-sm text-muted">
          {t('layers.extracurricular.school_year', { year: props.schoolYear })}
        </p>
      </div>
      <p className="mt-2 max-w-3xl text-muted">{t('layers.extracurricular.intro')}</p>
      {props.canPropose && (
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {t('layers.extracurricular.intro_proposer')}
        </p>
      )}

      {!props.ready && (
        <p className="mt-4 rounded-md border border-warn/40 bg-warn/10 p-4">
          {t('layers.extracurricular.not_ready')}
        </p>
      )}

      {props.groups.map((group) => (
        <p key={group.key} className="mt-4 rounded-md bg-brand-tint p-3 text-sm text-brand-strong">
          {t('layers.list.group_note', { min: group.min, group: group.label })}
        </p>
      ))}

      <div
        role="tablist"
        aria-label={t('layers.extracurricular.title')}
        className="mt-6 flex gap-2"
      >
        {(['used', 'unused'] as const).map((name) => {
          const count = name === 'used' ? props.items.length : props.hidden.length
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap',
                tab === name
                  ? 'border-brand bg-brand-tint text-brand-strong'
                  : 'bg-surface text-muted'
              )}
            >
              {t(`layers.tabs.${name}`)}
              <span className="rounded-full bg-surface px-2 text-xs text-text">{count}</span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-4">
        {list.length === 0 ? (
          <p className="rounded-md border bg-surface p-4 text-muted">
            {t(tab === 'used' ? 'layers.list.empty_used' : 'layers.list.empty_unused')}
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {list.map((item) => (
              <li key={item.key}>
                <ItemCard {...props} item={item} isHidden={tab === 'unused'} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {(props.canEdit || props.canPropose) && <AddForm {...props} />}
    </>
  )
}

function ItemCard({
  item,
  isHidden: hidden,
  canEdit,
  canPropose,
}: Props & { item: Item | HiddenItem; isHidden: boolean }) {
  const t = useT()
  const sourceLabel = useSourceLabel()
  const hiddenBy = hidden ? (item as HiddenItem).hiddenBy : null
  const mandatory = item.source.force === 'mandatory'

  return (
    <article className="flex h-full flex-col rounded-xl border bg-surface p-4">
      <h3 className="font-bold break-words">{item.label}</h3>
      {item.category && (
        <p className="text-sm text-muted">
          {t(`layers.extracurricular.categories.${item.category}`)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <SourceBadge source={item.source} />
        {item.offeredByDefault && !hidden && (
          <span className="inline-flex min-h-7 items-center rounded-full border border-ok/30 bg-ok/10 px-2.5 text-xs font-semibold text-ok">
            {t('layers.list.offered_by_default')}
          </span>
        )}
      </div>
      {item.description && <p className="mt-2 text-sm">{item.description}</p>}
      {hiddenBy && (
        <div className="mt-2 text-sm">
          <p className="font-semibold">
            {t('layers.list.hidden_by', { source: sourceLabel(hiddenBy) })}
          </p>
          {hiddenBy.reason && (
            <p className="text-muted">
              {t('layers.list.hidden_reason', { reason: hiddenBy.reason })}
            </p>
          )}
        </div>
      )}
      {mandatory && <p className="mt-2 text-sm text-muted">{t('layers.list.mandatory_note')}</p>}

      <div className="mt-auto pt-3">
        {hiddenBy && !hiddenBy.own ? (
          <p className="text-sm text-muted">
            {t('layers.list.managed_by', { source: sourceLabel(hiddenBy) })}
          </p>
        ) : canEdit ? (
          <OperatorActions item={item} hidden={hidden} />
        ) : canPropose && !mandatory && !(item.own && !hidden) ? (
          <ProposeAction item={item} hidden={hidden} />
        ) : null}
      </div>
    </article>
  )
}

function OperatorActions({ item, hidden }: { item: Item; hidden: boolean }) {
  const t = useT()
  if (hidden) {
    return (
      <Form
        action={`/ekstrakurikuler/${item.key}/pakai-lagi`}
        method="post"
        options={{ preserveScroll: true }}
      >
        {({ processing }) => (
          <Button
            type="submit"
            variant="outline"
            disabled={processing}
            className="w-full sm:w-auto"
          >
            {t('layers.list.unhide')}
          </Button>
        )}
      </Form>
    )
  }
  if (item.own) {
    return (
      <Form
        action={`/ekstrakurikuler/${item.key}/hapus`}
        method="post"
        options={{ preserveScroll: true }}
      >
        {({ processing }) => (
          <Button
            type="submit"
            variant="outline"
            disabled={processing}
            className="w-full sm:w-auto"
          >
            {t('layers.list.retire')}
          </Button>
        )}
      </Form>
    )
  }
  if (item.source.force === 'mandatory') return null
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-strong">
        {t('layers.list.hide')}
      </summary>
      <Form
        action={`/ekstrakurikuler/${item.key}/sembunyikan`}
        method="post"
        options={{ preserveScroll: true }}
        className="mt-2 flex flex-col gap-2"
      >
        {({ processing }) => (
          <>
            <label className="space-y-1.5">
              <span className="block font-semibold">{t('layers.list.hide_reason')}</span>
              <input name="reason" maxLength={300} className={fieldClass} />
            </label>
            <Button type="submit" disabled={processing} className="w-full sm:w-auto sm:self-start">
              {t('layers.list.hide_confirm')}
            </Button>
          </>
        )}
      </Form>
    </details>
  )
}

function ProposeAction({ item, hidden }: { item: Item; hidden: boolean }) {
  const t = useT()
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-strong">
        {t(hidden ? 'layers.list.propose_unhide' : 'layers.list.propose_hide')}
      </summary>
      <Form
        action="/ekstrakurikuler/usulan"
        method="post"
        options={{ preserveScroll: true }}
        className="mt-2 flex flex-col gap-2"
      >
        {({ processing }) => (
          <>
            <input type="hidden" name="action" value={hidden ? 'unhide' : 'hide'} />
            <input type="hidden" name="item_key" value={item.key} />
            <label className="space-y-1.5">
              <span className="block font-semibold">{t('layers.list.propose_reason')}</span>
              <input name="reason" maxLength={500} className={fieldClass} />
            </label>
            <Button type="submit" disabled={processing} className="w-full sm:w-auto sm:self-start">
              {t('layers.list.send_proposal')}
            </Button>
          </>
        )}
      </Form>
    </details>
  )
}

function AddForm({ canEdit, categories }: Props) {
  const t = useT()
  return (
    <section aria-labelledby="add-title" className="mt-8 rounded-xl border bg-surface p-4 sm:p-6">
      <h2 id="add-title" className="text-lg font-bold">
        {t(canEdit ? 'layers.add.title_operator' : 'layers.add.title_proposer')}
      </h2>
      <Form
        action={canEdit ? '/ekstrakurikuler' : '/ekstrakurikuler/usulan'}
        method="post"
        options={{ preserveScroll: true }}
        resetOnSuccess
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        {({ processing, errors }) => (
          <>
            {!canEdit && <input type="hidden" name="action" value="add" />}
            <TextField
              name="label"
              label={t('layers.add.label')}
              required
              maxLength={160}
              error={errors.label}
            />
            <label className="space-y-1.5">
              <span className="block text-sm font-semibold">{t('layers.add.category')}</span>
              <select name="category" className={fieldClass} defaultValue="">
                <option value="">{t('layers.add.category_none')}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {t(`layers.extracurricular.categories.${category}`)}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <TextField
                name="description"
                label={t('layers.add.description')}
                maxLength={500}
                error={errors.description}
              />
            </div>
            <label className="flex min-h-11 items-start gap-3 sm:col-span-2">
              <input type="checkbox" name="scouting" value="true" className="mt-1 size-5" />
              <span>
                <span className="block font-semibold">{t('layers.add.scouting')}</span>
                <span className="block text-sm text-muted">{t('layers.add.scouting_hint')}</span>
              </span>
            </label>
            {!canEdit && (
              <div className="sm:col-span-2">
                <TextField name="reason" label={t('layers.list.propose_reason')} maxLength={500} />
              </div>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={processing} className="w-full sm:w-auto">
                {t(canEdit ? 'layers.add.submit_operator' : 'layers.add.submit_proposer')}
              </Button>
            </div>
          </>
        )}
      </Form>
    </section>
  )
}

Extracurriculars.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
