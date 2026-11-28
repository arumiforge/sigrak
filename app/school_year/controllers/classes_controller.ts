import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#models/user'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import Subject from '../../curriculum/models/subject.js'
import AcademicYear from '../models/academic_year.js'
import SchoolClass from '../models/school_class.js'
import TeachingAssignment from '../models/teaching_assignment.js'
import { currentYear, refuseClosed, yearsOfSchool } from '../academic_years.js'
import { rowsOf, setTeachers } from '../assignments.js'
import {
  levelTermsOf,
  type ArtBranchOption,
  type ClassSubjects,
  type SchoolPolicyInput,
} from '../class_subjects.js'
import { deleteClass, saveClass } from '../classes.js'
import { SchoolYearRuleError } from '../errors.js'
import { operatorContext, withRules } from '../http.js'
import { KEEP_CURRENT, pickTeacher, teacherOptions, type TeacherOption } from '../teachers.js'
import { assignmentsValidator, classValidator } from '../validators.js'

const GRADES = [1, 2, 3, 4, 5, 6]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Deps = { classSubjects: ClassSubjects; school: SchoolPolicyInput }

function notFound(): never {
  throw new Exception('Not found', { status: 404, code: 'E_ROW_NOT_FOUND' })
}

function findClass(ctx: HttpContext) {
  return SchoolClass.query()
    .where('public_id', ctx.params.class)
    .preload('academicYear')
    .firstOrFail()
}

async function artBranchesByGrade(deps: Deps, schoolYear: string) {
  const byGrade: Record<string, ArtBranchOption[]> = {}
  for (const grade of GRADES) {
    const list = await deps.classSubjects.forGrade(deps.school, schoolYear, grade)
    byGrade[grade] = list.artBranches
  }
  return byGrade
}

/**
 * A teacher as a select value: the membership public id of an active
 * teacher, else KEEP_CURRENT with the name and `active: false`.
 */
function teacherValue(options: TeacherOption[], userId: number | null, names: Map<number, string>) {
  if (userId === null) return null
  const option = options.find((teacher) => teacher.userId === userId)
  if (option) return { value: option.publicId, name: option.name, active: true }
  return { value: KEEP_CURRENT, name: names.get(userId) ?? '', active: false }
}

async function userNames(ids: number[]) {
  if (ids.length === 0) return new Map<number, string>()
  const users = await User.query().whereIn('id', ids).select('id', 'name')
  return new Map(users.map((user) => [user.id, user.name]))
}

function classInput(input: Awaited<ReturnType<typeof classValidator.validate>>) {
  return {
    name: input.class_name,
    grade: input.grade,
    artBranch: input.art_branch ?? null,
    homeroom: input.homeroom ?? null,
  }
}

/**
 * Kelas (operator, D-241): the classes of a year, add, change, delete,
 * and per class the teacher of each subject (D-032, D-240). The level
 * term "Guru kelas"/"Wali kelas" comes from the Profil Jenjang (D-383).
 */
