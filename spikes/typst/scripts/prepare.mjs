// Turns a document's content JSON into the JSON the Typst templates read:
// every math segment { tex } becomes { m } (Typst math source). Pure function,
// used by the CLI build (scripts/build.mjs) and by the browser test.
import { convertFixed, isSafeMath } from './latex.mjs'

function convertSegment(tex) {
  try {
    const typ = convertFixed(tex)
    if (isSafeMath(typ)) return { m: typ }
    return { t: tex, warning: 'math refused by the # guard' }
  } catch (err) {
    // Unsupported LaTeX: print the source rather than fail the document.
    return { t: tex, warning: err.message }
  }
}

export function prepareDoc(value) {
  if (Array.isArray(value)) return value.map(prepareDoc)
  if (value && typeof value === 'object') {
    if (typeof value.tex === 'string' && Object.keys(value).length === 1) {
      return convertSegment(value.tex)
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, prepareDoc(v)]))
  }
  return value
}
