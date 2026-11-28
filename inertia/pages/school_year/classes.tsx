import { useState, type ReactNode } from 'react'
import { Form, Head, Link } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import {
  ArtBranchSelect,
  Select,
  gradeOptions,
  teacherOptions,
} from '~/components/school_year/fields'
import { useT } from '~/lib/i18n'
import { useLevelTerms } from '~/lib/level_terms'
import { cn } from '~/lib/utils'

type ArtBranchOption = { artBranch: string; hasTopics: boolean }

type Props = {
  years: { publicId: string; name: string; isCurrent: boolean }[]
  year: { publicId: string; name: string; closed: boolean } | null
  classes: {
    publicId: string
    name: string
    grade: number
    artBranch: string | null
    homeroomName: string | null
    subjectCount: number
    assignedCount: number
  }[]
  artBranchesByGrade: Record<string, ArtBranchOption[]>
  teachers: { publicId: string; name: string }[]
  levelTerms: { homeroomTeacherTerm: string } | null
}

/**
 * /kelas (operator, D-241): the classes of one academic year by grade,
 * and a form to add a class with its grade, Seni dan Budaya branch
 * (D-458) and guru kelas / wali kelas (D-383).
 */
export default function Classes(props: Props) {
  const t = useT()
  const { years, year } = props

  return (
    <>
      <Head title={t('classes.classes.title')} />
      <h1 className="text-2xl font-bold">{t('classes.classes.title')}</h1>
      <p className="mt-2 text-muted">{t('classes.classes.intro')}</p>

      {year === null ? (
        <Section title={t('classes.classes.no_year_title')} className="mt-6 max-w-xl">
          <p className="text-muted">{t('classes.classes.no_year')}</p>
          <Button asChild className="mt-4">
            <Link href="/tahun-ajaran">{t('classes.classes.to_years')}</Link>
          </Button>
        </Section>
      ) : (
        <>
          <nav aria-label={t('classes.classes.year_picker')} className="mt-4 overflow-x-auto">
            <ul className="flex gap-2">
              {years.map((row) => (
                <li key={row.publicId}>
                  <Link
                    href={`/kelas?tahun=${row.publicId}`}
                    aria-current={row.publicId === year.publicId ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap',
                      row.publicId === year.publicId
                        ? 'border-brand bg-brand-tint text-brand-strong'
                        : 'text-muted hover:text-text'
                    )}
                  >
                    {row.isCurrent
                      ? t('classes.classes.year_current', { year: row.name })
                      : row.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ClassesOfYear {...props} year={year} />
        </>
      )}
    </>
  )
}

function ClassesOfYear({
  year,
  classes,
  artBranchesByGrade,
  teachers,
  levelTerms,
}: Props & { year: NonNullable<Props['year']> }) {
  const t = useT()
  const terms = useLevelTerms(levelTerms!)
  const [grade, setGrade] = useState('1')
  const grades = [...new Set(classes.map((row) => row.grade))]

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_3fr]">
      {year.closed ? (
        <Section title={t('classes.years.closed')} className="self-start">
          <p className="text-sm text-muted">{t('classes.years.closed_note')}</p>
        </Section>
      ) : (
        <Section title={t('classes.classes.add_title')} className="self-start">
          <Form
            action="/kelas"
            method="post"
            resetOnSuccess
            options={{ preserveScroll: true }}
            className="space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <input type="hidden" name="year" value={year.publicId} />
                <TextField
                  label={t('classes.fields.class_name')}
                  name="class_name"
                  required
                  maxLength={20}
                  autoComplete="off"
                  hint={t('classes.class_name_hint')}
                  error={errors.class_name}
                />
                <Select
                  label={t('classes.fields.grade')}
                  name="grade"
                  value={grade}
                  onChange={setGrade}
                  options={gradeOptions(t)}
                  error={errors.grade}
                />
                <ArtBranchSelect
                  options={artBranchesByGrade[grade] ?? []}
                  defaultValue={null}
                  error={errors.art_branch}
                />
                <Select
                  label={terms.homeroom_teacher}
                  name="homeroom"
                  defaultValue=""
                  options={teacherOptions(t, teachers, null, t('classes.homeroom_none', terms))}
                  error={errors.homeroom}
                  hint={
                    teachers.length === 0
                      ? t('classes.no_teachers')
                      : t('classes.homeroom_hint', terms)
                  }
                />
                <Button type="submit" disabled={processing}>
                  {processing ? t('common.status.saving') : t('classes.classes.add_action')}
                </Button>
              </>
            )}
          </Form>
        </Section>
      )}

      <Section title={t('classes.classes.list_title', { year: year.name })}>
        {classes.length === 0 ? (
          <p className="text-muted">{t('classes.classes.empty')}</p>
        ) : (
          <div className="space-y-5">
            {grades.map((gradeNo) => (
              <div key={gradeNo}>
                <h3 className="text-sm font-bold text-muted">
                  {t('classes.grade_label', { grade: gradeNo })}
                </h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {classes
                    .filter((row) => row.grade === gradeNo)
                    .map((row) => (
                      <li key={row.publicId}>
                        <Link
                          href={`/kelas/${row.publicId}`}
                          className="block rounded-lg border p-3 hover:border-brand"
                          data-testid="class-card"
                        >
                          <p className="font-bold">{row.name}</p>
                          <p className="text-sm text-muted">
                            {row.homeroomName ?? t('classes.homeroom_missing', terms)}
                          </p>
                          <p className="text-xs text-muted">
                            {t('classes.classes.assigned_count', {
                              assigned: row.assignedCount,
                              total: row.subjectCount,
                            })}
                            {row.artBranch
                              ? ` · ${t(`classes.art_branches.${row.artBranch}`)}`
                              : ''}
                          </p>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

Classes.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
