import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type { HttpContext } from '@adonisjs/core/http'
import SchoolMembership from '#models/school_membership'
import SupervisorAssignment from '#models/supervisor_assignment'
import { createSchool } from '#tests/helpers'
import { asSchool, assertSchoolCannotRead, createMember, createTwoSchools } from '#tests/tenancy'
import { ACTIVE_MEMBERSHIP_SESSION_KEY, resolveActiveMembership } from '#tenancy/active_membership'
import {
  MissingSchoolContextException,
  SchoolContext,
  SchoolMismatchException,
} from '#tenancy/school_context'
import SchoolContextMiddleware, {
  NoActiveMembershipException,
} from '#tenancy/school_context_middleware'
import { staffTransaction, tenantTransaction } from '#tenancy/tenant_transaction'

/**
 * A supervisor's request for a school, written on the owner connection.
 */
async function requestFor(schoolId: number, userId: number) {
  const now = new Date()
  const [row] = await db
    .table('supervisor_assignments')
    .insert({
      school_id: schoolId,
      user_id: userId,
      status: 'requested',
      created_at: now,
      updated_at: now,
    })
    .returning('id')
  return row.id as number
}

test.group('Tenancy | school context', () => {
  test('the context is empty outside a unit of work and isolated per run', async ({ assert }) => {
    assert.isUndefined(SchoolContext.current())
    assert.isNull(SchoolContext.schoolId())
    assert.throws(() => SchoolContext.requireSchoolId(), MissingSchoolContextException.message)

    const seen = await Promise.all(
      [1, 2, 3, 4].map((schoolId) =>
        SchoolContext.runFor(schoolId, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5 - schoolId))
          return SchoolContext.requireSchoolId()
        })
      )
    )
    assert.deepEqual(seen, [1, 2, 3, 4])
    assert.isUndefined(SchoolContext.current())
  })

  test('tenantTransaction refuses to run without a school or user', async ({ assert }) => {
    await assert.rejects(
      () => tenantTransaction(async () => 1),
      MissingSchoolContextException.message
    )
  })

  test('a nested tenant transaction for another school is refused', async ({ assert }) => {
    await assert.rejects(
      () =>
        SchoolContext.runFor(1, () =>
          tenantTransaction(() => tenantTransaction(async () => 1, { schoolId: 2 }))
        ),
      /already open/
    )
  })
})

test.group('Tenancy | school scope on models', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('outside a school context a scoped model returns nothing and cannot create', async ({
    assert,
  }) => {
    const { a } = await createTwoSchools()
    await requestFor(a.school.id, a.user.id)

    assert.lengthOf(await SupervisorAssignment.all(), 0)
    assert.lengthOf(await SupervisorAssignment.withoutSchoolScope(), 0)
    await assert.rejects(
      () => SupervisorAssignment.create({ userId: a.user.id, status: 'requested' }),
      MissingSchoolContextException.message
    )
  })

  test('creating fills school_id from the context and refuses another school', async ({
    assert,
  }) => {
    const { a, b } = await createTwoSchools()

    const created = await asSchool(a.school, () =>
      SupervisorAssignment.create({ userId: a.user.id, status: 'requested' })
    )
    assert.equal(created.schoolId, a.school.id)

    await assert.rejects(
      () =>
        asSchool(a.school, () =>
          SupervisorAssignment.create({
            schoolId: b.school.id,
            userId: b.user.id,
            status: 'requested',
          })
        ),
      SchoolMismatchException.message
    )
  })

  test('school A never reads school B (IDOR), even without the app scope', async ({ assert }) => {
    const { a, b } = await createTwoSchools()
    const own = await requestFor(a.school.id, a.user.id)
    const foreign = await requestFor(b.school.id, b.user.id)

    const listed = await asSchool(a.school, async () => {
      const rows = await SupervisorAssignment.query().orderBy('id')
      return rows.map((row) => row.id)
    })
    assert.deepEqual(listed, [own])

    await assertSchoolCannotRead(assert, a.school, () => SupervisorAssignment.find(foreign))
    await assertSchoolCannotRead(assert, a.school, () =>
      SupervisorAssignment.query().where('id', foreign)
    )
    // The app scope skipped: row-level security still hides school B.
    await assertSchoolCannotRead(assert, a.school, () =>
      SupervisorAssignment.withoutSchoolScope().where('id', foreign).first()
    )
    await assertSchoolCannotRead(assert, b.school, () => SupervisorAssignment.find(own))
  })

  test('bulk updates and deletes stay inside the school', async ({ assert }) => {
    const { a, b } = await createTwoSchools()
    await requestFor(a.school.id, a.user.id)
    const foreign = await requestFor(b.school.id, b.user.id)

    await asSchool(a.school, async () => {
      await SupervisorAssignment.query().update({ status: 'rejected', decidedAt: new Date() })
      await SupervisorAssignment.withoutSchoolScope().where('id', foreign).delete()
    })

    const rowB = await db.from('supervisor_assignments').where('id', foreign).first()
    assert.equal(rowB.status, 'requested')
    const rowsA = await db.from('supervisor_assignments').where('school_id', a.school.id)
    assert.deepEqual(
      rowsA.map((row) => row.status),
      ['rejected']
    )
  })

  test('a row cannot move to another school or be changed from another school', async ({
    assert,
  }) => {
    const { a, b } = await createTwoSchools()
    const id = await requestFor(a.school.id, a.user.id)

    await assert.rejects(
      () =>
        asSchool(a.school, async () => {
          const row = await SupervisorAssignment.findOrFail(id)
          row.schoolId = b.school.id
          await row.save()
        }),
      SchoolMismatchException.message
    )

    // A model loaded by staff and saved under another school's context.
    const loaded = await staffTransaction(() => SupervisorAssignment.findOrFail(id))
    await assert.rejects(
      () =>
        asSchool(b.school, async () => {
          loaded.status = 'rejected'
          await loaded.save()
        }),
      SchoolMismatchException.message
    )
    await assert.rejects(
      () => asSchool(b.school, () => loaded.delete()),
      SchoolMismatchException.message
    )
  })

  test('staff see and change every school inside staffTransaction', async ({ assert }) => {
    const { a, b } = await createTwoSchools()
    const ids = [await requestFor(a.school.id, a.user.id), await requestFor(b.school.id, b.user.id)]

    const listed = await staffTransaction(async () => {
      const rows = await SupervisorAssignment.query().orderBy('id')
      return rows.map((row) => row.id)
    })
    assert.deepEqual(listed, ids)

    const approved = await staffTransaction(async () => {
      const row = await SupervisorAssignment.findOrFail(ids[1])
      row.merge({ status: 'approved', startedOn: DateTime.now(), decidedAt: DateTime.now() })
      return row.save()
    })
    assert.equal(approved.status, 'approved')
  })
})

