import type { IconName } from '~/components/icon'

/**
 * The one role-aware menu config of the shell (R1-12, D-473). Labels
 * are keys in resources/lang/id/nav.json (first word capitalised,
 * D-472). Each area lists its items once; each role picks and orders
 * them. The app shows the first items as the bottom navigation on
 * phones (at most five, the fifth becomes "Lainnya" when there are
 * more) and all of them, grouped, in the sidebar from 1024 px.
 *
 * To add a page: add an item here, then its key to the roles that see
 * it. An item with `available: false` is a placeholder for a page that
 * is still being built (it is never shown); set it to true when the
 * page lands.
 */

export type SchoolRole = 'principal' | 'operator' | 'teacher'

export type NavItem = {
  key: string
  href: string
  label: string
  icon: IconName
  /** Sidebar group heading (nav.sections.*); items without one come first. */
  section?: string
  /** Only the exact path counts as this item (the console home). */
  exact?: boolean
  /** False while the page is still being built in another task. */
  available?: boolean
  /**
   * Console only: the staff ability that opens the page (app/staff/
   * abilities.ts); the item is hidden from staff without it. The
   * server checks again on every request.
   */
  ability?: string
}

const appItems = {
  calendar: { key: 'calendar', href: '/kalender', label: 'nav.calendar', icon: 'calendar' },
  school_years: {
    key: 'school_years',
    href: '/tahun-ajaran',
    label: 'nav.school_years',
    icon: 'school-years',
    section: 'nav.sections.school',
  },
  classes: {
    key: 'classes',
    href: '/kelas',
    label: 'nav.classes',
    icon: 'classes',
    section: 'nav.sections.school',
  },
  teachers: {
    key: 'teachers',
    href: '/guru',
    label: 'nav.teachers',
    icon: 'teachers',
    section: 'nav.sections.school',
  },
  timetable: {
    key: 'timetable',
    href: '/jadwal',
    label: 'nav.timetable',
    icon: 'timetable',
    section: 'nav.sections.school',
  },
  my_timetable: {
    key: 'my_timetable',
    href: '/kelas-saya/jadwal',
    label: 'nav.my_timetable',
    icon: 'timetable',
  },
  extracurricular: {
    key: 'extracurricular',
    href: '/ekstrakurikuler',
    label: 'nav.extracurricular',
    icon: 'extracurricular',
    section: 'nav.sections.layers',
  },
  packages: {
    key: 'packages',
    href: '/paket-daerah',
    label: 'nav.packages',
    icon: 'packages',
    section: 'nav.sections.layers',
  },
  proposals: {
    key: 'proposals',
    href: '/usulan',
    label: 'nav.proposals',
    icon: 'proposals',
    section: 'nav.sections.layers',
  },
  ai_demo: { key: 'ai_demo', href: '/coba-ai', label: 'nav.ai_demo', icon: 'lab' },
} satisfies Record<string, NavItem>

type AppItemKey = keyof typeof appItems

/**
 * Menus per role, in the order of the product concept (operator:
 * Tahun Ajaran, Kelas, Guru, Jadwal, Kaldik, …). The teacher's five
 * menus (Hari ini, Di kelas, Buat, Asesmen, Kelas saya) replace this
 * list when their slices arrive (R5). Without a school (a teacher who
 * signed up alone, D-459) only pages that need no school are listed.
 * Operator order puts Kalender first (D-474); Coba AI (the R0 test
 * page) stays reachable by URL only, not in any menu (D-474).
 */
const appMenus: Record<SchoolRole | 'none', AppItemKey[]> = {
  operator: [
    'calendar',
    'classes',
    'teachers',
    'timetable',
    'school_years',
    'extracurricular',
    'packages',
    'proposals',
  ],
  principal: ['calendar', 'extracurricular', 'packages', 'proposals'],
  teacher: ['calendar', 'my_timetable', 'extracurricular', 'proposals'],
  none: ['calendar'],
}

const visible = (item: NavItem) => item.available !== false

export function appNavFor(role: SchoolRole | null): NavItem[] {
  return appMenus[role ?? 'none'].map((key) => appItems[key] as NavItem).filter(visible)
}

/** At most five bottom slots; with more items the fifth is "Lainnya". */
export const BOTTOM_NAV_SLOTS = 5

export function splitForBottomNav(items: NavItem[]) {
  if (items.length <= BOTTOM_NAV_SLOTS) return { primary: items, more: [] as NavItem[] }
  return {
    primary: items.slice(0, BOTTOM_NAV_SLOTS - 1),
    more: items.slice(BOTTOM_NAV_SLOTS - 1),
  }
}

