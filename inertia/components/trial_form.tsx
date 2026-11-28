import { useState } from 'react'
import { Form } from '@inertiajs/react'
import { SelectField } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Mode = 'extend' | 'set' | 'clear'

/**
 * Console form to change a trial (D-459): add days, set a length, or
 * follow the default again.
 */
export function TrialForm({ action }: { action: string }) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('extend')

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
              options={(['extend', 'set', 'clear'] as const).map((value) => ({
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
                max={365}
                defaultValue={7}
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
