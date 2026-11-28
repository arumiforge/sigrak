import { useState, type ReactNode } from 'react'
import { Form, Head, Link } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Section } from '~/components/section'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/school_year/fields'
import {
  CopyOptions,
  YearDateFields,
  type CopyPreview,
  type YearDates,
} from '~/components/school_year/year_parts'
import { useT } from '~/lib/i18n'
import { formatShortDate } from '~/lib/format'

type Year = YearDates & {
  publicId: string
  name: string
  closed: boolean
  isCurrent: boolean
  classCount: number
  copy: CopyPreview | null
}

type Props = {
  years: Year[]
  suggestion: YearDates & { name: string }
  createCopy: CopyPreview | null
  levelTerms: { homeroomTeacherTerm: string }
}

/**
 * /tahun-ajaran (operator, D-241): add a year (the form suggests the
 * one after the latest and can copy last year's classes, D-242…D-246),
 * see every year with its classes, change or delete it, and copy
 * classes into an empty year.
 */
export default function AcademicYears({ years, suggestion, createCopy, levelTerms }: Props) {
  const t = useT()
  const [copy, setCopy] = useState(true)

  return (
    <>
      <Head title={t('classes.years.title')} />
      <h1 className="text-2xl font-bold">{t('classes.years.title')}</h1>
      <p className="mt-2 text-muted">{t('classes.years.intro')}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Section title={t('classes.years.add_title')} className="self-start">
          <Form
            action="/tahun-ajaran"
            method="post"
            options={{ preserveScroll: true }}
            className="space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <YearDateFields dates={suggestion} errors={errors} />
                {createCopy && (
                  <div className="space-y-3 border-t pt-4">
                    <Checkbox
                      label={t('classes.copy.from_year', { year: createCopy.sourceName })}
                      name="copy_classes"
                      checked={copy}
                      onChange={setCopy}
                    />
                    {copy && <CopyOptions preview={createCopy} levelTerms={levelTerms} />}
                  </div>
                )}
                <Button type="submit" disabled={processing}>
                  {processing ? t('common.status.saving') : t('classes.years.add_action')}
                </Button>
              </>
            )}
          </Form>
        </Section>

        <Section title={t('classes.years.list_title')}>
          {years.length === 0 ? (
            <p className="text-muted">{t('classes.years.empty')}</p>
          ) : (
            <ul className="divide-y">
              {years.map((year) => (
                <YearRow key={year.publicId} year={year} levelTerms={levelTerms} />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}

function YearRow({ year, levelTerms }: { year: Year; levelTerms: Props['levelTerms'] }) {
  const t = useT()
  return (
    <li className="space-y-3 py-4" data-testid="year-row">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{year.name}</span>
            {year.isCurrent && (
              <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-strong">
                {t('classes.years.current')}
              </span>
            )}
            {year.closed && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold text-muted">
                {t('classes.years.closed')}
              </span>
            )}
          </p>
          <p className="text-sm text-muted">
            {t('classes.years.dates', {
              start: formatShortDate(year.startsOn),
              end: formatShortDate(year.endsOn),
            })}
          </p>
          <p className="text-sm text-muted">
            {t('classes.years.even_from', { date: formatShortDate(year.evenSemesterStartsOn) })}
          </p>
          <Link
            href={`/kelas?tahun=${year.publicId}`}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong underline-offset-4 hover:underline"
          >
            {year.classCount === 0
              ? t('classes.years.no_classes')
              : t('classes.years.class_count', { count: year.classCount })}
          </Link>
        </div>
        {!year.closed && (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/tahun-ajaran/${year.publicId}/ubah`}>{t('common.actions.edit')}</Link>
            </Button>
            {year.classCount === 0 && (
              <Form
                action={`/tahun-ajaran/${year.publicId}/hapus`}
                method="post"
                options={{ preserveScroll: true }}
                onBefore={() =>
                  window.confirm(t('classes.years.delete_confirm', { year: year.name }))
                }
              >
                {({ processing }) => (
                  <Button type="submit" variant="ghost" size="sm" disabled={processing}>
                    {t('common.actions.delete')}
                  </Button>
                )}
              </Form>
            )}
          </div>
        )}
      </div>

      {year.copy && (
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand-strong">
            {t('classes.copy.from_year', { year: year.copy.sourceName })}
          </summary>
          <Form
            action={`/tahun-ajaran/${year.publicId}/salin-kelas`}
            method="post"
            className="mt-3 space-y-3"
          >
            {({ processing }) => (
              <>
                <CopyOptions preview={year.copy!} levelTerms={levelTerms} />
                <Button type="submit" size="sm" disabled={processing}>
                  {processing ? t('common.status.saving') : t('classes.copy.action')}
                </Button>
              </>
            )}
          </Form>
        </details>
      )}
    </li>
  )
}

AcademicYears.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
