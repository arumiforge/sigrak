import { SubjectSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { DefaultTeacher, Religion, SubjectKind, SubjectSchoolLevel } from '../types.js'

/**
 * A subject's status by school year where a regulation phases it in
 * (`subjects.json` `transition`, D-410).
 */
export interface SubjectTransition {
  levels: string[]
  grades: number[]
  periods: {
    until_school_year?: string
    from_school_year?: string
    status: 'elective' | 'compulsory'
    condition?: string
  }[]
  [key: string]: unknown
}

export interface SubjectDelivery {
  options: ('subject' | 'cocurricular')[]
  chosen_by: string
  source?: string
}

/**
 * Global subject catalogue (D-227, D-452).
 */
export default class Subject extends SubjectSchema {
  declare kind: SubjectKind
  declare defaultTeacher: DefaultTeacher
  declare religion: Religion | null
  declare schoolLevel: SubjectSchoolLevel

  @column()
  declare aliases: string[]

  @column()
  declare transition: SubjectTransition | null

  @column()
  declare offeredGrades: number[] | null

  @column()
  declare delivery: SubjectDelivery | null
}
