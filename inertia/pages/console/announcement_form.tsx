import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { MarkdownEditor } from '~/components/publishing/markdown_editor'
import { PostActions } from '~/components/publishing/post_actions'
import {
  CheckboxGroup,
  TargetEditor,
  type RegionOption,
  type SchoolOption,
  type TargetValue,
} from '~/components/publishing/target_editor'
import { Section, SelectField } from '~/components/section'
import { TextField } from '~/components/text_field'
import { useT } from '~/lib/i18n'

type Announcement = {
  id: number
  slug: string
  title: string
  summary: string
  body: string
  kind: string
  status: 'draft' | 'published'
  state: 'draft' | 'scheduled' | 'live' | 'ended'
  showInApp: boolean
  showPublic: boolean
  regions: RegionOption[]
  schools: SchoolOption[]
  levels: string[]
  roles: string[]
  showFrom: string
  showUntil: string
  publishedAt: string | null
  publicUrl: string | null
}

type Props = {
  announcement: Announcement | null
  kinds: string[]
  levels: string[]
  roles: string[]
  can: { manage: boolean; public: boolean; app: boolean }
}

const stateTone = { draft: 'neutral', scheduled: 'info', live: 'ok', ended: 'neutral' } as const

/**
 * Konsol /kabar/baru and /kabar/{id} (R2-05): one editor for a Kabar
 * in the app (with D-319 targets and a date window) and on sigrak.com
 * (D-477). Staff without `announcements.manage` see only the kinds
 * their roles may write, and the server checks the targets against
 * their scope (announcement_rules.ts).
 */
export default function ConsoleAnnouncementForm({
  announcement,
  kinds,
  levels,
  roles,
  can,
}: Props) {
  const t = useT()
  const form = useForm({
    title: announcement?.title ?? '',
    summary: announcement?.summary ?? '',
    body: announcement?.body ?? '',
    kind: announcement?.kind ?? kinds[0] ?? 'general',
    show_in_app: announcement?.showInApp ?? can.app,
    show_public: announcement?.showPublic ?? (!can.app && can.public),
    show_from: announcement?.showFrom ?? '',
    show_until: announcement?.showUntil ?? '',
  })
  const [targets, setTargets] = useState<TargetValue>({
    regions: announcement?.regions ?? [],
    schools: announcement?.schools ?? [],
    levels: announcement?.levels ?? [],
    roles: announcement?.roles ?? [],
  })
  const errors = form.errors as Record<string, string | undefined>

  const save = (publish: boolean) => {
    form.transform((data) => ({
      ...data,
      summary: data.summary.trim() === '' ? undefined : data.summary,
      show_from: data.show_from === '' ? undefined : data.show_from,
      show_until: data.show_until === '' ? undefined : data.show_until,
      target_region_ids: data.show_in_app ? targets.regions.map((region) => region.id) : [],
      target_school_ids: data.show_in_app ? targets.schools.map((school) => school.id) : [],
      target_levels: data.show_in_app ? targets.levels : [],
      target_roles: data.show_in_app ? targets.roles : [],
      publish,
    }))
    form.post(announcement ? `/kabar/${announcement.id}` : '/kabar', { preserveScroll: true })
  }

  const where = [
    ...(can.app || form.data.show_in_app ? ['app'] : []),
    ...(can.public || form.data.show_public ? ['public'] : []),
  ]
  const kindOptions = kinds.includes(form.data.kind) ? kinds : [form.data.kind, ...kinds]

  return (
    <>
      <PageHeader
        title={t(
          announcement
            ? 'publishing.announcements.form.edit_title'
            : 'publishing.announcements.form.new_title'
        )}
        back={{ href: '/kabar', label: t('publishing.announcements.form.back') }}
        meta={
          announcement && (
            <StatusChip tone={stateTone[announcement.state]}>
              {t(`publishing.statuses.${announcement.state}`)}
            </StatusChip>
          )
        }
      >
        {!can.manage && (
          <p className="mt-2 max-w-3xl text-sm text-muted">
            {t('publishing.announcements.form.scope_hint')}
          </p>
        )}
      </PageHeader>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
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
              onChange={(event) => form.setData('title', event.target.value)}
              error={errors.title}
            />
            <SelectField
              label={t('publishing.announcements.form.kind')}
              name="kind"
              defaultValue={form.data.kind}
              onChange={(value) => form.setData('kind', value)}
              error={errors.kind}
              options={kindOptions.map((kind) => ({
                value: kind,
                label: t(`publishing.kinds.${kind}`),
              }))}
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

        <Section
          title={t('publishing.announcements.form.where')}
          description={t('publishing.announcements.form.where_hint')}
        >
          <CheckboxGroup
            legend={t('publishing.announcements.form.where')}
            value={[
              ...(form.data.show_in_app ? ['app'] : []),
              ...(form.data.show_public ? ['public'] : []),
            ]}
            onChange={(selected) => {
              form.setData((data) => ({
                ...data,
                show_in_app: selected.includes('app'),
                show_public: selected.includes('public'),
              }))
            }}
            error={errors.show_public ?? errors.show_in_app}
            options={where.map((place) =>
              place === 'app'
                ? {
                    value: 'app',
                    label: t('publishing.announcements.form.show_in_app'),
                    hint: t('publishing.announcements.form.show_in_app_hint'),
                  }
                : {
                    value: 'public',
                    label: t('publishing.announcements.form.show_public'),
                    hint: t('publishing.announcements.form.show_public_hint'),
                  }
            )}
          />
        </Section>

        {form.data.show_in_app && (
          <Section
            title={t('publishing.announcements.form.targets')}
            description={t('publishing.announcements.form.targets_hint')}
          >
            <TargetEditor
              value={targets}
              onChange={setTargets}
              levels={levels}
              roles={roles}
              error={errors.target_region_ids}
            />
          </Section>
        )}

        <Section
          title={t('publishing.announcements.form.window')}
          description={t('publishing.announcements.form.window_hint')}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('publishing.announcements.form.show_from')}
              name="show_from"
              type="datetime-local"
              value={form.data.show_from}
              onChange={(event) => form.setData('show_from', event.target.value)}
              hint={t('publishing.announcements.form.show_from_hint')}
              error={errors.show_from}
            />
            <TextField
              label={t('publishing.announcements.form.show_until')}
              name="show_until"
              type="datetime-local"
              value={form.data.show_until}
              onChange={(event) => form.setData('show_until', event.target.value)}
              hint={t('publishing.announcements.form.show_until_hint')}
              error={errors.show_until}
            />
          </div>
        </Section>

        <PostActions
          status={announcement?.status ?? null}
          processing={form.processing}
          onSave={save}
          baseUrl={announcement ? `/kabar/${announcement.id}` : null}
          publicUrl={announcement?.publicUrl}
          canPublish={kinds.length > 0}
        />
      </form>
    </>
  )
}
