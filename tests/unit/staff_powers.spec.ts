import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import StaffUser from '#models/staff_user'
import StaffRoleAssignment from '#models/staff_role_assignment'
import { ABILITY_GROUPS, STAFF_ABILITIES, type StaffAbility } from '#staff/abilities'
import { abilitiesOf, coversField, coversLevel, schoolScopeOf, staffCan } from '#staff/access'
import { POWERS } from '#staff/powers'
import { ROLE_SCOPES, STAFF_ROLES, type StaffRole } from '#staff/roles'

/**
 * The access matrix of docs/drafts/internal-roles.md §3 with D-340,
 * D-341, D-439 and D-477, written out by hand: powers.ts must grant
 * exactly this, so a change to a role's powers is a deliberate change
 * to this list too (D-314: powers fixed in code).
 */
const EVERYONE = ['access.view', 'layers.propose']
const TEAMS = ['problems.view', 'good_practices.view', 'forum.view']
const FIELD = [...TEAMS, 'problems.record', 'problems.triage']
const RESEARCH = [...TEAMS, 'problems.analyse', 'good_practices.manage']
const SALES = [
  ...EVERYONE,
  ...FIELD,
  'schools.view',
  'users.view',
  'trials.extend',
  'payments.record',
  'announcements.write',
  'help_requests.view',
  'reports.view',
]

const EXPECTED: Record<StaffRole, string[]> = {
  owner: STAFF_ABILITIES.filter(
    (ability) => ability !== 'payments.record' && ability !== 'support_sessions.start'
  ),
  admin: [
    ...EVERYONE,
    'staff.view',
    'staff.manage',
    'staff.reset_2fa',
    'audit.view',
    'schools.view',
    'schools.manage',
    'users.view',
    'invitations.manage',
    'trials.manage',
    'regions.review',
    'layers.approve',
    'subscriptions.view',
    'subscriptions.manage',
    'payments.view',
    'prices.view',
    'templates.view',
    'catalogs.view',
    'embeds.view',
    'embeds.manage',
    'curriculum.view',
    'announcements.manage',
    'announcements.write',
    'announcements.public',
    'events.manage',
    'stories.manage',
    'legal_pages.manage',
    'help_requests.view',
    'help_requests.manage',
    'support_sessions.view',
    'supervisor_requests.manage',
    'problems.view',
    'problems.record',
    'problems.triage',
    'good_practices.view',
    'forum.view',
    'forum.manage',
    'settings.view',
    'settings.manage',
    'integrations.view',
    'ai_models.view',
    'system_health.view',
    'reports.view',
  ],
  validator: [
    ...EVERYONE,
    ...RESEARCH,
    'layers.approve',
    'templates.view',
    'templates.signoff',
    'catalogs.view',
    'catalogs.signoff',
    'embeds.view',
    'embeds.signoff',
    'curriculum.view',
    'curriculum.signoff',
    'reports.view',
  ],
  content: [
    ...EVERYONE,
    ...RESEARCH,
    'templates.view',
    'templates.prepare',
    'catalogs.view',
    'catalogs.prepare',
    'embeds.view',
    'embeds.prepare',
    'curriculum.view',
    'curriculum.draft',
    'help_requests.view',
    'reports.view',
  ],
  curriculum: [
    ...EVERYONE,
    ...RESEARCH,
    'curriculum.view',
    'curriculum.publish',
    'announcements.write',
    'reports.view',
  ],
  support: [
    ...EVERYONE,
    ...FIELD,
    'schools.view',
    'users.view',
    'subscriptions.view',
    'regions.review',
    'announcements.write',
    'help_requests.view',
    'help_requests.manage',
    'support_sessions.start',
    'supervisor_requests.manage',
    'reports.view',
  ],
  marketing: [
    ...EVERYONE,
    ...FIELD,
    'announcements.write',
    'announcements.public',
    'events.manage',
    'stories.manage',
    'reports.view',
  ],
  sales: SALES,
  regional_lead: [...SALES, 'layers.approve', 'subscriptions.view', 'payments.view'],
  finance: [
    ...EVERYONE,
    'schools.view',
    'subscriptions.view',
    'subscriptions.manage',
    'trials.manage',
    'payments.view',
    'payments.confirm',
    'invoices.manage',
    'prices.view',
    'ai_models.view',
    'help_requests.view',
    'reports.view',
  ],
  engineer: [
    ...EVERYONE,
    ...TEAMS,
    'problems.deliver',
    'audit.view',
    'prices.view',
    'ai_models.view',
    'integrations.view',
    'embeds.view',
    'announcements.write',
    'help_requests.view',
    'system_health.view',
    'system_health.manage',
    'reports.view',
  ],
  researcher: [...EVERYONE, ...RESEARCH, 'curriculum.view'],
}

