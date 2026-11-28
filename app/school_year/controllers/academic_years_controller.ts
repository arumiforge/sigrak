import type { HttpContext } from '@adonisjs/core/http'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import AcademicYear from '../models/academic_year.js'
import SchoolClass from '../models/school_class.js'
import {
  currentYear,
  deleteAcademicYear,
  previousYear,
  saveAcademicYear,
  suggestedDates,
  yearName,
  yearsOfSchool,
} from '../academic_years.js'
import { copyClasses, planCopy, sourceClassesOf } from '../copy_classes.js'
import { levelTermsOf } from '../class_subjects.js'
import { isoDate, operatorContext, withRules } from '../http.js'
import { academicYearValidator, copyClassesValidator } from '../validators.js'

const INDEX = '/tahun-ajaran'

/** What the copy panel shows: the source year and the names it makes. */
async function copyPreview(source: AcademicYear | null | undefined) {
  if (!source) return null
  const classes = await sourceClassesOf(source)
  if (classes.length === 0) return null
  return {
    sourceName: source.name,
    withGradeOne: planCopy(classes, true).map(({ name, grade }) => ({ name, grade })),
    withoutGradeOne: planCopy(classes, false).map(({ name, grade }) => ({ name, grade })),
  }
}

function findYear(ctx: HttpContext) {
  return AcademicYear.query().where('public_id', ctx.params.academicYear).firstOrFail()
}

/**
 * Tahun Ajaran (operator, D-241): list, add (with an optional class
 * copy from the previous year, D-242…D-246), change, delete, and copy
 * classes into an empty year.
 */
export default class AcademicYearsController {
  async index(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)

    const props = await tenantTransaction(async () => {
      const years = await yearsOfSchool()
      const counts = new Map<number, number>()
      const rows = await SchoolClass.query()
        .groupBy('academic_year_id')
        .select('academic_year_id')
        .count('* as total')
        .pojo<{ academic_year_id: number; total: string }>()
      for (const row of rows) counts.set(row.academic_year_id, Number(row.total))

      const current = currentYear(years)
      const latest = years.at(-1) ?? null
      const list = []
      for (const year of [...years].reverse()) {
        const classCount = counts.get(year.id) ?? 0
        list.push({
          publicId: year.publicId,
          name: year.name,
          startsOn: isoDate(year.startsOn),
          evenSemesterStartsOn: isoDate(year.evenSemesterStartsOn),
          endsOn: isoDate(year.endsOn),
          closed: year.isClosed,
          isCurrent: year.id === current?.id,
          classCount,
          copy:
            classCount === 0 && !year.isClosed ? await copyPreview(await previousYear(year)) : null,
        })
      }

      const suggestion = suggestedDates(latest)
      return {
        years: list,
        suggestion: {
          name: yearName(suggestion.startsOn),
          startsOn: isoDate(suggestion.startsOn),
          evenSemesterStartsOn: isoDate(suggestion.evenSemesterStartsOn),
          endsOn: isoDate(suggestion.endsOn),
        },
        createCopy: await copyPreview(latest),
        levelTerms: levelTermsOf(
          await deps.classSubjects.policy(
            deps.school,
            current?.name ?? yearName(suggestion.startsOn)
          )
        ),
      }
    })

    return ctx.inertia.render('school_year/academic_years', props)
  }

  async store(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const input = await ctx.request.validateUsing(academicYearValidator)

    return withRules(ctx, INDEX, async () => {
      const { year, copied } = await tenantTransaction(async () => {
        const saved = await saveAcademicYear({
          startsOn: input.starts_on,
          evenSemesterStartsOn: input.even_semester_starts_on,
          endsOn: input.ends_on,
        })
        let count = 0
        if (input.copy_classes) {
          const source = await previousYear(saved)
          const sourceClasses = source ? await sourceClassesOf(source) : []
          if (sourceClasses.length > 0) {
            const result = await copyClasses(deps, saved, input.include_grade_one ?? false)
            count = result.count
          }
        }
        return { year: saved, copied: count }
      })
      ctx.session.flash(
        'success',
        copied > 0
          ? ctx.i18n.t('classes.years.created_with_copy', { year: year.name, count: copied })
          : ctx.i18n.t('classes.years.created', { year: year.name })
      )
      return ctx.response.redirect().toPath(INDEX)
    })
  }

  async edit(ctx: HttpContext) {
    await operatorContext(ctx)
    const year = await tenantTransaction(() => findYear(ctx))
    return ctx.inertia.render('school_year/academic_year_edit', {
      year: {
        publicId: year.publicId,
        name: year.name,
        startsOn: isoDate(year.startsOn),
        evenSemesterStartsOn: isoDate(year.evenSemesterStartsOn),
        endsOn: isoDate(year.endsOn),
        closed: year.isClosed,
      },
    })
  }

  async update(ctx: HttpContext) {
    await operatorContext(ctx)
    const path = `${INDEX}/${ctx.params.academicYear}/ubah`
    await tenantTransaction(() => findYear(ctx))
    const input = await ctx.request.validateUsing(academicYearValidator)

    return withRules(ctx, path, async () => {
      const saved = await tenantTransaction(async () =>
        saveAcademicYear(
          {
            startsOn: input.starts_on,
            evenSemesterStartsOn: input.even_semester_starts_on,
            endsOn: input.ends_on,
          },
          await findYear(ctx)
        )
      )
      ctx.session.flash('success', ctx.i18n.t('classes.years.updated', { year: saved.name }))
      return ctx.response.redirect().toPath(INDEX)
    })
  }

  async destroy(ctx: HttpContext) {
    await operatorContext(ctx)
    const year = await tenantTransaction(() => findYear(ctx))

    return withRules(ctx, INDEX, async () => {
      await tenantTransaction(async () => deleteAcademicYear(await findYear(ctx)))
      ctx.session.flash('success', ctx.i18n.t('classes.years.deleted', { year: year.name }))
      return ctx.response.redirect().toPath(INDEX)
    })
  }

  async copy(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const year = await tenantTransaction(() => findYear(ctx))
    const input = await ctx.request.validateUsing(copyClassesValidator)

    return withRules(ctx, INDEX, async () => {
      const result = await tenantTransaction(async () =>
        copyClasses(deps, await findYear(ctx), input.include_grade_one ?? false)
      )
      ctx.session.flash(
        'success',
        ctx.i18n.t('classes.copy.done', {
          count: result.count,
          source: result.source.name,
          year: year.name,
        })
      )
      return ctx.response.redirect().toPath(`/kelas?tahun=${year.publicId}`)
    })
  }
}
