// Converts the 20 sample formulas and checks that each one compiles.
// Writes data/formulas.result.json, which templates/rumus.typ prints.
// Usage: node scripts/formulas.mjs
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { convertFixed, convertPlain, isSafeMath } from './latex.mjs'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const formulas = JSON.parse(await readFile(join(root, 'data/formulas.json'), 'utf8'))

async function compiles(mode, src) {
  if (src === null) return { ok: false, error: 'not converted' }
  try {
    await run(
      'typst',
      [
        'compile',
        '--root',
        root,
        '--ignore-system-fonts',
        '--ignore-embedded-fonts',
        '--font-path',
        join(root, 'fonts'),
        '--input',
        `mode=${mode}`,
        '--input',
        `src=${src}`,
        join(root, 'templates/check-math.typ'),
        '-',
      ],
      { encoding: 'buffer', maxBuffer: 1 << 24 }
    )
    return { ok: true }
  } catch (err) {
    const text = err.stderr ? err.stderr.toString() : String(err)
    const line = text.split('\n').find((l) => l.startsWith('error:')) ?? text.split('\n')[0]
    return { ok: false, error: line.replace(/^error:\s*/, '').trim() }
  }
}

function tryConvert(fn, latex) {
  try {
    return { typst: fn(latex) }
  } catch (err) {
    return { typst: null, error: err.message }
  }
}

const results = await Promise.all(
  formulas.map(async (f) => {
    const plain = tryConvert(convertPlain, f.latex)
    const fixed = tryConvert(convertFixed, f.latex)
    const [plainCheck, fixedCheck, manualCheck, mitexCheck] = await Promise.all([
      compiles('typst', plain.typst),
      compiles('typst', fixed.typst),
      compiles('typst', f.manual),
      compiles('mitex', f.latex),
    ])
    return {
      ...f,
      plain: { ...plain, ...plainCheck, safe: plain.typst !== null && isSafeMath(plain.typst) },
      fixed: { ...fixed, ...fixedCheck, safe: fixed.typst !== null && isSafeMath(fixed.typst) },
      manualCheck,
      mitex: mitexCheck,
    }
  })
)

await writeFile(join(root, 'data/formulas.result.json'), JSON.stringify(results, null, 2) + '\n')
for (const r of results) {
  const mark = (c) => (c.ok ? 'ok ' : 'ERR')
  console.log(
    String(r.id).padStart(2),
    `plain ${mark(r.plain)}`,
    `fixed ${mark(r.fixed)}`,
    `manual ${mark(r.manualCheck)}`,
    `mitex ${mark(r.mitex)}`,
    '|',
    r.fixed.typst,
    r.fixed.ok ? '' : `<- ${r.fixed.error}`,
    r.mitex.ok ? '' : `| mitex: ${r.mitex.error}`
  )
}
