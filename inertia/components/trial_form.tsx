import { useState } from 'react'
import { Form } from '@inertiajs/react'
import { SelectField } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Mode = 'extend' | 'set' | 'clear'

/**
 * Console form to change a trial (D-459): add days, set a length, or
 * follow the default again. With `extendMaxDays` only "Tambah hari" up
 * to that many days is offered (`trials.extend`, R2-01).
 */
export function TrialForm({ action, extendMaxDays }: { action: string; extendMaxDays?: number }) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('extend')
  const modes: Mode[] = extendMaxDays ? ['extend'] : ['extend', 'set', 'clear']

  return (
    <Form action={action} method="post" options={{ preserveScroll: true }} className="space-y-3">
      {({ errors, processing }) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label={t('console.trial.mode_label')}
              name="mode"
              defaultValue="extend"
              onChange={(value) => setMode(value as Mode)}
              error={errors.mode}
              options={modes.map((value) => ({
                value,
                label: t(`console.trial.modes.${value}`),
              }))}
            />
            {mode !== 'clear' && (
              <TextField
                label={t('console.trial.days_label')}
                name="days"
                type="number"
                inputMode="numeric"
                min={1}
                max={extendMaxDays ?? 365}
                defaultValue={7}
                hint={
                  extendMaxDays
                    ? t('console.trial.extend_limit', { days: extendMaxDays })
                    : undefined
                }
                required
                error={errors.days}
              />
            )}
          </div>
          <Button type="submit" variant="outline" disabled={processing}>
            {t('console.trial.save')}
          </Button>
        </>
      )}
    </Form>
  )
}
