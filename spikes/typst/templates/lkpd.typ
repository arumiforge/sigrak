// LKPD print layout, one page (spike). Inputs as in rpm.typ.
#import "lib.typ": *

#let doc = json(sys.inputs.at("data", default: "/build/lkpd.json"))
#let kop = sys.inputs.at("kop", default: "/data/kop-contoh.png")

#show: sigrak-doc.with(
  title: doc.title,
  short-title: doc.short_title,
  school: doc.school,
  paper: sys.inputs.at("paper", default: "a4"),
  font: sys.inputs.at("font", default: "sans"),
  kop: if kop == "none" { none } else { kop },
  margin: (top: 1.5cm, bottom: 1.8cm, left: 1.8cm, right: 1.8cm),
)
#set text(size: 11pt)

#let blank(width) = box(width: width, stroke: (bottom: 0.5pt + colors.rule), height: 1em)
#let checkbox = box(width: 0.9em, height: 0.9em, stroke: 0.6pt + colors.ink, baseline: 0.1em)

// Title and pupil fields (filled in by hand: no pupil data is printed).
#grid(
  columns: (1fr, auto),
  align: (left + horizon, right + horizon),
  [
    #text(size: 13pt, weight: "bold")[LKPD #doc.subject: #doc.topic] #h(0.4em) #ar(doc.topic_ar, size: 1.35em) \
    #text(fill: colors.muted)[Kelas #doc.class · #doc.school]
  ],
  table(
    columns: (auto, 4.2cm),
    stroke: 0.5pt + colors.rule,
    fill: none,
    [Nama], [], [Kelas], [], [Tanggal], [],
  ),
)

#block(fill: colors.band, inset: 8pt, radius: 3pt, width: 100%)[
  *Tujuan:* #doc.goal.text \
  *Petunjuk:*
  #enum(..doc.instructions, tight: true)
]

#let trace-block(b) = {
  subsection(b.title)
  grid(
    columns: b.letters.len(),
    column-gutter: 4pt,
    ..b.letters.map(l => box(
      width: 100%,
      height: 1.7cm,
      stroke: (paint: colors.rule, thickness: 0.5pt, dash: "dashed"),
      align(center + horizon, text(
        font: fonts.arabic,
        size: 30pt,
        lang: "ar",
        fill: white,
        stroke: 0.7pt + rgb("#7b8794"),
        l,
      )),
    )),
  )
}

#let match-block(b) = {
  subsection(b.title)
  grid(
    columns: (1fr, 2.2cm, 1fr),
    row-gutter: 2pt,
    align: horizon,
    ..range(b.left.len())
      .map(i => (
        align(right, ar(b.left.at(i), size: 1.3em) + h(0.5em) + text(size: 14pt)[•]),
        [],
        align(left, text(size: 14pt)[•] + h(0.5em) + b.right.at(i)),
      ))
      .flatten(),
  )
}

#let fill-block(b) = {
  subsection(b.title)
  align(center, box(stroke: 0.6pt + colors.ink, inset: 6pt, radius: 2pt, b.word_bank.map(w => ar(w, size: 1.35em)).join(h(1.6em))))
  // Right-to-left table: the speaker column comes first on the right.
  set text(dir: rtl)
  table(
    columns: (25%, 1fr),
    align: right + horizon,
    inset: (x: 8pt, y: 3pt),
    fill: none,
    ..b.rows.map(r => (ar(r.at(0) + ":", size: 1.25em), ar(r.at(1), size: 1.25em))).flatten(),
  )
}

#let answer-block(b) = {
  subsection(b.title)
  // Right to left: number and question on the right, answer line to the left.
  set text(dir: rtl)
  for (i, q) in b.items.enumerate() {
    block(above: 0.5em, below: 0.5em)[
      #box(text(dir: ltr)[#(i + 1).]) #h(0.4em) #ar(q.ar, size: 1.35em)
      #if "hint" in q [#h(0.4em) #text(dir: ltr, size: 9.5pt, fill: colors.muted)[(#q.hint)]]
      #h(1fr) #blank(50%)
    ]
  }
}

#for b in doc.blocks {
  if b.type == "trace" { trace-block(b) } else if b.type == "match_lines" { match-block(b) } else if (
    b.type == "fill_table"
  ) { fill-block(b) } else if b.type == "short_answer" { answer-block(b) }
}

#subsection[Refleksi: beri tanda centang.]
#table(
  columns: (1fr, auto, auto),
  align: (left, center, center),
  th([Pernyataan], [Sudah bisa], [Belum]),
  ..doc.reflection.map(r => (r, checkbox, checkbox)).flatten(),
)
