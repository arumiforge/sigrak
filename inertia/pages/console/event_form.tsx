import { useForm } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { MarkdownEditor } from '~/components/publishing/markdown_editor'
import { PostActions } from '~/components/publishing/post_actions'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { useT } from '~/lib/i18n'

type EventData = {
  id: number
  slug: string
  title: string
  summary: string
  body: string
  status: 'draft' | 'published'
  eventStart: string
  eventEnd: string
  place: string
  onlineUrl: string
  registrationUrl: string
  publishedAt: string | null
  publicUrl: string | null
}

/**
 * Konsol /acara/baru and /acara/{id} (R2-05): an Acara with its date
 * and time (WIB), a place or an online link and an optional
 * registration link. Ability `events.manage`.
 */
export default function ConsoleEventForm({ event }: { event: EventData | null }) {
  const t = useT()
  const form = useForm({
    title: event?.title ?? '',
    summary: event?.summary ?? '',
    body: event?.body ?? '',
    event_start: event?.eventStart ?? '',
    event_end: event?.eventEnd ?? '',
    place: event?.place ?? '',
    online_url: event?.onlineUrl ?? '',
    registration_url: event?.registrationUrl ?? '',
  })
  const errors = form.errors as Record<string, string | undefined>
  const optional = t('publishing.form.optional')

  const save = (publish: boolean) => {
    form.transform((data) => {
      const payload: Record<string, string | boolean> = { publish }
      for (const [key, value] of Object.entries(data)) {
        if (value.trim() !== '') payload[key] = value
      }
      return payload
    })
    form.post(event ? `/acara/${event.id}` : '/acara', { preserveScroll: true })
  }

  return (
    <>
      <PageHeader
        title={t(event ? 'publishing.events.form.edit_title' : 'publishing.events.form.new_title')}
        back={{ href: '/acara', label: t('publishing.events.form.back') }}
        meta={
          event && (
            <StatusChip tone={event.status === 'published' ? 'ok' : 'neutral'}>
              {t(`publishing.statuses.${event.status}`)}
            </StatusChip>
          )
        }
      />
      <form
        className="space-y-6"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          save(false)
        }}
      >
        <Section title={t('publishing.form.body')}>
          <div className="space-y-4">
            <TextField
              label={t('publishing.form.title')}
              name="title"
              required
              maxLength={200}
              value={form.data.title}
              onChange={(change) => form.setData('title', change.target.value)}
              error={errors.title}
            />
            <TextField
              label={t('publishing.form.summary')}
              name="summary"
              maxLength={300}
              value={form.data.summary}
              onChange={(change) => form.setData('summary', change.target.value)}
              hint={t('publishing.form.summary_hint')}
              error={errors.summary}
            />
            <MarkdownEditor
              label={t('publishing.form.body')}
              name="body"
              value={form.data.body}
              onChange={(value) => form.setData('body', value)}
              optionalLabel={optional}
              hint={t('publishing.events.form.body_hint')}
              rows={10}
              error={errors.body}
            />
          </div>
        </Section>

        <Section
          title={t('publishing.events.list.col_when')}
          description={t('publishing.events.form.time_hint')}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('publishing.events.form.event_start')}
              name="event_start"
              type="datetime-local"
              required
              value={form.data.event_start}
              onChange={(change) => form.setData('event_start', change.target.value)}
              error={errors.event_start}
            />
            <TextField
              label={t('publishing.events.form.event_end')}
              name="event_end"
              type="datetime-local"
              value={form.data.event_end}
              onChange={(change) => form.setData('event_end', change.target.value)}
              hint={t('publishing.events.form.event_end_hint')}
              error={errors.event_end}
            />
          </div>
        </Section>

        <Section title={t('publishing.events.list.col_where')}>
          <div className="space-y-4">
            <TextField
              label={t('publishing.events.form.place')}
              name="place"
              maxLength={200}
              value={form.data.place}
              onChange={(change) => form.setData('place', change.target.value)}
              hint={t('publishing.events.form.place_hint')}
              error={errors.place}
            />
            <TextField
              label={t('publishing.events.form.online_url')}
              name="online_url"
              type="url"
              inputMode="url"
              maxLength={500}
              value={form.data.online_url}
              onChange={(change) => form.setData('online_url', change.target.value)}
              hint={t('publishing.events.form.online_url_hint')}
              error={errors.online_url}
            />
            <TextField
              label={`${t('publishing.events.form.registration_url')} (${optional})`}
              name="registration_url"
              type="url"
              inputMode="url"
              maxLength={500}
              value={form.data.registration_url}
              onChange={(change) => form.setData('registration_url', change.target.value)}
              error={errors.registration_url}
            />
          </div>
        </Section>

        <PostActions
          status={event?.status ?? null}
          processing={form.processing}
          onSave={save}
          baseUrl={event ? `/acara/${event.id}` : null}
          publicUrl={event?.publicUrl}
        />
      </form>
    </>
  )
}