const consoleItems: NavItem[] = [
  { key: 'home', href: '/', label: 'nav.console.home', icon: 'home', exact: true },
  {
    key: 'schools',
    href: '/sekolah',
    label: 'nav.console.schools',
    icon: 'school',
    section: 'nav.sections.schools',
    ability: 'schools.view',
  },
  {
    key: 'users',
    href: '/pengguna',
    label: 'nav.console.users',
    icon: 'users',
    section: 'nav.sections.schools',
    ability: 'users.view',
  },
  {
    key: 'directory',
    href: '/direktori-sekolah',
    label: 'nav.console.directory',
    icon: 'directory',
    section: 'nav.sections.regions',
    ability: 'regions.review',
  },
  {
    key: 'region_changes',
    href: '/perubahan-wilayah',
    label: 'nav.console.region_changes',
    icon: 'region',
    section: 'nav.sections.regions',
    ability: 'regions.review',
  },
  {
    key: 'area_proposals',
    href: '/usulan-wilayah',
    label: 'nav.console.area_proposals',
    icon: 'proposals',
    section: 'nav.sections.regions',
    ability: 'layers.propose',
  },
  {
    key: 'calendar',
    href: '/kalender',
    label: 'nav.console.calendar',
    icon: 'calendar',
    section: 'nav.sections.regions',
    ability: 'layers.propose',
  },
  {
    key: 'curriculum',
    href: '/kurikulum',
    label: 'nav.console.curriculum',
    icon: 'curriculum',
    section: 'nav.sections.curriculum',
    ability: 'curriculum.view',
  },
  {
    key: 'announcements',
    href: '/kabar',
    label: 'nav.console.announcements',
    icon: 'news',
    section: 'nav.sections.communication',
    ability: 'announcements.write',
  },
  {
    key: 'events',
    href: '/acara',
    label: 'nav.console.events',
    icon: 'event',
    section: 'nav.sections.communication',
    ability: 'events.manage',
  },
  {
    key: 'stories',
    href: '/cerita-sekolah',
    label: 'nav.console.stories',
    icon: 'story',
    section: 'nav.sections.communication',
    ability: 'stories.manage',
  },
  {
    key: 'legal',
    href: '/halaman-legal',
    label: 'nav.console.legal',
    icon: 'legal',
    section: 'nav.sections.communication',
    ability: 'legal_pages.manage',
  },
  {
    key: 'help_requests',
    href: '/bantuan',
    label: 'nav.console.help_requests',
    icon: 'support',
    section: 'nav.sections.support',
    ability: 'help_requests.view',
  },
  {
    key: 'support_sessions',
    href: '/sesi-bantuan',
    label: 'nav.console.support_sessions',
    icon: 'school-view',
    section: 'nav.sections.support',
    ability: 'support_sessions.view',
  },
  {
    key: 'problems',
    href: '/bank-masalah',
    label: 'nav.console.problems',
    icon: 'problem',
    section: 'nav.sections.problems',
    ability: 'problems.view',
  },
  {
    key: 'good_practices',
    href: '/bank-praktik-baik',
    label: 'nav.console.good_practices',
    icon: 'practice',
    section: 'nav.sections.problems',
    ability: 'good_practices.view',
  },
  {
    key: 'forum',
    href: '/forum',
    label: 'nav.console.forum',
    icon: 'forum',
    section: 'nav.sections.problems',
    ability: 'forum.view',
  },
  {
    key: 'settings',
    href: '/pengaturan',
    label: 'nav.console.settings',
    icon: 'settings',
    section: 'nav.sections.system',
    ability: 'settings.view',
    // Integrasi and Model AI below are pages of the same area (R2-03).
    exact: true,
  },
  {
    key: 'integrations',
    href: '/pengaturan/integrasi',
    label: 'nav.console.integrations',
    icon: 'integrations',
    section: 'nav.sections.system',
    ability: 'integrations.view',
  },
  {
    key: 'ai_models',
    href: '/pengaturan/model-ai',
    label: 'nav.console.ai_models',
    icon: 'ai-models',
    section: 'nav.sections.system',
    ability: 'ai_models.view',
  },
  {
    key: 'system_health',
    href: '/kesehatan-sistem',
    label: 'nav.console.system_health',
    icon: 'health',
    section: 'nav.sections.system',
    ability: 'system_health.view',
  },
  {
    key: 'staff',
    href: '/staf',
    label: 'nav.console.staff',
    icon: 'staff',
    section: 'nav.sections.team',
    ability: 'staff.view',
  },
  {
    key: 'activity_log',
    href: '/log-aktivitas',
    label: 'nav.console.activity_log',
    icon: 'activity',
    section: 'nav.sections.team',
    ability: 'audit.view',
  },
  {
    key: 'access',
    href: '/hak-akses',
    label: 'nav.console.access',
    icon: 'access',
    section: 'nav.sections.team',
    ability: 'access.view',
  },
]

/**
 * The console menu for a staff member's abilities (shared prop
 * `staffAbilities`): items without an ability show to everyone.
 */
export function consoleNav(abilities: readonly string[] = []): NavItem[] {
  return consoleItems
    .filter(visible)
    .filter((item) => !item.ability || abilities.includes(item.ability))
}

/** The path part of an Inertia URL ("/kelas?tahun=…" → "/kelas"). */
export function pathOf(url: string) {
  return url.split(/[?#]/)[0] || '/'
}

/**
 * The item a URL belongs to: the exact path or a path below it, so
 * "/kelas/…" is Kelas but "/kelas-saya/jadwal" is not.
 */
export function isActive(item: NavItem, url: string) {
  const path = pathOf(url)
  if (item.exact || item.href === '/') return path === item.href
  return path === item.href || path.startsWith(`${item.href}/`)
}

/**
 * Runs of items with the same section, in menu order, for the sidebar
 * (a group without a section has no heading).
 */
export function groupBySection(items: NavItem[]) {
  const groups: { section: string | null; items: NavItem[] }[] = []
  for (const item of items) {
    const section = item.section ?? null
    const last = groups.at(-1)
    if (last && last.section === section) last.items.push(item)
    else groups.push({ section, items: [item] })
  }
  return groups
}
