# Marketing site `sigrak.com`: sitemap

- **Status:** draft (RS-06)
- **Decisions:** D-435 (sitemap, admin-edited pages, versioned legal pages), D-389 (public pages server-rendered), D-390 (Codex visuals), D-149 (Indonesian paths), D-157…D-160 (plans, add-ons, trial), D-426 (status page), D-443 (public chatbot without AI), D-444 (legal review offline)
- **Rules applied:** Fondasi `docs/web-baseline.md` §10 and §12 (required public pages, share previews, visitor counts), `docs/ui.md` (the "never" list), `bahasa-indonesia-plain`; SIGRAK `docs/final/design-system.md` (voice, terms, banned words)

## Ground rules for every page

- **Server-rendered HTML** from the same app (D-435, D-389). Text, navigation and links work before any Codex visual or motion loads; visuals load after first paint, with skeletons that reserve their size (Fondasi web-baseline §6).
- **Structure reference only:** grafana.com's information architecture (mega menu, role and solution pages, resources, company and legal footer). Its look, copy and components are never copied (D-435).
- **Not the default landing page** (Fondasi `ui.md`): no centred hero + three icon cards + testimonial carousel. Product pages start from what a teacher or principal does on a school day. Left-aligned reading, varied section layouts, cards only for related data. No eyebrows, accent bars, icons in tinted circles, gradients or glow.
- **Only real claims:** copy describes v1 as defined in `docs/final/product-concept.md`. No invented numbers, user counts, testimonials, school names or logos. A feature whose slice has not shipped at launch is removed from the page or marked "Segera hadir" (see the ship check in [`README.md`](README.md)).
- **Voice:** "Anda" for the reader, "kami" for Tim Sigrak, "Sigrak" in sentence case, tagline "Kerja guru, lebih sigrak." Terms from the design system (murid, Kehadiran, Templat, Kunci AI, Simulasi TKA, Pengingat, Berkas Administrasi, pengesahan dokumen). The banned words never appear.
- **Share previews** on every page (Fondasi web-baseline §10): `<title>`, meta description, Open Graph and Twitter tags, a 1200 × 630 share image per page or section (Codex brief), canonical URL on `https://sigrak.com`, `lang="id"`, favicon and app icons.
- **Public chatbot** (D-443) on every page: quick choices, links to Panduan and to answers already on the site; no AI model, nothing sent to a provider. It hands over to WhatsApp for sales and support questions.
- **Visitor counts** without personal data only (Fondasi web-baseline §12): daily-salted hash, no third-party analytics script, no tracking cookies.
- **Robots:** indexing allowed on `sigrak.com` only; staging stays `noindex` behind Cloudflare Access. `sitemap.xml` lists every page below except utility pages.

## Page list

Calls to action use two destinations whose exact URLs are still open (README, Q1): **trial sign-up** ("Coba 7 hari") on `app.sigrak.com`, and **contact by WhatsApp** for schools and pengawas. "Masuk" always goes to `https://app.sigrak.com/masuk`.

### Product (in code, D-435)

