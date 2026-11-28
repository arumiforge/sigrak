import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  CurriculumImportError,
  SubjectLookup,
  assertUnique,
  ensureVersion,
  optionalString,
  pad2,
  reportMissing,
  requireArray,
  requireInt,
  requireOneOf,
  requireString,
  type Json,
  type SourceFile,
} from '../context.js'
import type { FileReport } from '../report.js'
import { upsertRows, type Row } from '../upsert.js'
import { artBranchByLabel, phaseGrades, phases, type ArtBranch, type Phase } from '../../types.js'

const outcomeJson = ['extras']

function compact(value: Json): Json | null {
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)
  return entries.length > 0 ? Object.fromEntries(entries) : null
}

function checkPhaseGrades(report: FileReport, phase: Phase, grades: unknown, where: string) {
  const expected = phaseGrades[phase]
  if (
    !Array.isArray(grades) ||
    grades.length !== expected.length ||
    !expected.every((grade) => grades.includes(grade))
  ) {
    report.mismatch(
      'phase_grades',
      `${where}: Fase ${phase} lists grades ${JSON.stringify(grades)}, expected ${JSON.stringify(expected)}`
    )
  }
}

async function writeOutcomes(
  trx: TransactionClientContract,
  report: FileReport,
  versionId: number,
  rows: Row[]
) {
  assertUnique(
    rows.map((row) => String(row.code)),
    'CP row',
    report.file
  )
  report.count(
    'learning_outcomes',
    await upsertRows(trx, 'learning_outcomes', rows, {
      conflict: ['code'],
      jsonColumns: outcomeJson,
    })
  )
  const inDatabase = (await trx
    .from('learning_outcomes')
    .where('curriculum_version_id', versionId)
    .select('code')) as { code: string }[]
  reportMissing(
    report,
    'learning_outcome',
    'CP row',
    inDatabase.map((row) => row.code),
    new Set(rows.map((row) => String(row.code)))
  )
}

/**
 * `cp-umum-sd-bskap-046-2025.json`: official CP of the general SD
 * subjects per element (D-452), and PAI's element codes whose text is
 * in the religion CP set (`linked_sets`).
 */
