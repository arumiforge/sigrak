import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import Region from '#models/region'
import School from '#models/school'
import User from '#models/user'
import SchoolMembership from '#models/school_membership'
import StaffUser from '#models/staff_user'
import Calendar from '#models/calendar'
import CalendarEvent, { type CalendarEventKind, type ExamType } from '#models/calendar_event'
import ExamSession from '#models/exam_session'
import ExamParticipant from '#models/exam_participant'

/**
 * Local demo data: invented schools and people only (Fondasi
 * web-baseline §3, §8). Never runs in production.
 */
export const DEMO_PASSWORD = 'sigrak-demo-2026'

type RegionCalendarFile = {
  code: string
  name: string
  academic_year: string
  school_days_per_week: number
  starts_on: string
  even_semester_starts_on: string
  ends_on: string
  events: {
    kind: CalendarEventKind
    exam_type?: ExamType
    title: string
    starts_on: string
    ends_on: string
  }[]
  joint_leave_school_days: { date: string }[]
}

export default class DemoSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const file = JSON.parse(
      await readFile(app.makePath('docs/data/calendar/region-jawa-tengah-2026-2027.json'), 'utf8')
    ) as RegionCalendarFile

    const province = await Region.firstOrCreate({ province: 'Jawa Tengah', regency: null })
    const kudus = await Region.firstOrCreate({
      province: 'Jawa Tengah',
      regency: 'Kabupaten Kudus',
    })

    // Region reference calendar (status draft until Tim Validasi signs off).
    const regionCalendar = await Calendar.firstOrCreate(
      { code: file.code },
      {
        regionId: province.id,
        academicYear: file.academic_year,
        name: file.name,
        status: 'draft',
        schoolDaysPerWeek: file.school_days_per_week,
        startsOn: DateTime.fromISO(file.starts_on),
        evenSemesterStartsOn: DateTime.fromISO(file.even_semester_starts_on),
        endsOn: DateTime.fromISO(file.ends_on),
        jointLeaveSchoolDays: file.joint_leave_school_days.map((day) => day.date),
        meta: {},
      }
    )
    const existingEvent = await regionCalendar.related('events').query().first()
    if (!existingEvent) {
      await regionCalendar.related('events').createMany(
        file.events.map((event) => ({
          kind: event.kind,
          examType: event.exam_type ?? null,
          title: event.title,
          startsOn: DateTime.fromISO(event.starts_on),
          endsOn: DateTime.fromISO(event.ends_on),
        }))
      )
    }
    await regionCalendar.load('events')

    const sd = await School.firstOrCreate(
      { name: 'SD Negeri Contoh 1' },
      {
        level: 'sd',
        regionId: kudus.id,
        district: 'Kota Kudus',
        address: 'Jalan Contoh No. 1, Kudus',
      }
    )
    const mi = await School.firstOrCreate(
      { name: 'MI Contoh Al-Ikhlas' },
      {
        level: 'mi',
        regionId: kudus.id,
        district: 'Jati',
        address: 'Jalan Madrasah No. 2, Kudus',
      }
    )

    await this.copyCalendar(regionCalendar, sd, [
      {
        kind: 'exam',
        examType: 'sts',
        title: 'Sumatif Tengah Semester Gasal',
        startsOn: '2026-09-21',
        endsOn: '2026-09-26',
      },
      {
        kind: 'school_event',
        title: 'Rapat Komite Sekolah',
        startsOn: '2026-11-28',
        endsOn: '2026-11-28',
      },
      {
        kind: 'exam',
        examType: 'sas',
        title: 'Sumatif Akhir Semester Gasal',
        startsOn: '2026-12-07',
        endsOn: '2026-12-12',
      },
      {
        kind: 'no_lessons',
        title: 'Pembagian Rapor Semester Gasal',
        startsOn: '2026-12-19',
        endsOn: '2026-12-19',
      },
    ])
    await this.copyCalendar(regionCalendar, mi, [
      {
        kind: 'school_event',
        title: 'Pentas Seni Madrasah',
        startsOn: '2026-11-21',
        endsOn: '2026-11-21',
      },
    ])

    const teacher = await this.user('Rina Kartika, S.Pd.', 'guru@sd-contoh.test')
    const operator = await this.user('Bayu Setiawan', 'operator@sd-contoh.test')
    const miTeacher = await this.user('Siti Aminah, S.Pd.I.', 'guru@mi-contoh.test')
    await this.membership(sd, teacher, 'teacher')
    await this.membership(sd, operator, 'operator')
    await this.membership(mi, miTeacher, 'teacher')

    await StaffUser.firstOrCreate(
      { email: 'admin@sigrak.test' },
      { name: 'Admin Tim SIGRAK', password: DEMO_PASSWORD, role: 'admin' }
    )

    const session = await ExamSession.firstOrCreate(
      { title: 'Simulasi TKA Matematika (contoh)' },
      {
        schoolId: sd.id,
        opensAt: DateTime.now().minus({ hours: 1 }),
        closesAt: DateTime.now().plus({ days: 60 }),
        status: 'open',
      }
    )
    const participant = await ExamParticipant.findBy({
      examSessionId: session.id,
      username: 'peserta01',
    })
    if (!participant) {
      await ExamParticipant.create({
        examSessionId: session.id,
        username: 'peserta01',
        password: ExamParticipant.encryptPassword('kartu-0101'),
        status: 'not_started',
      })
    }
  }

  private async user(name: string, email: string) {
    return User.firstOrCreate({ email }, { name, password: DEMO_PASSWORD, nip: null })
  }

  private async membership(school: School, user: User, role: SchoolMembership['role']) {
    return SchoolMembership.firstOrCreate(
      { schoolId: school.id, userId: user.id, role },
      { status: 'active', startedOn: DateTime.fromISO('2026-07-01') }
    )
  }

  /**
   * "Salin dari kalender wilayah": the school calendar copies the region
   * calendar and its events (D-256), then adds its own events.
   */
  private async copyCalendar(
    region: Calendar,
    school: School,
    own: {
      kind: CalendarEventKind
      examType?: ExamType
      title: string
      startsOn: string
      endsOn: string
    }[]
  ) {
    const existing = await Calendar.query()
      .where('school_id', school.id)
      .where('academic_year', region.academicYear)
      .first()
    if (existing) {
      return existing
    }

    const calendar = await Calendar.create({
      schoolId: school.id,
      academicYear: region.academicYear,
      name: `Kalender ${school.name} ${region.academicYear}`,
      status: 'active',
      schoolDaysPerWeek: region.schoolDaysPerWeek,
      startsOn: region.startsOn,
      evenSemesterStartsOn: region.evenSemesterStartsOn,
      endsOn: region.endsOn,
      sourceCalendarId: region.id,
      sourceVersion: region.version,
      jointLeaveSchoolDays: region.jointLeaveSchoolDays,
      meta: {},
    })

    await CalendarEvent.createMany([
      ...region.events.map((event) => ({
        calendarId: calendar.id,
        kind: event.kind,
        examType: event.examType,
        title: event.title,
        startsOn: event.startsOn,
        endsOn: event.endsOn,
        sourceEventUid: event.publicId,
      })),
      ...own.map((event) => ({
        calendarId: calendar.id,
        kind: event.kind,
        examType: event.examType ?? null,
        title: event.title,
        startsOn: DateTime.fromISO(event.startsOn),
        endsOn: DateTime.fromISO(event.endsOn),
      })),
    ])
    return calendar
  }
}
