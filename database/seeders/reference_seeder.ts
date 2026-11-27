import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

type HolidayFile = {
  academic_years: {
    academic_year: string
    days: {
      date: string
      name: string
      kind: 'national_holiday' | 'joint_leave'
      decree: string
      is_provisional: boolean
    }[]
  }[]
}

/**
 * Reference data from docs/data/calendar (D-253, D-254): the national
 * holidays and joint leave of 2026/2027. Idempotent per date and name.
 */
export default class ReferenceSeeder extends BaseSeeder {
  async run() {
    const file = JSON.parse(
      await readFile(app.makePath('docs/data/calendar/national-holidays-2026-2027.json'), 'utf8')
    ) as HolidayFile

    const now = new Date()
    const rows = file.academic_years.flatMap((year) =>
      year.days.map((day) => ({
        date: day.date,
        name: day.name,
        kind: day.kind,
        decree: day.decree,
        academic_year: year.academic_year,
        is_provisional: day.is_provisional,
        created_at: now,
        updated_at: now,
      }))
    )

    await db
      .knexQuery()
      .table('national_holidays')
      .insert(rows)
      .onConflict(['date', 'name'])
      .merge(['kind', 'decree', 'academic_year', 'is_provisional', 'updated_at'])
  }
}
