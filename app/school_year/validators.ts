import vine from '@vinejs/vine'
import { artBranches } from '../curriculum/types.js'
import { MAX_CLASS_NAME } from './copy_classes.js'

const date = () => vine.date({ formats: ['YYYY-MM-DD'] })
const checkbox = () => vine.boolean().optional()

/** Tahun Ajaran form: the name follows the start date (D-241). */
export const academicYearValidator = vine.create({
  starts_on: date(),
  even_semester_starts_on: date(),
  ends_on: date(),
  copy_classes: checkbox(),
  include_grade_one: checkbox(),
})

export const copyClassesValidator = vine.create({
  include_grade_one: checkbox(),
})

/** Kelas form (D-241, D-458). */
export const classValidator = vine.create({
  class_name: vine.string().trim().minLength(1).maxLength(MAX_CLASS_NAME),
  grade: vine.number().withoutDecimals().range([1, 6]),
  art_branch: vine.enum(artBranches).nullable().optional(),
  homeroom: vine.string().trim().maxLength(64).nullable().optional(),
})

/**
 * Guru mapel form: `assignments[<subject code>]` = membership public id,
 * '' (no teacher yet) or KEEP_CURRENT.
 */
export const assignmentsValidator = vine.create({
  assignments: vine.record(vine.string().trim().maxLength(64).nullable().optional()).optional(),
})
