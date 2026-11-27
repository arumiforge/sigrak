// Shared print frame for SIGRAK documents (R0-07 spike).
// Rules from docs/final/content-engine.md (Export): A4 default and F4
// (215 x 330 mm, F-020), letterhead image across the content width on the
// first page capped at 4 cm (D-031), repeating header and footer with page
// numbers, table rows that never split, Arabic shaped right to left.

#let fonts = (
  sans: "Liberation Sans", // metric-compatible with Arial (D-125)
  serif: "Liberation Serif", // metric-compatible with Times New Roman
  arabic: "Noto Naskh Arabic",
  math: "New Computer Modern Math",
)

#let paper-sizes = (
  a4: (paper: "a4"),
  f4: (width: 215mm, height: 330mm),
)

#let colors = (
  ink: rgb("#1f2933"),
  muted: rgb("#52606d"),
  rule: rgb("#9aa5b1"),
  head: rgb("#e6efe9"),
  band: rgb("#f5f7f5"),
)

/// Arabic text: Naskh at a larger size, right to left. Works inline inside
/// Indonesian paragraphs (bidi) and as its own block.
#let ar(body, size: 1.3em, font: fonts.arabic) = text(
  font: font,
  size: size,
  lang: "ar",
  dir: rtl,
  // Harakat and Qur'anic marks reach beyond the font's ascender and
  // descender; measuring the real glyph bounds keeps them inside cells.
  top-edge: "bounds",
  bottom-edge: "bounds",
  body,
)

/// Arabic paragraph, right-aligned, with room for harakat above and below.
#let ar-block(body, size: 1.45em, font: fonts.arabic) = block(width: 100%, above: 0.8em, below: 0.8em)[
  #set par(justify: false, leading: 0.75em)
  #set align(right)
  #ar(body, size: size, font: font)
]

/// Converted math (Typst source produced from LaTeX by scripts/latex.mjs).
/// Only strings that passed the `#` guard reach this function.
/// Inline formulas use display size (fractions as tall as on a worksheet,
/// readable for SD/MI pupils), not the small text-style fractions.
#let m(src, block: false) = math.equation(block: block, math.display(eval(src, mode: "math")))

/// Rich text from the document model: an array of segments
/// (t: plain text, m: math as Typst source, ar: Arabic). Plain text is never
/// evaluated as markup, so teacher text cannot run Typst code.
#let rich(segments) = {
  for s in segments {
    if "t" in s { s.t } else if "m" in s { m(s.m) } else if "ar" in s { ar(s.ar) }
  }
}

/// Plain string or rich segments.
#let content-of(v) = if type(v) == array { rich(v) } else { v }

#let section(title) = block(above: 1.2em, below: 0.6em, sticky: true)[
  #text(weight: "bold", size: 1.05em, fill: colors.ink, upper(title))
  #v(-0.5em)
  #line(length: 100%, stroke: 0.6pt + colors.rule)
]

#let subsection(title) = block(above: 0.9em, below: 0.45em, sticky: true, text(weight: "bold", title))

/// Table header row: shaded, bold, repeated on every page.
#let th(..cells) = table.header(
  repeat: true,
  ..cells.pos().map(c => table.cell(fill: colors.head, text(weight: "bold", c))),
)

/// Two-column key/value table (identity block).
#let identity(rows) = {
  set par(justify: false)
  grid(
    columns: (30%, 0.8em, 1fr),
    inset: (x: 0pt, y: 2.5pt),
    ..rows.map(r => (r.at(0), [:], content-of(r.at(1)))).flatten(),
  )
}

/// Letterhead image across the content width, height capped at 4 cm.
#let letterhead(path) = layout(size => {
  let img = image(path, width: size.width)
  let h = measure(img).height
  if h > 4cm { align(center, image(path, height: 4cm)) } else { img }
})

/// Signature block: left and right signers (text, D-031).
#let signatures(place-date, left, right) = block(breakable: false, above: 2em)[
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 2em,
    [
      Mengetahui, \
      #left.role
      #v(2.2cm)
      #text(weight: "bold", underline(left.name)) \
      NIP #left.nip
    ],
    [
      #place-date \
      #right.role
      #v(2.2cm)
      #text(weight: "bold", underline(right.name)) \
      NIP #right.nip
    ],
  )
]

/// The page frame. `paper`: "a4" | "f4"; `font`: "sans" | "serif".
#let sigrak-doc(
  title: "",
  short-title: none,
  school: "",
  paper: "a4",
  font: "sans",
  kop: none,
  margin: (top: 1.8cm, bottom: 2cm, left: 2.2cm, right: 2cm),
  body,
) = {
  let body-font = if font == "serif" { fonts.serif } else { fonts.sans }
  let paper-key = if paper == "f4" { "f4" } else { "a4" }
  let paper-label = if paper-key == "f4" { "F4 (215 × 330 mm)" } else { "A4" }

  set document(title: title, author: school)
  set text(font: (body-font, fonts.arabic), size: 11pt, lang: "id", fill: colors.ink)
  // Line boxes use the real height of formulas; with the default edges a
  // display fraction inside a table cell runs into the cell border.
  show math.equation: set text(font: fonts.math, top-edge: "bounds", bottom-edge: "bounds")
  show raw: set text(font: "Liberation Mono")
  set par(justify: true, leading: 0.62em, spacing: 0.9em)
  set list(indent: 0.4em, body-indent: 0.5em)
  set enum(indent: 0.4em, body-indent: 0.5em)

  set table(stroke: 0.5pt + colors.rule, inset: (x: 5pt, y: 4pt))
  // A row never splits across pages; header rows repeat on every page.
  set table.cell(breakable: false)
  show table.cell: set par(justify: false)

  set page(
    ..paper-sizes.at(paper-key),
    margin: margin,
    header: context {
      if here().page() > 1 {
        set text(size: 8.5pt, fill: colors.muted)
        grid(
          columns: (1fr, auto),
          if short-title != none { short-title } else { title },
          school,
        )
        v(-0.4em)
        line(length: 100%, stroke: 0.4pt + colors.rule)
      }
    },
    footer: context {
      set text(size: 8.5pt, fill: colors.muted)
      line(length: 100%, stroke: 0.4pt + colors.rule)
      v(-0.4em)
      grid(
        columns: (1fr, auto),
        [Dibuat dengan SIGRAK · Kertas #paper-label],
        [Halaman #counter(page).display() dari #counter(page).final().first()],
      )
    },
  )

  if kop != none {
    letterhead(kop)
    v(0.4em)
  }
  body
}
