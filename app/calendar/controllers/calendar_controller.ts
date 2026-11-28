import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import {
  canEditSchoolLayer,
  canProposeSchoolChange,
  LayerAccessDeniedException,
  membershipOf,
  schoolLayerEditor,
} from '../../layers/access.js'
import { runAndRedirect } from '../../layers/controllers/respond.js'
import { LayerRuleException } from '../../layers/layer_rules.js'
import { SchoolProposals } from '../../layers/proposals.js'
import { SchoolLayer } from '../../layers/school_layer.js'
import { currentSchoolYear, todayIso } from '../../layers/school_years.js'
import { currentYear } from '../../school_year/academic_years.js'
import AcademicYear from '../../school_year/models/academic_year.js'
import SchoolClass from '../../school_year/models/school_class.js'
import { CalendarChanges, type CalendarChangeSet } from '../calendar_changes.js'
import { ConflictChecker } from '../conflict_checker.js'
import { calendarAdapter } from '../domain.js'
import {
  effectiveDaysOf,
  entryProps,
  frameProps,
  hiddenEntryProps,
  loadCalendar,
  type CalendarView,
} from '../school_calendar.js'
import { CALENDAR_DOMAIN, type CalendarEventPayload } from '../types.js'
import { calendarProposalValidator, eventFormValidator, yearFormValidator } from '../validators.js'

const PATH = '/kalender'

export class CalendarYearNotFoundException extends Exception {
  static status = 404
  static code = 'E_CALENDAR_YEAR_NOT_FOUND'
}

interface YearChoice {
  academicYear: AcademicYear | null
  schoolYear: string
}

/** The academic year a request is about: `?tahun=` (public id), else the current one (D-241). */
async function chooseYear(publicId: string | null | undefined): Promise<YearChoice> {
  const years = await AcademicYear.query().orderBy('starts_on', 'asc')
  if (publicId) {
    const chosen = years.find((year) => year.publicId === publicId)
    if (!chosen) throw new CalendarYearNotFoundException('Unknown academic year')
    return { academicYear: chosen, schoolYear: chosen.name }
  }
  const current = currentYear(years)
  return { academicYear: current, schoolYear: current?.name ?? currentSchoolYear() }
}

/** A class of the chosen year, by public id (another school's class is a 404 through RLS). */
async function classIdOf(year: YearChoice, publicId: string | null | undefined) {
  if (!publicId) return null
  if (!year.academicYear) throw new LayerRuleException('calendar.errors.class_not_found')
  const found = await SchoolClass.query()
    .where('public_id', publicId)
    .where('academic_year_id', year.academicYear.id)
    .first()
  if (!found) throw new LayerRuleException('calendar.errors.class_not_found')
  return found.id
}

function eventInput(input: {
  kind?: string
  exam_type?: string
  title?: string
  starts_on?: string
  ends_on?: string
}) {
  return Object.fromEntries(
    Object.entries({
      kind: input.kind,
      exam_type: input.exam_type,
      title: input.title,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
    }).filter(([, value]) => value !== undefined && value !== '')
  )
}

function actorOf(membership: { schoolId: number; userId: number }) {
  return { schoolId: membership.schoolId, userId: membership.userId }
}

/**
 * Warnings of the conflict checker (D-260) for an event the operator
 * saves; they do not block, so they ride on the success toast.
 */
async function warningsFor(
  ctx: HttpContext,
  trx: TransactionClientContract,
  schoolId: number,
  schoolYear: string,
  payload: CalendarEventPayload,
  replacing: string | null
) {
  const view = await loadCalendar(trx, schoolId, schoolYear)
  const result = ConflictChecker.checkEvent(
    {
      kind: payload.kind,
      examType: payload.exam_type ?? null,
      startsOn: payload.starts_on,
      endsOn: payload.ends_on,
      classId: payload.class_id ?? null,
    },
    { frame: view.frame, items: view.items.filter((item) => item.itemKey !== replacing) }
  )
  return result.warnings.map((warning) => ctx.i18n.t(warning.key, warning.values))
}

/**
 * Kalender (D-252…D-261, D-380, D-466): one calendar for every role,
 * resolved through the layer model. Every row names its source; the
 * operator changes the school's own layer, the others propose; the
 * operator sees the impact of area changes and teachers the days that
 * moved.
 */