test.group('Tenancy | active membership', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('picks the earliest active membership, or the one kept in the session', async ({
    assert,
  }) => {
    const { a, b } = await createTwoSchools()
    const later = await createMember(b.school, 'operator', a.user)
    later.membership.startedOn = DateTime.fromISO('2026-08-01')
    await later.membership.save()

    const first = await resolveActiveMembership(a.user.id)
    assert.equal(first?.id, a.membership.id)
    assert.equal(first?.schoolId, a.school.id)

    const chosen = await resolveActiveMembership(a.user.id, later.membership.publicId)
    assert.equal(chosen?.id, later.membership.id)
    assert.equal(chosen?.role, 'operator')

    // Another user's membership or a broken id falls back to the user's own.
    const foreign = await resolveActiveMembership(a.user.id, b.membership.publicId)
    assert.equal(foreign?.id, a.membership.id)
    const broken = await resolveActiveMembership(a.user.id, 'bukan-uuid')
    assert.equal(broken?.id, a.membership.id)
  })

  test('ended memberships do not count', async ({ assert }) => {
    const school = await createSchool('SD Uji C')
    const { user, membership } = await createMember(school)
    membership.merge({ status: 'ended', endedOn: DateTime.fromISO('2026-09-01') })
    await membership.save()

    assert.isNull(await resolveActiveMembership(user.id))
  })

  test('the middleware runs the request inside the membership school', async ({ assert }) => {
    const { a, b } = await createTwoSchools()
    const second = await createMember(b.school, 'operator', a.user)
    const forgotten: string[] = []

    const ctx = await testUtils.createHttpContext()
    Object.assign(ctx, {
      auth: { getUserOrFail: () => a.user },
      session: {
        get: (key: string) =>
          key === ACTIVE_MEMBERSHIP_SESSION_KEY ? second.membership.publicId : undefined,
        forget: (key: string) => forgotten.push(key),
      },
    })

    const seen = await new SchoolContextMiddleware().handle(ctx as HttpContext, async () => ({
      school: SchoolContext.schoolId(),
      user: SchoolContext.current()?.userId,
    }))
    assert.deepEqual(seen, { school: b.school.id, user: a.user.id })
    assert.equal(ctx.membership?.id, second.membership.id)
    assert.deepEqual(forgotten, [])
    assert.isUndefined(SchoolContext.current())
  })

  test('the middleware refuses a user without an active membership', async ({ assert }) => {
    const school = await createSchool('SD Uji D')
    const { user, membership } = await createMember(school)
    await SchoolMembership.query().where('id', membership.id).update({
      status: 'ended',
      endedOn: '2026-09-01',
    })

    const ctx = await testUtils.createHttpContext()
    Object.assign(ctx, { auth: { getUserOrFail: () => user } })

    await assert.rejects(
      () => new SchoolContextMiddleware().handle(ctx as HttpContext, async () => 'tidak boleh'),
      NoActiveMembershipException.message
    )
  })
})
