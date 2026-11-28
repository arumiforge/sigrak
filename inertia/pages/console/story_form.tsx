import { useForm } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { MarkdownEditor } from '~/components/publishing/markdown_editor'
import { PostActions } from '~/components/publishing/post_actions'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'

type StoryData = {
  id: number
  slug: string
  title: string
  summary: string
  body: string
  schoolName: string
  consentNote: string
  consentOn: string
  status: 'draft' | 'published'
  publishedAt: string | null
  publicUrl: string | null
}

/**
 * Konsol /cerita-sekolah/baru and /cerita-sekolah/{id} (R2-05): a
 * school's story, naming the school only with its recorded consent.
 * Photos come later. Ability `stories.manage`.
 */
export default function ConsoleStoryForm({ story }: { story: StoryData | null }) {
  const t = useT()
  const form = useForm({
    title: story?.title ?? '',
    summary: story?.summary ?? '',
    body: story?.body ?? '',
    school_name: story?.schoolName ?? '',
    consent_note: story?.consentNote ?? '',
    consent_on: story?.consentOn ?? '',
  })
  const errors = form.errors as Record<string, string | undefined>

  const save = (publish: boolean) => {
    form.transform((data) => ({
      ...data,
      summary: data.summary.trim() === '' ? undefined : data.summary,
      publish,
    }))
    form.post(story ? `/cerita-sekolah/${story.id}` : '/cerita-sekolah', { preserveScroll: true })
  }

  return (
    <>
      <PageHeader
        title={t(
          story ? 'publishing.stories.form.edit_title' : 'publishing.stories.form.new_title'
        )}
        back={{ href: '/cerita-sekolah', label: t('publishing.stories.form.back') }}
        meta={
          story && (
            <StatusChip tone={story.status === 'published' ? 'ok' : 'neutral'}>
              {t(`publishing.statuses.${story.status}`)}
            </StatusChip>
          )
        }
      />
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          save(false)
        }}
      >
        <Section title={t('publishing.stories.list.col_school')}>
          <div className="space-y-4">
            <p className="flex gap-2 rounded-md border border-info/30 bg-info-tint p-3 text-sm text-info">
              <Icon name="info" size={18} className="mt-0.5" />
              <span>{t('publishing.stories.form.consent_notice')}</span>
            </p>
            <TextField
              label={t('publishing.stories.form.school_name')}
              name="school_name"
              required
              maxLength={200}
              value={form.data.school_name}
              onChange={(event) => form.setData('school_name', event.target.value)}
              error={errors.school_name}
            />
            <TextField
              label={t('publishing.stories.form.consent_note')}
              name="consent_note"
              required
              maxLength={500}
              value={form.data.consent_note}
              onChange={(event) => form.setData('consent_note', event.target.value)}
              hint={t('publishing.stories.form.consent_note_hint')}
              error={errors.consent_note}
            />
            <TextField
              label={t('publishing.stories.form.consent_on')}
              name="consent_on"
              type="date"
              required
              value={form.data.consent_on}
              onChange={(event) => form.setData('consent_on', event.target.value)}
              error={errors.consent_on}
              className="sm:max-w-xs"
            />
          </div>
        </Section>

        <Section title={t('publishing.form.body')}>
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
            <TextField
              label={t('publishing.form.summary')}
              name="summary"
              maxLength={300}
              value={form.data.summary}
              onChange={(event) => form.setData('summary', event.target.value)}
              hint={t('publishing.form.summary_hint')}
              error={errors.summary}
            />
            <MarkdownEditor
              label={t('publishing.form.body')}
              name="body"
              value={form.data.body}
              onChange={(value) => form.setData('body', value)}
              error={errors.body}
            />
          </div>
        </Section>

        <PostActions
          status={story?.status ?? null}
          processing={form.processing}
          onSave={save}
          baseUrl={story ? `/cerita-sekolah/${story.id}` : null}
          publicUrl={story?.publicUrl}
        />
      </form>
    </>
  )
}