export async function importCpGeneral(
  trx: TransactionClientContract,
  source: SourceFile,
  report: FileReport
) {
  const data = source.data
  const versionCode = requireString(data.version_code, `${source.name} version_code`)
  const subjects = await SubjectLookup.load(trx)
  const sourceInfo = (data.source ?? {}) as Json
  const extraction = (data.extraction ?? {}) as Json

  const fileSubjects = requireArray(data.subjects, `${source.name} subjects`)
  const linkedSets = requireArray(data.linked_sets ?? [], `${source.name} linked_sets`)

  const versionId = await ensureVersion(trx, report, {
    code: versionCode,
    kind: 'cp',
    name: requireString(sourceInfo.title ?? versionCode, `${source.name} source.title`),
    file: source.name,
    fileMeta: {
      sha256: source.sha256,
      dataset: String(data.dataset),
      status: data.status ?? null,
      source: sourceInfo,
      extraction: { date: extraction.date, task: extraction.task, verified: extraction.verified },
      decision: data.decision ?? null,
    },
  })

  const elementRows: Row[] = []
  const elementCodesBySubject = new Map<string, Set<string>>()
  const addElements = (
    subjectId: number,
    cpKey: string,
    artBranch: ArtBranch | null,
    elements: Json[],
    linkedVersionCode: string | null,
    where: string
  ) => {
    const codes = new Set<string>()
    elements.forEach((element, index) => {
      const code = requireString(element.code, `${where}.elements[${index}].code`)
      codes.add(code)
      elementRows.push({
        curriculum_version_id: versionId,
        subject_id: subjectId,
        art_branch: artBranch,
        code,
        order: index + 1,
        name: requireString(element.name, `${where}.elements[${index}].name`),
        name_en: optionalString(element.name_en, `${where}.elements[${index}].name_en`),
        phases: requireArray<string>(element.phases, `${where}.elements[${index}].phases`).map(
          (phase) => requireOneOf(phase, phases, `${where}.elements[${index}].phases`)
        ),
        linked_version_code: linkedVersionCode,
      })
    })
    elementCodesBySubject.set(cpKey, codes)
  }

  const outcomeRows: Row[] = []
  for (const [subjectIndex, subjectData] of fileSubjects.entries()) {
    const where = `${source.name} subjects[${subjectIndex}]`
    const cpKey = requireString(subjectData.cp_key, `${where}.cp_key`)
    const subject = subjects.get(
      requireString(subjectData.subject_code, `${where}.subject_code`),
      where
    )
    const branchLabel = optionalString(subjectData.art_branch, `${where}.art_branch`)
    const artBranch = branchLabel ? artBranchByLabel[branchLabel] : null
    if (artBranch === undefined) {
      throw new CurriculumImportError(`${where}: unknown art branch "${branchLabel}"`)
    }
    addElements(
      subject.id,
      cpKey,
      artBranch,
      requireArray(subjectData.elements, where),
      null,
      where
    )
    const elementCodes = elementCodesBySubject.get(cpKey)!
    const elementPhases = new Map(
      requireArray(subjectData.elements, where).map((element) => [
        String(element.code),
        element.phases as string[],
      ])
    )

    for (const [phaseIndex, phaseData] of requireArray(subjectData.phases, where).entries()) {
      const phaseWhere = `${where}.phases[${phaseIndex}]`
      const phase = requireOneOf(phaseData.phase, phases, `${phaseWhere}.phase`)
      checkPhaseGrades(report, phase, phaseData.grades, `${cpKey} ${phaseWhere}`)
      const leadIn = optionalString(phaseData.lead_in, `${phaseWhere}.lead_in`)
      const summary = optionalString(phaseData.summary, `${phaseWhere}.summary`)
      if (summary) {
        outcomeRows.push({
          curriculum_version_id: versionId,
          subject_id: subject.id,
          art_branch: artBranch,
          phase,
          code: `${versionCode}-${cpKey}-${phase}-00`,
          order: 0,
          element_code: null,
          element: null,
          sub_element: null,
          text: summary,
          extras: compact({ lead_in: leadIn }),
        })
      }
      for (const [index, outcome] of requireArray(phaseData.outcomes, phaseWhere).entries()) {
        const outcomeWhere = `${phaseWhere}.outcomes[${index}]`
        const code = requireString(outcome.code, `${outcomeWhere}.code`)
        const elementCode = optionalString(outcome.element_code, `${outcomeWhere}.element_code`)
        if (elementCode && !elementCodes.has(elementCode)) {
          report.mismatch(
            'cp_element_unknown',
            `${code}: element ${elementCode} is not an element of ${cpKey}`,
            code
          )
        } else if (elementCode && !elementPhases.get(elementCode)?.includes(phase)) {
          report.mismatch(
            'cp_element_phase',
            `${code}: element ${elementCode} does not list Fase ${phase}`,
            code
          )
        }
        outcomeRows.push({
          curriculum_version_id: versionId,
          subject_id: subject.id,
          art_branch: artBranch,
          phase,
          code,
          order: requireInt(outcome.order, `${outcomeWhere}.order`),
          element_code: elementCode,
          element: optionalString(outcome.element, `${outcomeWhere}.element`),
          sub_element: optionalString(outcome.sub_element, `${outcomeWhere}.sub_element`),
          text: requireString(outcome.text, `${outcomeWhere}.text`),
          extras: compact({
            lead_in: leadIn,
            decree_number: outcome.decree_number,
            pages: outcome.pages,
            translation_en: outcome.translation_en,
            element_intro: outcome.element_intro,
            heading_as_printed: outcome.heading_as_printed,
            figure_note: outcome.figure_note,
          }),
        })
      }
    }
  }

  for (const [index, linked] of linkedSets.entries()) {
    const where = `${source.name} linked_sets[${index}]`
    const cpKey = requireString(linked.cp_key, `${where}.cp_key`)
    const subject = subjects.get(requireString(linked.subject_code, `${where}.subject_code`), where)
    addElements(
      subject.id,
      cpKey,
      null,
      requireArray(linked.elements, where),
      requireString(linked.version_code, `${where}.version_code`),
      where
    )
  }

  assertUnique(
    elementRows.map((row) => String(row.code)),
    'CP element',
    source.name
  )
  report.count(
    'learning_outcome_elements',
    await upsertRows(trx, 'learning_outcome_elements', elementRows, {
      conflict: ['curriculum_version_id', 'code'],
      jsonColumns: ['phases'],
    })
  )
  const elementsInDatabase = (await trx
    .from('learning_outcome_elements')
    .where('curriculum_version_id', versionId)
    .select('code')) as { code: string }[]
  reportMissing(
    report,
    'learning_outcome_element',
    'CP element',
    elementsInDatabase.map((row) => row.code),
    new Set(elementRows.map((row) => String(row.code)))
  )

  await writeOutcomes(trx, report, versionId, outcomeRows)
}

