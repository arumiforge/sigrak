// Sample letterhead (kop) for a fictional madrasah. SIGRAK receives the
// letterhead as an uploaded image (D-031); this file only makes that sample
// image: typst compile kop/kop.typ data/kop-contoh.png --ppi 360
// 170 mm x 30 mm at 360 ppi = 2409 x 425 px (ratio 5.7:1, rule 4:1 to 8:1).
#set page(width: 170mm, height: 30mm, margin: (x: 2mm, top: 2mm, bottom: 1.5mm), fill: white)
#set text(font: "Liberation Sans", fill: rgb("#1d3b2a"))

#let emblem = box(width: 22mm, height: 22mm)[
  #place(center + horizon, circle(radius: 11mm, stroke: 1.2pt + rgb("#1d6b3a"), fill: rgb("#eaf5ee")))
  #place(center + horizon, circle(radius: 8.6mm, stroke: 0.6pt + rgb("#1d6b3a")))
  // open book
  #place(center + horizon, dy: 2.2mm, polygon(
    fill: rgb("#1d6b3a"),
    (-6mm, -1.5mm), (0mm, 0mm), (6mm, -1.5mm), (6mm, 2.5mm), (0mm, 4mm), (-6mm, 2.5mm),
  ))
  #place(center + horizon, dy: 2.2mm, line(start: (0mm, 0mm), end: (0mm, 4mm), stroke: 0.6pt + white))
  // star
  #place(center + horizon, dy: -4mm, polygon.regular(fill: rgb("#c99a1c"), size: 5mm, vertices: 8))
]

#grid(
  columns: (24mm, 1fr, 24mm),
  align: (center + horizon, center + horizon, center + horizon),
  emblem,
  [
    #set par(leading: 0.35em, spacing: 0.35em)
    #text(size: 8.5pt, tracking: 0.4pt)[YAYASAN PENDIDIKAN ISLAM CONTOH] \
    #text(size: 13pt, weight: "bold")[MADRASAH IBTIDAIYAH CONTOH NURUL ILMI] \
    #text(font: "Noto Naskh Arabic", size: 11pt, lang: "ar")[مَدْرَسَةُ نُوْرِ الْعِلْمِ الْاِبْتِدَائِيَّةُ] \
    #text(size: 7pt)[NSM 111200000000 · NPSN 60000000 · Terakreditasi A] \
    #text(size: 7pt)[Jl. Contoh Raya No. 1, Desa Contoh, Kab. Kudus 59300 · Telp. (0291) 000000 · mi.contoh\@example.sch.id]
  ],
  [],
)
#place(bottom, dy: 0mm, line(length: 100%, stroke: 1.6pt + rgb("#1d3b2a")))
#place(bottom, dy: -2.2pt, line(length: 100%, stroke: 0.5pt + rgb("#1d3b2a")))
