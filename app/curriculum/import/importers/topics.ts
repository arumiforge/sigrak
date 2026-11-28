import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  CurriculumImportError,
  SubjectLookup,
  assertUnique,
  ensureVersion,
  optionalString,
  reportMissing,
  requireArray,
  requireInt,
  requireOneOf,
  requireString,
  type Json,
  type SourceFile,
  type SubjectRef,
} from '../context.js'
import type { FileReport } from '../report.js'
import { idsByCode, upsertRows, type Row } from '../upsert.js'
import { writeAllocations } from './structure.js'
import type { LevelProfile } from '../../policy/level_profiles.js'
import type { Curation } from '../../models/curriculum_version.js'
import {
  allocationStatuses,
  artBranchByLabel,
  jpTargetSetters,
  phaseOfGrade,
  phases,
  type ArtBranch,
  type Phase,
} from '../../types.js'

const topicJson = [
  'element_codes',
  'weekly_distribution',
  'references',
  'curation_notes',
  'outside_cp',
  'extras',
]

interface AllocationTarget {
  subjectCode: string
  grade: number
  artBranch: ArtBranch | null
  s1Jp: number
  s2Jp: number
  s1Weeks: number
  s2Weeks: number
  setBySchool: boolean
  topicJp: [number, number]
  topicCount: number
}

function branchOf(label: unknown, where: string): ArtBranch | null {
  if (label === undefined || label === null) return null
  const branch = artBranchByLabel[String(label)]
  if (!branch) throw new CurriculumImportError(`${where}: unknown art branch "${label}"`)
  return branch
}

function checkPhase(report: FileReport, grade: number, phase: Phase, where: string, code?: string) {
  const expected = phaseOfGrade(grade)
  if (expected !== phase) {
    report.mismatch(
      'phase_grade',
      `${where}: grade ${grade} is in Fase ${expected}, not ${phase}`,
      code
    )
  }
}

const targetKey = (subjectCode: string, grade: number, branch: ArtBranch | null) =>
  `${subjectCode}|${grade}|${branch ?? ''}`

/**
 * Structure rows (JP per year) and local-content caps of the structure
 * versions that the profiles pair with this topic version, for the
 * cross-check of the SIGRAK semester targets.
 */
async function structureReference(
  trx: TransactionClientContract,
  profiles: Map<string, LevelProfile>,
  versionCode: string
) {
  const structureCodes = new Set<string>()
  for (const profile of profiles.values()) {
    for (const version of profile.versions) {
      if (version.rule_sets.tp_atp_defaults?.some((entry) => entry.code === versionCode)) {
        for (const entry of version.rule_sets.structure_jp ?? []) structureCodes.add(entry.code)
      }
    }
  }
  const yearly = new Map<string, number>()
  const localCap = new Map<number, number>()
  if (structureCodes.size === 0) return { structureCodes, yearly, localCap }

  const versions = (await trx
    .from('curriculum_versions')
    .whereIn('code', [...structureCodes])
    .select('id', 'meta')) as { id: number; meta: { files?: Record<string, Json> } }[]
  for (const version of versions) {
    for (const file of Object.values(version.meta.files ?? {})) {
      const local = (file.local_content ?? {}) as Record<string, Json>
      for (const [grade, rule] of Object.entries(local)) {
        if (typeof rule.max_jp_per_year === 'number')
          localCap.set(Number(grade), rule.max_jp_per_year)
      }
    }
  }
  const rows = (await trx
    .from('subject_allocations')
    .join('subjects', 'subjects.id', 'subject_allocations.subject_id')
    .whereIn(
      'curriculum_version_id',
      versions.map((version) => version.id)
    )
    .where('learning_type', 'intracurricular')
    .select('subjects.code', 'subject_allocations.grade', 'subject_allocations.jp_per_year')) as {
    code: string
    grade: number
    jp_per_year: number
  }[]
  for (const row of rows) yearly.set(`${row.code}|${row.grade}`, row.jp_per_year)
  return { structureCodes, yearly, localCap }
}

