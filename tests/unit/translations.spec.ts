import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import i18nManager from '@adonisjs/i18n/services/main'

/**
 * Checks that keep resources/lang/id complete and plain (design system,
 * D-098, D-382): every key the code uses exists, values avoid banned and
 * old terms, and pages carry no hard-coded text.
 */

const LANG_DIR = app.makePath('resources/lang/id')

type Messages = Record<string, string>

function flatten(value: unknown, prefix: string, into: Messages, problems: string[]) {
  if (typeof value === 'string') {
    into[prefix] = value
    return
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, `${prefix}.${key}`, into, problems)
    }
    return
  }
  problems.push(`${prefix}: value must be a string or an object`)
}

function loadLang() {
  const messages: Messages = {}
  const problems: string[] = []
  const namespaces: string[] = []
  for (const file of readdirSync(LANG_DIR).sort()) {
    if (!file.endsWith('.json')) {
      problems.push(`${file}: only .json files belong in resources/lang/id`)
      continue
    }
    const namespace = file.replace(/\.json$/, '')
    namespaces.push(namespace)
    const parsed: unknown = JSON.parse(readFileSync(join(LANG_DIR, file), 'utf8'))
    flatten(parsed, namespace, messages, problems)
  }
  return { messages, namespaces, problems }
}

function walk(dir: string, extensions: string[]): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'icons' && entry.name !== 'node_modules') {
        files.push(...walk(path, extensions))
      }
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(path)
    }
  }
  return files
}

function parse(file: string, code = readFileSync(file, 'utf8')) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind)
}

function visitAll(node: ts.Node, visitor: (node: ts.Node) => void) {
  visitor(node)
  node.forEachChild((child) => visitAll(child, visitor))
}

function where(source: ts.SourceFile, node: ts.Node) {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart())
  return `${relative(app.makePath(), source.fileName)}:${line + 1}`
}

/** t('key'), i18n.t('key'), translate(messages, 'key'). */
function isTranslateCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee)) return callee.text === 't' || callee.text === 'translate'
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't'
}

type KeyUse = { key: string; prefix: boolean; at: string }

/**
 * Translation keys the code uses. On the server only the arguments of
 * t() count (route names look like keys). In inertia/ any string that
 * starts with a lang file name and a dot is a key, e.g. a nav item's
 * label. A template literal like `calendar.kinds.${kind}` counts as a
 * prefix that some key must start with.
 */
function collectKeyUses(
  file: string,
  namespaces: string[],
  anyString: boolean,
  code?: string
): KeyUse[] {
  const source = parse(file, code)
  const keyPattern = new RegExp(`^(${namespaces.join('|')})\\.[a-zA-Z0-9_.]+$`)
  const prefixPattern = new RegExp(`^(${namespaces.join('|')})\\.[a-zA-Z0-9_.]*$`)
  const uses: KeyUse[] = []

  function record(node: ts.Node, strict: boolean) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (keyPattern.test(node.text) || (strict && node.text.length > 0)) {
        uses.push({ key: node.text, prefix: false, at: where(source, node) })
      }
    } else if (ts.isTemplateExpression(node)) {
      const head = node.head.text
      if (prefixPattern.test(head) && head.includes('.')) {
        uses.push({ key: head, prefix: true, at: where(source, node) })
      }
    }
  }

  visitAll(source, (node) => {
    if (isTranslateCall(node)) {
      const keyArgument = ts.isIdentifier(node.expression) && node.expression.text === 'translate'
      const argument = node.arguments[keyArgument ? 1 : 0]
      if (argument) record(argument, true)
    } else if (anyString && !ts.isImportDeclaration(node.parent ?? node)) {
      record(node, false)
    }
  })
  return uses
}

/** Attributes whose text people see or hear. */
const TEXT_ATTRIBUTES = new Set([
  'alt',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'description',
  'error',
  'hint',
  'label',
  'placeholder',
  'title',
])

const hasLetters = (text: string) => /\p{L}/u.test(text)

