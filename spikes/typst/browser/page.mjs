// Browser side of the render-time test. bench.mjs calls window.runBench().
import { createCompiler, loadProject, renderPdf, setDoc } from './compile.mjs'

const status = document.querySelector('#status')
const load = async (path) => {
  const res = await fetch(`/${path}`)
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return new Uint8Array(await res.arrayBuffer())
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const round = (x) => Math.round(x)

window.runBench = async ({ runs = 7 } = {}) => {
  const t0 = performance.now()
  const wasmUrl =
    '/node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'
  const { compiler, memory, timings } = await createCompiler(load, wasmUrl)
  const projectMs = await loadProject(compiler, load)
  const ready = performance.now() - t0

  const docs = {}
  for (const name of ['rpm', 'lkpd']) {
    docs[name] = JSON.parse(new TextDecoder().decode(await load(`data/${name}.json`)))
  }

  const results = {}
  for (const name of ['rpm', 'lkpd']) {
    status.textContent = `Merender ${name}…`
    const first = renderPdf(compiler, name, 'a4')
    const paperSwitch = renderPdf(compiler, name, 'f4')
    // The preview loop: the teacher edits one text field, the PDF re-renders.
    const edits = []
    for (let i = 0; i < runs; i++) {
      const doc = structuredClone(docs[name])
      if (name === 'rpm') doc.asesmen.tindak_lanjut += ` (revisi ${i})`
      else doc.instructions[0] += ` (revisi ${i})`
      setDoc(compiler, name, doc)
      edits.push(renderPdf(compiler, name, 'a4').ms)
    }
    setDoc(compiler, name, docs[name])
    compiler.evict_cache(10)
    results[name] = {
      first_render_ms: round(first.ms),
      paper_switch_ms: round(paperSwitch.ms),
      edit_render_median_ms: round(median(edits)),
      edit_render_max_ms: round(Math.max(...edits)),
      pdf_bytes: first.pdf.length,
    }
    if (name === 'lkpd') {
      const url = URL.createObjectURL(new Blob([first.pdf], { type: 'application/pdf' }))
      document.querySelector('#preview').src = url
    }
  }
  status.textContent = 'Selesai.'
  return {
    startup_ms: {
      wasm_fetch_and_init: round(timings.wasm_init_ms),
      fonts_fetch_and_load: round(timings.fonts_ms),
      project_load_and_latex: round(projectMs),
      total_until_ready: round(ready),
    },
    wasm_memory_mb: round(memory.buffer.byteLength / 1048576),
    results,
  }
}

status.textContent = 'Siap.'
window.benchReady = true