/**
 * A SIGRAK topic file (`sigrak_curriculum_topics`, D-363): allocations
 * (semester targets), topics, TP, fokus and fokus–TP links. Files that
 * share a version each answer only for their own subjects.
 */
export async function importTopics(
  trx: TransactionClientContract,
  source: SourceFile,
  report: FileReport,
  profiles: Map<string, LevelProfile>
) {
  const data = source.data
  const versionCode = requireString(data.version_code, `${source.name} version_code`)
  const subjects = await SubjectLookup.load(trx)
  const fileSubjects = requireArray(data.subjects, `${source.name} subjects`)

  // Validate codes before writing anything.
  const allTopics = fileSubjects.flatMap((subject) => requireArray(subject.topics, source.name))
  assertUnique(
    allTopics.map((topic) => String(topic.code)),
    'topic',
    source.name
  )
  assertUnique(
    allTopics.flatMap((topic) =>
      requireArray(topic.learning_objectives, source.name).map((tp) => String(tp.code))
    ),
    'TP',
    source.name
  )
  assertUnique(
    allTopics.flatMap((topic) =>
      requireArray(topic.focus_items, source.name).map((item) => String(item.code))
    ),
    'fokus',
    source.name
  )

  const subjectMeta: Record<string, { curation: Curation | null; cp_version_code: string | null }> =
    {}
  const fileSubjectRefs: SubjectRef[] = []
  for (const [index, subjectData] of fileSubjects.entries()) {
    const where = `${source.name} subjects[${index}]`
    const subject = subjects.get(requireString(subjectData.code, `${where}.code`), where)
    fileSubjectRefs.push(subject)
    subjectMeta[subject.code] = {
      curation: (subjectData.curation as Curation | undefined) ?? null,
      cp_version_code: optionalString(subjectData.cp_version_code, `${where}.cp_version_code`),
      ...(subjectData.note ? { note: subjectData.note } : {}),
    }
  }

  const versionId = await ensureVersion(trx, report, {
    code: versionCode,
    kind: 'topics',
    name: requireString(data.scope ?? versionCode, `${source.name} scope`),
    file: source.name,
    fileMeta: {
      sha256: source.sha256,
      dataset: String(data.dataset),
      status: data.status ?? null,
      part: data.part ?? null,
      subjects: subjectMeta,
    },
  })

  const reference = await structureReference(trx, profiles, versionCode)
  if (reference.structureCodes.size > 0 && reference.yearly.size === 0) {
    report.note(
      'structure_not_imported',
      `Structure ${[...reference.structureCodes].join(', ')} is not imported yet; allocations are not cross-checked`
    )
  }

  // CP elements per CP version, to check topics' element_codes (D-452).
  // PAI's elements are defined in the general CP set and link to the
  // religion CP set (`linked_version_code`), so they count for both.
  const cpCodes = [
    ...new Set(Object.values(subjectMeta).flatMap((meta) => meta.cp_version_code ?? [])),
  ]
  const elementRows = (await trx
    .from('learning_outcome_elements')
    .join(
      'curriculum_versions',
      'curriculum_versions.id',
      'learning_outcome_elements.curriculum_version_id'
    )
    .where((query) => {
      query
        .whereIn('curriculum_versions.code', cpCodes.length > 0 ? cpCodes : [''])
        .orWhereIn(
          'learning_outcome_elements.linked_version_code',
          cpCodes.length > 0 ? cpCodes : ['']
        )
    })
    .select(
      'curriculum_versions.code as version_code',
      'learning_outcome_elements.linked_version_code',
      'learning_outcome_elements.code'
    )) as { version_code: string; linked_version_code: string | null; code: string }[]
  const elementsByVersion = new Map<string, Set<string>>()
  for (const row of elementRows) {
    for (const setCode of [row.version_code, row.linked_version_code]) {
      if (!setCode) continue
      if (!elementsByVersion.has(setCode)) elementsByVersion.set(setCode, new Set())
      elementsByVersion.get(setCode)!.add(row.code)
    }
  }
  const missingCp = cpCodes.filter((code) => !elementsByVersion.has(code))
  if (missingCp.length > 0) {
    report.note(
      'cp_elements_not_imported',
      `No CP elements for ${missingCp.join(', ')} (not imported, or a set without element codes); element_codes not checked there`
    )
  }

  // Allocations (semester targets).
  const allocationRows: Row[] = []
  const targets = new Map<string, AllocationTarget>()
  const branchedSubjects = new Set<string>()
  for (const [index, subjectData] of fileSubjects.entries()) {
    const subject = fileSubjectRefs[index]
    for (const [rowIndex, row] of requireArray(
      subjectData.allocations ?? [],
      subject.code
    ).entries()) {
      const where = `${subject.code} allocations[${rowIndex}]`
      const grade = requireInt(row.grade, `${where}.grade`)
      const phase = requireOneOf(row.phase, phases, `${where}.phase`)
      checkPhase(report, grade, phase, where)
      const artBranch = branchOf(row.art_branch, where)
      if (artBranch) branchedSubjects.add(subject.code)
      const status = requireOneOf(row.status ?? 'compulsory', allocationStatuses, `${where}.status`)
      const setBy = requireOneOf(
        row.jp_target_set_by ?? 'curriculum',
        jpTargetSetters,
        `${where}.jp_target_set_by`
      )
      const s1Jp = requireInt(row.s1_jp, `${where}.s1_jp`)
      const s2Jp = requireInt(row.s2_jp, `${where}.s2_jp`)
      const s1Weeks = requireInt(row.s1_effective_weeks, `${where}.s1_effective_weeks`)
      const s2Weeks = requireInt(row.s2_effective_weeks, `${where}.s2_effective_weeks`)
      const meta: Json = {}
      for (const key of ['intrakurikuler_jp_per_year', 'kokurikuler_jp_per_year']) {
        if (row[key] !== undefined) meta[key] = row[key]
      }
      allocationRows.push({
        curriculum_version_id: versionId,
        subject_id: subject.id,
        grade,
        phase,
        learning_type: 'intracurricular',
        art_branch: artBranch,
        status,
        jp_target_set_by: setBy,
        jp_per_week: requireInt(row.jp_per_week, `${where}.jp_per_week`),
        jp_per_year: s1Jp + s2Jp,
        weeks_per_year: s1Weeks + s2Weeks,
        s1_jp: s1Jp,
        s1_effective_weeks: s1Weeks,
        s2_jp: s2Jp,
        s2_effective_weeks: s2Weeks,
        basis: optionalString(row.basis, `${where}.basis`),
        meta,
      })
      targets.set(targetKey(subject.code, grade, artBranch), {
        subjectCode: subject.code,
        grade,
        artBranch,
        s1Jp,
        s2Jp,
        s1Weeks,
        s2Weeks,
        setBySchool: setBy === 'school',
        topicJp: [0, 0],
        topicCount: 0,
      })

      // Cross-check against the official structure (D-366).
      if (setBy === 'school' || status === 'optional' || reference.yearly.size === 0) continue
      const yearly = reference.yearly.get(`${subject.code}|${grade}`)
      if (subject.kind === 'local_content') {
        const cap = reference.localCap.get(grade)
        if (cap !== undefined && s1Jp + s2Jp > cap) {
          report.mismatch(
            'local_content_cap',
            `${where}: ${s1Jp + s2Jp} JP a year is over the muatan lokal cap of ${cap}`
          )
        }
      } else if (yearly === undefined) {
        report.mismatch(
          'allocation_not_in_structure',
          `${where}: grade ${grade} has no ${subject.code} row in ${[...reference.structureCodes].join(', ')}`
        )
      } else if (yearly !== s1Jp + s2Jp) {
        report.mismatch(
          'allocation_differs_from_structure',
          `${where}: ${s1Jp + s2Jp} JP a year, the structure gives ${yearly}`
        )
      }
    }
  }
  await writeAllocations(trx, report, versionId, allocationRows, {
    subjectIds: fileSubjectRefs.map((subject) => subject.id),
  })

  // Topics.
  const topicRows: Row[] = []
  const tpRows: { topicCode: string; row: Row }[] = []
  const fokusRows: { topicCode: string; row: Row }[] = []
  const links = new Map<string, string[]>()
  for (const [index, subjectData] of fileSubjects.entries()) {
    const subject = fileSubjectRefs[index]
    const cpVersion = subjectMeta[subject.code].cp_version_code
    const knownElements = cpVersion ? elementsByVersion.get(cpVersion) : undefined
    for (const [topicIndex, topic] of requireArray(subjectData.topics, subject.code).entries()) {
      const where = `${subject.code} topics[${topicIndex}]`
      const code = requireString(topic.code, `${where}.code`)
      if (!code.startsWith(`${versionCode}-`)) {
        throw new CurriculumImportError(
          `${source.name}: topic ${code} does not start with ${versionCode}- (only the SIGRAK format is imported, D-363)`
        )
      }
      const grade = requireInt(topic.grade, `${code}.grade`)
      const phase = requireOneOf(topic.phase, phases, `${code}.phase`)
      checkPhase(report, grade, phase, code, code)
      const semester = requireInt(topic.semester, `${code}.semester`)
      if (semester !== 1 && semester !== 2) {
        throw new CurriculumImportError(`${code}: semester must be 1 or 2`)
      }
      const extras = (topic.extras ?? null) as Json | null
      const artBranch = branchOf(extras?.art_branch, code)
      const jpTotal = requireInt(topic.jp_total, `${code}.jp_total`)
      const weekStart = requireInt(topic.week_start, `${code}.week_start`)
      const weekEnd = requireInt(topic.week_end, `${code}.week_end`)
      const distribution = requireArray<number>(
        topic.weekly_distribution,
        `${code}.weekly_distribution`
      )
      const elementCodes = (topic.element_codes ?? null) as string[] | null
      const subElement = optionalString(topic.sub_element, `${code}.sub_element`)

      // JP and weeks against the semester target.
      const target = targets.get(targetKey(subject.code, grade, artBranch))
      if (!target) {
        report.mismatch(
          'topic_without_allocation',
          `${code}: no allocation for ${subject.code} grade ${grade}${artBranch ? ` (${artBranch})` : ''}`,
          code
        )
      } else {
        target.topicJp[semester - 1] += jpTotal
        target.topicCount++
        const weeks = semester === 1 ? target.s1Weeks : target.s2Weeks
        if (weekEnd > weeks) {
          report.mismatch(
            'topic_past_semester',
            `${code}: runs to week ${weekEnd} of a ${weeks}-week semester`,
            code
          )
        }
      }
      if (branchedSubjects.has(subject.code) && !artBranch) {
        report.mismatch('topic_without_art_branch', `${code}: no extras.art_branch`, code)
      }
      if (distribution.length !== weekEnd - weekStart + 1) {
        report.mismatch(
          'weekly_distribution_weeks',
          `${code}: ${distribution.length} weekly values for weeks ${weekStart}–${weekEnd}`,
          code
        )
      }
      const distributed = distribution.reduce((sum, value) => sum + value, 0)
      if (distributed !== jpTotal) {
        report.mismatch(
          'weekly_distribution_jp',
          `${code}: weekly distribution adds up to ${distributed} JP, jp_total is ${jpTotal}`,
          code
        )
      }
      if (knownElements && elementCodes) {
        for (const elementCode of elementCodes) {
          if (!knownElements.has(elementCode)) {
            report.mismatch(
              'topic_element_unknown',
              `${code}: element ${elementCode} is not in ${cpVersion}`,
              code
            )
          }
        }
      }

      topicRows.push({
        curriculum_version_id: versionId,
        subject_id: subject.id,
        code,
        grade,
        phase,
        semester,
        art_branch: artBranch,
        order_in_semester: requireInt(topic.order_in_semester, `${code}.order_in_semester`),
        elements: requireString(topic.element, `${code}.element`),
        element_codes: elementCodes,
        title: requireString(topic.title, `${code}.title`),
        cp_summary: optionalString(topic.cp_summary, `${code}.cp_summary`),
        cp_text: optionalString(topic.cp_text, `${code}.cp_text`),
        atp_code: requireString(topic.atp_code, `${code}.atp_code`),
        jp_total: jpTotal,
        jp_per_week: requireInt(topic.jp_per_week, `${code}.jp_per_week`),
        week_start: weekStart,
        week_end: weekEnd,
        weekly_distribution: distribution,
        references: topic.references ?? {},
        curation_notes: topic.curation_notes ?? null,
        outside_cp: topic.outside_cp ?? null,
        extras: subElement ? { ...(extras ?? {}), sub_element: subElement } : extras,
      })

      const tpCodes = new Set<string>()
      for (const [tpIndex, tp] of requireArray(topic.learning_objectives, code).entries()) {
        const tpCode = requireString(tp.code, `${code} learning_objectives[${tpIndex}].code`)
        if (!tpCode.startsWith(`${code}-`)) {
          report.mismatch(
            'code_prefix',
            `TP ${tpCode} does not start with its topic code ${code}`,
            tpCode
          )
        }
        tpCodes.add(tpCode)
        tpRows.push({
          topicCode: code,
          row: {
            code: tpCode,
            order: requireInt(tp.order, `${tpCode}.order`),
            text: requireString(tp.text, `${tpCode}.text`),
          },
        })
      }

      let fokusJp = 0
      for (const [itemIndex, item] of requireArray(topic.focus_items, code).entries()) {
        const itemCode = requireString(item.code, `${code} focus_items[${itemIndex}].code`)
        if (!itemCode.startsWith(`${code}-`)) {
          report.mismatch(
            'code_prefix',
            `Fokus ${itemCode} does not start with its topic code ${code}`,
            itemCode
          )
        }
        const estimated = requireInt(item.estimated_jp, `${itemCode}.estimated_jp`)
        fokusJp += estimated
        fokusRows.push({
          topicCode: code,
          row: {
            code: itemCode,
            order: requireInt(item.order, `${itemCode}.order`),
            title: requireString(item.title, `${itemCode}.title`),
            estimated_jp: estimated,
            allocation_status: optionalString(
              item.allocation_status,
              `${itemCode}.allocation_status`
            ),
          },
        })
        if (Array.isArray(item.objective_codes)) {
          const objectiveCodes = item.objective_codes.map(String)
          for (const objectiveCode of objectiveCodes) {
            if (!tpCodes.has(objectiveCode)) {
              report.mismatch(
                'fokus_link_outside_topic',
                `${itemCode}: TP ${objectiveCode} is not a TP of ${code}`,
                itemCode
              )
            }
          }
          links.set(
            itemCode,
            objectiveCodes.filter((objectiveCode) => tpCodes.has(objectiveCode))
          )
        }
      }
      if (fokusJp !== jpTotal) {
        report.mismatch(
          'fokus_jp',
          `${code}: fokus estimates add up to ${fokusJp} JP, jp_total is ${jpTotal}`,
          code
        )
      }
    }
  }

  // Semester sums against the targets (Tata Boga: no target, D-458).
  for (const target of targets.values()) {
    const label = `${target.subjectCode} grade ${target.grade}${target.artBranch ? ` ${target.artBranch}` : ''}`
    if (target.topicCount === 0) {
      report.note(
        'allocation_without_topics',
        `${label}: no topics yet${target.artBranch ? '; the school may still pick this branch (D-464)' : ''}`
      )
      continue
    }
    if (target.setBySchool) continue
    for (const semester of [1, 2] as const) {
      const expected = semester === 1 ? target.s1Jp : target.s2Jp
      const actual = target.topicJp[semester - 1]
      if (actual !== expected) {
        report.mismatch(
          actual < expected ? 'semester_jp_short' : 'semester_jp_over',
          `${label} semester ${semester}: topics add up to ${actual} JP, target ${expected}`
        )
      }
    }
  }

  report.count(
    'topics',
    await upsertRows(trx, 'topics', topicRows, { conflict: ['code'], jsonColumns: topicJson })
  )
  const topicIds = await idsByCode(
    trx,
    'topics',
    topicRows.map((row) => String(row.code))
  )
  const subjectIds = fileSubjectRefs.map((subject) => subject.id)
  const topicsInDatabase = (await trx
    .from('topics')
    .where('curriculum_version_id', versionId)
    .whereIn('subject_id', subjectIds)
    .select('code')) as { code: string }[]
  reportMissing(
    report,
    'topic',
    'Topic',
    topicsInDatabase.map((row) => row.code),
    new Set(topicIds.keys())
  )

  const withTopic = (items: { topicCode: string; row: Row }[]) =>
    items.map(({ topicCode, row }) => ({ topic_id: topicIds.get(topicCode)!, ...row }))
  report.count(
    'learning_objectives',
    await upsertRows(trx, 'learning_objectives', withTopic(tpRows), { conflict: ['code'] })
  )
  report.count(
    'focus_items',
    await upsertRows(trx, 'focus_items', withTopic(fokusRows), { conflict: ['code'] })
  )

  const fileTopicIds = [...topicIds.values()]
  for (const [table, label, rows] of [
    ['learning_objectives', 'TP', tpRows],
    ['focus_items', 'Fokus', fokusRows],
  ] as const) {
    const inDatabase = (await trx.from(table).whereIn('topic_id', fileTopicIds).select('code')) as {
      code: string
    }[]
    reportMissing(
      report,
      table === 'focus_items' ? 'focus_item' : 'learning_objective',
      label,
      inDatabase.map((row) => row.code),
      new Set(rows.map(({ row }) => String(row.code)))
    )
  }

  await syncLinks(trx, report, links)
}