export default class ClassesController {
  async index(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const wanted = ctx.request.qs().tahun as string | undefined
    if (wanted !== undefined && !UUID.test(wanted)) notFound()

    const props = await tenantTransaction(async () => {
      const years = await yearsOfSchool()
      const year = wanted
        ? (years.find((row) => row.publicId === wanted) ?? notFound())
        : currentYear(years)
      const current = currentYear(years)
      const yearList = [...years].reverse().map((row) => ({
        publicId: row.publicId,
        name: row.name,
        isCurrent: row.id === current?.id,
      }))
      if (!year) {
        return {
          years: yearList,
          year: null,
          classes: [],
          artBranchesByGrade: {},
          teachers: [],
          levelTerms: null,
        }
      }

      const classes = await SchoolClass.query()
        .where('academic_year_id', year.id)
        .orderBy('grade', 'asc')
        .orderBy('name', 'asc')
      const assigned = new Map<number, Set<number>>()
      if (classes.length > 0) {
        const rows = await TeachingAssignment.query().whereIn(
          'class_id',
          classes.map((row) => row.id)
        )
        for (const row of rows) {
          if (!assigned.has(row.classId)) assigned.set(row.classId, new Set())
          assigned.get(row.classId)!.add(row.subjectId)
        }
      }
      const subjectsByGrade = new Map<number, number[]>()
      for (const grade of new Set(classes.map((row) => row.grade))) {
        const list = await deps.classSubjects.forGrade(deps.school, year.name, grade)
        subjectsByGrade.set(
          grade,
          list.subjects.map((subject) => subject.subjectId)
        )
      }
      const names = await userNames(
        classes.flatMap((row) => (row.homeroomTeacherId === null ? [] : [row.homeroomTeacherId]))
      )
      const options = await teacherOptions()
      const policy = await deps.classSubjects.policy(deps.school, year.name)

      return {
        years: yearList,
        year: { publicId: year.publicId, name: year.name, closed: year.isClosed },
        classes: classes.map((row) => {
          const taken = subjectsByGrade.get(row.grade) ?? []
          const held = assigned.get(row.id) ?? new Set<number>()
          return {
            publicId: row.publicId,
            name: row.name,
            grade: row.grade,
            artBranch: row.artBranch,
            homeroomName:
              row.homeroomTeacherId === null ? null : (names.get(row.homeroomTeacherId) ?? null),
            subjectCount: taken.length,
            assignedCount: taken.filter((id) => held.has(id)).length,
          }
        }),
        artBranchesByGrade: await artBranchesByGrade(deps, year.name),
        teachers: options.map(({ publicId, name }) => ({ publicId, name })),
        levelTerms: levelTermsOf(policy),
      }
    })

    return ctx.inertia.render('school_year/classes', props)
  }

  async store(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const yearId = ctx.request.input('year') as string | undefined
    if (!yearId || !UUID.test(yearId)) notFound()
    const year = await tenantTransaction(() =>
      AcademicYear.query().where('public_id', yearId).firstOrFail()
    )
    const path = `/kelas?tahun=${year.publicId}`
    const input = await ctx.request.validateUsing(classValidator)

    return withRules(ctx, path, async () => {
      const saved = await tenantTransaction(async () =>
        saveClass(deps, await AcademicYear.findOrFail(year.id), classInput(input))
      )
      ctx.session.flash('success', ctx.i18n.t('classes.classes.created', { name: saved.name }))
      return ctx.response.redirect().toPath(path)
    })
  }

  async show(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)

    const props = await tenantTransaction(async () => {
      const schoolClass = await findClass(ctx)
      const year = schoolClass.academicYear
      const list = await deps.classSubjects.forGrade(deps.school, year.name, schoolClass.grade)
      const rows = await rowsOf(schoolClass)
      const options = await teacherOptions()
      const names = await userNames([
        ...rows.map((row) => row.teacherId),
        ...(schoolClass.homeroomTeacherId === null ? [] : [schoolClass.homeroomTeacherId]),
      ])
      const rowBySubject = new Map(rows.map((row) => [row.subjectId, row]))
      const takenIds = new Set(list.subjects.map((subject) => subject.subjectId))
      const stale = rows.filter((row) => !takenIds.has(row.subjectId))
      const staleSubjects =
        stale.length === 0
          ? []
          : await Subject.query()
              .whereIn(
                'id',
                stale.map((row) => row.subjectId)
              )
              .orderBy('sort_order', 'asc')

      const subjects = [
        ...list.subjects.map((subject) => ({
          code: subject.code,
          name: subject.name,
          defaultTeacher: subject.defaultTeacher,
          religion: subject.religion,
          taught: true,
          teacher: teacherValue(
            options,
            rowBySubject.get(subject.subjectId)?.teacherId ?? null,
            names
          ),
        })),
        ...staleSubjects.map((subject) => ({
          code: subject.code,
          name: subject.name,
          defaultTeacher: subject.defaultTeacher,
          religion: subject.religion,
          taught: false,
          teacher: teacherValue(options, rowBySubject.get(subject.id)?.teacherId ?? null, names),
        })),
      ]

      return {
        schoolClass: {
          publicId: schoolClass.publicId,
          name: schoolClass.name,
          grade: schoolClass.grade,
          artBranch: schoolClass.artBranch,
          homeroom: teacherValue(options, schoolClass.homeroomTeacherId, names),
        },
        year: { publicId: year.publicId, name: year.name, closed: year.isClosed },
        subjects,
        teachers: options.map(({ publicId, name }) => ({ publicId, name })),
        artBranchesByGrade: await artBranchesByGrade(deps, year.name),
        levelTerms: levelTermsOf(list.policy),
      }
    })