| Path                    | Page title            | Purpose                                                                        | Audience                                     | Main sections                                                                                                                                                                                        | Main CTA                                           |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `/`                     | Beranda               | Say what Sigrak is in one screen and route each visitor to their role          | All visitors; teachers first                 | Hero with tagline and promise · one teaching day with Sigrak · four steps to make content · what teachers can make · pages per role · data stays with the school · SD and madrasah · prices in brief | Coba 7 hari; secondary Lihat harga                 |
| `/fitur`                | Fitur                 | Full feature list grouped by the five teacher menus and the portals            | Teachers comparing tools; principals         | Buat (templates) · Di Kelas · Asesmen · Kelas Saya · Hari Ini · portals · print and documents · Kunci AI · what is coming later                                                                      | Coba 7 hari                                        |
| `/untuk-guru`           | Untuk guru            | Show guru kelas, wali kelas and guru mapel their own day                       | Guru kelas (SD), wali kelas (MI), guru mapel | A teaching day · make content without writing instructions · Di Kelas works without signal · assessment and rapor · Kunci AI in plain words · price for teachers                                     | Coba 7 hari                                        |
| `/untuk-kepala-sekolah` | Untuk kepala sekolah  | Show monitoring without collecting files, validation, supervision              | Principals                                   | Weekly routine (Ringkasan, Pantau Guru, Validasi) · Pengingat · pengesahan dokumen · supervisi akademik · Berkas Administrasi · school settings · Sigrak Sekolah price                               | Hubungi kami lewat WhatsApp; secondary Lihat harga |
| `/untuk-operator`       | Untuk operator        | Show the start-of-year setup and daily school data work                        | Operator sekolah                             | Start of the school year in four steps · invitations instead of shared passwords · timetable and kaldik · pindah dan keluar · inventaris · Arsip Tahun Ajaran                                        | Hubungi kami lewat WhatsApp                        |
| `/untuk-pengawas`       | Untuk pengawas        | Show sekolah binaan, read-only totals, PKKS and reports; explain Sigrak Binaan | Pengawas, korwil                             | Request sekolah binaan · school totals, read-only · curriculum validation · PKKS · supervision report · free access rule                                                                             | Hubungi kami lewat WhatsApp                        |
| `/sd`                   | Sigrak untuk SD       | What is specific to SD                                                         | SD teachers and principals                   | Structure and JP from the SD rules · six religion subjects · guru kelas and guru mapel · muatan lokal per region · rapor export to e-Rapor SD                                                        | Coba 7 hari                                        |
| `/madrasah`             | Sigrak untuk madrasah | What is specific to MI                                                         | MI teachers and principals                   | Kemenag structure · religion subjects of MI · Kurikulum Berbasis Cinta in the RPM · wali kelas · Arabic text · rapor export to RDM                                                                   | Coba 7 hari                                        |
| `/harga`                | Harga                 | Plans, add-ons, trial, payment and who pays                                    | Teachers, principals, pengawas               | Plans table · fitur tambahan · uji coba and Game kelas trial · Sigrak Binaan · how payment works · AI costs                                                                                          | Coba 7 hari; Hubungi kami for schools              |

Copy drafts: [`pages/`](pages/).

### Resources (Kabar, Acara, Cerita Sekolah edited in the admin panel, D-435)

| Path              | Page title     | Purpose                                                                                                           | Audience                       | Main sections                                                                                                  | Main CTA                                                  |
| ----------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `/kabar`          | Kabar          | Public news from Tim Sigrak: releases, curriculum and rule updates relevant to SD/MI, pilot news                  | Teachers, principals, pengawas | List (newest first, filter by topic and level) · article page with date, author role, related links            | Link to related Panduan or feature                        |
| `/acara`          | Acara          | Webinars, trainings with KKG/KKM, school visits                                                                   | Teachers, communities          | Upcoming (date, time with zone, place or online, who it is for, how to join) · past events with materials      | Daftar acara (external form or WhatsApp; open, README Q9) |
| `/cerita-sekolah` | Cerita Sekolah | Real stories from pilot schools, published only with the school's written permission                              | Principals, pengawas, teachers | Story list · story page (school, region, what changed, in the school's own words)                              | Coba 7 hari                                               |
| `/praktik-baik`   | Praktik Baik   | Public part of the Bank Praktik Baik (D-439): good classroom and school practice, credited to its authors (F-034) | Teachers, KKG/KKM              | List by subject, phase and topic · practice page with author credit and the national element it serves (D-352) | Kirim praktik baik (contact)                              |
| `/apa-yang-baru`  | Apa yang baru  | Plain Indonesian release notes for teachers and principals, one entry per CalVer release (D-420)                  | Current users                  | Release list (version, date, what users notice)                                                                | Masuk                                                     |

