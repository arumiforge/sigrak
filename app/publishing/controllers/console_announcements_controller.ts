import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Announcement from '#models/announcement'
import type StaffUser from '#models/staff_user'
import { backWithFieldError } from '#accounts/http'
import {
  StaffForbiddenException,
  currentStaff,
  grantsFor,
  regionScopeOf,
  staffCan,
} from '#staff/access'
import { ROLE_SCOPES } from '#staff/roles'
import {
  TARGET_LEVELS,
  TARGET_ROLES,
  canWriteAnnouncements,
  loadPlaces,
  refusalFor,
  writableKinds,
} from '../announcement_rules.js'
import {
  AnnouncementRefusedException,
  createAnnouncement,
  deleteAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
  type AnnouncementInput,
} from '../announcements.js'
import { announcementValidator, targetSearchValidator } from '../validators.js'
import {
  isoOrNull,
  localInput,
  publicUrl,
  publicationState,
  regionsById,
  schoolsById,
} from '../views.js'

type ValidatedAnnouncement = Awaited<ReturnType<typeof announcementValidator.validate>>

function inputOf(data: ValidatedAnnouncement): AnnouncementInput {
  return {
    title: data.title,
    summary: data.summary ?? null,
    body: data.body,
    kind: data.kind,
    showInApp: data.show_in_app,
    showPublic: data.show_public,
    targetRegionIds: data.target_region_ids ?? [],
    targetSchoolIds: data.target_school_ids ?? [],
    targetLevels: data.target_levels ?? [],
    targetRoles: data.target_roles ?? [],
    showFrom: data.show_from ?? null,
    showUntil: data.show_until ?? null,
  }
}

/** The form field a refusal belongs to. */
const REFUSAL_FIELDS = {
  kind: 'kind',
  targets: 'target_region_ids',
  public: 'show_public',
  window: 'show_until',
  where: 'show_in_app',
  state: 'title',
} as const

/**
 * Konsol: Kabar (R2-05, D-319, D-477). One editor for Kabar in the app
 * (with targets) and on sigrak.com/kabar. Abilities:
 * `announcements.manage` (every Kabar), `announcements.write` (in the
 * app, within the role's scope and kinds), `announcements.public`
 * (sigrak.com); the rules live in announcement_rules.ts. A staff
 * member sees and changes only the Kabar they may hold.
 */
