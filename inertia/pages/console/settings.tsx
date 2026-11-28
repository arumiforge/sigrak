import { Form } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { Section } from '~/components/section'
import { SettingsTabs } from '~/components/settings_tabs'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Props = {
  defaultTrialDays: number
  trialExtendMaxDays: number
  can: { manageTrials: boolean }
}

/**
 * Konsol /pengaturan: the default trial length (D-459) and the
 * "Tambah hari" limit for Penjualan and Koordinator wilayah (D-481).
 */
export default function ConsoleSettings({ defaultTrialDays, trialExtendMaxDays, can }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader title={t('console.settings.title')} />
      <SettingsTabs />

      <div className="space-y-4">
        <DaysSetting
          title={t('console.settings.trial_title')}
          description={t('console.settings.trial_intro')}
          action="/pengaturan"
          value={defaultTrialDays}
          editable={can.manageTrials}
        />
        <DaysSetting
          title={t('console.settings.extend_title')}
          description={t('console.settings.extend_intro')}
          action="/pengaturan/batas-tambah-hari"
          value={trialExtendMaxDays}
          editable={can.manageTrials}
        />
      </div>
    </>
  )
}

/** One logged number-of-days setting with its own form. */
function DaysSetting({
  title,
  description,
  action,
  value,
  editable,
}: {
  title: string
  description: string
  action: string
  value: number
  editable: boolean
}) {
  const t = useT()
  return (
    <Section title={title} description={description} className="max-w-xl">
      <Form action={action} method="post" className="space-y-3">
        {({ errors, processing }) => (
          <>
            <TextField
              label={t('console.settings.days_label')}
              name="days"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              defaultValue={value}
              disabled={!editable}
              required
              error={errors.days}
              hint={editable ? undefined : t('console.settings.read_only')}
            />
            {editable && (
              <Button type="submit" disabled={processing}>
                {t('console.settings.save')}
              </Button>
            )}
          </>
        )}
      </Form>
    </Section>
  )
}
