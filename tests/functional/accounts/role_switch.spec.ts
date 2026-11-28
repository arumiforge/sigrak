import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import { createSchool } from '#tests/helpers'
import { createMember } from '#tests/tenancy'
import { cookieOf, inertiaPage, postForm, signIn } from '#tests/accounts'
import { visit } from '#tests/helpers'

test.group('Accounts | role switch', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  async function twoRoles() {
    const schoolA = await createSchool('SD Pagi')
    const schoolB = await createSchool('SD Siang')
    const teacher = await createMember(schoolA, 'teacher')
    const operator = await createMember(schoolB, 'operator', teacher.user)
    operator.membership.startedOn = DateTime.fromISO('2026-08-01')
    await operator.membership.save()
    return { schoolA, schoolB, user: teacher.user, teacher, operator }
  }

  test('a person with two roles works as the earliest, then switches', async ({
    client,
    assert,
  }) => {
    const { user, operator } = await twoRoles()
    const session = await signIn(client, 'app', user.email)

    const before = await inertiaPage(client, session, '/ganti-peran')
    assert.equal(before.inertiaProps.role, 'teacher')
    assert.lengthOf(before.inertiaProps.memberships, 2)
    for (const choice of before.inertiaProps.memberships) {
      assert.notProperty(choice, 'id')
      assert.notProperty(choice, 'schoolId')
    }
    const guruBefore = await visit(client, 'app', '/guru', cookieOf(session))
    assert.equal(guruBefore.status(), 403)

    const { response, session: after } = await postForm(client, session, '/ganti-peran', {
      membership: operator.membership.publicId,
    })
    assert.equal(response.header('location'), '/')

    const guru = await inertiaPage(client, after, '/guru')
    guru.assertStatus(200)
    assert.equal(guru.inertiaProps.role, 'operator')
  })

  test('another person’s membership cannot be chosen', async ({ client, assert }) => {
    const { user } = await twoRoles()
    const stranger = await createMember(await createSchool('SD Asing'), 'operator')
    const session = await signIn(client, 'app', user.email)

    const { session: after } = await postForm(client, session, '/ganti-peran', {
      membership: stranger.membership.publicId,
    })
    const page = await inertiaPage(client, after, '/ganti-peran')
    assert.equal(page.inertiaProps.role, 'teacher')
    assert.equal(page.body().flash?.error, 'Peran itu sudah tidak aktif. Pilih peran lain.')
  })

  test('an ended membership drops out of the switch', async ({ client, assert }) => {
    const { user, operator } = await twoRoles()
    operator.membership.merge({ status: 'ended', endedOn: DateTime.fromISO('2026-09-01') })
    await operator.membership.save()
    const session = await signIn(client, 'app', user.email)

    const page = await inertiaPage(client, session, '/ganti-peran')
    assert.lengthOf(page.inertiaProps.memberships, 1)
  })
})
