# `/harga` Harga: copy draft

- **Audience:** teachers deciding after the trial; principals deciding on Sigrak Sekolah and add-ons; pengawas checking Sigrak Binaan.
- **Goal:** every price, who pays, what happens after the trial, and how to pay, on one page, in plain words.
- **Sources:** D-157 (plans, who pays), D-459 (free trial whose length is a setting, extendable, per user or per school; replaces the fixed 1 week of D-160), D-459 (sign-up and joining a school), D-158 (add-ons), D-159 (Game kelas trial), D-161 (Buku Induk upcoming), D-211 (core vs add-on set in the console), D-025 and D-459 (no funding-source line on public pages), D-091 and D-395 (manual payment, static QRIS first), D-012 and D-023 (AI cost is never a SIGRAK cost).
- **Keep in sync:** the add-on list is the D-158 starting configuration. The console can move features between core and add-on (D-211), so in the built page this table reads from the console's plan mapping, not from hard-coded copy. Open mapping question in the product concept: leger lock and weights (core Asesmen or Rapor add-on), sumbangan and savings (Keuangan add-on).
- **Layout:** a plain table on desktop that becomes one block per plan on phones. No "most popular" badge, no strike-through prices, no countdowns.
- **No FAQ block:** the conditions are written as short sections (bahasa-indonesia-plain: "jangan gunakan FAQ").

## Share preview

- Title: "Harga Sigrak per tahun ajaran"
- Meta description: "Sigrak Guru Rp60.000 dan Sigrak Sekolah Rp100.000 per tahun ajaran. Coba semua fitur guru tanpa biaya."
- Share image: Codex brief needed — a plain price card drawn as a school receipt book page with the wordmark, no numbers in the image.

## 1. Intro

- H1: "Harga per tahun ajaran"
- Lead: "Satu tahun ajaran berlaku dari Juli sampai Juni. Yang membayar hanya guru dan sekolah. Murid dan orang tua tidak pernah membayar."

## 2. Paket

Copy (table):

| Paket                              | Untuk                        | Isi                                                                                                                                  | Harga                                                                                  | Dibayar oleh |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------ |
| Uji coba (`#uji-coba`)             | Satu guru, atau semua guru di satu sekolah | Semua fitur guru selama masa uji coba. Lama uji coba tertera saat mendaftar dan bisa diperpanjang                  | Tanpa biaya                                                                            | —            |
| Sigrak Guru (`#sigrak-guru`)       | Satu guru                    | Semua fitur guru                                                                                                                     | Rp60.000 per tahun ajaran, atau Rp50.000 bila sekolah Anda berlangganan Sigrak Sekolah | Guru         |
| Sigrak Sekolah (`#sigrak-sekolah`) | Satu sekolah                 | Dua akun, kepala sekolah dan operator, lengkap dengan portalnya: validasi, pengaturan cetak sekolah, undangan guru, dan data sekolah | Rp100.000 per tahun ajaran                                                             | Sekolah      |
| Sigrak Binaan (`#sigrak-binaan`)   | Satu pengawas atau gugus KKG | Portal pengawas                                                                                                                      | Tanpa biaya, terbuka setelah 5 atau lebih sekolah binaan berlangganan Sigrak Sekolah   | —            |

Under the table:

- "Sigrak Sekolah tidak termasuk akun guru. Setiap guru berlangganan Sigrak Guru sendiri, dengan harga Rp50.000."
- Price tax line: "[Harga sudah termasuk pajak / belum termasuk pajak]" (placeholder; tax is settled offline, D-460).

## 3. Fitur tambahan (`#fitur-tambahan`)

- H2: "Fitur tambahan untuk sekolah"
- Lead: "Sekolah yang berlangganan Sigrak Sekolah bisa menyalakan fitur tambahan untuk semua akunnya. Setiap fitur Rp50.000 per tahun ajaran."
- List:
    - "Simulasi TKA — ujian latihan kelas 6 dengan kartu login, token dari pengawas, dan hasil per tingkat."
    - "Game kelas — Quiz Battle, tayangkan di kelas, dan unduh game untuk dimainkan tanpa internet."
    - "Rapor — leger, draf deskripsi capaian, dan ekspor rapor."
    - "Keuangan dan Inventaris kelas — sumbangan sukarela, tabungan murid, dan barang di kelas."
    - "Buku Sekolah — buku tamu, humas, dan notulen."
    - "Buku Induk dan sinkron data Dapodik — segera hadir."
- Note line: "Daftar fitur tambahan bisa berubah. Perubahan diumumkan di halaman Apa yang baru sebelum tahun ajaran berikutnya."

## 4. Uji coba dan sesudahnya

- H2: "Uji coba gratis"
- Body: "Daftar di app.sigrak.com/daftar, lalu coba semua fitur guru tanpa biaya. Lama uji coba tertera di akun Anda."
- Body 2: "Belum cukup? Uji coba bisa diperpanjang saat berakhir. Sekolah juga bisa meminta uji coba untuk semua gurunya sekaligus. Hubungi kami lewat WhatsApp atau formulir kontak."
- H3: "Daftar sendiri, lalu bergabung ke sekolah"
- Body: "Anda boleh mendaftar sendiri tanpa menunggu sekolah. Saat operator sekolah mengundang email yang sama, akun Anda bergabung ke sekolah itu. Semua dokumen Anda tetap ada."
- H3: "Bila uji coba berakhir"
- Body: "Bila Anda belum berlangganan, akun Anda tidak dihapus. Anda masih bisa melihat dan mengunduh semua data Anda. Untuk membuat dan mengubah lagi, pilih Sigrak Guru."
- H3: "Coba Game kelas"
- Body: "Guru boleh mencoba Game kelas selama 7 hari, satu kali, walaupun sekolahnya belum menyalakan fitur ini."

## 5. Cara membayar

- H2: "Cara membayar"
- Steps:
    1. "Pilih paket di menu Paket Saya (guru) atau Pengaturan Sekolah > Langganan (kepala sekolah)."
    2. "Bayar lewat QRIS dengan nominal yang tertera, termasuk kode unik di belakangnya."
    3. "Tim Sigrak memeriksa pembayaran Anda, lalu paket aktif. [Lama pemeriksaan, misalnya 1 hari kerja]."
- Body: "Butuh kuitansi atau cara bayar lain? Hubungi kami lewat WhatsApp atau formulir kontak."

Notes: static QRIS with a unique code and manual confirmation by Keuangan or the owner (D-395, D-340). Confirmation time and receipts/invoices are placeholders; mid-year purchases, refunds and tax are settled offline (D-460). No funding-source line on public pages (D-025, D-459). Trial copy names no number of days because the length is a setting (D-459); the Game kelas trial keeps its own 7 days (D-159).

## 6. Biaya AI

- H2: "Biaya AI tidak ditagih Sigrak"
- Body: "Untuk membuat bahan ajar, Anda memakai kunci AI Gemini milik Anda sendiri, versi gratis. Pemakaian AI tidak masuk tagihan Sigrak, dan Sigrak tidak menjual kuota AI."
- Link: "Baca kebijakan AI" → `/kebijakan-ai`

## 7. Penutup

- H2: "Mulai dari uji coba"
- Primary button: "Coba gratis" → `https://app.sigrak.com/daftar`
- Secondary: "Untuk sekolah: hubungi kami lewat WhatsApp" · "Atau isi formulir kontak" → `/kontak#formulir`
