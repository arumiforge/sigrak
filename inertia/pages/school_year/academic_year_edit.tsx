import type { ReactNode } from 'react'
import { Form, Head, Link } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Section } from '~/components/section'
import { Button } from '~/components/ui/button'
import { YearDateFields, type YearDates } from '~/components/school_year/year_parts'
import { useT } from '~/lib/i18n'

type Props = {
  year: YearDates & { publicId: string; name: string; closed: boolean }
}

/**
 * /tahun-ajaran/{academicYear}/ubah (operator, D-241): change a year's
 * dates; its name follows the start date. A closed year is read-only
 * (D-318).
 */
export default function AcademicYearEdit({ year }: Props) {
  const t = useT()

  return (
    <>
      <Head title={t('classes.years.edit_title', { year: year.name })} />
      <Link
        href="/tahun-ajaran"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong"
      >
        {t('classes.years.back')}
      </Link>
      <h1 className="text-2xl font-bold">{t('classes.years.edit_title', { year: year.name })}</h1>

      <Section title={t('classes.years.dates_title')} className="mt-6 max-w-xl">
        {year.closed && <p className="mb-4 text-sm text-warn">{t('classes.years.closed_note')}</p>}
        <Form
          action={`/tahun-ajaran/${year.publicId}/ubah`}
          method="post"
          options={{ preserveScroll: true }}
          className="space-y-4"
        >
          {({ errors, processing }) => (
            <>
              <YearDateFields dates={year} errors={errors} disabled={year.closed} />
              <div className="flex gap-2">
                <Button type="submit" disabled={processing || year.closed}>
                  {processing ? t('common.status.saving') : t('common.actions.save')}
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/tahun-ajaran">{t('common.actions.cancel')}</Link>
                </Button>
              </div>
            </>
          )}
        </Form>
      </Section>
    </>
  )
}

AcademicYearEdit.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