/** Hard-coded text in a page or component: JSX text, text attributes, toasts. */
function findHardCodedText(file: string, code?: string) {
  const source = parse(file, code)
  const found: string[] = []
  const report = (node: ts.Node, text: string) =>
    found.push(`${where(source, node)}: "${text.trim().slice(0, 60)}"`)

  visitAll(source, (node) => {
    if (ts.isJsxText(node) && hasLetters(node.text)) {
      report(node, node.text)
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(source)
      if (!TEXT_ATTRIBUTES.has(name)) return
      const value = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer
      if (
        value &&
        (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) &&
        hasLetters(value.text)
      ) {
        report(node, value.text)
      }
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      (ts.isStringLiteral(node.expression) ||
        ts.isNoSubstitutionTemplateLiteral(node.expression)) &&
      hasLetters(node.expression.text)
    ) {
      report(node, node.expression.text)
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source)
      const first = node.arguments[0]
      if (
        /^toast(\.(success|error|info|warning|message|loading))?$/.test(callee) &&
        first &&
        (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) &&
        hasLetters(first.text)
      ) {
        report(node, first.text)
      }
    }
  })
  return found
}

/**
 * Words that never appear in UI copy (design system "Banned words",
 * D-300, D-311, D-281, D-210, D-322, D-382) and old terms replaced by
 * the standard ones (design system "Terms", D-098).
 */
const BANNED_WORDS = [
  'tunggakan',
  'kurang bayar',
  'belum lunas',
  'teguran',
  'tanda tangan elektronik',
  'siswa',
  'P5',
  'taraf serap',
  'absensi',
  'presensi',
]

const OLD_TERMS: Record<string, string> = {
  'download': 'Unduh',
  'generate': 'Buat',
  'generator': 'Buat',
  'prompt': '(never shown)',
  'template': 'Templat',
  'modul ajar': 'RPM',
  'bank modul': 'Dokumen Saya',
  'worksheet': 'LKPD',
  'api key': 'Kunci AI',
  'letterhead': 'Kop',
  'kop surat': 'Kop',
  'tutorial': 'Bantuan',
  'dashboard': 'Ringkasan / Hari Ini',
  'password': 'Kata sandi',
  'username': 'Nama pengguna',
  'instansi': 'Sekolah',
  'super admin': 'Tim SIGRAK / admin sekolah',
  'hak akses': 'Peran',
  'role': 'Peran',
  'cloud': 'tersimpan di akun',
  'firestore': 'tersimpan di akun',
  'firebase': 'tersimpan di akun',
  'sinkronisasi': 'tersimpan di akun',
  'edit': 'Ubah',
  'reset': 'Kembalikan / Atur ulang',
  'mutasi': 'Pindah dan keluar',
  'regu piket': 'Kelompok piket',
  'iuran': 'Sumbangan sukarela',
  'cerdas': '(no decoration)',
  'canggih': '(no decoration)',
  'gagal': '… belum berhasil',
  'error': 'plain words',
  'file': 'Berkas (D-472)',
}

/**
 * Exceptions by key, for copy that must name an old word, e.g. help
 * search text that still finds "absensi" (D-382). Empty for now.
 */
const ALLOWED: Record<string, string[]> = {}

/**
 * Spellings of the product name other than "SIGRAK" (D-469: until the
 * wordmark is chosen, D-462). Domain names such as `app.sigrak.com` are
 * not the product name and stay lowercase.
 */
function productNameSpellings(value: string) {
  return [...value.matchAll(/(?<![\p{L}@.])sigrak(?![\p{L}]|\.[a-z])/giu)]
    .map((match) => match[0])
    .filter((found) => found !== 'SIGRAK')
}

function wordPattern(word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu')
}

