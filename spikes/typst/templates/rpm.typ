// RPM print layout (spike). Inputs: paper (a4 | f4), font (sans | serif),
// data (prepared JSON, default /build/rpm.json), kop (path or "none").
#import "lib.typ": *

#let doc = json(sys.inputs.at("data", default: "/build/rpm.json"))
#let kop = sys.inputs.at("kop", default: "/data/kop-contoh.png")

#show: sigrak-doc.with(
  title: doc.title,
  short-title: doc.short_title,
  school: doc.school,
  paper: sys.inputs.at("paper", default: "a4"),
  font: sys.inputs.at("font", default: "sans"),
  kop: if kop == "none" { none } else { kop },
)

#align(center)[
  #text(size: 14pt, weight: "bold", upper(doc.title)) \
  #text(size: 11pt)[Pembelajaran Mendalam · Kurikulum 2025]
]
#v(0.3em)
#identity(doc.identity)

// A. Identifikasi
#section[A. Identifikasi]
#subsection[Kesiapan murid]
#content-of(doc.identifikasi.kesiapan)

#subsection[Karakteristik materi]
#content-of(doc.identifikasi.karakteristik_materi)

#subsection[Dimensi profil lulusan]
#list(..doc.identifikasi.dpl.map(d => [#d.at(0) #d.at(1)]))

#subsection[Kurikulum Berbasis Cinta (KBC)]
#identity((
  ("Tema KBC", doc.identifikasi.kbc.tema),
  ("Materi insersi", doc.identifikasi.kbc.insersi),
))

// B. Desain Pembelajaran
#section[B. Desain Pembelajaran]
#subsection[Capaian Pembelajaran]
#doc.desain.cp

#subsection[Tujuan Pembelajaran]
#table(
  columns: (auto, 1fr),
  th([Kode], [Tujuan pembelajaran]),
  ..doc.desain.tp.map(t => (text(size: 8.5pt, t.at(0)), t.at(1))).flatten(),
)

#identity((
  ("Praktik pedagogis", doc.desain.praktik_pedagogis),
  ("Kemitraan pembelajaran", doc.desain.kemitraan),
  ("Lingkungan pembelajaran", doc.desain.lingkungan),
  ("Pemanfaatan digital", doc.desain.digital),
  ("Media dan sumber", doc.desain.media),
))

// C. Pengalaman Belajar
#section[C. Pengalaman Belajar]
#for p in doc.pertemuan {
  subsection(p.judul)
  table(
    columns: (16%, 1fr, 19%, 12%),
    th([Tahap], [Kegiatan], [Prinsip], [Waktu]),
    ..p.langkah.map(l => (l.tahap, content-of(l.kegiatan), l.prinsip, l.waktu)).flatten(),
  )
}

// D. Asesmen
#section[D. Asesmen]
#subsection[Teknik dan instrumen]
#table(
  columns: (24%, 1fr, 22%),
  th([Waktu], [Teknik], [Instrumen]),
  ..doc.asesmen.teknik.flatten(),
)

#subsection[Rubrik (4 tingkat)]
#table(
  columns: (16%, 1fr, 1fr, 1fr, 1fr),
  th([Kriteria], [Sangat baik (4)], [Baik (3)], [Berkembang (2)], [Perlu bimbingan (1)]),
  ..doc.asesmen.rubrik.kriteria.flatten().map(c => text(size: 9.5pt, c)),
)

#subsection[Soal evaluasi]
#enum(..doc.asesmen.soal.map(s => content-of(s)))

#subsection[Tindak lanjut]
#doc.asesmen.tindak_lanjut

// The last section stays with the signatures, so they never stand alone.
#block(breakable: false)[
  #section[E. Lampiran]
  #doc.lampiran
  #signatures(doc.tanda_tangan.tempat_tanggal, doc.tanda_tangan.kiri, doc.tanda_tangan.kanan)
]
