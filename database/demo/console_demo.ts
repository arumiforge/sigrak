import i18nManager from '@adonisjs/i18n/services/main'
import { DateTime } from 'luxon'
import Event from '#models/event'
import Region from '#models/region'
import SchoolMembership from '#models/school_membership'
import type School from '#models/school'
import StaffUser from '#models/staff_user'
import Story from '#models/story'
import type User from '#models/user'
import type { StaffRole } from '#models/staff_user'
import { setDefaultTrialDays } from '#accounts/settings'
import { replyToHelpRequest, sendHelpRequest } from '#help/help_requests'
import { startSupportSession } from '#help/support_sessions'
import { setPurposeModels } from '#integrations/ai_models'
import { createAnnouncement } from '#publishing/announcements'
import { publishDraft, startDraft } from '#publishing/legal'
import { savePost } from '#publishing/posts'
import { addToAgenda, planMeeting } from '#problems/forum'
import { createGoodPractice } from '#problems/good_practices'
import { addAnalysis, helpRequestToProblem, moveProblem, recordProblem } from '#problems/problems'
import { loadStaffAccess } from '#staff/access'
import type { ActiveMembership } from '#tenancy/active_membership'
import type { ScopeInput } from '#staff/staff_accounts'
import { createStaff } from '#staff/staff_accounts'

/**
 * Demo data for the staff console (R2-09): Tim SIGRAK colleagues in
 * every role, help requests, Bank Masalah, Bank Praktik Baik, a forum,
 * Kabar, Acara, Cerita Sekolah, a legal page and a support session, so
 * every console page has something to show. Invented people and
 * `.test` addresses only (Fondasi web-baseline §3, §8). Runs once: it
 * stops when the demo colleagues already exist. Staff changes go
 * through the real functions, so Log aktivitas fills too.
 */

const t = (key: string) => i18nManager.locale('id').t(key)

type Colleague = { key: string; name: string; role: StaffRole; scope?: ScopeInput }

