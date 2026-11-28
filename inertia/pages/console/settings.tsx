import { Form } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Props = {
  defaultTrialDays: number
  can: { manageTrials: boolean }
}

/**
 * Konsol /pengaturan: the default trial length (D-459).
 */
export default function ConsoleSettings({ defaultTrialDays, can }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader title={t('console.settings.title')} />

      <Section
        title={t('console.settings.trial_title')}
        description={t('console.settings.trial_intro')}
        className="max-w-xl"
      >
        <Form action="/pengaturan" method="post" className="space-y-3">
          {({ errors, processing }) => (
            <>
              <TextField
                label={t('console.settings.days_label')}
                name="days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                defaultValue={defaultTrialDays}
                disabled={!can.manageTrials}
                required
                error={errors.days}
                hint={can.manageTrials ? undefined : t('console.settings.read_only')}
              />
              {can.manageTrials && (
                <Button type="submit" disabled={processing}>
                  {t('console.settings.save')}
                </Button>
              )}
            </>
          )}
        </Form>
      </Section>
    </>
  )
}