/**
 * `cp-pendidikan-agama-sd-bkpdm-020-2026.json`: CP of the six SD
 * religion subjects. Rows have no codes in the file, so the code is
 * `<version>-<subject>-<phase>-<nn>` with nn the row's place in the
 * phase as printed (rows with no CP keep their number, D-226). PAI rows
 * get their element code from the linked elements of the general CP set.
 */
export async function importCpReligionSd(
  trx: TransactionClientContract,
  source: SourceFile,
  report: FileReport
) {
  const data = source.data
  const versionCode = requireString(data.version_code, `${source.name} version_code`)
  const subjects = await SubjectLookup.load(trx)
  const sourceInfo = (data.source ?? {}) as Json
  const transcription = (data.transcription ?? {}) as Json

  const versionId = await ensureVersion(trx, report, {
    code: versionCode,
    kind: 'cp',
    name: requireString(sourceInfo.title ?? versionCode, `${source.name} source.title`),
    file: source.name,
    fileMeta: {
      sha256: source.sha256,
      dataset: String(data.dataset),
      source: sourceInfo,
      transcription: {
        date: transcription.date,
        verified: transcription.verified,
        verified_on: transcription.verified_on,
      },
    },
  })

  // Element codes defined elsewhere for this set (PAI-E1…E5, D-452).
  const linked = (await trx
    .from('learning_outcome_elements')
    .where('linked_version_code', versionCode)
    .select('subject_id', 'code', 'name')) as { subject_id: number; code: string; name: string }[]
  if (linked.length === 0) {
    report.note(
      'linked_elements_missing',
      `No element codes link to ${versionCode} yet; import the general CP file first to fill element_code`
    )
  }

  const rows: Row[] = []
  let skipped = 0
  for (const [religionIndex, religion] of requireArray(data.religions, source.name).entries()) {
    const where = `${source.name} religions[${religionIndex}]`
    const key = requireString(religion.key, `${where}.key`)
    const subject = subjects.all.find(
      (candidate) => candidate.religion === key && candidate.schoolLevel !== 'mi'
    )
    if (!subject) {
      throw new CurriculumImportError(`${where}: no SD subject has religion "${key}"`)
    }
    const elementCodeByName = new Map(
      linked.filter((row) => row.subject_id === subject.id).map((row) => [row.name, row.code])
    )

    for (const [phaseIndex, phaseData] of requireArray(religion.phases, where).entries()) {
      const phaseWhere = `${where}.phases[${phaseIndex}]`
      const phase = requireOneOf(phaseData.phase, phases, `${phaseWhere}.phase`)
      checkPhaseGrades(report, phase, phaseData.grades, `${subject.code} ${phaseWhere}`)
      const pages = phaseData.pages ?? null
      const summary = optionalString(phaseData.summary, `${phaseWhere}.summary`)
      if (summary) {
        rows.push({
          curriculum_version_id: versionId,
          subject_id: subject.id,
          art_branch: null,
          phase,
          code: `${versionCode}-${subject.code}-${phase}-00`,
          order: 0,
          element_code: null,
          element: null,
          sub_element: null,
          text: summary,
          extras: compact({ pages }),
        })
      }
      for (const [index, outcome] of requireArray(phaseData.outcomes, phaseWhere).entries()) {
        const outcomeWhere = `${phaseWhere}.outcomes[${index}]`
        if (outcome.no_cp_in_phase === true) {
          skipped++
          continue
        }
        const element = requireString(outcome.element, `${outcomeWhere}.element`)
        const elementCode = elementCodeByName.get(element) ?? null
        if (elementCodeByName.size > 0 && !elementCode) {
          report.mismatch(
            'cp_element_unknown',
            `${outcomeWhere}: element "${element}" matches no linked element code of ${subject.code}`
          )
        }
        rows.push({
          curriculum_version_id: versionId,
          subject_id: subject.id,
          art_branch: null,
          phase,
          code: `${versionCode}-${subject.code}-${phase}-${pad2(index + 1)}`,
          order: index + 1,
          element_code: elementCode,
          element,
          sub_element: optionalString(outcome.sub_element, `${outcomeWhere}.sub_element`),
          text: requireString(outcome.text, `${outcomeWhere}.text`),
          extras: compact({ pages }),
        })
      }
    }
  }
  if (skipped > 0) {
    report.note(
      'no_cp_in_phase',
      `${skipped} sub-element row(s) with no CP in their phase: no row (D-226)`
    )
  }

  await writeOutcomes(trx, report, versionId, rows)
}

