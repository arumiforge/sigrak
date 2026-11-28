import { Form, Link } from '@inertiajs/react'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { Section } from '~/components/section'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

type Props = {
  categories: string[]
  /** The page the user came from (attached to the request), or null. */
  pageUrl: string | null
  messageMin: number
  messageMax: number
}

/**
 * /minta-bantuan (R2-06, D-320): the form behind "Minta bantuan" in the
 * account menu. Category and message; the page the user came from is
 * attached. School and role come from the session, not the form.
 */
export default function AskHelp({ categories, pageUrl, messageMin, messageMax }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('help.ask.title')}
        description={t('help.ask.intro')}
        actions={
          <Button asChild variant="outline">
            <Link href="/bantuan-saya">
              <Icon name="inbox" />
              {t('help.ask.to_mine')}
            </Link>
          </Button>
        }
      />

      <Section title={t('help.ask.title')} className="max-w-2xl">
        <Form action="/minta-bantuan" method="post" className="space-y-4">
          {({ errors, processing }) => (
            <>
              <FormField
                label={t('help.ask.category')}
                hint={t('help.ask.category_hint')}
                error={errors.category}
              >
                {(field) => (
                  <select
                    {...field}
                    name="category"
                    defaultValue=""
                    required
                    className={controlClass}
                  >
                    <option value="" disabled>
                      {t('help.ask.choose_category')}
                    </option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {t(`help.categories.${category}`)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <FormField
                label={t('help.ask.message')}
                hint={t('help.ask.message_hint', { min: messageMin })}
                error={errors.message}
              >
                {(field) => (
                  <textarea
                    {...field}
                    name="message"
                    required
                    minLength={messageMin}
                    maxLength={messageMax}
                    rows={6}
                    className={cn(controlClass, 'py-2.5')}
                  />
                )}
              </FormField>

              {pageUrl && (
                <div className="rounded-md border bg-page p-3 text-sm">
                  <p className="font-semibold">{t('help.ask.page')}</p>
                  <p className="mt-0.5 break-all text-muted" data-testid="attached-page">
                    {pageUrl}
                  </p>
                  <p className="mt-1 text-xs text-muted">{t('help.ask.page_hint')}</p>
                  <input type="hidden" name="page_url" value={pageUrl} />
                </div>
              )}

              <p className="text-sm text-muted">{t('help.ask.privacy')}</p>

              <Button type="submit" disabled={processing}>
                {processing ? t('help.ask.sending') : t('help.ask.submit')}
              </Button>
            </>
          )}
        </Form>
      </Section>
    </>
  )
}