    return ctx.inertia.render('school_year/class', props)
  }

  async update(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const schoolClass = await tenantTransaction(() => findClass(ctx))
    const path = `/kelas/${schoolClass.publicId}`
    const input = await ctx.request.validateUsing(classValidator)

    return withRules(ctx, path, async () => {
      const saved = await tenantTransaction(async () => {
        const fresh = await findClass(ctx)
        return saveClass(deps, fresh.academicYear, classInput(input), fresh)
      })
      ctx.session.flash('success', ctx.i18n.t('classes.classes.updated', { name: saved.name }))
      return ctx.response.redirect().toPath(path)
    })
  }

  async destroy(ctx: HttpContext) {
    await operatorContext(ctx)
    const schoolClass = await tenantTransaction(() => findClass(ctx))
    const year = schoolClass.academicYear

    return withRules(ctx, `/kelas/${schoolClass.publicId}`, async () => {
      await tenantTransaction(async () => {
        const fresh = await findClass(ctx)
        await deleteClass(fresh, fresh.academicYear)
      })
      ctx.session.flash(
        'success',
        ctx.i18n.t('classes.classes.deleted', { name: schoolClass.name })
      )
      return ctx.response.redirect().toPath(`/kelas?tahun=${year.publicId}`)
    })
  }

  async assign(ctx: HttpContext) {
    const { deps } = await operatorContext(ctx)
    const schoolClass = await tenantTransaction(() => findClass(ctx))
    const path = `/kelas/${schoolClass.publicId}`
    const { assignments = {} } = await ctx.request.validateUsing(assignmentsValidator)

    return withRules(ctx, path, async () => {
      await tenantTransaction(async () => {
        const fresh = await findClass(ctx)
        refuseClosed(fresh.academicYear)
        const list = await deps.classSubjects.forGrade(
          deps.school,
          fresh.academicYear.name,
          fresh.grade
        )
        const rows = await rowsOf(fresh)
        const options = await teacherOptions()
        const codes = Object.keys(assignments)
        const known = new Map(list.subjects.map((subject) => [subject.code, subject.subjectId]))
        // A subject no longer taught can still be cleared (D-240).
        const stale = await Subject.query()
          .whereIn(
            'code',
            codes.filter((code) => !known.has(code))
          )
          .whereIn(
            'id',
            rows.map((row) => row.subjectId)
          )
        for (const subject of stale) known.set(subject.code, subject.id)

        const changes = new Map<number, number | null>()
        for (const [code, value] of Object.entries(assignments)) {
          const subjectId = known.get(code)
          if (subjectId === undefined) {
            throw new SchoolYearRuleError(null, 'classes.errors.subject_unknown')
          }
          const current = rows.find((row) => row.subjectId === subjectId)?.teacherId ?? null
          changes.set(subjectId, pickTeacher(options, value, current, `assignments.${code}`))
        }
        await setTeachers(fresh, changes)
      })
      ctx.session.flash('success', ctx.i18n.t('classes.assignments.saved'))
      return ctx.response.redirect().toPath(path)
    })
  }
}