test.group('Translations: lang/id files', () => {
  test('every file parses and every key is English snake_case', ({ assert }) => {
    const { messages, problems } = loadLang()
    for (const key of Object.keys(messages)) {
      for (const segment of key.split('.')) {
        if (!/^[a-z][a-zA-Z0-9_]*$/.test(segment)) {
          problems.push(`${key}: "${segment}" is not an English identifier`)
        }
      }
    }
    assert.deepEqual(problems, [])
    assert.isAbove(Object.keys(messages).length, 0)
  })

  test('the shared files exist', ({ assert }) => {
    const { namespaces } = loadLang()
    for (const shared of ['common', 'nav', 'errors', 'validation', 'auth']) {
      assert.include(namespaces, shared)
    }
  })

  test('values are plain, finished Indonesian copy', ({ assert }) => {
    const { messages } = loadLang()
    const problems: string[] = []
    for (const [key, value] of Object.entries(messages)) {
      if (value.trim() === '') problems.push(`${key}: empty`)
      if (value !== value.trim()) problems.push(`${key}: leading or trailing space`)
      if (/ {2}/.test(value)) problems.push(`${key}: double space`)
      if (value.includes('...')) problems.push(`${key}: use "…" instead of "..."`)
      if (/(^|\s)&(\s|$)/.test(value)) problems.push(`${key}: use "dan" instead of "&"`)
      if (/!{2,}|\?{2,}/.test(value)) problems.push(`${key}: stacked ! or ?`)
      if (/\p{Extended_Pictographic}/u.test(value)) problems.push(`${key}: no emoji`)
      if (value.includes('{{')) problems.push(`${key}: use {name} placeholders`)
      let depth = 0
      for (const character of value) {
        if (character === '{') depth++
        if (character === '}') depth--
        if (depth < 0 || depth > 1) break
      }
      if (depth !== 0) problems.push(`${key}: unbalanced { }`)
      for (const name of value.match(/\{([^}]*)\}/g) ?? []) {
        if (!/^\{[a-zA-Z_]\w*\}$/.test(name)) problems.push(`${key}: placeholder ${name}`)
      }
    }
    assert.deepEqual(problems, [])
  })

  test('no banned word or old term appears in any value', ({ assert }) => {
    const { messages } = loadLang()
    const problems: string[] = []
    for (const [key, message] of Object.entries(messages)) {
      // Placeholder names are code, not copy.
      const value = message.replace(/\{\w+\}/g, '{}')
      const allowed = ALLOWED[key] ?? []
      for (const word of BANNED_WORDS) {
        if (!allowed.includes(word) && wordPattern(word).test(value)) {
          problems.push(`${key}: banned word "${word}"`)
        }
      }
      for (const [word, replacement] of Object.entries(OLD_TERMS)) {
        if (!allowed.includes(word) && wordPattern(word).test(value)) {
          problems.push(`${key}: old term "${word}", use "${replacement}"`)
        }
      }
    }
    assert.deepEqual(problems, [])
  })

  test('the product name is written "SIGRAK" (D-469)', ({ assert }) => {
    const { messages } = loadLang()
    const problems = Object.entries(messages).flatMap(([key, value]) =>
      productNameSpellings(value).map((found) => `${key}: "${found}", write "SIGRAK"`)
    )
    assert.deepEqual(problems, [])

    assert.deepEqual(productNameSpellings('Selamat datang di Sigrak'), ['Sigrak'])
    assert.deepEqual(productNameSpellings('sigrak Guru dan SIGRAK'), ['sigrak'])
    assert.deepEqual(productNameSpellings('Buka app.sigrak.com atau tanya@sigrak.com'), [])
  })

  test('the banned-word check catches its words', ({ assert }) => {
    assert.isTrue(wordPattern('absensi').test('Rekap Absensi bulan ini'))
    assert.isTrue(wordPattern('siswa').test('Data siswa'))
    assert.isTrue(wordPattern('P5').test('Projek P5'))
    assert.isTrue(wordPattern('tanda tangan elektronik').test('Tanda  tangan elektronik'))
    assert.isFalse(wordPattern('siswa').test('Mahasiswa'))
    assert.isFalse(wordPattern('template').test('Templat RPM'))
    assert.isFalse(wordPattern('edit').test('Kredit'))
  })
})

