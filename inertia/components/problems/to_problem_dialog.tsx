import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { ResponsiveDialog } from '~/components/patterns/responsive_dialog'
import { TextField } from '~/components/text_field'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

/**
 * "Jadikan masalah" on a help request (R2-07, D-477): a new Bank
 * Masalah problem written in staff's own words (the message is only a
 * starting point), or a link to an open problem. The sender is told
 * that the request was recorded.
 */
export function ToProblemDialog({
  requestId,
  message,
  openProblems,
}: {
  requestId: number
  message: string
  openProblems: { id: number; number: string; title: string }[]
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const form = useForm<{
    mode: 'new' | 'link'
    title: string
    description: string
    problem_id: string
  }>({
    mode: 'new',
    title: '',
    description: message,
    problem_id: openProblems[0] ? String(openProblems[0].id) : '',
  })

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="to-problem">
        <Icon name="problem" />
        {t('problems.to_problem.open')}
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={t('problems.to_problem.title')}
        description={t('problems.to_problem.intro')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" form="to-problem" disabled={form.processing}>
              {form.data.mode === 'new'
                ? t('problems.to_problem.create')
                : t('problems.to_problem.link')}
            </Button>
          </>
        }
      >
        <form
          id="to-problem"
          className="max-h-[60dvh] space-y-4 overflow-y-auto px-4 pb-2 sm:max-h-[65dvh] sm:px-0"
          onSubmit={(event) => {
            event.preventDefault()
            form.post(`/bantuan/${requestId}/jadikan-masalah`, {
              preserveScroll: true,
              onSuccess: () => setOpen(false),
            })
          }}
        >
          <fieldset>
            <legend className="text-sm font-semibold">{t('problems.to_problem.mode')}</legend>
            <div className="mt-1 flex flex-wrap gap-x-4">
              {(['new', 'link'] as const).map((mode) => (
                <label key={mode} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    value={mode}
                    checked={form.data.mode === mode}
                    disabled={mode === 'link' && openProblems.length === 0}
                    onChange={() => form.setData('mode', mode)}
                    className="size-5"
                  />
                  {t(`problems.to_problem.modes.${mode}`)}
                </label>
              ))}
            </div>
          </fieldset>

          {form.data.mode === 'new' ? (
            <>
              <TextField
                label={t('problems.fields.title')}
                hint={t('problems.fields.title_hint')}
                name="title"
                required
                maxLength={160}
                value={form.data.title}
                onChange={(event) => form.setData('title', event.target.value)}
                error={form.errors.title}
              />
              <FormField
                label={t('problems.fields.description')}
                hint={t('problems.to_problem.description_hint')}
                error={form.errors.description}
              >
                {(field) => (
                  <textarea
                    {...field}
                    name="description"
                    required
                    maxLength={4000}
                    rows={5}
                    value={form.data.description}
                    onChange={(event) => form.setData('description', event.target.value)}
                    className={cn(controlClass, 'py-2.5')}
                  />
                )}
              </FormField>
            </>
          ) : (
            <FormField label={t('problems.to_problem.problem')} error={form.errors.problem_id}>
              {(field) => (
                <select
                  {...field}
                  name="problem_id"
                  value={form.data.problem_id}
                  onChange={(event) => form.setData('problem_id', event.target.value)}
                  className={controlClass}
                >
                  {openProblems.map((problem) => (
                    <option key={problem.id} value={problem.id}>
                      {problem.number} · {problem.title}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          )}
          <p className="text-sm text-muted">{t('problems.to_problem.sender_told')}</p>
        </form>
      </ResponsiveDialog>
    </>
  )
}