/** A staff member held in memory with the given assignments (no database). */
function staffWith(
  roles: { role: StaffRole; regionIds?: number[]; levels?: ('sd' | 'mi')[]; fields?: string[] }[],
  disabled = false
) {
  const staff = new StaffUser()
  staff.fill({ id: 1, name: 'Uji', email: 'uji@uji.test', password: 'x' })
  staff.disabledAt = disabled ? DateTime.now() : null
  staff.$setRelated(
    'roleAssignments',
    roles.map((input) => {
      const assignment = new StaffRoleAssignment()
      assignment.role = input.role
      assignment.regionIds = input.regionIds ?? []
      assignment.schoolIds = []
      assignment.levels = input.levels ?? []
      assignment.fields = (input.fields ?? []) as StaffRoleAssignment['fields']
      return assignment
    })
  )
  return staff
}

test.group('Staff | powers per role (D-314, D-338, D-339)', () => {
  test('the catalogue has unique keys and every key is held by some role', ({ assert }) => {
    assert.equal(new Set(STAFF_ABILITIES).size, STAFF_ABILITIES.length)
    for (const ability of STAFF_ABILITIES) {
      assert.isTrue(
        STAFF_ROLES.some((role) => POWERS[role].includes(ability)),
        `${ability} is held by no role`
      )
    }
  })

  test('the R2 keys the later tasks need are in the catalogue (R2-00)', ({ assert }) => {
    const needed = [
      'staff.reset_2fa',
      'settings.manage',
      'integrations.manage',
      'ai_models.manage',
      'system_health.view',
      'system_health.manage',
      'announcements.manage',
      'announcements.write',
      'announcements.public',
      'events.manage',
      'stories.manage',
      'legal_pages.manage',
      'help_requests.view',
      'help_requests.manage',
      'support_sessions.start',
      'support_sessions.view',
      'problems.record',
      'problems.triage',
      'problems.analyse',
      'problems.deliver',
      'problems.decide',
      'good_practices.manage',
      'forum.manage',
      'curriculum.view',
      'curriculum.draft',
      'curriculum.signoff',
      'curriculum.publish',
      'staff.manage',
      'audit.view',
    ]
    assert.includeMembers([...STAFF_ABILITIES], needed)
    assert.deepEqual(Object.keys(ABILITY_GROUPS).length, 9)
  })

  for (const role of STAFF_ROLES) {
    test(`${role}: every ability matches the matrix`, ({ assert }) => {
      const staff = staffWith([{ role }])
      const expected = new Set(EXPECTED[role])
      for (const ability of STAFF_ABILITIES) {
        assert.equal(staffCan(staff, ability), expected.has(ability), `${role} × ${ability}`)
      }
      assert.deepEqual(abilitiesOf(staff), [...expected].sort())
    })
  }

  test('separation of duty and the rules of D-340 and D-341', ({ assert }) => {
    for (const role of STAFF_ROLES) {
      const powers = POWERS[role]
      assert.isFalse(
        powers.includes('payments.record') && powers.includes('payments.confirm'),
        `${role} records and confirms payments`
      )
      // The owner holds everything (matrix ●); sign-off of one's own work
      // is refused per item (R2-08), not by role.
      if (role === 'owner') continue
      const pairs: [StaffAbility, StaffAbility][] = [
        ['templates.prepare', 'templates.signoff'],
        ['catalogs.prepare', 'catalogs.signoff'],
        ['embeds.prepare', 'embeds.signoff'],
        ['curriculum.draft', 'curriculum.signoff'],
        ['curriculum.signoff', 'curriculum.publish'],
      ]
      for (const [write, approve] of pairs) {
        assert.isFalse(
          powers.includes(write) && powers.includes(approve),
          `${role} holds ${write} and ${approve}`
        )
      }
    }
    const holders = (ability: StaffAbility) =>
      STAFF_ROLES.filter((role) => POWERS[role].includes(ability))
    assert.deepEqual(holders('payments.confirm'), ['owner', 'finance'])
    assert.deepEqual(holders('support_sessions.start'), ['support'])
    assert.deepEqual(holders('staff.manage_high'), ['owner'])
    assert.deepEqual(holders('ai_models.manage'), ['owner'])
    assert.deepEqual(holders('prices.manage'), ['owner'])
    assert.deepEqual(holders('problems.decide'), ['owner'])
  })

  test('several roles add up; a disabled account holds nothing', ({ assert }) => {
    const both = staffWith([{ role: 'content' }, { role: 'support' }])
    assert.isTrue(staffCan(both, 'curriculum.draft'))
    assert.isTrue(staffCan(both, 'help_requests.manage'))
    assert.isFalse(staffCan(both, 'staff.manage'))

    const disabled = staffWith([{ role: 'owner' }], true)
    assert.isFalse(staffCan(disabled, 'access.view'))
    assert.deepEqual(abilitiesOf(disabled), [])
  })

  test('a staff member without loaded roles is an error, never "no roles"', ({ assert }) => {
    const staff = new StaffUser()
    assert.throws(() => staffCan(staff, 'access.view'), /not loaded/)
  })
})

