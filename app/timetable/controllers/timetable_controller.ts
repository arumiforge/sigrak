import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { currentYear, yearsOfSchool } from '../../school_year/academic_years.js'
import { SchoolYearRuleError } from '../../school_year/errors.js'
import AcademicYear from '../../school_year/models/academic_year.js'
import { operatorContext, withRules } from '../../school_year/http.js'
import { createDraft, saveDraft } from '../drafts.js'
import { queueDraft } from '../draft_job.js'
import TimetableDraft from '../models/timetable_draft.js'
import { classRows, presentRow } from '../presenters.js'
import { newSeed } from '../random.js'
import { frameFromInput, loadSettings, saveSettings } from '../settings.js'
import { classSummary, classWarnings, yearRuleRows } from '../slots.js'
import { toClock } from '../time.js'
import { preferenceKeys, type DayFrame, type Preferences } from '../types.js'
import { draftValidator, settingsValidator } from '../validators.js'
import { loadYearState } from '../year_state.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function notFound(): never {
  throw new Exception('Not found', { status: 404, code: 'E_ROW_NOT_FOUND' })
}

/** The year asked for with `?tahun=`, else the current one (D-241). */
async function pickYear(ctx: HttpContext) {
  const wanted = ctx.request.qs().tahun as string | undefined
  if (wanted !== undefined && !UUID.test(wanted)) notFound()
  const years = await yearsOfSchool()
  const year = wanted
    ? (years.find((row) => row.publicId === wanted) ?? notFound())
    : currentYear(years)
  const current = currentYear(years)
  return {
    year,
    years: [...years].reverse().map((row) => ({
      publicId: row.publicId,
      name: row.name,
      isCurrent: row.id === current?.id,
    })),
  }
}

function frameProps(frame: DayFrame) {
  return {
    days: frame.days.map((day) => ({
      weekday: day.weekday,
      startsAt: toClock(day.startsAt),
      lessons: day.lessons,
      opening: day.opening,
    })),
    breaks: frame.breaks,
  }
}

function draftSummary(draft: TimetableDraft, names: Map<number, string>) {
  return {
    publicId: draft.publicId,
    status: draft.status,
    createdAt: draft.createdAt.toISO(),
    classNames: draft.classIds.flatMap((id) => names.get(id) ?? []),
    unplacedJp: draft.result?.unplacedJp ?? null,
  }
}

/**
 * Jadwal overview and Susun Jadwal (operator, D-262, D-381): the
 * classes of a year with their timetable state, the day frame and the
 * switches, drafts for one class or all classes made on the `default`
 * queue, the comparison page, Acak ulang and saving a draft.
 */
export default class TimetableController {
  async index(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const props = await tenantTransaction(async () => {
      const { year, years } = await pickYear(ctx)
      if (!year) return { years, year: null, classes: [] }
      const state = await loadYearState(deps, year)
      const rows = yearRuleRows(state)
      return {
        years,
        year: { publicId: year.publicId, name: year.name, closed: year.isClosed },
        classes: [...state.classes.values()].map((classState) => {
          const summary = classSummary(state, classState.model.id)
          return {
            publicId: classState.model.publicId,
            name: classState.model.name,
            grade: classState.model.grade,
            rowCount: state.slots.filter((slot) => slot.classId === classState.model.id).length,
            complete: summary.complete,
            countedTotal: summary.countedTotal,
            countedComplete: summary.countedComplete,
            warningCount: classWarnings(state, classState.model.id, rows).length,
          }
        }),
      }
    })
    return ctx.inertia.render('timetable/index', props)
  }

  async compose(ctx: HttpContext) {
    await operatorContext(ctx)
    const props = await tenantTransaction(async () => {
      const { year, years } = await pickYear(ctx)
      const settings = await loadSettings()
      const base = {
        years,
        frame: frameProps(settings.frame),
        preferences: settings.preferences,
        settingsSaved: settings.saved,
      }
      if (!year) return { ...base, year: null, classes: [], drafts: [] }
      const classes = await year
        .related('classes')
        .query()
        .orderBy('grade', 'asc')
        .orderBy('name', 'asc')
      const names = new Map(classes.map((row) => [row.id, row.name]))
      const drafts = await TimetableDraft.query()
        .where('academic_year_id', year.id)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(5)
      return {
        ...base,
        year: { publicId: year.publicId, name: year.name, closed: year.isClosed },
        classes: classes.map((row) => ({ publicId: row.publicId, name: row.name })),
        drafts: drafts.map((draft) => draftSummary(draft, names)),
      }
    })
    return ctx.inertia.render('timetable/compose', props)
  }