/**
 * `cp-pai-bahasa-arab-mi-sk-dirjen-9941-2025.json`: CP of MI's Kemenag
 * subjects. Codes as for the SD religion CP.
 */
export async function importCpMadrasah(
  trx: TransactionClientContract,
  source: SourceFile,
  report: FileReport
) {
  const data = source.data
  const versionCode = requireString(data.version_code, `${source.name} version_code`)
  const subjects = await SubjectLookup.load(trx)
  const sourceInfo = (data.source ?? {}) as Json
  const extraction = (data.extraction ?? {}) as Json

  const versionId = await ensureVersion(trx, report, {
    code: versionCode,
    kind: 'cp',
    name: requireString(sourceInfo.title ?? versionCode, `${source.name} source.title`),
    file: source.name,
    fileMeta: {
      sha256: source.sha256,
      dataset: String(data.dataset),
      source: sourceInfo,
      extraction: { date: extraction.date, verified: extraction.verified },
    },
  })

  const rows: Row[] = []
  for (const [subjectIndex, subjectData] of requireArray(data.subjects, source.name).entries()) {
    const where = `${source.name} subjects[${subjectIndex}]`
    const subject = subjects.get(requireString(subjectData.key, `${where}.key`), where)
    for (const [phaseIndex, phaseData] of requireArray(subjectData.phases, where).entries()) {
      const phaseWhere = `${where}.phases[${phaseIndex}]`
      const phase = requireOneOf(phaseData.phase, phases, `${phaseWhere}.phase`)
      checkPhaseGrades(report, phase, phaseData.grades, `${subject.code} ${phaseWhere}`)
      const leadIn = optionalString(phaseData.lead_in, `${phaseWhere}.lead_in`)
      const intros = new Map(
        requireArray(phaseData.element_intros ?? [], `${phaseWhere}.element_intros`).map(
          (intro) => [String(intro.element), String(intro.text)]
        )
      )
      for (const [index, outcome] of requireArray(phaseData.outcomes, phaseWhere).entries()) {
        const outcomeWhere = `${phaseWhere}.outcomes[${index}]`
        const element = requireString(outcome.element, `${outcomeWhere}.element`)
        rows.push({
          curriculum_version_id: versionId,
          subject_id: subject.id,
          art_branch: null,
          phase,
          code: `${versionCode}-${subject.code}-${phase}-${pad2(index + 1)}`,
          order: index + 1,
          element_code: null,
          element,
          sub_element: optionalString(outcome.sub_element, `${outcomeWhere}.sub_element`),
          text: requireString(outcome.text, `${outcomeWhere}.text`),
          extras: compact({
            lead_in: leadIn,
            element_intro: intros.get(element),
            pdf_pages: phaseData.pdf_pages,
            arabic_passages: outcome.arabic_passages,
            review_notes: outcome.review_notes,
          }),
        })
      }
    }
  }

  await writeOutcomes(trx, report, versionId, rows)
}