export default class ConsoleAnnouncementsController {
  async index(ctx: HttpContext) {
    const staff = await this.#authorize(ctx)
    const rows = await Announcement.query().orderBy('updated_at', 'desc').limit(300)
    const places = await loadPlaces(
      rows.flatMap((row) => row.targetRegionIds),
      rows.flatMap((row) => row.targetSchoolIds)
    )
    const mine = rows.filter((row) => refusalFor(staff, row, places) === null)
    const now = new Date()

    return ctx.inertia.render('console/announcements', {
      announcements: mine.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.kind,
        showInApp: row.showInApp,
        showPublic: row.showPublic,
        state: publicationState(row, now),
        startsAt: isoOrNull(row.startsAt),
        endsAt: isoOrNull(row.endsAt),
        updatedAt: row.updatedAt.toISO()!,
      })),
      can: { write: writableKinds(staff).length > 0 },
    })
  }

  async create(ctx: HttpContext) {
    const staff = await this.#authorize(ctx)
    return ctx.inertia.render('console/announcement_form', {
      announcement: null,
      ...(await this.#formOptions(staff)),
    })
  }

  async edit(ctx: HttpContext) {
    const staff = await this.#authorize(ctx)
    const announcement = await this.#find(ctx, staff)
    const regions = await regionsById(announcement.targetRegionIds)
    const schools = await schoolsById(announcement.targetSchoolIds)
    return ctx.inertia.render('console/announcement_form', {
      announcement: {
        id: announcement.id,
        slug: announcement.slug,
        title: announcement.title,
        summary: announcement.summary ?? '',
        body: announcement.body,
        kind: announcement.kind,
        status: announcement.status,
        state: publicationState(announcement, new Date()),
        showInApp: announcement.showInApp,
        showPublic: announcement.showPublic,
        regions: announcement.targetRegionIds.flatMap((id) => regions.get(id) ?? []),
        schools: announcement.targetSchoolIds.flatMap((id) => schools.get(id) ?? []),
        levels: announcement.targetLevels,
        roles: announcement.targetRoles,
        showFrom: localInput(announcement.startsAt),
        showUntil: localInput(announcement.endsAt),
        publishedAt: isoOrNull(announcement.publishedAt),
        publicUrl:
          announcement.status === 'published' && announcement.showPublic
            ? publicUrl(`/kabar/${announcement.slug}`)
            : null,
      },
      ...(await this.#formOptions(staff)),
    })
  }

  async store(ctx: HttpContext) {
    const staff = await this.#authorize(ctx)
    const data = await ctx.request.validateUsing(announcementValidator)
    try {
      const created = await createAnnouncement(staff, inputOf(data), data.publish ?? false)
      ctx.session.flash(
        'success',
        ctx.i18n.t(data.publish ? 'publishing.toasts.published' : 'publishing.toasts.draft_saved', {
          title: created.title,
        })
      )
      return ctx.response.redirect().toPath(`/kabar/${created.id}`)
    } catch (error) {
      return this.#refused(ctx, error, '/kabar/baru')
    }
  }

  async update(ctx: HttpContext) {
    const staff = await this.#authorize(ctx)
    const announcement = await this.#find(ctx, staff)
    const data = await ctx.request.validateUsing(announcementValidator)
    const back = `/kabar/${announcement.id}`
    const publishing = announcement.status === 'draft' && (data.publish ?? false)
    try {
      await updateAnnouncement(staff, announcement, inputOf(data), data.publish ?? false)
    } catch (error) {
      return this.#refused(ctx, error, back)
    }
    ctx.session.flash(
      'success',
      ctx.i18n.t(publishing ? 'publishing.toasts.published' : 'publishing.toasts.saved', {
        title: announcement.title,
      })
    )
    return ctx.response.redirect().toPath(back)
  }

  async unpublish(ctx: HttpContext) {
    const staff = await this.#authorize(ctx)
    const announcement = await this.#find(ctx, staff)
    await this.#simple(ctx, () => unpublishAnnouncement(staff, announcement), 'unpublished')
    return ctx.response.redirect().toPath(`/kabar/${announcement.id}`)
  }

  async destroy(ctx: HttpContext) {
    const staff = await this.#authorize(ctx)
    const announcement = await this.#find(ctx, staff)
    const done = await this.#simple(ctx, () => deleteAnnouncement(staff, announcement), 'deleted')
    return ctx.response.redirect().toPath(done ? '/kabar' : `/kabar/${announcement.id}`)
  }

  /**
   * Regions and schools to target, as JSON. Staff with an area only
   * find places inside it (the save checks again).
   */
  async targetOptions(ctx: HttpContext) {
    const staff = await this.#authorize(ctx)
    const { wilayah, sekolah } = await ctx.request.validateUsing(targetSearchValidator, {
      data: ctx.request.qs(),
    })
    const limit = staffCan(staff, 'announcements.manage')
      ? null
      : regionScopeOf(staff, 'announcements.write')
    const within = (ids: number[] | null) => (ids === null ? null : ids.length > 0 ? ids : [0])

    const regionQuery = wilayah
      ? db
          .from('regions as r')
          .leftJoin('regions as p', 'p.id', 'r.parent_id')
          .where('r.status', 'active')
          .whereIn('r.level', ['province', 'regency', 'district'])
          .whereILike('r.name', `%${wilayah}%`)
          .orderByRaw(`array_position(ARRAY['province', 'regency', 'district'], r.level::text)`)
          .orderBy('r.name', 'asc')
          .limit(20)
          .select('r.id')
      : null
    const area = within(limit)
    if (regionQuery && area) {
      regionQuery.where((where) =>
        where.whereIn('r.id', area).orWhereIn('r.parent_id', area).orWhereIn('p.parent_id', area)
      )
    }
    const regionRows: { id: number }[] = regionQuery ? await regionQuery : []
    const regionIds = regionRows.map((row) => row.id)

    const schoolQuery = sekolah
      ? db
          .from('schools as s')
          .leftJoin('regions as r', 'r.id', 's.region_id')
          .where((where) => where.whereILike('s.name', `%${sekolah}%`).orWhere('s.npsn', sekolah))
          .orderBy('s.name', 'asc')
          .limit(20)
          .select('s.id')
      : null
    if (schoolQuery && limit !== null) {
      const own = this.#ownSchools(staff)
      schoolQuery.where((where) => {
        where.whereIn('s.id', own.length > 0 ? own : [0])
        if (area) {
          where
            .orWhereIn('s.region_id', area)
            .orWhereIn('s.district_id', area)
            .orWhereIn('r.parent_id', area)
        }
      })
    }
    const schoolRows: { id: number }[] = schoolQuery ? await schoolQuery : []
    const schoolIds = schoolRows.map((row) => row.id)

    const regions = await regionsById(regionIds)
    const schools = await schoolsById(schoolIds)
    return ctx.response.json({
      regions: regionIds.flatMap((id) => regions.get(id) ?? []),
      schools: schoolIds.flatMap((id) => schools.get(id) ?? []),
    })
  }

  async #authorize(ctx: HttpContext) {
    const staff = await currentStaff(ctx)
    if (!canWriteAnnouncements(staff)) throw new StaffForbiddenException()
    return staff
  }

  /** The Kabar in the URL, when the staff member may hold it (404 otherwise). */
  async #find(ctx: HttpContext, staff: StaffUser) {
    const announcement = await Announcement.findOrFail(Number(ctx.params.announcement))
    const places = await loadPlaces(announcement.targetRegionIds, announcement.targetSchoolIds)
    if (refusalFor(staff, announcement, places)) throw new StaffForbiddenException()
    return announcement
  }

  async #formOptions(staff: StaffUser) {
    return {
      kinds: writableKinds(staff),
      levels: [...TARGET_LEVELS],
      roles: [...TARGET_ROLES],
      can: {
        manage: staffCan(staff, 'announcements.manage'),
        public: staffCan(staff, 'announcements.manage') || staffCan(staff, 'announcements.public'),
        app: staffCan(staff, 'announcements.manage') || staffCan(staff, 'announcements.write'),
      },
    }
  }

  /** Schools named in the staff member's write scopes (Penjualan, Koordinator wilayah). */
  #ownSchools(staff: StaffUser) {
    return [
      ...new Set(
        grantsFor(staff, 'announcements.write').flatMap((assignment) =>
          ROLE_SCOPES[assignment.role].schools ? assignment.schoolIds : []
        )
      ),
    ]
  }

  #refused(ctx: HttpContext, error: unknown, back: string) {
    if (!(error instanceof AnnouncementRefusedException)) throw error
    return backWithFieldError(
      ctx,
      back,
      REFUSAL_FIELDS[error.reason],
      ctx.i18n.t(`publishing.announcements.errors.${error.reason}`)
    )
  }

  async #simple(ctx: HttpContext, work: () => Promise<void>, toast: 'unpublished' | 'deleted') {
    try {
      await work()
      ctx.session.flash('success', ctx.i18n.t(`publishing.toasts.${toast}`))
      return true
    } catch (error) {
      if (!(error instanceof AnnouncementRefusedException)) throw error
      ctx.session.flash('error', ctx.i18n.t(`publishing.announcements.errors.${error.reason}`))
      return false
    }
  }
}
