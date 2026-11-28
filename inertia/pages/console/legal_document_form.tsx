import { useState } from 'react'
import { router, useForm } from '@inertiajs/react'
import { ConfirmDialog } from '~/components/patterns/confirm_dialog'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { MarkdownEditor } from '~/components/publishing/markdown_editor'
import { RichText } from '~/components/publishing/rich_text'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { formatDate } from '~/lib/dates'
import { useT } from '~/lib/i18n'
import { renderMarkdown } from '~/lib/markdown'

type LegalDocument = {
  id: number
  key: string
  version: number
  title: string
  body: string
  effectiveOn: string
  changeNote: string
  status: 'draft' | 'published'
  publishedAt: string | null
  publicUrl: string | null
}

/**
 * Konsol /halaman-legal/versi/{id} (R2-05, D-435): a draft version is
 * edited and published with its "berlaku sejak" date; a published
 * version is shown read-only (it never changes again). Ability
 * `legal_pages.manage`.
 */
export default function ConsoleLegalDocumentForm({ document }: { document: LegalDocument }) {
  const t = useT()
  const page = t(`publishing.legal.titles.${document.key}`)
  const draft = document.status === 'draft'
  const [confirm, setConfirm] = useState<'publish' | 'discard' | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useForm({
    title: document.title,
    body: document.body,
    effective_on: document.effectiveOn,
    change_note: document.changeNote,
  })
  const errors = form.errors as Record<string, string | undefined>
  const base = `/halaman-legal/versi/${document.id}`

  const save = () => {
    form.transform((data) => ({
      ...data,
      change_note: data.change_note.trim() === '' ? undefined : data.change_note,
    }))
    form.post(base, { preserveScroll: true })
  }

  const act = (suffix: 'terbitkan' | 'hapus') =>
    router.post(
      `${base}/${suffix}`,
      {},
      {
        onStart: () => setBusy(true),
        onFinish: () => {
          setBusy(false)
          setConfirm(null)
        },
      }
    )

  return (
    <>
      <PageHeader
        title={t('publishing.legal.form.edit_title', { page, version: document.version })}
        back={{ href: '/halaman-legal', label: t('publishing.legal.form.back') }}
        meta={
          <StatusChip tone={draft ? 'neutral' : 'ok'}>
            {t(`publishing.statuses.${document.status}`)}
          </StatusChip>
        }
      >
        <p className="mt-3 flex max-w-3xl gap-2 rounded-md border border-warn/35 bg-warn-tint p-3 text-sm text-warn">
          <Icon name="warning" size={18} className="mt-0.5" />
          <span>
            {t(draft ? 'publishing.legal.form.review_note' : 'publishing.legal.form.locked')}
          </span>
        </p>
      </PageHeader>

      {draft ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <Section title={page}>
            <div className="space-y-4">
              <TextField
                label={t('publishing.form.title')}
                name="title"
                required
                maxLength={200}
                value={form.data.title}
                onChange={(event) => form.setData('title', event.target.value)}
                error={errors.title}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t('publishing.legal.form.effective_on')}
                  name="effective_on"
                  type="date"
                  required
                  value={form.data.effective_on}
                  onChange={(event) => form.setData('effective_on', event.target.value)}
                  hint={t('publishing.legal.form.effective_on_hint')}
                  error={errors.effective_on}
                />
                <TextField
                  label={t('publishing.legal.form.change_note')}
                  name="change_note"
                  maxLength={300}
                  value={form.data.change_note}
                  onChange={(event) => form.setData('change_note', event.target.value)}
                  hint={t('publishing.legal.form.change_note_hint')}
                  error={errors.change_note}
                />
              </div>
              <MarkdownEditor
                label={t('publishing.form.body')}
                name="body"
                value={form.data.body}
                onChange={(value) => form.setData('body', value)}
                rows={20}
                error={errors.body}
              />
            </div>
          </Section>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Button type="submit" disabled={form.processing}>
              {t('publishing.legal.form.save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={form.processing || form.isDirty}
              onClick={() => setConfirm('publish')}
            >
              {t('publishing.legal.form.publish', { version: document.version })}
            </Button>
            <div className="hidden flex-1 sm:block" />
            <Button type="button" variant="ghost" onClick={() => setConfirm('discard')}>
              <Icon name="delete" size={18} />
              {t('publishing.legal.form.discard')}
            </Button>
          </div>
        </form>
      ) : (
        <Section
          title={document.title}
          description={t('publishing.legal.list.effective', {
            date: formatDate(document.effectiveOn),
          })}
          actions={
            document.publicUrl && (
              <Button asChild variant="ghost">
                <a href={document.publicUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={18} />
                  {t('publishing.form.public_link')}
                </a>
              </Button>
            )
          }
        >
          {document.changeNote && <p className="mb-4 text-sm text-muted">{document.changeNote}</p>}
          <RichText html={renderMarkdown(document.body)} />
        </Section>
      )}

      <ConfirmDialog
        open={confirm === 'publish'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('publishing.legal.form.publish_title', { version: document.version })}
        description={t('publishing.legal.form.publish_body')}
        confirmLabel={t('publishing.legal.form.publish', { version: document.version })}
        processing={busy}
        onConfirm={() => act('terbitkan')}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('publishing.legal.form.discard_title')}
        description={t('publishing.legal.form.discard_body')}
        confirmLabel={t('publishing.legal.form.discard')}
        destructive
        processing={busy}
        onConfirm={() => act('hapus')}
      />
    </>
  )
}
