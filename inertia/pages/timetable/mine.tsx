import { Section } from '~/components/section'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { DayGroups, TimeRange, WEEKDAYS, type Row, dayName } from '~/components/timetable/parts'
import { useT } from '~/lib/i18n'

type Props = {
  year: { name: string } | null
  lessons: {
    weekday: number
    startsAt: string
    endsAt: string
    className: string
    subjectName: string
    jp: number
  }[]
  totalJp: number
  homerooms: { name: string; rows: Omit<Row, 'publicId'>[] }[]
  levelTerms: { homeroomTeacherTerm: string } | null
}

/**
 * /kelas-saya/jadwal (teacher, D-247, D-249): the teacher's lessons this
 * year by day with the total JP, and the full timetable of each class
 * they are guru kelas / wali kelas of.
 */
export default function MyTimetable({ year, lessons, totalJp, homerooms }: Props) {
  const t = useT()
  return (
    <>
      <PageHeader
        title={t('timetable.mine.title')}
        description={year ? t('timetable.mine.intro', { year: year.name }) : undefined}
      />
      {year === null ? (
        <EmptyState icon="timetable" description={t('timetable.no_year_teacher')} />
      ) : (
        <>
          <Section title={t('timetable.mine.total', { count: totalJp })}>
            {lessons.length === 0 ? (
              <EmptyState compact icon="timetable" description={t('timetable.mine.empty')} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {WEEKDAYS.map((weekday) => {
                  const dayLessons = lessons.filter((row) => row.weekday === weekday)
                  if (dayLessons.length === 0) return null
                  return (
                    <div key={weekday} className="min-w-0">
                      <h3 className="font-bold">{dayName(t, weekday)}</h3>
                      <ul className="divide-y">
                        {dayLessons.map((row, index) => (
                          <li
                            key={index}
                            className="grid gap-1 py-2 sm:grid-cols-[9.5rem_1fr] sm:gap-3"
                            data-testid="my-lesson"
                          >
                            <p className="text-sm font-semibold">
                              <TimeRange start={row.startsAt} end={row.endsAt} />
                            </p>
                            <p className="min-w-0">
                              {t('timetable.mine.class_subject', {
                                subject: row.subjectName,
                                class: row.className,
                              })}
                              <span className="text-xs text-muted">
                                {' · '}
                                {t('timetable.jp_count', { count: row.jp })}
                              </span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {homerooms.map((homeroom) => (
            <Section
              key={homeroom.name}
              title={t('timetable.mine.homeroom_title', { name: homeroom.name })}
              className="mt-6"
            >
              <DayGroups
                rows={homeroom.rows.map((row) => ({ ...row, publicId: null }))}
                hideEmpty
              />
            </Section>
          ))}
        </>
      )}
    </>
  )
}
