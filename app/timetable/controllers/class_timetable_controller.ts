import type { HttpContext } from '@adonisjs/core/http'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import SchoolClass from '../../school_year/models/school_class.js'
import { operatorContext, withRules } from '../../school_year/http.js'
import { describeViolation } from '../messages.js'
import TimetableSlot from '../models/timetable_slot.js'
import { classRows } from '../presenters.js'
import {
  classSummary,
  classWarnings,
  deleteSlot,
  saveSlot,
  setLocked,
  type SlotInput,
} from '../slots.js'
import { lockValidator, slotValidator } from '../validators.js'
import { loadYearState } from '../year_state.js'

function findClass(ctx: HttpContext) {
  return SchoolClass.query()
    .where('public_id', ctx.params.class)
    .preload('academicYear')
    .firstOrFail()
}

function findSlot(ctx: HttpContext, schoolClass: SchoolClass) {
  return TimetableSlot.query()
    .where('public_id', ctx.params.slot)
    .where('class_id', schoolClass.id)
    .firstOrFail()
}

function slotInput(input: Awaited<ReturnType<typeof slotValidator.validate>>): SlotInput {
  return {
    weekday: input.weekday,
    startsAt: input.starts_at,
    endsAt: input.ends_at,
    kind: input.kind,
    subject: input.subject ?? null,
    label: input.label ?? null,
    jp: input.jp ?? null,
  }
}

/**
 * Jadwal of one class (operator, D-247…D-251): rows per day, JP per
 * subject against the allocation, warnings for clashes already in the
 * rows, and the lock for the draft timetable (D-262). Another school's
 * class or row is a 404.
 */
export default class ClassTimetableController {
  async show(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const props = await tenantTransaction(async () => {
      const schoolClass = await findClass(ctx)
      const year = schoolClass.academicYear
      const state = await loadYearState(deps, year)
      const summary = classSummary(state, schoolClass.id)
      const classState = state.classes.get(schoolClass.id)!
      return {
        schoolClass: {
          publicId: schoolClass.publicId,
          name: schoolClass.name,
          grade: schoolClass.grade,
        },
        year: { publicId: year.publicId, name: year.name, closed: year.isClosed },
        rows: classRows(state, schoolClass.id),
        summary,
        subjectOptions: classState.subjects.map((subject) => ({
          code: subject.code,
          name: subject.name,
          hasTeacher: classState.rules.teacherOf.has(subject.subjectId),
        })),
        warnings: classWarnings(state, schoolClass.id).map((violation) => {
          const message = describeViolation(violation, state)
          return ctx.i18n.t(message.key, message.params)
        }),
      }
    })
    return ctx.inertia.render('timetable/class', props)
  }

  async store(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const schoolClass = await tenantTransaction(() => findClass(ctx))
    const path = `/kelas/${schoolClass.publicId}/jadwal`
    const input = await ctx.request.validateUsing(slotValidator)
    return withRules(ctx, path, async () => {
      await tenantTransaction(async () => saveSlot(deps, await findClass(ctx), slotInput(input)))
      ctx.session.flash('success', ctx.i18n.t('timetable.class.row_added'))
      return ctx.response.redirect().toPath(path)
    })
  }

  async update(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const schoolClass = await tenantTransaction(() => findClass(ctx))
    await tenantTransaction(() => findSlot(ctx, schoolClass))
    const path = `/kelas/${schoolClass.publicId}/jadwal`
    const input = await ctx.request.validateUsing(slotValidator)
    return withRules(ctx, path, async () => {
      await tenantTransaction(async () => {
        const fresh = await findClass(ctx)
        await saveSlot(deps, fresh, slotInput(input), await findSlot(ctx, fresh))
      })
      ctx.session.flash('success', ctx.i18n.t('timetable.class.row_updated'))
      return ctx.response.redirect().toPath(path)
    })
  }

  async destroy(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const schoolClass = await tenantTransaction(() => findClass(ctx))
    await tenantTransaction(() => findSlot(ctx, schoolClass))
    const path = `/kelas/${schoolClass.publicId}/jadwal`
    return withRules(ctx, path, async () => {
      await tenantTransaction(async () => {
        const fresh = await findClass(ctx)
        await deleteSlot(deps, fresh, await findSlot(ctx, fresh))
      })
      ctx.session.flash('success', ctx.i18n.t('timetable.class.row_deleted'))
      return ctx.response.redirect().toPath(path)
    })
  }

  async lock(ctx: HttpContext) {
    await operatorContext(ctx)
    const schoolClass = await tenantTransaction(() => findClass(ctx))
    await tenantTransaction(() => findSlot(ctx, schoolClass))
    const path = `/kelas/${schoolClass.publicId}/jadwal`
    const { locked } = await ctx.request.validateUsing(lockValidator)
    return withRules(ctx, path, async () => {
      await tenantTransaction(async () => {
        const fresh = await findClass(ctx)
        await setLocked(fresh, await findSlot(ctx, fresh), locked)
      })
      ctx.session.flash(
        'success',
        ctx.i18n.t(locked ? 'timetable.class.row_locked' : 'timetable.class.row_unlocked')
      )
      return ctx.response.redirect().toPath(path)
    })
  }
}
