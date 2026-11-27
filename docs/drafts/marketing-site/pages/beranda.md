# `/` Beranda: copy draft

- **Audience:** every visitor; teachers first, then principals, operators and pengawas.
- **Goal:** in one screen, say what Sigrak does and for whom; then route each visitor to their role page or to the trial.
- **Format:** structure and notes in English; the copy (everything in quotes or under "Copy") is Indonesian UI text for `resources/lang/id`.
- **Claims check:** every feature named here is v1 in `docs/final/product-concept.md`. Before launch, remove or mark "Segera hadir" anything whose slice has not shipped (README, ship check).

## Share preview

- Title: "Sigrak — bahan ajar dan administrasi guru SD dan MI"
- Meta description: "Siapkan RPM, soal, dan LKPD dengan menjawab beberapa pertanyaan. Isi kehadiran dan jurnal dari ponsel. Untuk guru dan sekolah SD dan MI."
- Share image: Codex brief needed — 1200 × 630, a teacher at a desk after class with a phone and a printed RPM, wordmark space on the left.

## 1. Hero

Layout: left-aligned text column, visual on the right on desktop, below the buttons on phones. Main button visible without scrolling at 360 px. No eyebrow above the heading.

Visual: Codex brief needed — an SD teacher in a real classroom between lessons, checking her phone while pupils pack their bags.

Copy:

- H1: "Kerja guru, lebih sigrak."
- Lead: "Bahan ajar siap pakai dan administrasi beres, tanpa menulis prompt."
- Body: "Sigrak membantu guru SD dan MI menyiapkan RPM, soal, dan LKPD, mengisi kehadiran dan jurnal, lalu menyusun rapor. Semuanya di satu tempat, dari ponsel atau laptop."
- Primary button: "Coba 7 hari" → trial sign-up
- Secondary link: "Lihat harga" → `/harga`
- Small text under the buttons: "Uji coba 7 hari dengan semua fitur guru, tanpa biaya."

Note: "prompt" appears only because it is the approved brand promise (D-017); everywhere else the copy avoids the word (design-system rule 9). README Q3.

## 2. Satu hari mengajar dengan Sigrak (`#satu-hari`)

Layout: a horizontal timeline on desktop, a vertical list on phones. Four moments, each with a time of day, one sentence and a small screen crop. No cards with coloured borders.

Visual: Codex brief needed — four small scenes in one style: morning roll call, after the lesson, afternoon at home, end of semester.

Copy:

- H2: "Satu hari mengajar dengan Sigrak"
- Pagi — "Buka Kehadiran. Semua murid tercatat hadir, Anda cukup ketuk yang tidak masuk. Tetap bisa diisi saat sinyal hilang."
- Setelah pelajaran — "Jurnal sudah terisi dari RPM hari ini. Tandai terlaksana, sebagian, atau belum terlaksana, lalu tambah catatan."
- Sore — "Siapkan RPM untuk besok. Kelas dan mapel sudah terisi dari jadwal Anda."
- Akhir semester — "Unduh Berkas Administrasi dalam satu PDF. Tidak perlu mengumpulkan berkas satu per satu."

## 3. Anda menjawab pertanyaan, bukan menulis perintah

Layout: numbered steps in a single column with a screen recording or still per step beside it (desktop) or below it (phone).

Visual: Codex brief needed — a phone frame showing the four-step wizard with abstract text lines, no readable words.

Copy:

- H2: "Anda menjawab pertanyaan, bukan menulis perintah"
- Lead: "Setiap templat dibuat Tim Sigrak. Anda cukup menjawab pertanyaan yang biasa Anda pikirkan saat menyiapkan pelajaran."
- Steps:
  1. "Pilih templat: RPM, Bank Soal, LKPD, Quiz Battle, atau yang lain."
  2. "Jawab beberapa pertanyaan: topik, tujuan pembelajaran, kondisi murid, dan lama pelajaran. Kelas, mapel, CP, dan JP sudah diisi Sigrak."
  3. "Sigrak menyusun isinya dengan kunci AI Anda. Anda boleh pindah ke halaman lain dan akan diberi tahu saat selesai."
  4. "Periksa dan ubah sesuka Anda. Perbaiki satu bagian saja tanpa mengulang semuanya, lalu unduh PDF atau Word."
- Closing line: "Anda tetap penulisnya. Semua hasil bisa diubah sebelum dipakai."

## 4. Yang bisa Anda buat

