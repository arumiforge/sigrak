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
  type TeacherChoice,
} from '~/components/school_year/fields'
import { useT } from '~/lib/i18n'
import { useLevelTerms } from '~/lib/level_terms'

type Props = {
  schoolClass: {
    publicId: string
    name: string
    grade: number
    artBranch: string | null
    homeroom: TeacherChoice
  }
  year: { publicId: string; name: string; closed: boolean }
  subjects: {
    code: string
    name: string
    defaultTeacher: 'class_teacher' | 'subject_teacher'
    religion: string | null
    taught: boolean
    teacher: TeacherChoice
  }[]
  teachers: { publicId: string; name: string }[]
  artBranchesByGrade: Record<string, { artBranch: string; hasTopics: boolean }[]>
  levelTerms: { homeroomTeacherTerm: string }
}

/**
 * /kelas/{class} (operator, D-241): the class's name, grade, Seni dan
 * Budaya branch (D-458, D-464) and guru kelas / wali kelas (D-383), and
 * the teacher of every subject the class takes (D-032, D-240). A
 * subject without a teacher has none yet; a row for a subject no longer
 * taught stays until the operator clears it.
 */
export default function ClassPage({
  schoolClass,
  year,
  subjects,
  teachers,
  artBranchesByGrade,
  levelTerms,
}: Props) {
  const t = useT()
  const terms = useLevelTerms(levelTerms)
  const [grade, setGrade] = useState(String(schoolClass.grade))
  const readOnly = year.closed
  const missing = subjects.filter((subject) => subject.taught && !subject.teacher).length

  return (
    <>
      <Head title={t('classes.class.title', { name: schoolClass.name })} />
      <Link
        href={`/kelas?tahun=${year.publicId}`}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong"
      >
        {t('classes.class.back', { year: year.name })}
      </Link>
      <h1 className="text-2xl font-bold">{t('classes.class.title', { name: schoolClass.name })}</h1>
      <p className="mt-1 text-muted">
        {t('classes.class.subtitle', { grade: schoolClass.grade, year: year.name })}
      </p>
      {readOnly && <p className="mt-2 text-sm text-warn">{t('classes.years.closed_note')}</p>}
      <Button asChild variant="outline" className="mt-4">
        <Link href={`/kelas/${schoolClass.publicId}/jadwal`}>
          {t('classes.class.timetable_link')}
        </Link>
      </Button>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-4 self-start">
          <Section title={t('classes.class.details_title')}>
            <Form
              action={`/kelas/${schoolClass.publicId}/ubah`}
              method="post"
              options={{ preserveScroll: true }}
              className="space-y-4"
            >
              {({ errors, processing }) => (
                <>
                  <TextField
                    label={t('classes.fields.class_name')}
                    name="class_name"
                    required
                    maxLength={20}
                    autoComplete="off"
                    disabled={readOnly}
                    defaultValue={schoolClass.name}
                    error={errors.class_name}
                  />
                  <Select
                    label={t('classes.fields.grade')}
                    name="grade"
                    value={grade}
                    onChange={setGrade}
                    disabled={readOnly}
                    options={gradeOptions(t)}
                    error={errors.grade}
                    hint={
                      grade !== String(schoolClass.grade)
                        ? t('classes.class.grade_hint')
                        : undefined
                    }
                  />
                  <ArtBranchSelect
                    options={artBranchesByGrade[grade] ?? []}
                    defaultValue={schoolClass.artBranch}
                    disabled={readOnly}
                    error={errors.art_branch}
                  />
                  <Select
                    label={terms.homeroom_teacher}
                    name="homeroom"
                    defaultValue={schoolClass.homeroom?.value ?? ''}
                    disabled={readOnly}
                    options={teacherOptions(
                      t,
                      teachers,
                      schoolClass.homeroom,
                      t('classes.homeroom_none', terms)
                    )}
                    error={errors.homeroom}
                    hint={
                      teachers.length === 0
                        ? t('classes.no_teachers')
                        : t('classes.homeroom_hint', terms)
                    }
                  />
                  {!readOnly && (
                    <Button type="submit" disabled={processing}>
                      {processing ? t('common.status.saving') : t('common.actions.save')}
                    </Button>
                  )}
                </>
              )}
            </Form>
          </Section>

          {!readOnly && (
            <Section title={t('classes.class.delete_title')}>
              <p className="text-sm text-muted">{t('classes.class.delete_body')}</p>
              <Form
                action={`/kelas/${schoolClass.publicId}/hapus`}
                method="post"
                className="mt-3"
                onBefore={() =>
                  window.confirm(t('classes.class.delete_confirm', { name: schoolClass.name }))
                }
              >
                {({ processing }) => (
                  <Button type="submit" variant="outline" disabled={processing}>
                    {t('classes.class.delete_action')}
                  </Button>
                )}
              </Form>
            </Section>
          )}
        </div>

        <Section
          title={t('classes.assignments.title')}
          description={
            subjects.length === 0
              ? undefined
              : missing === 0
                ? t('classes.assignments.all_set')
                : t('classes.assignments.missing', { count: missing })
          }
        >
          {subjects.length === 0 ? (
            <p className="text-muted">{t('classes.assignments.no_subjects')}</p>
          ) : (
            <Form
              action={`/kelas/${schoolClass.publicId}/guru-mapel`}
              method="post"
              options={{ preserveScroll: true }}
              className="space-y-4"
            >
              {({ errors, processing }) => (
                <>
                  <ul className="divide-y">
                    {subjects.map((subject) => (
                      <li
                        key={subject.code}
                        className="grid gap-2 py-3 sm:grid-cols-[1fr_16rem] sm:items-center"
                        data-testid="assignment-row"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{subject.name}</p>
                          <p className="text-xs text-muted">
                            {!subject.taught
                              ? t('classes.assignments.not_taught')
                              : subject.defaultTeacher === 'class_teacher'
                                ? t('classes.assignments.default_homeroom', terms)
                                : t('classes.assignments.default_subject_teacher')}
                          </p>
                        </div>
                        <Select
                          label={t('classes.assignments.teacher_of', { subject: subject.name })}
                          srOnlyLabel
                          name={`assignments[${subject.code}]`}
                          defaultValue={subject.teacher?.value ?? ''}
                          disabled={readOnly}
                          options={teacherOptions(
                            t,
                            teachers,
                            subject.teacher,
                            t('classes.assignments.none')
                          )}
                          error={errors[`assignments.${subject.code}` as keyof typeof errors]}
                        />
                      </li>
                    ))}
                  </ul>
                  {!readOnly && (
                    <Button type="submit" disabled={processing}>
                      {processing ? t('common.status.saving') : t('classes.assignments.save')}
                    </Button>
                  )}
                </>
              )}
            </Form>
          )}
        </Section>
      </div>
    </>
  )
}

ClassPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
