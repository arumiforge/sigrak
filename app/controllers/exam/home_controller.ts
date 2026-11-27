import type { HttpContext } from '@adonisjs/core/http'
import ExamParticipant from '#models/exam_participant'

/**
 * Placeholder home of the exam site on ujian.
 */
export default class HomeController {
  async show({ inertia, auth }: HttpContext) {
    const participant = auth.use('exam').getUserOrFail()
    if (!(participant instanceof ExamParticipant)) {
      throw new Error('Expected an exam participant')
    }
    await participant.load('examSession')

    return inertia.render('exam/home', {
      username: participant.username,
      sessionTitle: participant.examSession.title,
    })
  }
}
