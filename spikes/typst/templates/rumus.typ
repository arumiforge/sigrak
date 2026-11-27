// Formula test sheet: 20 SD/MI formulas, LaTeX -> Typst three ways.
// Reads data/formulas.result.json (from scripts/formulas.mjs).
#import "lib.typ": *
#import "@preview/mitex:0.2.7": mi

#let data = json("/data/formulas.result.json")
#let paper = sys.inputs.at("paper", default: "a4")

#show: sigrak-doc.with(
  title: "Uji Rumus LaTeX ke Typst",
  school: "Spike R0-07",
  paper: paper,
  margin: (top: 1.5cm, bottom: 1.6cm, left: 1.5cm, right: 1.5cm),
)
#set page(flipped: true)
#set text(size: 9.5pt)

#align(center, text(size: 14pt, weight: "bold")[Uji Rumus Matematika SD/MI: LaTeX ke Typst])
#align(center, text(fill: colors.muted)[
  20 rumus contoh. Kolom *tex2typst* memakai konversi otomatis apa adanya; kolom *+ perbaikan* memakai
  aturan kecil SIGRAK (`scripts/latex.mjs`); *mitex* membaca LaTeX langsung di Typst; *tulisan tangan*
  adalah rumus Typst yang ditulis pengembang sebagai pembanding.
])

#let show-typst(r) = {
  if r.ok and r.safe { math.equation(eval(r.typst, mode: "math")) } else if r.typst == none {
    text(fill: red)[gagal dikonversi]
  } else if not r.ok { text(fill: red, size: 8pt)[galat: #r.error] } else {
    text(fill: red, size: 8pt)[ditolak: berisi `#`]
  }
}

#table(
  columns: (auto, 13%, 21%, 17%, 1fr, 1fr, 1fr, 1fr),
  align: (center + horizon, horizon, horizon, horizon, center + horizon, center + horizon, center + horizon, center + horizon),
  th(
    [No],
    [Materi],
    [LaTeX (disimpan)],
    [Typst (+ perbaikan)],
    [tex2typst],
    [\+ perbaikan],
    [mitex],
    [tulisan tangan],
  ),
  ..data
    .map(r => (
      str(r.id),
      r.topic,
      text(size: 7.5pt, raw(r.latex)),
      text(size: 7.5pt, raw(if r.fixed.typst == none { "-" } else { r.fixed.typst })),
      show-typst(r.plain),
      show-typst(r.fixed),
      if r.mitex.ok { mi(r.latex) } else { text(fill: red, size: 8pt)[galat] },
      if r.manualCheck.ok { math.equation(eval(r.manual, mode: "math")) } else { text(fill: red, size: 8pt)[galat] },
    ))
    .flatten(),
)

#let verdict(v) = {
  let c = if v == "lulus" { rgb("#1d6b3a") } else if v == "kecil" { rgb("#a06a00") } else { red }
  text(fill: c, weight: "bold", v)
}
#let count(key, v) = data.filter(r => r.review.at(key) == v).len()

#section[Penilaian visual]
Penilaian dibuat dengan melihat hasil cetak satu per satu. *lulus*: benar dan rapi; *kecil*: benar
tetapi ada jarak atau ukuran yang kurang tepat; *salah*: tampil tetapi isinya keliru; *galat*: tidak
bisa dikompilasi.

#table(
  columns: (auto, 22%, auto, auto, auto, 1fr),
  align: (center, left, center, center, center, left),
  th([No], [Materi], [tex2typst], [\+ perbaikan], [mitex], [Catatan]),
  ..data
    .filter(r => r.review.note != "")
    .map(r => (str(r.id), r.topic, verdict(r.review.plain), verdict(r.review.fixed), verdict(r.review.mitex), r.review.note))
    .flatten(),
  table.cell(colspan: 2)[*Jumlah lulus dari 20*],
  [*#count("plain", "lulus")*],
  [*#count("fixed", "lulus")*],
  [*#count("mitex", "lulus")*],
  [Rumus yang tidak tercantum di sini lulus di ketiga cara.],
)
