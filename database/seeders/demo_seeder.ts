import app from '@adonisjs/core/services/app'
import { randomUUID } from 'node:crypto'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Region from '#models/region'
import School from '#models/school'
import User from '#models/user'
import SchoolMembership from '#models/school_membership'
import StaffUser from '#models/staff_user'
import StaffRoleAssignment from '#models/staff_role_assignment'
import ExamSession from '#models/exam_session'
import ExamParticipant from '#models/exam_participant'
import { seedRegionList } from '#regions/region_list'
import { jawaTengahRegions } from '#regions/region_files'
import {
  activateCalendarPackage,
  importNationalHolidays,
  importRegionCalendar,
  NATIONAL_PACKAGE_CODE,
} from '#calendar/data_files'
import { calendarMatchKey } from '#calendar/keys'
import type { EventKind, ExamType } from '#calendar/types'

/**
 * Local demo data: invented schools and people only (Fondasi
 * web-baseline §3, §8). Never runs in production.
 */
export const DEMO_PASSWORD = 'sigrak-demo-2026'

export default class DemoSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    // The region list is idempotent; region_seeder also loads the school directory.
    await seedRegionList(db.connection(), jawaTengahRegions())
    const kudus = await Region.findByOrFail('kemendagriCode', '33.19')
    const kotaKudus = await Region.findByOrFail('kemendagriCode', '33.19.02')
    const jati = await Region.findByOrFail('kemendagriCode', '33.19.03')

    // National holidays and the Jawa Tengah kaldik as layer packages (R1-08). They stay
    // draft until Tim Validasi signs off (D-113, D-254); the demo activates them locally.
    await db.transaction(async (trx) => {
      await importNationalHolidays(trx)
      const region = await importRegionCalendar(trx, {
        file: app.makePath('docs/data/calendar/region-jawa-tengah-2026-2027.json'),
      })
      await activateCalendarPackage(trx, NATIONAL_PACKAGE_CODE, null)
      await activateCalendarPackage(trx, region.packageCode, null)
    })

    const sd = await School.firstOrCreate(
      { name: 'SD Negeri Contoh 1' },
      {
        level: 'sd',
        regionId: kudus.id,
        districtId: kotaKudus.id,
        district: kotaKudus.name,
        address: 'Jalan Contoh No. 1, Kudus',
      }
    )
    const mi = await School.firstOrCreate(
      { name: 'MI Contoh Al-Ikhlas' },
      {
        level: 'mi',
        regionId: kudus.id,
        districtId: jati.id,
        district: jati.name,
        address: 'Jalan Madrasah No. 2, Kudus',
      }
    )

    await this.schoolEvents(sd, [
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
    await this.schoolEvents(mi, [
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

    // The demo console account holds the owner role, so every page shows (R2-01).
    const staff = await StaffUser.firstOrCreate(
      { email: 'admin@sigrak.test' },
      { name: 'Admin Tim SIGRAK', password: DEMO_PASSWORD }
    )
    await StaffRoleAssignment.firstOrCreate({ staffUserId: staff.id, role: 'owner' }, {})

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
   * The school's academic year 2026/2027 (frame of the Jawa Tengah kaldik) and
   * its own events in its school calendar package (D-466: no copy of the region).
   */
  private async schoolEvents(
    school: School,
    own: { kind: EventKind; examType?: ExamType; title: string; startsOn: string; endsOn: string }[]
  ) {
    const now = new Date()
    await db
      .table('academic_years')
      .insert({
        public_id: randomUUID(),
        school_id: school.id,
        name: '2026/2027',
        starts_on: '2026-07-13',
        even_semester_starts_on: '2027-01-02',
        ends_on: '2027-06-19',
        created_at: now,
        updated_at: now,
      })
      .onConflict(['school_id', 'name'])
      .ignore()

    const code = `SCHOOL-${school.id}-CALENDAR-2026-2027`
    const existing = await db.from('layer_packages').where('code', code).first()
    if (existing) return
    const [pkg] = (await db
      .table('layer_packages')
      .insert({
        code,
        domain: 'calendar',
        layer: 'school',
        school_id: school.id,
        line: 'all',
        kind: 'school',
        level_scope: 'both',
        name: 'Perubahan sekolah',
        status: 'active',
        applies_from_school_year: '2026/2027',
        version: 1,
        created_at: now,
        updated_at: now,
      })
      .returning('id')) as { id: number }[]
    for (const [index, event] of own.entries()) {
      const itemKey = `CAL-SCH-DEMO${String(index + 1).padStart(2, '0')}`
      await db.table('calendar_items').insert({
        package_id: pkg.id,
        item_key: itemKey,
        shape: 'list',
        force: 'free',
        origin: 'school',
        match_key: calendarMatchKey({
          itemKey,
          kind: event.kind,
          startsOn: event.startsOn,
          endsOn: event.endsOn,
          title: event.title,
        }),
        revision: 1,
        status: 'active',
        kind: event.kind,
        exam_type: event.examType ?? null,
        title: event.title,
        starts_on: event.startsOn,
        ends_on: event.endsOn,
        created_at: now,
        updated_at: now,
      })
    }
  }
}