export default class CalendarController {
  async index(ctx: HttpContext) {
    const { inertia, membership, request } = ctx
    const today = todayIso()

    if (!membership) {
      return inertia.render('school/calendar', {
        school: null,
        year: null,
        years: [],
        classes: [],
        selectedClass: null,
        canEdit: false,
        canPropose: false,
        today,
        entries: inertia.defer(async () => []),
        hidden: inertia.defer(async () => []),
        frame: inertia.defer(async () => null),
        effective: inertia.defer(async () => null),
        changes: inertia.defer(async () => null),
      })
    }

    const page = await tenantTransaction(async (trx) => {
      const school = (await trx
        .from('schools')
        .where('id', membership.schoolId)
        .select('name')
        .first()) as { name: string }
      const choice = await chooseYear(request.qs().tahun)
      const classes = choice.academicYear
        ? await SchoolClass.query()
            .where('academic_year_id', choice.academicYear.id)
            .orderBy('grade')
            .orderBy('name')
        : []
      const years = await AcademicYear.query().orderBy('starts_on', 'asc')
      return { school, choice, classes, years }
    })

    const classMap = new Map(
      page.classes.map((row) => [row.id, { id: row.publicId, name: row.name }])
    )
    const selected = page.classes.find((row) => row.publicId === request.qs().kelas) ?? null
    const { choice } = page

    // The deferred props share one read of the calendar.
    let loading: Promise<{ view: CalendarView; changes: CalendarChangeSet | null }> | null = null
    const load = () =>
      (loading ??= tenantTransaction(async (trx) => {
        const view = await loadCalendar(trx, membership.schoolId, choice.schoolYear)
        const changes = await CalendarChanges.since(
          trx,
          membership.schoolId,
          membership.userId,
          view
        )
        return { view, changes }
      }))

    const year = choice.academicYear
    return inertia.render('school/calendar', {
      school: { name: page.school.name },
      year: {
        id: year?.publicId ?? null,
        name: choice.schoolYear,
        startsOn: year?.startsOn.toISODate() ?? `${choice.schoolYear.slice(0, 4)}-07-01`,
        endsOn: year?.endsOn.toISODate() ?? `${choice.schoolYear.slice(5, 9)}-06-30`,
      },
      years: page.years.map((row) => ({ id: row.publicId, name: row.name })),
      classes: page.classes.map((row) => ({ id: row.publicId, name: row.name, grade: row.grade })),
      selectedClass: selected?.publicId ?? null,
      canEdit: canEditSchoolLayer(membership.role),
      canPropose: canProposeSchoolChange(membership.role),
      today,
      entries: inertia.defer(async () => {
        const { view } = await load()
        return view.items
          .filter((item) => item.value.kind !== 'setting')
          .map((item) => entryProps(item, classMap))
      }),
      hidden: inertia.defer(async () => {
        const { view } = await load()
        return view.hidden.map((item) => hiddenEntryProps(item, classMap))
      }),
      frame: inertia.defer(async () => {
        const { view } = await load()
        return { ...frameProps(view.frame), ready: view.ready }
      }),
      effective: inertia.defer(async () => {
        const { view } = await load()
        return effectiveDaysOf(view, selected?.id ?? null)
      }),
      changes: inertia.defer(async () => {
        const { changes } = await load()
        return changes
      }),
    })
  }

  /** The operator adds an event of the school or of one class (D-258). */
  async store(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const input = await ctx.request.validateUsing(eventFormValidator)
    return this.saveEvent(ctx, membership, input, null)
  }

  /** The operator changes one of the school's own events (a new revision). */
  async update(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const input = await ctx.request.validateUsing(eventFormValidator)
    return this.saveEvent(ctx, membership, input, ctx.params.item)
  }

