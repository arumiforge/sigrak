import { test } from '@japa/runner'
import { cleanPageUrl } from '#help/validators'
import { withoutSensitiveFields } from '#help/support_sessions'
import { helpRequestToProblem, PROBLEM_HOOK_READY } from '#help/problem_hook'
import StaffUser from '#models/staff_user'

test.group('Help | helpers', () => {
  test('the attached page is a same-site path, never another host', ({ assert }) => {
    assert.equal(cleanPageUrl('/jadwal?kelas=4A'), '/jadwal?kelas=4A')
    assert.equal(cleanPageUrl('https://app.sigrak.test/kelas/1#guru'), '/kelas/1#guru')
    assert.isNull(cleanPageUrl('//jahat.test/x'))
    assert.isNull(cleanPageUrl('javascript:alert(1)'))
    assert.isNull(cleanPageUrl('kelas'))
    assert.isNull(cleanPageUrl('/a\\b'))
    assert.isNull(cleanPageUrl('/kelas\n/x'))
    assert.isNull(cleanPageUrl('/minta-bantuan?halaman=/x'))
    assert.isNull(cleanPageUrl(undefined))
    assert.lengthOf(cleanPageUrl(`/${'a'.repeat(900)}`)!, 500)
  })

  test('religion and health fields are dropped at every depth', ({ assert }) => {
    const cleaned = withoutSensitiveFields({
      name: 'Ani',
      religion: 'islam',
      members: [{ name: 'Budi', health_notes: 'asma', agama: 'kristen', role: 'teacher' }],
      profile: { kesehatan: { alergi: true }, medicalRecord: 'x', disability: 'y', grade: 4 },
      when: new Date('2026-07-01T00:00:00Z'),
    })
    assert.deepEqual(cleaned, {
      name: 'Ani',
      members: [{ name: 'Budi', role: 'teacher' }],
      profile: { grade: 4 },
      when: new Date('2026-07-01T00:00:00Z'),
    })
  })

  test('the Bank Masalah hook is a stub until R2-07', async ({ assert }) => {
    assert.isFalse(PROBLEM_HOOK_READY)
    await assert.rejects(() => helpRequestToProblem(new StaffUser(), 1), /R2-07/)
  })
})
