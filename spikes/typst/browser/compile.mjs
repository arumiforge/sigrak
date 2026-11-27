// Typst WASM compile helper, shared by the browser test page and a Node
// smoke test. `load(path)` returns the bytes of a spike file (fetch in the
// browser, readFile in Node).
import init, {
  TypstCompilerBuilder,
} from '../node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/wasm-pack-shim.mjs'
import { prepareDoc } from '../scripts/prepare.mjs'

export const fontFiles = [
  'LiberationSans-Regular.ttf',
  'LiberationSans-Bold.ttf',
  'LiberationSans-Italic.ttf',
  'LiberationSans-BoldItalic.ttf',
  'LiberationSerif-Regular.ttf',
  'LiberationSerif-Bold.ttf',
  'LiberationMono-Regular.ttf',
  'NotoNaskhArabic-Regular.ttf',
  'NotoNaskhArabic-Bold.ttf',
  'NewCMMath-Regular.otf',
]

const sources = ['templates/lib.typ', 'templates/rpm.typ', 'templates/lkpd.typ']
const PDF = 1
const DIAGNOSTICS_FULL = 3

const now = () => performance.now()

/** Instantiates the WASM module and builds a compiler with the spike fonts. */
export async function createCompiler(load, wasm) {
  const t0 = now()
  const out = await init({ module_or_path: wasm })
  const t1 = now()
  const builder = new TypstCompilerBuilder()
  builder.set_dummy_access_model()
  const fonts = await Promise.all(fontFiles.map((f) => load(`fonts/${f}`)))
  for (const bytes of fonts) await builder.add_raw_font(bytes)
  const compiler = await builder.build()
  const t2 = now()
  return { compiler, memory: out.memory, timings: { wasm_init_ms: t1 - t0, fonts_ms: t2 - t1 } }
}

/** Loads templates, letterhead and prepared JSON into the compiler. */
export async function loadProject(compiler, load) {
  const t0 = now()
  const decoder = new TextDecoder()
  for (const path of sources) compiler.add_source(`/${path}`, decoder.decode(await load(path)))
  compiler.map_shadow('/data/kop-contoh.png', await load('data/kop-contoh.png'))
  for (const name of ['rpm', 'lkpd']) {
    const doc = JSON.parse(decoder.decode(await load(`data/${name}.json`)))
    setDoc(compiler, name, doc)
  }
  return now() - t0
}

/** Converts LaTeX in the content JSON and puts it where the template reads it. */
export function setDoc(compiler, name, doc) {
  const prepared = prepareDoc(doc)
  compiler.map_shadow(`/build/${name}.json`, new TextEncoder().encode(JSON.stringify(prepared)))
}

/** One PDF render. Returns the PDF bytes and the time it took. */
export function renderPdf(compiler, template, paper) {
  const t0 = now()
  const world = compiler.snapshot(null, `/templates/${template}.typ`, [['paper', paper]])
  const result = world.get_artifact(PDF, DIAGNOSTICS_FULL)
  world.free()
  const ms = now() - t0
  if (!result?.result) {
    throw new Error(`Typst failed: ${JSON.stringify(result?.diagnostics ?? result).slice(0, 800)}`)
  }
  return { pdf: result.result, ms }
}
