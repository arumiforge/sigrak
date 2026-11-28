/*
 * R2-10 load data: exam cards for one lab in the demo exam session, for
 * `shared_ip.js`. Local and test databases only; never run against
 * production. See README.md.
 *
 * Needs `node ace migration:run` and `node ace db:seed` (the demo school and
 * its open exam session "Simulasi TKA Matematika (contoh)").
 *
 *   node --import=@poppinss/ts-exec spikes/k6/seed_exam_cards.ts
 *
 * Writes, idempotently by card name: CARDS (300) cards lab-001…lab-300 with
 * the card password CARD_PASSWORD (`kartu-lab`), and moves the session's
 * window so it is open now.
 */
import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core/ignitor'

const APP_ROOT = new URL('../../', import.meta.url)
const CARDS = Number(process.env.CARDS ?? 300)
const CARD_PASSWORD = process.env.CARD_PASSWORD ?? 'kartu-lab'
const SESSION_TITLE = 'Simulasi TKA Matematika (contoh)'

const ignitor = new Ignitor(APP_ROOT, {
  importer: (filePath: string) =>
    import(
      filePath.startsWith('./') || filePath.startsWith('../')
        ? new URL(filePath, APP_ROOT).href
        : filePath
    ),
})
const app = ignitor.createApp('console')
app.booting(async () => {
  await import('#start/env')
})
await app.init()
await app.boot()
await app.start(async () => {})

const { DateTime } = await import('luxon')
const { default: ExamSession } = await import('#models/exam_session')
const { default: ExamParticipant } = await import('#models/exam_participant')

const session = await ExamSession.findByOrFail('title', SESSION_TITLE)
session.status = 'open'
session.opensAt = DateTime.now().minus({ hours: 1 })
session.closesAt = DateTime.now().plus({ days: 7 })
await session.save()

const names = Array.from({ length: CARDS }, (_, i) => `lab-${String(i + 1).padStart(3, '0')}`)
const found = await ExamParticipant.query()
  .where('exam_session_id', session.id)
  .whereIn('username', names)
  .select('username')
const existing = new Set(found.map((card) => card.username))
const password = ExamParticipant.encryptPassword(CARD_PASSWORD)
const missing = names.filter((name) => !existing.has(name))
if (missing.length > 0) {
  await ExamParticipant.createMany(
    missing.map((username) => ({
      examSessionId: session.id,
      username,
      password,
      status: 'not_started' as const,
    }))
  )
}
console.log(`exam session ${session.id}: ${missing.length} cards added, ${names.length} in total`)
await app.terminate()