Layout: a two-column list (name + one line), not icon cards. Each name links to the matching anchor on `/fitur`.

Copy:

- H2: "Yang bisa Anda buat"
- RPM — "Rencana pembelajaran per pertemuan, sesuai jadwal dan kalender sekolah. Siap cetak dengan kop sekolah."
- Kokurikuler — "Rencana kokurikuler yang mengikuti program sekolah."
- Bank Soal — "Soal yang terhubung ke tujuan pembelajaran, lengkap dengan kisi-kisi dan kartu soal."
- LKPD — "Lembar kerja murid, juga sebagai lampiran RPM."
- Quiz Battle — "Permainan kuis untuk ditayangkan di kelas atau diunduh dan dimainkan tanpa internet."
- Paket Soal TKA — "Paket latihan untuk Simulasi TKA kelas 6."
- Small note: "Quiz Battle dan Simulasi TKA termasuk fitur tambahan. Lihat harga."

Note: add-on placement follows the D-158 starting configuration; the console may change it (D-211). Keep this note in sync with `/harga`.

## 5. Sigrak untuk setiap peran di sekolah

Layout: four rows, each a role name, one sentence, and a text link. A single Codex illustration of a staff room beside the list on desktop.

Visual: Codex brief needed — a school staff room with a teacher, a principal, an operator at a laptop, and a visiting pengawas.

Copy:

- H2: "Sigrak untuk setiap peran di sekolah"
- Guru — "Siapkan bahan ajar, isi Di Kelas dari ponsel, dan susun rapor." → "Lihat untuk guru"
- Kepala sekolah — "Lihat kelengkapan guru setiap minggu dan sahkan dokumen tanpa tumpukan map." → "Lihat untuk kepala sekolah"
- Operator — "Siapkan tahun ajaran, kelas, jadwal, dan undang guru." → "Lihat untuk operator"
- Pengawas — "Pantau sekolah binaan dari data yang sama dengan guru." → "Lihat untuk pengawas"

## 6. Data sekolah tetap milik sekolah

Layout: a plain text section with a short list and two links; no shield icons or lock illustrations.

Copy:

- H2: "Data sekolah tetap milik sekolah"
- List intro: "Kami menjaga data murid dengan aturan yang jelas:"
  - "data pribadi murid tidak pernah dikirim ke AI."
  - "murid bukan pengguna aplikasi guru. Mereka hanya masuk ke situs Simulasi TKA dengan kartu login sekali pakai."
  - "berkas yang memuat data pribadi murid disimpan di server di Indonesia."
  - "setiap peran hanya melihat data yang menjadi tugasnya."
- Links: "Baca perjanjian perlindungan data murid" → `/perlindungan-data-murid` · "Cara Sigrak memakai AI" → `/kebijakan-ai`

## 7. Untuk SD dan madrasah

Layout: two halves side by side (stacked on phones), each with a Codex visual, two sentences and a link.

Visual: Codex brief needed — two matching scenes: a public SD class in red-and-white uniform, an MI class in madrasah uniform.

Copy:

- H2: "Untuk SD dan madrasah"
- SD — "Struktur kurikulum dan JP mengikuti aturan SD terbaru. Enam mapel agama tersedia." → "Sigrak untuk SD"
- Madrasah — "Mapel agama Kemenag dan Kurikulum Berbasis Cinta sudah ada di RPM." → "Sigrak untuk madrasah"

## 8. Harga singkat

Layout: two plain price rows and a link; the full table lives on `/harga`.

Copy:

- H2: "Harga per tahun ajaran"
- "Sigrak Guru — Rp60.000 per tahun ajaran. Rp50.000 bila sekolah Anda berlangganan Sigrak Sekolah."
- "Sigrak Sekolah — Rp100.000 per tahun ajaran untuk akun kepala sekolah dan operator."
- "Biaya AI tidak ditagih Sigrak. Anda memakai kunci AI Gemini milik Anda sendiri."
- Link: "Lihat semua harga dan fitur tambahan" → `/harga`

## 9. Penutup

Layout: one short band with the button; a Codex pattern or divider above it.

Visual: Codex brief needed — a quiet chalk-line divider in the brand teal, used across product pages.

Copy:

- H2: "Mulai dari kelas Anda sendiri"
- Body: "Coba semua fitur guru selama 7 hari. Setelah itu, data Anda tetap bisa dilihat dan diunduh."
- Button: "Coba 7 hari"