Each list page has an honest empty state until the first entry exists ("Belum ada kabar. Kabar pertama terbit saat Sigrak dibuka untuk sekolah."). Personal data rule for Cerita Sekolah and Praktik Baik: no murid names or faces without the school's and the parent's written permission; Codex illustrations instead of photos by default.

### Company

| Path       | Page title     | Purpose                                                                                               | Audience                           | Main sections                                                                                                                                                             | Main CTA                            |
| ---------- | -------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `/tentang` | Tentang Sigrak | Who makes Sigrak and why; vision, values, policy stance "Berpijak pada kebijakan, leluasa berinovasi" | Principals, partners, press        | Why Sigrak exists · vision and the values Cekatan, Jelas, Bisa diandalkan, Membumi, Menghormati guru · how we work with the rules · company identity ([Nama PT], address) | Hubungi kami                        |
| `/mitra`   | Mitra          | Partner programme for KKG, KKM and resellers (D-342)                                                  | Teacher communities, resellers     | Who can be a partner · what a partner gets (referral code, partner report) · how to apply; terms and rewards marked "Segera diumumkan" until designed                     | Ajukan kemitraan (WhatsApp or form) |
| `/karier`  | Karier         | Open roles at Tim Sigrak                                                                              | Job seekers                        | Open roles or an honest empty state · how to apply                                                                                                                        | Kirim lamaran (email)               |
| `/kontak`  | Kontak         | Every way to reach Tim Sigrak                                                                         | Everyone                           | WhatsApp, email, service hours with time zone, address · contact form with Turnstile and rate limits · link to status page                                                | Hubungi lewat WhatsApp              |
| `/bantuan` | Bantuan        | Entry to help for people who are not signed in                                                        | Users who cannot sign in, visitors | Cannot sign in (lupa kata sandi link on `app.`) · Panduan per role · status page · contact                                                                                | Buka Panduan                        |

### Trust

| Path                           | Page title     | Purpose                                    | Audience                               | Main sections                                                                                                                                                                       | Main CTA                   |
| ------------------------------ | -------------- | ------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `/keamanan`                    | Keamanan       | Plain description of how data is protected | Principals, operators, dinas, pengawas | Where data lives (Indonesia) · access per role · backups and recovery · sign-in protection · how to report a security problem (contact, placeholder `security.txt`)                 | Baca perjanjian data murid |
| `/kebijakan-ai`                | Kebijakan AI   | How AI is used and where its limits are    | Teachers, principals, parents          | Teachers' own Kunci AI (Gemini) · what is sent and what never is · murid never use AI · the teacher decides · the public chatbot has no AI (D-443) · the in-app assistant for staff | Baca kebijakan privasi     |
| `status.sigrak.com` (external) | Status layanan | Better Stack status page (D-426)           | Everyone                               | Linked from footer, `/bantuan`, `/kontak`, `/keamanan`                                                                                                                              | —                          |

### Legal (edited in the admin panel; version + "Berlaku sejak", D-435)

| Path                       | Page title              | Purpose                                                                                           | Audience                              | Main sections                                                              | Main CTA                                 |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| `/syarat-penggunaan`       | Syarat Penggunaan       | Terms of use for accounts and visitors                                                            | All users                             | See [`legal/syarat-penggunaan.md`](legal/syarat-penggunaan.md)             | —                                        |
| `/kebijakan-privasi`       | Kebijakan Privasi       | Personal data Sigrak handles as controller (visitors, accounts, payments)                         | Everyone                              | See [`legal/kebijakan-privasi.md`](legal/kebijakan-privasi.md)             | —                                        |
| `/perlindungan-data-murid` | Perlindungan Data Murid | Data-processing agreement between each school (controller) and [Nama PT] (processor) under UU PDP | Principals, operators, dinas, parents | See [`legal/perlindungan-data-murid.md`](legal/perlindungan-data-murid.md) | Unduh PDF (Typst, Indonesian, A4 and F4) |