test.group('Translations: code', () => {
  test('every key used in app/, start/ and inertia/ exists in lang/id', ({ assert }) => {
    const { messages, namespaces } = loadLang()
    const keys = Object.keys(messages)
    const serverFiles = [
      ...walk(app.makePath('app'), ['.ts']),
      ...walk(app.makePath('start'), ['.ts']),
    ]
    const clientFiles = walk(app.makePath('inertia'), ['.ts', '.tsx'])
    const uses = [
      ...serverFiles.flatMap((file) => collectKeyUses(file, namespaces, false)),
      ...clientFiles.flatMap((file) => collectKeyUses(file, namespaces, true)),
    ]

    const missing = uses
      .filter((use) =>
        use.prefix
          ? !keys.some((key) => key.startsWith(use.key))
          : // A key must name one message, not a group of messages.
            !(use.key in messages)
      )
      .map((use) => `${use.at}: ${use.prefix ? `${use.key}…` : use.key}`)

    assert.deepEqual(missing, [])
    assert.isAbove(uses.length, 50)
  }).timeout(30_000)

  test('the key check finds keys in calls, labels and templates', ({ assert }) => {
    const code = [
      `const items = [{ label: 'nav.calendar' }, { label: 'nav.nowhere' }]`,
      `t('common.actions.save'); i18n.t('auth.failed'); t('typo')`,
      't(`calendar.kinds.${kind}`); t(`${namespace}.title`)',
      `router.get('/x').as('calendar.index')`,
    ].join('\n')
    const keys = (anyString: boolean) =>
      collectKeyUses(
        app.makePath('sample.tsx'),
        ['nav', 'common', 'auth', 'calendar'],
        anyString,
        code
      )
        .map((use) => (use.prefix ? `${use.key}…` : use.key))
        .sort()
    assert.deepEqual(keys(false), [
      'auth.failed',
      'calendar.kinds.…',
      'common.actions.save',
      'typo',
    ])
    assert.includeMembers(keys(true), ['nav.calendar', 'nav.nowhere', 'calendar.index'])
  })

  test('validation messages are never sent to the browser', async ({ assert }) => {
    const { SHARED_NAMESPACES, messagesFor } = await import('#middleware/translations_middleware')
    assert.notInclude([...SHARED_NAMESPACES], 'validation')
    const sent = messagesFor('id', ['common', 'validation'])
    assert.isTrue(Object.keys(sent).some((key) => key.startsWith('common.')))
    assert.isFalse(Object.keys(sent).some((key) => key.startsWith('validation.')))
  })

  test('the messages of a namespace set are picked once and shared (R1-11)', async ({
    assert,
  }) => {
    const { messagesFor } = await import('#middleware/translations_middleware')
    const first = messagesFor('id', ['common', 'nav', 'calendar'])
    // Same set in another order, with a duplicate and a server-only namespace.
    const again = messagesFor('id', ['calendar', 'nav', 'common', 'nav', 'validation'])
    assert.strictEqual(again, first)
    assert.isTrue(Object.isFrozen(first))

    const all = i18nManager.getTranslationsFor('id')
    const expected = Object.fromEntries(
      Object.entries(all).filter(([key]) =>
        ['common.', 'nav.', 'calendar.'].some((prefix) => key.startsWith(prefix))
      )
    )
    assert.deepEqual({ ...first }, expected)

    const other = messagesFor('id', ['common', 'nav', 'timetable'])
    assert.notStrictEqual(other, first)
    assert.isTrue(Object.keys(other).some((key) => key.startsWith('timetable.')))
    assert.isFalse(Object.keys(other).some((key) => key.startsWith('calendar.')))
  })

  test('pages and components carry no hard-coded text', ({ assert }) => {
    const files = walk(app.makePath('inertia'), ['.tsx'])
    assert.deepEqual(
      files.flatMap((file) => findHardCodedText(file)),
      []
    )
  }).timeout(30_000)

  test('the hard-coded text check catches visible strings', ({ assert }) => {
    const code = [
      `export function A({ t }) {`,
      `  toast.success('Tersimpan')`,
      `  return (`,
      `    <div title="Judul" className="p-2" aria-label={t('common.app_name')}>`,
      `      Halo {'dunia'} <b>{t('common.app_name')}</b> · 3`,
      `      <input placeholder="Cari murid" />`,
      `    </div>`,
      `  )`,
      `}`,
    ].join('\n')
    const found = findHardCodedText(app.makePath('inertia/sample.tsx'), code).map((line) =>
      line.replace(/^.*?: /, '')
    )
    assert.deepEqual(found, ['"Tersimpan"', '"Judul"', '"Halo"', '"dunia"', '"Cari murid"'])
  })
})
