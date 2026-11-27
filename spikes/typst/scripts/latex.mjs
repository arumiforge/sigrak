// LaTeX (as stored for KaTeX on screen) -> Typst math, for the PDF.
// tex2typst does the conversion; `fixups` are the small SIGRAK-specific
// repairs the spike found necessary. Runs the same in Node and the browser.
import { tex2typst } from 'tex2typst'

// Applied to the LaTeX before conversion.
const preFixups = [
  // Indonesian decimal comma written the KaTeX way: 0{,}75 -> one text run,
  // otherwise tex2typst emits "0, 75" (a list comma with a space).
  [/(\d+)\{,\}(\d+)/g, '\\text{$1,$2}'],
]

// Applied to the Typst output.
const postFixups = [
  // ^\circ becomes a small circle in superscript; Typst has a real degree sign.
  [/\^circle\.small/g, ' degree'],
  // \text{Rp}12.500 and \text{KPK}(4, 6) come out with a space after the
  // quoted text ("Rp" 12.500), which prints as a visible gap.
  [/("[^"]*") (?=[\d(])/g, '$1'],
]

// \dfrac comes out as frac(a, b) (\frac as a/b), so the display size is lost
// inline. Wrap every frac(...) in display(...), matching parentheses.
function keepDisplayFractions(typ) {
  let out = ''
  let i = 0
  while (i < typ.length) {
    const at = typ.indexOf('frac(', i)
    const boundary = at > 0 ? typ[at - 1] : ' '
    if (at === -1) return out + typ.slice(i)
    if (/[\w.]/.test(boundary)) {
      out += typ.slice(i, at + 5)
      i = at + 5
      continue
    }
    let depth = 0
    let end = at + 4
    for (; end < typ.length; end++) {
      if (typ[end] === '(') depth++
      else if (typ[end] === ')' && --depth === 0) break
    }
    out += typ.slice(i, at) + 'display(' + typ.slice(at, end + 1) + ')'
    i = end + 1
  }
  return out
}

/** Plain tex2typst, no repairs. Throws on unsupported input. */
export function convertPlain(latex) {
  return tex2typst(latex)
}

/** tex2typst with the SIGRAK repairs. Throws on unsupported input. */
export function convertFixed(latex) {
  let tex = latex
  for (const [re, to] of preFixups) tex = tex.replace(re, to)
  let typ = tex2typst(tex)
  for (const [re, to] of postFixups) typ = typ.replace(re, to)
  return keepDisplayFractions(typ)
}

/**
 * Guard before the template evaluates converted math with eval(mode: "math").
 * `#` would switch to code mode inside math, so it is refused; this keeps
 * teacher input from reaching Typst code.
 */
export function isSafeMath(typ) {
  return !typ.includes('#')
}
