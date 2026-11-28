import vine from '@vinejs/vine'
import { randomBytes } from 'node:crypto'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type StaffUser from '#models/staff_user'
import { SchoolContext } from '../tenancy/school_context.js'
import { staffTransaction } from '../tenancy/tenant_transaction.js'
import { domainAdapter } from './domains/registry.js'
import { canApproveAreaChange, LayerAccessDeniedException } from './access.js'
import { LayerRuleException, LayerRules } from './layer_rules.js'
import { LayerResolver, LayerTransactionRequiredException } from './resolver/layer_resolver.js'
import { affectedRows } from './package_choices.js'
import {
  bumpVersion,
  ensureSchoolPackage,
  insertItem,
  SchoolLayer,
  writeHide,
  type SchoolActor,
} from './school_layer.js'
import { isSchoolYear, todayIso } from './school_years.js'
import {
  FORCES,
  LEVEL_SCOPES,
  LINES,
  type Evidence,
  type Force,
  type Layer,
  type ProposalAction,
  type RegionLayer,
} from './types.js'

/**
 * Proposal flow (docs/drafts/regional-layers.md §6, D-380, D-466).
 *
 * School: draft-free; a teacher or the principal sends a proposal, the
 * operator approves (the change runs through SchoolLayer, so the same
 * rules apply again) or rejects. Area: Tim SIGRAK staff send proposals
 * with evidence; an approver who is not the proposer approves, returns
 * or rejects. Rules run at send and again at approval (§6.3).
 */

export class ProposalNotOpenException extends LayerRuleException {
  constructor() {
    super('layers.errors.proposal_not_open')
  }
}

export const SCHOOL_PROPOSAL_ACTIONS = ['add', 'hide', 'unhide', 'retire'] as const
export type SchoolProposalAction = (typeof SCHOOL_PROPOSAL_ACTIONS)[number]

function trxOrFail(): QueryClientContract {
  const trx = SchoolContext.current()?.trx
  if (!trx) throw new LayerTransactionRequiredException()
  return trx
}

interface ProposalRow {
  id: number
  public_id: string
  domain: string
  target_layer: Exclude<Layer, 'national'>
  region_id: number | null
  school_id: number | null
  package_id: number | null
  action: ProposalAction
  item_key: string | null
  payload: Record<string, any>
  reason: string | null
  evidence: Evidence | null
  status: string
  proposed_by_user_id: number | null
  proposed_by_staff_id: number | null
}

async function lockOpen(client: QueryClientContract, publicId: string, statuses = ['submitted']) {
  const row = (await client
    .from('layer_proposals')
    .where('public_id', publicId)
    .forUpdate()
    .first()) as ProposalRow | undefined
  if (!row || !statuses.includes(row.status)) throw new ProposalNotOpenException()
  return row
}

