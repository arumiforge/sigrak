// Prepares the sample data and renders every sample PDF with the Typst CLI.
// Usage: node scripts/build.mjs            render pdf/*.pdf
//        node scripts/build.mjs --bench 15 also time each render (median)
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cpus } from 'node:os'
import { promisify } from 'node:util'
import { prepareDoc } from './prepare.mjs'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const jobs = [
  { out: 'rpm-a4.pdf', template: 'rpm.typ', inputs: { paper: 'a4' } },
  { out: 'rpm-f4.pdf', template: 'rpm.typ', inputs: { paper: 'f4' } },
  { out: 'rpm-a4-times.pdf', template: 'rpm.typ', inputs: { paper: 'a4', font: 'serif' } },
  { out: 'lkpd-a4.pdf', template: 'lkpd.typ', inputs: { paper: 'a4' } },
  { out: 'lkpd-f4.pdf', template: 'lkpd.typ', inputs: { paper: 'f4' } },
  { out: 'arab-a4.pdf', template: 'arab.typ', inputs: { paper: 'a4' } },
  { out: 'rumus-a4.pdf', template: 'rumus.typ', inputs: { paper: 'a4' } },
]

async function prepare() {
  await mkdir(join(root, 'build'), { recursive: true })
  for (const name of ['rpm', 'lkpd']) {
    const doc = JSON.parse(await readFile(join(root, `data/${name}.json`), 'utf8'))
    await writeFile(join(root, `build/${name}.json`), JSON.stringify(prepareDoc(doc), null, 2))
  }
}

async function compile(job) {
  const args = [
    'compile',
    '--root',
    root,
    '--ignore-system-fonts',
    '--ignore-embedded-fonts',
    '--font-path',
    join(root, 'fonts'),
    ...Object.entries(job.inputs).flatMap(([k, v]) => ['--input', `${k}=${v}`]),
    join(root, 'templates', job.template),
    join(root, 'pdf', job.out),
  ]
  const started = performance.now()
  const { stderr } = await run('typst', args)
  const ms = performance.now() - started
  if (stderr.trim()) console.warn(`${job.out}:\n${stderr}`)
  return ms
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

await prepare()
await mkdir(join(root, 'pdf'), { recursive: true })
for (const job of jobs) await compile(job)
console.log(`Rendered ${jobs.length} PDFs into pdf/`)

const benchAt = process.argv.indexOf('--bench')
if (benchAt !== -1) {
  const runs = Number(process.argv[benchAt + 1] ?? 15)
  const results = []
  for (const job of jobs) {
    const times = []
    // One render at a time, so each measures a cold CLI process on an idle CPU.
    for (let i = 0; i < runs; i++) times.push(await compile(job))
    results.push({
      pdf: job.out,
      runs,
      median_ms: Math.round(median(times)),
      min_ms: Math.round(Math.min(...times)),
      max_ms: Math.round(Math.max(...times)),
    })
    console.log(results.at(-1))
  }
  const { stdout: version } = await run('typst', ['--version'])
  await mkdir(join(root, 'results'), { recursive: true })
  await writeFile(
    join(root, 'results/server-times.json'),
    JSON.stringify(
      {
        measured_at: new Date().toISOString(),
        typst: version.trim(),
        cpu: cpus()[0]?.model,
        cpu_count: cpus().length,
        note: 'Wall time of one `typst compile` process per render (process start, font scan, compile, PDF write).',
        results,
      },
      null,
      2
    ) + '\n'
  )
}