  private async saveEvent(
    ctx: HttpContext,
    membership: { schoolId: number; userId: number },
    input: Awaited<ReturnType<typeof eventFormValidator.validate>>,
    itemKey: string | null
  ) {
    let warnings: string[] = []
    try {
      await tenantTransaction(async (trx) => {
        const choice = await chooseYear(input.year)
        const classId = await classIdOf(choice, input.class)
        const raw = { ...eventInput(input), ...(classId ? { class_id: classId } : {}) }
        const payload = await calendarAdapter.validatePayload(raw)
        if (itemKey) {
          await SchoolLayer.revise(
            actorOf(membership),
            CALENDAR_DOMAIN,
            choice.schoolYear,
            itemKey,
            raw
          )
        } else {
          await SchoolLayer.add(actorOf(membership), CALENDAR_DOMAIN, choice.schoolYear, raw)
        }
        warnings = await warningsFor(
          ctx,
          trx,
          membership.schoolId,
          choice.schoolYear,
          payload,
          itemKey
        )
      })
      const saved = ctx.i18n.t(itemKey ? 'calendar.toasts.updated' : 'calendar.toasts.added')
      ctx.session.flash('success', [saved, ...warnings].join(' '))
    } catch (error) {
      if (!(error instanceof LayerRuleException)) throw error
      ctx.session.flash('error', ctx.i18n.t(error.messageKey, error.values))
    }
    return ctx.response.redirect().toPath(backPath(input.year))
  }

  /** The operator deletes one of the school's own events. */
  async destroy(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const { year } = await ctx.request.validateUsing(yearFormValidator)
    return runAndRedirect(ctx, backPath(year), 'calendar.toasts.deleted', () =>
      tenantTransaction(async () => {
        const choice = await chooseYear(year)
        await SchoolLayer.retire(
          actorOf(membership),
          CALENDAR_DOMAIN,
          choice.schoolYear,
          ctx.params.item
        )
      })
    )
  }

  /** "Masuk sekolah": the operator keeps a joint-leave day (or another non-mandatory item) open. */
  async hide(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const { year, reason } = await ctx.request.validateUsing(yearFormValidator)
    return runAndRedirect(ctx, backPath(year), 'calendar.toasts.hidden', () =>
      tenantTransaction(async () => {
        const choice = await chooseYear(year)
        await SchoolLayer.hide(
          actorOf(membership),
          CALENDAR_DOMAIN,
          choice.schoolYear,
          ctx.params.item,
          reason ?? null
        )
      })
    )
  }

  async unhide(ctx: HttpContext) {
    const membership = schoolLayerEditor(ctx)
    const { year } = await ctx.request.validateUsing(yearFormValidator)
    return runAndRedirect(ctx, backPath(year), 'calendar.toasts.unhidden', () =>
      tenantTransaction(async () => {
        const choice = await chooseYear(year)
        await SchoolLayer.unhide(
          actorOf(membership),
          CALENDAR_DOMAIN,
          choice.schoolYear,
          ctx.params.item
        )
      })
    )
  }

  /** Teachers and the principal propose a new event, a change or a deletion (D-380). */
  async propose(ctx: HttpContext) {
    const membership = membershipOf(ctx)
    if (!canProposeSchoolChange(membership.role)) throw new LayerAccessDeniedException()
    const input = await ctx.request.validateUsing(calendarProposalValidator)
    return runAndRedirect(ctx, backPath(input.year), 'layers.toasts.proposed', () =>
      tenantTransaction(async () => {
        const choice = await chooseYear(input.year)
        const withItem = input.action === 'add' || input.action === 'revise'
        const classId = withItem ? await classIdOf(choice, input.class) : null
        await SchoolProposals.propose(actorOf(membership), {
          domain: CALENDAR_DOMAIN,
          schoolYear: choice.schoolYear,
          action: input.action,
          itemKey: input.item_key ?? null,
          item: withItem
            ? { ...eventInput(input), ...(classId ? { class_id: classId } : {}) }
            : undefined,
          reason: input.reason ?? null,
        })
      })
    )
  }

  /** "Tandai sudah dibaca" on the impact notice or the shift preview. */
  async acknowledge(ctx: HttpContext) {
    const membership = membershipOf(ctx)
    const { year } = await ctx.request.validateUsing(yearFormValidator)
    await tenantTransaction(async (trx) => {
      const choice = await chooseYear(year)
      const view = await loadCalendar(trx, membership.schoolId, choice.schoolYear)
      await CalendarChanges.acknowledge(trx, membership.schoolId, membership.userId, view)
    })
    ctx.session.flash('success', ctx.i18n.t('calendar.toasts.read'))
    return ctx.response.redirect().toPath(backPath(year))
  }
}

function backPath(year: string | undefined) {
  return year ? `${PATH}?tahun=${encodeURIComponent(year)}` : PATH
}
