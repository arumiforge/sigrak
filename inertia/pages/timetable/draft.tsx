import { useEffect, useState } from 'react'
import { Form, usePoll } from '@inertiajs/react'
import { Section } from '~/components/section'
import { Button } from '~/components/ui/button'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { PageHeader } from '~/components/patterns/page_header'
import { SkeletonText } from '~/components/patterns/skeletons'
import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { Select } from '~/components/school_year/fields'
import { DayGroups, StatusLine, type Row } from '~/components/timetable/parts'
import { useT } from '~/lib/i18n'

type Props = {
  draft: {
    publicId: string
    status: 'queued' | 'running' | 'ready' | 'failed' | 'saved'
    createdAt: string | null
    classNames: string[]
    unplacedJp: number | null
  }
  year: { publicId: string; name: string; closed: boolean }
  classes: {
    publicId: string
    name: string
    current: Row[]
    draft: Row[]
    kept: Row[]
    unplaced: {
      subjectName: string
      jp: number
      reason: 'no_teacher' | 'no_room' | 'teacher_busy'
    }[]
  }[]
}

const POLL_MS = 1500

const STATUS_TONE: Record<Props['draft']['status'], StatusTone> = {
  queued: 'neutral',
  running: 'info',
  ready: 'brand',
  failed: 'danger',
  saved: 'ok',
}

/**
 * /jadwal/draf/{draft} (operator, D-262, D-381): waits for the job, then
 * compares each class's current rows with the draft (locked rows stay),
 * lists the JP that could not be placed with the reason, and offers
 * Acak ulang and Simpan draf.
 */
export default function DraftTimetable({ draft, year, classes }: Props) {
  const t = useT()
  const waiting = draft.status === 'queued' || draft.status === 'running'
  const { start, stop } = usePoll(POLL_MS, { only: ['draft', 'classes'] }, { autoStart: false })
  useEffect(() => {
    if (!waiting) return
    start()
    return stop
  }, [waiting, start, stop])
  const [picked, setPicked] = useState(classes[0]?.publicId ?? '')
  const shown = classes.find((row) => row.publicId === picked) ?? classes[0]
  // Religions without a teacher are not counted (D-251); they are listed, not warned about.
  const missingJp = (row: Props['classes'][number]) =>
    row.unplaced
      .filter((item) => item.reason !== 'no_teacher')
      .reduce((total, item) => total + item.jp, 0)
  const unplacedTotal = classes.reduce((sum, row) => sum + missingJp(row), 0)
  const canChange = !year.closed && draft.status !== 'saved'

  return (
    <>
      <PageHeader
        title={t('timetable.draft.title')}
        back={{
          href: `/jadwal/susun-draf?tahun=${year.publicId}`,
          label: t('timetable.draft.back'),
        }}
        description={draft.classNames.join(', ')}
        meta={
          <StatusChip tone={STATUS_TONE[draft.status]}>
            {t(`timetable.draft.statuses.${draft.status}`)}
          </StatusChip>
        }
      />

      {waiting && (
        <Section title={t(`timetable.draft.statuses.${draft.status}`)}>
          <p role="status" className="text-muted">
            {t('timetable.draft.waiting_body')}
          </p>
          <SkeletonText lines={4} className="mt-4" />
        </Section>
      )}

      {draft.status === 'failed' && (
        <Section title={t('timetable.draft.statuses.failed')}>
          <StatusLine tone="danger">{t('timetable.draft.failed_body')}</StatusLine>
          {canChange && (
            <div className="mt-4">
              <ReshuffleButton draftId={draft.publicId} />
            </div>
          )}
        </Section>
      )}

      {(draft.status === 'ready' || draft.status === 'saved') && shown && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {draft.status === 'saved' ? (
              <StatusLine tone="ok">{t('timetable.draft.saved_body')}</StatusLine>
            ) : unplacedTotal === 0 ? (
              <StatusLine tone="ok">{t('timetable.draft.all_placed')}</StatusLine>
            ) : (
              <StatusLine tone="warn">
                {t('timetable.draft.unplaced_total', { count: unplacedTotal })}
              </StatusLine>
            )}
          </div>
          {canChange && (
            <div className="mt-4 flex flex-wrap gap-2">
              <ConfirmAction
                action={`/jadwal/draf/${draft.publicId}/simpan`}
                label={t('timetable.draft.save_action')}
                title={t('timetable.draft.save_title', { count: classes.length })}
                description={t('timetable.draft.save_confirm', { count: classes.length })}
                confirmLabel={t('timetable.draft.save_action')}
                destructive={false}
                preserveScroll={false}
                variant="default"
                className="w-full sm:w-auto"
              />
              <ReshuffleButton draftId={draft.publicId} />
            </div>
          )}

          {classes.length > 1 && (
            <div className="mt-6 max-w-xs">
              <Select
                label={t('timetable.draft.class_label')}
                name="class"
                value={shown.publicId}
                onChange={setPicked}
                options={classes.map((row) => ({
                  value: row.publicId,
                  label:
                    missingJp(row) > 0
                      ? `${row.name} · ${t('timetable.jp_count', { count: missingJp(row) })}`
                      : row.name,
                }))}
              />
            </div>
          )}

          {shown.unplaced.length > 0 && (
            <Section title={t('timetable.draft.unplaced_title')} className="mt-6">
              <ul className="space-y-2">
                {shown.unplaced.map((item, index) => (
                  <li key={index}>
                    <p className="font-semibold">
                      {t('timetable.draft.unplaced_row', {
                        subject: item.subjectName,
                        count: item.jp,
                      })}
                    </p>
                    <p className="text-sm text-muted">
                      {t(`timetable.draft.reasons.${item.reason}`)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Section title={`${t('timetable.draft.draft_title')} · ${shown.name}`}>
              <DayGroups
                rows={[...shown.kept, ...shown.draft].sort(
                  (a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt)
                )}
                dense
                hideEmpty
              />
            </Section>
            <Section title={`${t('timetable.draft.current_title')} · ${shown.name}`}>
              {shown.current.length === 0 ? (
                <p className="text-muted">{t('timetable.draft.current_empty')}</p>
              ) : (
                <DayGroups rows={shown.current} dense hideEmpty />
              )}
            </Section>
          </div>
        </>
      )}
    </>
  )
}

function ReshuffleButton({ draftId }: { draftId: string }) {
  const t = useT()
  return (
    <Form action={`/jadwal/draf/${draftId}/acak-ulang`} method="post" className="w-full sm:w-auto">
      {({ processing }) => (
        <Button type="submit" variant="outline" disabled={processing} className="w-full sm:w-auto">
          {t('timetable.draft.reshuffle_action')}
        </Button>
      )}
    </Form>
  )
}