function labelOf(domain: string, value: unknown) {
  try {
    return domainAdapter(domain).labelOf(value as never)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* School proposals                                                    */
/* ------------------------------------------------------------------ */

export interface SchoolProposalInput {
  domain: string
  schoolYear: string
  action: SchoolProposalAction
  itemKey?: string | null
  item?: unknown
  reason?: string | null
}

async function checkSchoolProposal(
  client: QueryClientContract,
  schoolId: number,
  input: { domain: string; schoolYear: string; action: SchoolProposalAction; itemKey: string | null; item: unknown }
) {
  const adapter = domainAdapter<any, any>(input.domain)
  const resolution = await LayerResolver.resolve(input.domain, schoolId, input.schoolYear, {
    fresh: true,
  })
  const groups = await LayerRules.groups(client, input.domain)
  switch (input.action) {
    case 'add': {
      const payload = await adapter.validatePayload(input.item)
      LayerRules.checkAddition(resolution, { matchKey: adapter.matchKeyOf(payload) })
      return { payload, label: adapter.labelOf(payload) }
    }
    case 'hide': {
      const target = LayerRules.checkHide(resolution, input.itemKey!, 'school', groups)
      return { payload: null, label: adapter.labelOf(target.value) }
    }
    case 'unhide': {
      const hidden = resolution.hidden.find((item) => item.itemKey === input.itemKey)
      if (!hidden || hidden.hiddenBy.layer !== 'school') {
        throw new LayerRuleException('layers.errors.not_own_hide')
      }
      return { payload: null, label: adapter.labelOf(hidden.value) }
    }
    case 'retire': {
      const item = resolution.items.find((entry) => entry.itemKey === input.itemKey)
      if (!item || item.source.layer !== 'school') {
        throw new LayerRuleException('layers.errors.not_own_item')
      }
      LayerRules.checkRetire(resolution, input.itemKey!, groups)
      return { payload: null, label: adapter.labelOf(item.value) }
    }
  }
}

export const SchoolProposals = {
  /**
   * A teacher or the principal sends a proposal for their school.
   */
  async propose(actor: SchoolActor, input: SchoolProposalInput) {
    const client = trxOrFail()
    if (!SCHOOL_PROPOSAL_ACTIONS.includes(input.action)) {
      throw new LayerRuleException('layers.errors.action_unknown')
    }
    const itemKey = input.action === 'add' ? null : (input.itemKey ?? null)
    if (input.action !== 'add' && !itemKey) throw new LayerRuleException('layers.errors.item_not_found')
    const checked = await checkSchoolProposal(client, actor.schoolId, {
      domain: input.domain,
      schoolYear: input.schoolYear,
      action: input.action,
      itemKey,
      item: input.item,
    })
    const now = new Date()
    const [row] = (await client
      .table('layer_proposals')
      .insert({
        domain: input.domain,
        target_layer: 'school',
        school_id: actor.schoolId,
        action: input.action,
        item_key: itemKey,
        payload: JSON.stringify({
          school_year: input.schoolYear,
          label: checked.label,
          item: checked.payload,
        }),
        reason: input.reason ?? null,
        status: 'submitted',
        proposed_by_user_id: actor.userId,
        submitted_at: now,
        created_at: now,
        updated_at: now,
      })
      .returning('public_id')) as { public_id: string }[]
    return row.public_id
  },

  /**
   * The operator approves: the change runs through SchoolLayer (rules
   * again), the proposer is told through a notice.
   */
  async approve(actor: SchoolActor, publicId: string, note: string | null) {
    const client = trxOrFail()
    const proposal = await lockOpen(client, publicId)
    if (proposal.proposed_by_user_id === actor.userId) throw new LayerAccessDeniedException()
    const schoolYear = String(proposal.payload.school_year)
    switch (proposal.action) {
      case 'add':
        await SchoolLayer.add(actor, proposal.domain, schoolYear, proposal.payload.item)
        break
      case 'hide':
        await SchoolLayer.hide(actor, proposal.domain, schoolYear, proposal.item_key!, proposal.reason)
        break
      case 'unhide':
        await SchoolLayer.unhide(actor, proposal.domain, schoolYear, proposal.item_key!)
        break
      case 'retire':
        await SchoolLayer.retire(actor, proposal.domain, schoolYear, proposal.item_key!)
        break
      default:
        throw new LayerRuleException('layers.errors.action_unknown')
    }
    await decide(client, proposal, 'approved', { userId: actor.userId }, note)
  },

  async reject(actor: SchoolActor, publicId: string, note: string | null) {
    const client = trxOrFail()
    const proposal = await lockOpen(client, publicId)
    if (proposal.proposed_by_user_id === actor.userId) throw new LayerAccessDeniedException()
    await decide(client, proposal, 'rejected', { userId: actor.userId }, note)
  },

  /**
   * The proposer takes back a proposal that is still waiting.
   */
  async withdraw(actor: SchoolActor, publicId: string) {
    const client = trxOrFail()
    const proposal = await lockOpen(client, publicId)
    if (proposal.proposed_by_user_id !== actor.userId) throw new LayerAccessDeniedException()
    await client
      .from('layer_proposals')
      .where('id', proposal.id)
      .update({ status: 'withdrawn', updated_at: new Date() })
  },
}

async function decide(
  client: QueryClientContract,
  proposal: ProposalRow,
  status: 'approved' | 'rejected' | 'returned',
  by: { userId?: number; staffId?: number },
  note: string | null,
  extra: Record<string, unknown> = {}
) {
  const now = new Date()
  await client
    .from('layer_proposals')
    .where('id', proposal.id)
    .update({
      status,
      decided_by_user_id: by.userId ?? null,
      decided_by_staff_id: by.staffId ?? null,
      decided_at: now,
      decision_note: note,
      updated_at: now,
      ...extra,
    })
  if (proposal.school_id !== null && status !== 'returned') {
    await client.table('layer_notices').insert({
      school_id: proposal.school_id,
      kind: 'proposal_decided',
      audience: 'all',
      payload: JSON.stringify({
        domain: proposal.domain,
        proposal_id: proposal.public_id,
        action: proposal.action,
        label: proposal.payload.label ?? null,
        status,
        proposer_user_id: proposal.proposed_by_user_id,
        note,
      }),
      created_at: now,
    })
  }
}

/* ------------------------------------------------------------------ */
/* Area proposals (staff)                                              */
/* ------------------------------------------------------------------ */

const evidenceSchema = vine
  .object({
    regulation_code: vine.string().trim().maxLength(120).optional(),
    document_title: vine.string().trim().maxLength(200).optional(),
    source_file: vine.string().trim().maxLength(300).optional(),
    sha256: vine
      .string()
      .trim()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    source_url: vine.string().trim().url().maxLength(500).optional(),
    pages: vine.array(vine.number().withoutDecimals().min(1)).maxLength(50).optional(),
    note: vine.string().trim().maxLength(500).optional(),
  })
  .optional()

const newPackageValidator = vine.create({
  kind: vine.enum(['official', 'local_agreement'] as const),
  name: vine.string().trim().minLength(3).maxLength(200),
  line: vine.enum(LINES),
  level_scope: vine.enum(LEVEL_SCOPES),
  applies_from_school_year: vine.string().trim().regex(/^\d{4}\/\d{4}$/),
  applies_to_school_year: vine
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/)
    .optional(),
  effective_on: vine.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const forceValidator = vine.create({ force: vine.enum(FORCES).optional() })
const evidenceValidator = vine.create({ evidence: evidenceSchema })

export interface AreaProposalInput {
  domain: string
  regionId: number
  action: ProposalAction
  /** The package the change goes into (all actions but create_package). */
  packagePublicId?: string | null
  itemKey?: string | null
  /** create_package: the package fields; add/revise: `{ item, force? }`. */
  payload?: Record<string, unknown>
  reason?: string | null
  evidence?: Evidence | null
  /** The school year the checks read (default the package's first year). */
  schoolYear?: string
}

interface AreaPackageRow {
  id: number
  public_id: string
  code: string
  domain: string
  layer: RegionLayer
  kind: 'official' | 'local_agreement'
  status: string
  region_id: number
  applies_from_school_year: string
}

const hasEvidence = (evidence: Evidence | null | undefined) =>
  !!evidence &&
  !!(evidence.regulation_code || evidence.document_title || evidence.source_url || evidence.source_file)

async function regionOf(client: QueryClientContract, regionId: number) {
  const region = (await client
    .from('regions')
    .where('id', regionId)
    .select('id', 'level', 'kemendagri_code', 'name')
    .first()) as { id: number; level: RegionLayer; kemendagri_code: string; name: string } | undefined
  if (!region) throw new LayerRuleException('layers.errors.not_found')
  return region
}

async function areaPackage(
  client: QueryClientContract,
  publicId: string | number | null | undefined,
  regionId: number,
  domain: string
) {
  if (publicId === null || publicId === undefined) throw new LayerRuleException('layers.errors.package_required')
  const query = client.from('layer_packages').where('region_id', regionId).where('domain', domain)
  if (typeof publicId === 'number') query.where('id', publicId)
  else query.where('public_id', publicId)
  const pkg = (await query.first()) as AreaPackageRow | undefined
  if (!pkg) throw new LayerRuleException('layers.errors.not_found')
  if (pkg.status === 'retired') throw new LayerRuleException('layers.errors.package_retired')
  return pkg
}

/**
 * The checks of an area proposal (at send and at approval). Returns the
 * normalised payload and the package (when there is one).
 */
async function checkAreaProposal(
  client: QueryClientContract,
  input: {
    domain: string
    regionId: number
    action: ProposalAction
    packageRef: string | number | null
    itemKey: string | null
    payload: Record<string, any>
    evidence: Evidence | null
    schoolYear?: string
  }
) {
  const region = await regionOf(client, input.regionId)
  const adapter = domainAdapter<any, any>(input.domain)

  if (input.action === 'create_package') {
    const fields = await newPackageValidator.validate(input.payload)
    if (!isSchoolYear(fields.applies_from_school_year) ||
        (fields.applies_to_school_year && !isSchoolYear(fields.applies_to_school_year))) {
      throw new LayerRuleException('layers.errors.school_year')
    }
    if (region.level === 'district' && fields.kind === 'official') {
      throw new LayerRuleException('layers.errors.official_at_district')
    }
    await evidenceValidator.validate({ evidence: input.evidence ?? undefined })
    if (!hasEvidence(input.evidence)) throw new LayerRuleException('layers.errors.evidence_required')
    return { region, pkg: null, payload: fields, label: fields.name }
  }

  const pkg = await areaPackage(client, input.packageRef, input.regionId, input.domain)
  const schoolYear = input.schoolYear ?? pkg.applies_from_school_year
  const view = () =>
    LayerResolver.resolveArea(input.domain, input.regionId, schoolYear, {
      client,
      includePackageId: pkg.id,
    })
  const groups = await LayerRules.groups(client, input.domain)

  switch (input.action) {
    case 'add':
    case 'revise': {
      const item = await adapter.validatePayload(input.payload.item)
      const { force } = await forceValidator.validate({ force: input.payload.force })
      if (force === 'mandatory' && pkg.kind !== 'official') {
        throw new LayerRuleException('layers.errors.mandatory_needs_official')
      }
      const resolution = await view()
      if (input.action === 'add') {
        LayerRules.checkAddition(resolution, { matchKey: adapter.matchKeyOf(item) })
      } else {
        const own = resolution.items.find(
          (entry) => entry.itemKey === input.itemKey && entry.source.packageCode === pkg.code
        )
        if (!own) throw new LayerRuleException('layers.errors.not_own_item')
      }
      return { region, pkg, payload: { item, force: force ?? 'free' }, label: adapter.labelOf(item) }
    }
    case 'hide': {
      const target = LayerRules.checkHide(await view(), input.itemKey!, region.level, groups)
      return { region, pkg, payload: {}, label: adapter.labelOf(target.value) }
    }
    case 'unhide': {
      const hide = await client
        .from('layer_hides')
        .where('package_id', pkg.id)
        .where('target_item_key', input.itemKey!)
        .where('status', 'active')
        .first()
      if (!hide) throw new LayerRuleException('layers.errors.not_own_hide')
      return { region, pkg, payload: {}, label: input.itemKey }
    }
    case 'retire': {
      const resolution = await view()
      const own = resolution.items.find(
        (entry) => entry.itemKey === input.itemKey && entry.source.packageCode === pkg.code
      )
      if (!own) throw new LayerRuleException('layers.errors.not_own_item')
      LayerRules.checkRetire(resolution, input.itemKey!, groups)
      return { region, pkg, payload: {}, label: adapter.labelOf(own.value) }
    }
    case 'retire_package':
      return { region, pkg, payload: {}, label: pkg.code }
  }
}

const regionTag: Record<RegionLayer, string> = { province: 'PROV', regency: 'KAB', district: 'KEC' }

async function applyAreaChange(
  client: QueryClientContract,
  proposal: ProposalRow,
  checked: Awaited<ReturnType<typeof checkAreaProposal>>,
  staff: StaffUser
) {
  const adapter = domainAdapter<any, any>(proposal.domain)
  const now = new Date()
  if (proposal.action === 'create_package') {
    const fields = checked.payload as Record<string, string | undefined>
    const code = [
      proposal.domain.toUpperCase(),
      checked.region.kemendagri_code.replaceAll('.', ''),
      fields.kind === 'official' ? 'RESMI' : 'KESEPAKATAN',
      fields.applies_from_school_year!.replace('/', '-'),
      randomBytes(3).toString('hex').toUpperCase(),
    ].join('-')
    const [created] = (await client
      .table('layer_packages')
      .insert({
        code,
        domain: proposal.domain,
        layer: checked.region.level,
        region_id: checked.region.id,
        line: fields.line,
        kind: fields.kind,
        level_scope: fields.level_scope,
        name: fields.name,
        status: 'active',
        applies_from_school_year: fields.applies_from_school_year,
        applies_to_school_year: fields.applies_to_school_year ?? null,
        effective_on: fields.effective_on ?? null,
        version: 1,
        evidence: JSON.stringify({ ...proposal.evidence, checked_on: todayIso() }),
        approved_by_staff_id: staff.id,
        approved_at: now,
        created_at: now,
        updated_at: now,
      })
      .returning('id')) as { id: number }[]
    return Number(created.id)
  }

  const pkg = checked.pkg!
  const origin = pkg.kind === 'official' ? 'official' : 'local_agreement'
  switch (proposal.action) {
    case 'add': {
      const itemKey = await insertItem(client, adapter, pkg.id, (checked.payload as any).item, {
        origin,
        tag: regionTag[pkg.layer],
      })
      await setForce(client, adapter.itemTable, pkg.id, itemKey, (checked.payload as any).force)
      break
    }
    case 'revise': {
      const old = (await client
        .from(adapter.itemTable)
        .where('package_id', pkg.id)
        .where('item_key', proposal.item_key!)
        .whereNot('status', 'retired')
        .select('id', 'revision')
        .first()) as { id: number; revision: number }
      await client
        .from(adapter.itemTable)
        .where('id', old.id)
        .update({ status: 'retired', updated_at: now })
      await insertItem(client, adapter, pkg.id, (checked.payload as any).item, {
        origin,
        tag: regionTag[pkg.layer],
        itemKey: proposal.item_key!,
        revision: old.revision + 1,
        supersedesId: old.id,
      })
      await setForce(client, adapter.itemTable, pkg.id, proposal.item_key!, (checked.payload as any).force)
      break
    }
    case 'hide':
      await writeHide(client, pkg.id, proposal.item_key!, proposal.reason, { staffId: staff.id })
      break
    case 'unhide':
      await client
        .from('layer_hides')
        .where('package_id', pkg.id)
        .where('target_item_key', proposal.item_key!)
        .update({ status: 'void', void_reason: 'unhidden', updated_at: now })
      break
    case 'retire':
      await client
        .from(adapter.itemTable)
        .where('package_id', pkg.id)
        .where('item_key', proposal.item_key!)
        .whereNot('status', 'retired')
        .update({ status: 'retired', updated_at: now })
      break
    case 'retire_package':
      await client
        .from('layer_packages')
        .where('id', pkg.id)
        .update({ status: 'retired', updated_at: now })
      return pkg.id
  }
  await bumpVersion(client, pkg.id)
  return pkg.id
}

async function setForce(
  client: QueryClientContract,
  table: string,
  packageId: number,
  itemKey: string,
  force: Force
) {
  if (force === 'free') return
  await client
    .from(table)
    .where('package_id', packageId)
    .where('item_key', itemKey)
    .whereNot('status', 'retired')
    .update({ force, updated_at: new Date() })
}

async function affectedSchools(client: QueryClientContract, regionId: number) {
  const row = (await client
    .from('schools as s')
    .join('regions as r', 'r.id', 's.region_id')
    .where((q) =>
      q.where('s.region_id', regionId).orWhere('s.district_id', regionId).orWhere('r.parent_id', regionId)
    )
    .count('* as total')
    .first()) as { total: string | number }
  return Number(row.total)
}

export const AreaProposals = {
  /**
   * A staff member sends an area proposal. Runs in its own staff
   * transaction.
   */
  async propose(staff: StaffUser, input: AreaProposalInput) {
    return staffTransaction(async (client) => {
      const checked = await checkAreaProposal(client, {
        domain: input.domain,
        regionId: input.regionId,
        action: input.action,
        packageRef: input.packagePublicId ?? null,
        itemKey: input.itemKey ?? null,
        payload: input.payload ?? {},
        evidence: input.evidence ?? null,
        schoolYear: input.schoolYear,
      })
      const now = new Date()
      const [row] = (await client
        .table('layer_proposals')
        .insert({
          domain: input.domain,
          target_layer: checked.region.level,
          region_id: checked.region.id,
          package_id: checked.pkg?.id ?? null,
          action: input.action,
          item_key: input.itemKey ?? null,
          payload: JSON.stringify({
            ...checked.payload,
            label: checked.label,
            school_year: input.schoolYear ?? null,
          }),
          reason: input.reason ?? null,
          evidence: input.evidence ? JSON.stringify(input.evidence) : null,
          status: 'submitted',
          proposed_by_staff_id: staff.id,
          submitted_at: now,
          created_at: now,
          updated_at: now,
        })
        .returning('public_id')) as { public_id: string }[]
      return row.public_id
    })
  },

  /**
   * An approver (not the proposer) approves: the rules run again, the
   * evidence must have been checked, the change is published (package
   * version +1, stamps bumped by triggers) and the impact is stored.
   */
  async approve(
    staff: StaffUser,
    publicId: string,
    decision: { evidenceChecked: boolean; note?: string | null }
  ) {
    if (!canApproveAreaChange(staff)) throw new LayerAccessDeniedException()
    return staffTransaction(async (client) => {
      const proposal = await lockOpen(client, publicId)
      if (proposal.target_layer === 'school') throw new ProposalNotOpenException()
      if (proposal.proposed_by_staff_id === staff.id) {
        throw new LayerRuleException('layers.errors.own_proposal')
      }
      const needsEvidence = proposal.action === 'create_package' || hasEvidence(proposal.evidence)
      if (needsEvidence && !decision.evidenceChecked) {
        throw new LayerRuleException('layers.errors.evidence_unchecked')
      }
      const { label: _label, school_year: schoolYear, ...payload } = proposal.payload
      const checked = await checkAreaProposal(client, {
        domain: proposal.domain,
        regionId: proposal.region_id!,
        action: proposal.action,
        packageRef: proposal.package_id,
        itemKey: proposal.item_key,
        payload,
        evidence: proposal.evidence,
        schoolYear: schoolYear ?? undefined,
      })
      const packageId = await applyAreaChange(client, proposal, checked, staff)
      const impact = { schools: await affectedSchools(client, proposal.region_id!) }
      await decide(client, proposal, 'approved', { staffId: staff.id }, decision.note ?? null, {
        package_id: packageId,
        impact: JSON.stringify(impact),
      })
      return { packageId, impact }
    })
  },

  /** Back to the proposer for changes (area proposals only). */
  async return(staff: StaffUser, publicId: string, note: string | null) {
    if (!canApproveAreaChange(staff)) throw new LayerAccessDeniedException()
    return staffTransaction(async (client) => {
      const proposal = await lockOpen(client, publicId)
      if (proposal.target_layer === 'school') throw new ProposalNotOpenException()
      if (proposal.proposed_by_staff_id === staff.id) {
        throw new LayerRuleException('layers.errors.own_proposal')
      }
      await decide(client, proposal, 'returned', { staffId: staff.id }, note)
    })
  },

  async reject(staff: StaffUser, publicId: string, note: string | null) {
    if (!canApproveAreaChange(staff)) throw new LayerAccessDeniedException()
    return staffTransaction(async (client) => {
      const proposal = await lockOpen(client, publicId)
      if (proposal.target_layer === 'school') throw new ProposalNotOpenException()
      if (proposal.proposed_by_staff_id === staff.id) {
        throw new LayerRuleException('layers.errors.own_proposal')
      }
      await decide(client, proposal, 'rejected', { staffId: staff.id }, note)
    })
  },

  /**
   * The proposer sends a returned proposal again, with new evidence or
   * reason if given; the checks run again.
   */
  async resubmit(
    staff: StaffUser,
    publicId: string,
    changes: { reason?: string | null; evidence?: Evidence | null } = {}
  ) {
    return staffTransaction(async (client) => {
      const proposal = await lockOpen(client, publicId, ['returned'])
      if (proposal.proposed_by_staff_id !== staff.id) throw new LayerAccessDeniedException()
      const evidence = changes.evidence !== undefined ? changes.evidence : proposal.evidence
      const { label: _label, school_year: schoolYear, ...payload } = proposal.payload
      await checkAreaProposal(client, {
        domain: proposal.domain,
        regionId: proposal.region_id!,
        action: proposal.action,
        packageRef: proposal.package_id,
        itemKey: proposal.item_key,
        payload,
        evidence,
        schoolYear: schoolYear ?? undefined,
      })
      const now = new Date()
      await client
        .from('layer_proposals')
        .where('id', proposal.id)
        .update({
          status: 'submitted',
          reason: changes.reason !== undefined ? changes.reason : proposal.reason,
          evidence: evidence ? JSON.stringify(evidence) : null,
          decided_by_staff_id: null,
          decided_at: null,
          submitted_at: now,
          updated_at: now,
        })
    })
  },

  async withdraw(staff: StaffUser, publicId: string) {
    return staffTransaction(async (client) => {
      const proposal = await lockOpen(client, publicId, ['submitted', 'returned'])
      if (proposal.proposed_by_staff_id !== staff.id) throw new LayerAccessDeniedException()
      const updated = await client
        .from('layer_proposals')
        .where('id', proposal.id)
        .update({ status: 'withdrawn', decided_at: null, updated_at: new Date() })
      return affectedRows(updated)
    })
  },
}

export { ensureSchoolPackage, labelOf }