test.group('Staff | scope rules (D-338)', () => {
  test('which scope parts each role uses', ({ assert }) => {
    assert.equal(ROLE_SCOPES.owner.area, 'none')
    assert.equal(ROLE_SCOPES.admin.area, 'optional')
    assert.equal(ROLE_SCOPES.support.area, 'optional')
    assert.equal(ROLE_SCOPES.sales.area, 'required')
    assert.isTrue(ROLE_SCOPES.sales.schools)
    assert.isTrue(ROLE_SCOPES.regional_lead.schools)
    assert.isFalse(ROLE_SCOPES.support.schools)
    assert.isTrue(ROLE_SCOPES.validator.fields)
    assert.isTrue(ROLE_SCOPES.curriculum.levels)
    assert.isFalse(ROLE_SCOPES.curriculum.fields)
  })

  test('empty scopes: optional means everywhere, required means nowhere', ({ assert }) => {
    assert.deepEqual(schoolScopeOf(staffWith([{ role: 'support' }]), 'schools.view'), {
      all: true,
    })
    assert.deepEqual(schoolScopeOf(staffWith([{ role: 'sales' }]), 'schools.view'), {
      all: false,
      areas: [],
    })
    assert.deepEqual(schoolScopeOf(staffWith([{ role: 'finance' }]), 'schools.view'), {
      all: true,
    })
    // A region on a role without an area is ignored.
    assert.deepEqual(
      schoolScopeOf(staffWith([{ role: 'finance', regionIds: [5] }]), 'schools.view'),
      { all: true }
    )
  })

  test('the widest granting role wins', ({ assert }) => {
    const staff = staffWith([{ role: 'sales', regionIds: [7] }, { role: 'support' }])
    assert.deepEqual(schoolScopeOf(staff, 'schools.view'), { all: true })
    // trials.extend comes from sales only, so its area stays.
    assert.deepEqual(schoolScopeOf(staff, 'trials.extend'), {
      all: false,
      areas: [{ regionIds: [7], schoolIds: [], levels: [] }],
    })
  })

  test('levels and fields', ({ assert }) => {
    const validator = staffWith([{ role: 'validator', levels: ['mi'], fields: ['islamic'] }])
    assert.isTrue(coversLevel(validator, 'curriculum.signoff', 'mi'))
    assert.isFalse(coversLevel(validator, 'curriculum.signoff', 'sd'))
    assert.isTrue(coversField(validator, 'curriculum.signoff', 'islamic'))
    assert.isFalse(coversField(validator, 'curriculum.signoff', 'mathematics'))
    // A role without the ability covers nothing.
    assert.isFalse(coversLevel(validator, 'curriculum.publish', 'mi'))

    const open = staffWith([{ role: 'content' }])
    assert.isTrue(coversLevel(open, 'curriculum.draft', 'sd'))
    assert.isTrue(coversField(open, 'curriculum.draft', 'hindu'))
  })
})