/**
 * Fokus–TP links: synced only for fokus whose file entry lists
 * `objective_codes`, so links added by a data task survive a re-import
 * of a file without them (D-229).
 */
async function syncLinks(
  trx: TransactionClientContract,
  report: FileReport,
  links: Map<string, string[]>
) {
  const counts = { created: 0, updated: 0, unchanged: 0 }
  if (links.size === 0) {
    report.count('focus_item_objectives', counts)
    return
  }
  const fokusIds = await idsByCode(trx, 'focus_items', [...links.keys()])
  const tpIds = await idsByCode(trx, 'learning_objectives', [
    ...new Set([...links.values()].flat()),
  ])

  const wanted = new Set<string>()
  for (const [fokusCode, objectiveCodes] of links) {
    for (const objectiveCode of objectiveCodes) {
      wanted.add(`${fokusIds.get(fokusCode)}|${tpIds.get(objectiveCode)}`)
    }
  }
  const ids = [...fokusIds.values()]
  const existing = new Set<string>()
  for (let start = 0; start < ids.length; start += 5_000) {
    const rows = (await trx
      .from('focus_item_objectives')
      .whereIn('focus_item_id', ids.slice(start, start + 5_000))
      .select('focus_item_id', 'learning_objective_id')) as {
      focus_item_id: number
      learning_objective_id: number
    }[]
    for (const row of rows) existing.add(`${row.focus_item_id}|${row.learning_objective_id}`)
  }

  const toDelete = [...existing].filter((key) => !wanted.has(key))
  const toInsert = [...wanted].filter((key) => !existing.has(key))
  for (const key of toDelete) {
    const [fokusId, tpId] = key.split('|').map(Number)
    await trx
      .from('focus_item_objectives')
      .where({ focus_item_id: fokusId, learning_objective_id: tpId })
      .delete()
  }
  for (let start = 0; start < toInsert.length; start += 5_000) {
    await trx.table('focus_item_objectives').insert(
      toInsert.slice(start, start + 5_000).map((key) => {
        const [fokusId, tpId] = key.split('|').map(Number)
        return { focus_item_id: fokusId, learning_objective_id: tpId, created_at: trx.raw('now()') }
      })
    )
  }
  counts.created = toInsert.length
  counts.updated = toDelete.length
  counts.unchanged = existing.size - toDelete.length
  report.count('focus_item_objectives', counts)
  if (toDelete.length > 0) {
    report.note(
      'fokus_links_removed',
      `${toDelete.length} fokus–TP link(s) removed to match the file`
    )
  }
}