  async updateSettings(ctx: HttpContext) {
    await operatorContext(ctx)
    const path = '/jadwal/susun-draf'
    const input = await ctx.request.validateUsing(settingsValidator)
    return withRules(ctx, path, async () => {
      const frame = frameFromInput(
        input.days.map((day) => ({
          weekday: day.weekday,
          startsAt: day.starts_at,
          lessons: day.lessons,
          openingKind: day.opening_kind ?? null,
          openingLabel: day.opening_label ?? null,
          openingMinutes: day.opening_minutes ?? null,
        })),
        (input.breaks ?? []).map((row) => ({
          afterLesson: row.after_lesson ?? null,
          minutes: row.minutes ?? null,
        }))
      )
      const columns = {
        maxConsecutive: 'max_consecutive',
        pjokMorning: 'pjok_morning',
        coreEarly: 'core_early',
        spreadWeek: 'spread_week',
        noSplitBreak: 'no_split_break',
      } as const
      const preferences = Object.fromEntries(
        preferenceKeys.map((key) => [key, Boolean(input[columns[key]])])
      ) as Preferences
      await tenantTransaction(() => saveSettings(frame, preferences))
      ctx.session.flash('success', ctx.i18n.t('timetable.compose.settings_saved'))
      return ctx.response.redirect().toPath(path)
    })
  }

  async store(ctx: HttpContext) {
    const { membership } = await operatorContext(ctx)
    const input = await ctx.request.validateUsing(draftValidator)
    const year = await tenantTransaction(() =>
      AcademicYear.query().where('public_id', input.year).first()
    )
    if (!year) notFound()
    const path = `/jadwal/susun-draf?tahun=${year.publicId}`
    return withRules(ctx, path, async () => {
      const draft = await tenantTransaction(async () => {
        const fresh = await AcademicYear.findOrFail(year.id)
        const classes = await fresh.related('classes').query()
        let classIds: number[]
        if (input.target === 'all') {
          classIds = classes.map((row) => row.id)
        } else {
          const picked = classes.find((row) => row.publicId === input.target)
          if (!picked) throw new SchoolYearRuleError('target', 'timetable.errors.class_unknown')
          classIds = [picked.id]
        }
        const settings = await loadSettings()
        return createDraft(fresh, classIds, settings, newSeed(), membership.userId)
      })
      await queueDraft(draft)
      return ctx.response.redirect().toPath(`/jadwal/draf/${draft.publicId}`)
    })
  }

  async show(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const props = await tenantTransaction(async () => {
      const draft = await TimetableDraft.query().where('public_id', ctx.params.draft).firstOrFail()
      const year = await AcademicYear.findOrFail(draft.academicYearId)
      const state = await loadYearState(deps, year)
      const names = new Map([...state.classes].map(([id, row]) => [id, row.model.name]))
      const classes =
        draft.status === 'ready' || draft.status === 'saved'
          ? draft
              .result!.classes.filter((row) => state.classes.has(row.classId))
              .map((row) => ({
                publicId: state.classes.get(row.classId)!.model.publicId,
                name: names.get(row.classId)!,
                current: classRows(state, row.classId),
                draft: row.rows.map((plain) => presentRow(state, row.classId, plain)),
                kept: classRows(state, row.classId).filter((item) => item.locked),
                unplaced: row.unplaced.map((item) => ({
                  subjectName: state.subjects.get(item.subjectId)?.name ?? '',
                  jp: item.jp,
                  reason: item.reason,
                })),
              }))
          : []
      return {
        draft: draftSummary(draft, names),
        year: { publicId: year.publicId, name: year.name, closed: year.isClosed },
        classes,
      }
    })
    return ctx.inertia.render('timetable/draft', props)
  }

  async reshuffle(ctx: HttpContext) {
    const { membership } = await operatorContext(ctx)
    const source = await tenantTransaction(() =>
      TimetableDraft.query().where('public_id', ctx.params.draft).firstOrFail()
    )
    return withRules(ctx, `/jadwal/draf/${source.publicId}`, async () => {
      const draft = await tenantTransaction(async () => {
        const year = await AcademicYear.findOrFail(source.academicYearId)
        const classes = await year.related('classes').query()
        const alive = new Set(classes.map((row) => row.id))
        const classIds = source.classIds.filter((id) => alive.has(id))
        return createDraft(year, classIds, await loadSettings(), newSeed(), membership.userId)
      })
      await queueDraft(draft)
      return ctx.response.redirect().toPath(`/jadwal/draf/${draft.publicId}`)
    })
  }

  async save(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const source = await tenantTransaction(() =>
      TimetableDraft.query().where('public_id', ctx.params.draft).firstOrFail()
    )
    const path = `/jadwal/draf/${source.publicId}`
    return withRules(ctx, path, async () => {
      const saved = await tenantTransaction(async () => {
        const draft = await TimetableDraft.query().where('id', source.id).forUpdate().firstOrFail()
        const year = await AcademicYear.findOrFail(draft.academicYearId)
        return saveDraft(deps, draft, year)
      })
      ctx.session.flash('success', ctx.i18n.t('timetable.draft.saved', saved))
      return ctx.response.redirect().toPath(path)
    })
  }
}
