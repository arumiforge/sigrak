import { useState } from 'react'
import { Form, Link, useForm } from '@inertiajs/react'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { EmptyState } from '~/components/patterns/empty_state'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { ResponsiveDialog } from '~/components/patterns/responsive_dialog'
import { StatusChip } from '~/components/patterns/status_chip'
import { TextField } from '~/components/text_field'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

type Practice = {
  id: number
  title: string
  summary: string
  type: string
  authors: string[]
  link: string | null
  level: string | null
  year: number | null
  problem: { id: number; number: string; title: string } | null
  addedBy: string | null
  createdAt: string
}

type Props = {
  filters: { type: string; search: string }
  practices: Practice[]
  types: string[]
  levels: string[]
  problems: { id: number; number: string; title: string }[]
  can: { manage: boolean; viewProblems: boolean }
}

/**
 * Konsol /bank-praktik-baik (R2-07, D-439): good practice, PTK,
 * skripsi, seminars and webinars, each with its authors credited and
 * a link. `good_practices.view` reads; `good_practices.manage` (Tim
 * Kurikulum & Riset) adds, edits and removes.
 */
export default function ConsoleGoodPractices({
  filters,
  practices,
  types,
  levels,
  problems,
  can,
}: Props) {
  const t = useT()
  const [editing, setEditing] = useState<Practice | 'new' | null>(null)

  return (
    <>
      <PageHeader
        title={t('problems.practices.title')}
        description={t('problems.practices.intro')}
        actions={
          can.manage && (
            <Button onClick={() => setEditing('new')} data-testid="add-practice">
              <Icon name="add" />
              {t('problems.practices.add')}
            </Button>
          )
        }
      />

      <Form
        action="/bank-praktik-baik"
        method="get"
        className="mb-6 grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-end"
      >
        <TextField
          label={t('problems.practices.search')}
          name="cari"
          type="search"
          defaultValue={filters.search}
          maxLength={100}
        />
        <FormField label={t('problems.practices.type')}>
          {(field) => (
            <select {...field} name="jenis" defaultValue={filters.type} className={controlClass}>
              <option value="">{t('problems.practices.all_types')}</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {t(`problems.practices.types.${type}`)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t('problems.list.apply')}</Button>
          {(filters.type || filters.search) && (
            <Button asChild variant="ghost">
              <Link href="/bank-praktik-baik">{t('problems.list.reset')}</Link>
            </Button>
          )}
        </div>
      </Form>

      {practices.length === 0 ? (
        <EmptyState icon="practice" description={t('problems.practices.empty')} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {practices.map((practice) => (
            <li
              key={practice.id}
              className="flex min-w-0 flex-col rounded-lg border bg-surface p-4"
              data-testid="practice"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="brand">
                  {t(`problems.practices.types.${practice.type}`)}
                </StatusChip>
                {practice.level && (
                  <StatusChip>{t(`problems.levels.${practice.level}`)}</StatusChip>
                )}
                {practice.year && <span className="text-sm text-muted">{practice.year}</span>}
              </div>
              <h2 className="mt-2 text-lg font-bold break-words">{practice.title}</h2>
              <p className="text-sm text-muted">
                {t('problems.practices.by', { names: practice.authors.join(', ') })}
              </p>
              <p className="mt-2 break-words whitespace-pre-line">{practice.summary}</p>
              {practice.problem && (
                <p className="mt-2 text-sm">
                  {t('problems.practices.for_problem')}{' '}
                  {can.viewProblems ? (
                    <Link
                      href={`/bank-masalah/${practice.problem.id}`}
                      className="font-semibold text-brand-strong hover:underline"
                    >
                      {practice.problem.number}
                    </Link>
                  ) : (
                    practice.problem.number
                  )}{' '}
                  <span className="break-words">{practice.problem.title}</span>
                </p>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                {practice.link && (
                  <Button asChild variant="outline" size="sm">
                    <a href={practice.link} target="_blank" rel="noopener noreferrer">
                      <Icon name="external" />
                      {t('problems.practices.open_link')}
                    </a>
                  </Button>
                )}
                {can.manage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(practice)}>
                      {t('problems.practices.edit')}
                    </Button>
                    <ConfirmAction
                      action={`/bank-praktik-baik/${practice.id}/hapus`}
                      label={t('problems.practices.delete')}
                      ariaLabel={t('problems.practices.delete_named', { title: practice.title })}
                      title={t('problems.practices.delete_named', { title: practice.title })}
                      description={t('problems.practices.delete_hint')}
                      confirmLabel={t('problems.practices.delete')}
                      variant="ghost"
                      size="sm"
                    />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {can.manage && editing && (
        <PracticeDialog
          key={editing === 'new' ? 'new' : editing.id}
          practice={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          types={types}
          levels={levels}
          problems={problems}
        />
      )}
    </>
  )
}

function PracticeDialog({
  practice,
  onClose,
  types,
  levels,
  problems,
}: {
  practice: Practice | null
  onClose: () => void
  types: string[]
  levels: string[]
  problems: Props['problems']
}) {
  const t = useT()
  const form = useForm({
    title: practice?.title ?? '',
    summary: practice?.summary ?? '',
    type: practice?.type ?? types[0] ?? 'practice',
    authors: practice?.authors.join('\n') ?? '',
    link: practice?.link ?? '',
    level: practice?.level ?? '',
    year: practice?.year ? String(practice.year) : '',
    problem_id: practice?.problem ? String(practice.problem.id) : '',
  })
  const action = practice ? `/bank-praktik-baik/${practice.id}/ubah` : '/bank-praktik-baik'

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={practice ? t('problems.practices.edit_title') : t('problems.practices.add_title')}
      description={t('problems.practices.form_intro')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" form="practice-form" disabled={form.processing}>
            {t('problems.practices.save')}
          </Button>
        </>
      }
    >
      <form
        id="practice-form"
        className="max-h-[60dvh] space-y-4 overflow-y-auto px-4 pb-2 sm:max-h-[65dvh] sm:px-0"
        onSubmit={(event) => {
          event.preventDefault()
          form.post(action, { preserveScroll: true, onSuccess: onClose })
        }}
      >
        <TextField
          label={t('problems.fields.title')}
          name="title"
          required
          maxLength={160}
          value={form.data.title}
          onChange={(event) => form.setData('title', event.target.value)}
          error={form.errors.title}
        />
        <FormField label={t('problems.practices.type')} error={form.errors.type}>
          {(field) => (
            <select
              {...field}
              name="type"
              value={form.data.type}
              onChange={(event) => form.setData('type', event.target.value)}
              className={controlClass}
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {t(`problems.practices.types.${type}`)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField
          label={t('problems.practices.authors')}
          hint={t('problems.practices.authors_hint')}
          error={form.errors.authors}
        >
          {(field) => (
            <textarea
              {...field}
              name="authors"
              required
              rows={2}
              value={form.data.authors}
              onChange={(event) => form.setData('authors', event.target.value)}
              className={cn(controlClass, 'py-2.5')}
            />
          )}
        </FormField>
        <FormField label={t('problems.practices.summary')} error={form.errors.summary}>
          {(field) => (
            <textarea
              {...field}
              name="summary"
              required
              maxLength={2000}
              rows={4}
              value={form.data.summary}
              onChange={(event) => form.setData('summary', event.target.value)}
              className={cn(controlClass, 'py-2.5')}
            />
          )}
        </FormField>
        <TextField
          label={t('problems.practices.link')}
          hint={t('problems.practices.link_hint')}
          name="link"
          type="url"
          inputMode="url"
          maxLength={500}
          value={form.data.link}
          onChange={(event) => form.setData('link', event.target.value)}
          error={form.errors.link}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('problems.fields.level')} error={form.errors.level}>
            {(field) => (
              <select
                {...field}
                name="level"
                value={form.data.level}
                onChange={(event) => form.setData('level', event.target.value)}
                className={controlClass}
              >
                <option value="">{t('problems.fields.all_levels')}</option>
                {levels.map((level) => (
                  <option key={level} value={level}>
                    {t(`problems.levels.${level}`)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <TextField
            label={t('problems.practices.year')}
            name="year"
            inputMode="numeric"
            maxLength={4}
            value={form.data.year}
            onChange={(event) => form.setData('year', event.target.value)}
            error={form.errors.year}
          />
        </div>
        <FormField
          label={t('problems.practices.problem')}
          hint={t('problems.practices.problem_hint')}
          error={form.errors.problem_id}
        >
          {(field) => (
            <select
              {...field}
              name="problem_id"
              value={form.data.problem_id}
              onChange={(event) => form.setData('problem_id', event.target.value)}
              className={controlClass}
            >
              <option value="">{t('problems.practices.no_problem')}</option>
              {problems.map((problem) => (
                <option key={problem.id} value={problem.id}>
                  {problem.number} · {problem.title}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </form>
    </ResponsiveDialog>
  )
}