Legal page behaviour: each version is stored; the page shows "Versi", "Berlaku sejak" and a link "Lihat versi sebelumnya"; a new version shows a short "Apa yang berubah" list at the top; accounts are asked to read changes on their next sign-in when the change affects them. Before the lawyer's review the pages are not published (D-435, D-444).

### Utility (not in the menu)

| Path                                                       | Purpose                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 404 page                                                   | "Halaman ini tidak ada." Links: Beranda, Fitur, Bantuan; search not needed   |
| 500 page                                                   | "Ada gangguan di sisi kami." Link to `status.sigrak.com` and Kontak          |
| Maintenance page                                           | "Sedang ada perbaikan. Coba lagi pukul [jam] WIB." (Fondasi web-baseline §7) |
| `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt` | Indexing and security contact                                                |

## Navigation (mega menu)

Desktop: a top bar, left to right: wordmark "sigrak" (link to `/`), four menu items, then "Masuk" (text button) and "Coba 7 hari" (primary button). The menus open on click and on keyboard focus, not on hover alone. Phone (360 px): wordmark, "Coba 7 hari", and a "Menu" button that opens a full-height sheet with the same groups as accordions; "Masuk" sits at the top of the sheet.

| Menu           | Column          | Items (label → path), one short line under each                                                                               |
| -------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Produk**     | Untuk siapa     | Guru → `/untuk-guru` · Kepala sekolah → `/untuk-kepala-sekolah` · Operator → `/untuk-operator` · Pengawas → `/untuk-pengawas` |
|                | Jenjang         | SD → `/sd` · Madrasah (MI) → `/madrasah`                                                                                      |
|                | Lihat semua     | Semua fitur → `/fitur` · panel with one Codex visual and the line "Satu hari mengajar dengan Sigrak" linking to `/#satu-hari` |
| **Harga**      | —               | Direct link to `/harga` (no dropdown)                                                                                         |
| **Sumber**     | Baca            | Kabar → `/kabar` · Cerita Sekolah → `/cerita-sekolah` · Praktik Baik → `/praktik-baik`                                        |
|                | Ikuti           | Acara → `/acara` · Apa yang baru → `/apa-yang-baru`                                                                           |
|                | Belajar memakai | Panduan → guides (location open, README Q6)                                                                                   |
| **Perusahaan** | Tentang kami    | Tentang Sigrak → `/tentang` · Mitra → `/mitra` · Karier → `/karier`                                                           |
|                | Butuh bantuan   | Bantuan → `/bantuan` · Kontak → `/kontak` · Status layanan → `status.sigrak.com`                                              |

Menu item lines (Indonesian, one each), for example: Guru — "Siapkan RPM, soal, dan LKPD, lalu isi kehadiran dari ponsel." Kepala sekolah — "Lihat kelengkapan guru tanpa mengumpulkan berkas." Operator — "Siapkan tahun ajaran, kelas, jadwal, dan undangan guru." Pengawas — "Pantau sekolah binaan dan susun laporan kepengawasan." SD — "Struktur kurikulum SD dan enam mapel agama." Madrasah — "Mapel Kemenag dan Kurikulum Berbasis Cinta."

## Footer

Four link columns, then a bottom row. On phones the columns stack; no accordion needed.

| Column      | Links                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Produk      | Fitur · Untuk guru · Untuk kepala sekolah · Untuk operator · Untuk pengawas · SD · Madrasah · Harga        |
| Sumber      | Kabar · Acara · Cerita Sekolah · Praktik Baik · Apa yang baru · Panduan                                    |
| Perusahaan  | Tentang · Mitra · Karier · Kontak · Bantuan                                                                |
| Kepercayaan | Keamanan · Kebijakan AI · Status layanan · Syarat Penggunaan · Kebijakan Privasi · Perlindungan Data Murid |

Bottom row: wordmark, tagline "Kerja guru, lebih sigrak.", "© [tahun] [Nama PT]", app version (CalVer, D-420), WhatsApp and email ([Nomor WhatsApp], [Email]), and the visitor counter if the owner keeps it on (README Q8). No social icons until accounts exist.