export async function seedConsoleDemo(input: {
  owner: StaffUser
  sd: School
  mi: School
  teacher: User
  operator: User
  miTeacher: User
}) {
  const { owner, sd, mi, teacher, operator, miTeacher } = input
  if (await StaffUser.findBy('email', 'dewi.lestari@sigrak.test')) return

  await loadStaffAccess(owner)
  const kudus = await Region.findByOrFail('kemendagriCode', '33.19')
  const jateng = await Region.findByOrFail('kemendagriCode', '33')

  const colleagues: Colleague[] = [
    { key: 'admin', name: 'Dewi Lestari', role: 'admin' },
    { key: 'support', name: 'Fajar Nugroho', role: 'support', scope: { regionIds: [kudus.id] } },
    { key: 'validator', name: 'Laila Rahmawati', role: 'validator' },
    { key: 'curriculum', name: 'Hendra Wijaya', role: 'curriculum', scope: { levels: ['sd'] } },
    { key: 'content', name: 'Maya Puspita', role: 'content' },
    { key: 'sales', name: 'Rizky Pratama', role: 'sales', scope: { regionIds: [kudus.id] } },
    {
      key: 'marketing',
      name: 'Nadia Safitri',
      role: 'marketing',
      scope: { regionIds: [jateng.id] },
    },
    {
      key: 'regional_lead',
      name: 'Yusuf Hidayat',
      role: 'regional_lead',
      scope: { regionIds: [kudus.id] },
    },
    { key: 'finance', name: 'Putri Anggraini', role: 'finance' },
    { key: 'engineer', name: 'Bima Saputra', role: 'engineer' },
    { key: 'researcher', name: 'Sari Wulandari', role: 'researcher' },
  ]
  const staff: Record<string, StaffUser> = {}
  for (const colleague of colleagues) {
    const email = `${colleague.name.toLowerCase().replace(/\s+/g, '.')}@sigrak.test`
    const created = await createStaff(owner, {
      name: colleague.name,
      email,
      role: colleague.role,
      scope: colleague.scope,
    })
    // A demo password, so every colleague can sign in locally.
    created.password = 'sigrak-demo-2026'
    await created.save()
    await loadStaffAccess(created)
    staff[colleague.key] = created
  }

  await setDefaultTrialDays(owner, 14)
  await setPurposeModels(owner, 'document_short', ['gemini-2.5-flash', 'gemini-2.5-flash-lite'])

  // Minta bantuan from the demo schools.
  const sdTeacher = await membershipOf(teacher, sd)
  const sdOperator = await membershipOf(operator, sd)
  const miMember = await membershipOf(miTeacher, mi)
  const keyRequest = await sendHelpRequest(teacher, sdTeacher, {
    category: 'ai_key',
    message:
      'Kunci AI saya sudah dimasukkan, tetapi pembuatan RPM berhenti di langkah kedua dan muncul pesan untuk mencoba lagi nanti.',
    pageUrl: '/coba-ai',
  })
  const scheduleRequest = await sendHelpRequest(operator, sdOperator, {
    category: 'school_data',
    message:
      'Jadwal kelas 4 tidak bisa disimpan karena ada guru yang bentrok, padahal guru itu sudah dipindah ke kelas lain.',
    pageUrl: '/jadwal',
  })
  await sendHelpRequest(miTeacher, miMember, {
    category: 'content',
    message:
      'Apakah materi Akidah Akhlak kelas 3 sudah bisa dipakai untuk membuat LKPD? Saya belum menemukannya di daftar mata pelajaran.',
    pageUrl: '/kalender',
  })
  const accountRequest = await sendHelpRequest(teacher, sdTeacher, {
    category: 'account',
    message:
      'Saya ingin mengganti alamat email akun karena email sekolah yang lama sudah tidak aktif.',
    pageUrl: '/akun',
  })
  await replyToHelpRequest(
    { staff: staff.support, requestId: scheduleRequest.id },
    {
      body: 'Terima kasih, kami sedang memeriksa jadwal kelas 4. Kami kabari lagi setelah selesai.',
      status: 'in_progress',
    }
  )
  await replyToHelpRequest(
    { staff: staff.support, requestId: accountRequest.id },
    {
      body: 'Email akun sudah kami ganti. Silakan masuk dengan alamat yang baru.',
      status: 'done',
    }
  )

  // Bank Masalah: one from a help request, three recorded by hand.
  const { problemId: keyProblem } = await helpRequestToProblem(staff.support, keyRequest.id, {
    mode: 'new',
    title: 'Pembuatan RPM berhenti saat kuota kunci AI habis',
    description:
      'Guru melihat pembuatan berhenti di tengah jalan saat kuota harian kunci gratis habis. Pesannya belum menjelaskan apa yang perlu dilakukan.',
  })
  const fieldProblem = await recordProblem(staff.support, {
    title: 'Operator kesulitan membagi jam pelajaran PJOK',
    description:
      'Saat kunjungan ke beberapa sekolah, operator bertanya cara membagi jam PJOK ke dua guru dalam satu kelas.',
    regionId: kudus.id,
    level: 'sd',
    source: 'field_note',
  })
  const webinarProblem = await recordProblem(staff.support, {
    title: 'Guru MI ingin contoh LKPD Fikih yang siap pakai',
    description:
      'Peserta webinar bulan ini meminta contoh LKPD Fikih kelas 4 yang sesuai kurikulum terbaru.',
    regionId: kudus.id,
    level: 'mi',
    source: 'webinar',
  })
  await recordProblem(staff.support, {
    title: 'Kalender sekolah belum memuat libur daerah',
    description: 'Beberapa operator menanyakan libur daerah yang belum muncul di kalender.',
    regionId: kudus.id,
    level: null,
    source: 'other',
  })
  await moveProblem(staff.support, fieldProblem, 'triaged')
  await moveProblem(staff.support, webinarProblem, 'triaged')
  await moveProblem(staff.support, keyProblem, 'triaged')
  await addAnalysis(staff.researcher, keyProblem, {
    rootCause:
      'Pesan kendala tidak membedakan kuota harian yang habis dari kunci yang salah, jadi guru mencoba berulang kali.',
    regulations: null,
    evidenceLinks: ['https://contoh.sigrak.test/catatan/kuota-kunci'],
    creditedStaffIds: [staff.researcher.id],
    creditedNames: [],
  })
  await moveProblem(staff.researcher, keyProblem, 'analysed')

  const meeting = await planMeeting(owner, DateTime.now().plus({ days: 5 }).toISODate()!)
  await addToAgenda(owner, meeting, keyProblem)

  await createGoodPractice(staff.researcher, {
    title: 'Pojok baca kelas rendah dengan buku buatan murid',
    summary:
      'Guru kelas 2 mengajak murid membuat buku cerita bergambar sendiri, lalu memajangnya di pojok baca kelas.',
    type: 'practice',
    authors: ['Rina Kartika, S.Pd.'],
    link: null,
    level: 'sd',
    year: 2026,
    problemId: null,
  })
  await createGoodPractice(staff.researcher, {
    title: 'Pembelajaran pecahan dengan kertas lipat',
    summary: 'Penelitian tindakan kelas tentang pemahaman pecahan sederhana di kelas 3.',
    type: 'classroom_research',
    authors: ['Siti Aminah, S.Pd.I.', 'Sari Wulandari'],
    link: 'https://contoh.sigrak.test/ptk/pecahan',
    level: 'mi',
    year: 2025,
    problemId: null,
  })

  // Kabar, Acara, Cerita Sekolah, a legal page.
  const window = { showFrom: null, showUntil: null }
  await createAnnouncement(
    owner,
    {
      title: 'Jadwal pemeliharaan server Sabtu malam',
      summary: 'SIGRAK tidak bisa dibuka sekitar satu jam pada Sabtu pukul 22.00 WIB.',
      body: 'Kami memperbarui server pada **Sabtu pukul 22.00–23.00 WIB**. Simpan pekerjaan Anda sebelum waktu itu.',
      kind: 'maintenance',
      showInApp: true,
      showPublic: false,
      targetRegionIds: [],
      targetSchoolIds: [],
      targetLevels: [],
      targetRoles: [],
      ...window,
    },
    true
  )
  await createAnnouncement(
    staff.marketing,
    {
      title: 'Pelatihan menyusun LKPD untuk guru di Kudus',
      summary: 'Pelatihan daring gratis untuk guru SD dan MI di Kabupaten Kudus.',
      body: 'Pelatihan berlangsung lewat konferensi video. Daftar lewat tautan di halaman Acara.',
      kind: 'event',
      showInApp: true,
      showPublic: false,
      targetRegionIds: [kudus.id],
      targetSchoolIds: [],
      targetLevels: [],
      targetRoles: ['teacher'],
      ...window,
    },
    true
  )
  await createAnnouncement(
    owner,
    {
      title: 'Fitur Bank Soal segera hadir',
      summary: 'Draf pengumuman untuk sigrak.com.',
      body: 'Bank Soal membantu guru menyusun soal sesuai capaian pembelajaran.',
      kind: 'general',
      showInApp: false,
      showPublic: true,
      targetRegionIds: [],
      targetSchoolIds: [],
      targetLevels: [],
      targetRoles: [],
      ...window,
    },
    false
  )
  await savePost(
    staff.marketing,
    'event',
    new Event(),
    {
      title: 'Webinar Pembelajaran Mendalam di Kelas Rendah',
      summary: 'Berbagi praktik pembelajaran mendalam untuk kelas 1–3.',
      body: 'Webinar terbuka untuk guru SD dan MI. Sertifikat dikirim lewat email.',
      startsAt: DateTime.now().plus({ days: 12 }).set({ hour: 13, minute: 0 }),
      endsAt: DateTime.now().plus({ days: 12 }).set({ hour: 15, minute: 0 }),
      onlineUrl: 'https://contoh.sigrak.test/webinar',
      place: null,
      registrationUrl: 'https://contoh.sigrak.test/daftar',
    },
    true
  )
  await savePost(
    staff.marketing,
    'story',
    new Story(),
    {
      title: 'Guru SD Negeri Contoh 1 menyiapkan RPM lebih cepat',
      summary: 'Cerita guru kelas 4 yang memakai SIGRAK untuk menyiapkan pembelajaran.',
      body: 'Guru di sekolah ini memakai SIGRAK sejak awal tahun ajaran untuk menyusun RPM dan LKPD.',
      schoolName: 'SD Negeri Contoh 1',
      consentNote: 'Kepala sekolah setuju nama sekolah ditampilkan (surat persetujuan contoh).',
      consentOn: DateTime.now().minus({ days: 10 }),
    },
    true
  )
  const terms = await startDraft(owner, 'terms', {
    title: t('publishing.legal.titles.terms'),
    body: t('publishing.legal.placeholders.terms'),
  })
  await publishDraft(owner, terms)

  // A support session open on the SD (Fajar, Dukungan).
  await startSupportSession(staff.support, sd.id)
}

/** The demo user's active membership at a school, as a request would carry it. */
async function membershipOf(user: User, school: School): Promise<ActiveMembership> {
  const row = await SchoolMembership.query()
    .where({ user_id: user.id, school_id: school.id, status: 'active' })
    .firstOrFail()
  return {
    id: row.id,
    publicId: row.publicId,
    schoolId: row.schoolId,
    userId: row.userId,
    role: row.role,
  }
}
