// Node smoke test of the WASM compiler (same code path as the browser page).
// Usage: node browser/smoke-node.mjs   -> writes results/wasm-node-*.pdf
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createCompiler, loadProject, renderPdf } from './compile.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = async (p) => new Uint8Array(await readFile(join(root, p)))
const wasm = await readFile(
  join(root, 'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm')
)

const { compiler, timings } = await createCompiler(load, wasm)
await loadProject(compiler, load)
await mkdir(join(root, 'results'), { recursive: true })
for (const template of ['rpm', 'lkpd']) {
  const first = renderPdf(compiler, template, 'a4')
  const second = renderPdf(compiler, template, 'a4')
  await writeFile(join(root, `results/wasm-node-${template}-a4.pdf`), first.pdf)
  console.log(template, {
    first_ms: Math.round(first.ms),
    second_ms: Math.round(second.ms),
    bytes: first.pdf.length,
  })
}
console.log(timings)
