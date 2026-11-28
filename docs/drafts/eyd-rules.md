# EYD V Rules for SIGRAK

- **Status:** draft (D-471); checks in `tests/unit/eyd.spec.ts`
- **Task:** R1-14
- **Last updated:** 2026-11-28
- **Applies to:** all Indonesian text SIGRAK produces: UI copy in `resources/lang/id`, exports and import templates, generated PDFs and documents, the fixed text in AI templates, the public site, and the Indonesian guides in `docs/server/`. It does not apply to `docs/sources/`, which is never corrected.

## 1. Purpose and source

SIGRAK writes Indonesian by *Ejaan Bahasa Indonesia yang Disempurnakan* Edisi Kelima (EYD V). This page sums up the rules that come up in a school admin app, groups them by where they are used, and lists the house choices EYD leaves open. It is a working summary, not a copy of EYD: when a case is not here, read the source page.

**Source.** The working reference is the community web edition at <https://eyd.netlify.app/> (author: Gigip Andreas). The site says: "Hak cipta EYD dimiliki oleh Badan Pengembangan dan Pembinaan Bahasa Republik Indonesia. Seluruh konten dalam situs web ini dilisensikan di bawah CC BY-SA 4.0". The Indonesian examples quoted below come from that site and stay under **CC BY-SA 4.0**, with attribution to Badan Pengembangan dan Pembinaan Bahasa (the owner of EYD) and to the site. Quotes are kept short. If the site and Badan Bahasa's official publication differ, the official text wins (D-471).

**Word spelling.** EYD sets the rules. The standard (*baku*) form of a single word comes from KBBI (<https://kbbi.kemdikbud.go.id/>). The community edition's loanword pages list letter rules only, not suffix rules such as *-ty* → *-tas*, so words like *kualitas* and *analisis* are marked "KBBI" below.

Page URLs below are relative to `https://eyd.netlify.app`. For example, `/penulisan-kata/kata-depan` is <https://eyd.netlify.app/penulisan-kata/kata-depan>.

## 2. House choices (EYD leaves these open, or SIGRAK picks one form)

| Topic | SIGRAK form | EYD basis |
|---|---|---|
| Money in the UI | `Rp1.234.567`: no space, no period after Rp, no decimals; negative `-Rp5.000` (D-469) | Rp takes no period (`/penulisan-kata/singkatan`). EYD's own examples always show cents (`Rp5.000,00`), so leaving them out in the UI is a house choice |
| Money in formal documents and receipts | `Rp1.234.567,00` followed by the amount in words: `Rp1.234.567,00 (satu juta dua ratus tiga puluh empat ribu lima ratus enam puluh tujuh rupiah)` (D-471) | `/penulisan-kata/angka-dan-bilangan` (*kuitansi*, *akta*: numerals followed by words); `/penggunaan-tanda-baca/tanda-koma` (comma between rupiah and sen) |
| Times | `14.30`, with `WIB` where it matters: `pukul 14.30 WIB` (D-469, D-471) | Dot: `/penggunaan-tanda-baca/tanda-titik`. EYD also allows the colon (`/penggunaan-tanda-baca/tanda-titik-dua`, "dapat digunakan"); SIGRAK uses only the dot |
| Short dates in tables and forms | `25/11/2026` (`formatShortDate`, R1-02) | EYD writes numeric dates with a hyphen (`11-11-2022`, `/penggunaan-tanda-baca/tanda-hubung`). The slash is a house choice for tables and import files. Prose and documents use the long form `25 November 2026` |
| Date and number ranges | UI: `{start} sampai {end}`. Documents: an em dash with no spaces (`5—10 April 2026`, `Senin—Jumat`, `2025—2026`), or `s.d.` in tables | `/penggunaan-tanda-baca/tanda-pisah` (em dash for "sampai dengan"); `s.d.` from `/penulisan-kata/singkatan` 4b. The site writes page ranges with an en dash (`98–105`, on the colon page) but date ranges with an em dash. Check against the official text before the export templates are fixed |
| Ellipsis | The single character `…` with no space before it in status text: `Memuat…` (translation tests) | EYD writes three dots with spaces (`/penggunaan-tanda-baca/tanda-elipsis`). The single character is a typographic house choice |
| Numbers in UI copy | Numerals for limits, lengths, durations and format rules (`minimal 8 karakter`, `berlaku 7 hari`, `8 angka`). Words for a one-word count in running text (`Masih ada dua pembuatan`) | `/penulisan-kata/angka-dan-bilangan`: numbers that fit in one word are written as words, except in a series of numbers; measures and values (including time) use numerals |
| Capitals in headings | UI headings, buttons and labels use sentence case (design system, UI writing rule 2). Titles of generated documents (PDF title pages, report titles) capitalise every word except function words | `/penggunaan-huruf/huruf-kapital` (titles of books, articles and documents) |
| Product and feature names | `SIGRAK` in capitals (D-469); fixed feature names keep their capitals: `Hari Ini`, `Dokumen Saya`, `Kunci AI`, `Simulasi TKA` | Proper names take capitals (`/penggunaan-huruf/huruf-kapital`) |

## 3. UI labels, buttons and titles

- **No period after a label, button, heading or title.** "Tanda titik tidak digunakan pada akhir judul dan subjudul" (`/penggunaan-tanda-baca/tanda-titik`). A final abbreviation keeps its own period: `No.`. A title may end with `?` when it asks something (`Keluar dari SIGRAK?`).
- **Sentence case.** Capital only for the first word and proper names: `Simpan data diri`, `Undang guru`, `Kepala sekolah` (`/penggunaan-huruf/huruf-kapital`, design system rule 2). No ALL CAPS, except abbreviations (`NPSN`, `PDF`).
- **Role and position names** start with a small letter in running text when they name a role in general (`operator sekolah`, `kepala sekolah`). They take capitals when followed by a person's name, or when they stand for a specific office or person (`Kepala SD Negeri 1 Sleman`, `Kepala Sekolah,` above a signature) (`/penggunaan-huruf/huruf-kapital`, *nama jabatan*).
- **Field labels with a value** use a colon with no space before it: `Sesi: {title}`, `NPSN: 20317288` (`/penggunaan-tanda-baca/tanda-titik-dua`, *pemerian*). The aligned `Ketua : Ahmad` layout on the site is a typed table layout. SIGRAK aligns with layout, not with spaces.
- **Slash for "or" and "and"** in compact labels: `Desa/kelurahan`, `Kabupaten/kota`, `orang tua/wali`, `Nomor HP/WA` (`/penggunaan-tanda-baca/tanda-garis-miring`).
- **Parentheses** add an abbreviation or a short note: `A4 (210 × 297 mm)`, `Simulasi TKA (tes kemampuan akademik)` (`/penggunaan-tanda-baca/tanda-kurung`).
- **Foreign words.** EYD prints foreign words in italics (`/penggunaan-huruf/huruf-miring`). UI strings cannot carry italics, so the UI uses the Indonesian word where one exists (*unduh*, *kata sandi*, *tautan*, *templat*, *proyek*), following the design system's term list.

## 4. Sentences and messages

- **End punctuation.** A statement ends with a period, a question with `?` (`/penggunaan-tanda-baca/tanda-tanya`), and a command or strong feeling may end with `!` (`/penggunaan-tanda-baca/tanda-seru`). SIGRAK keeps `!` rare and never stacks it (design system rule 7).
- **No space before `. , ; : ? !`; one space after `, ; :`** (all punctuation pages).
- **Comma in a list of three or more, including before *dan*/*atau*:** "Buku, majalah, dan jurnal termasuk sumber kepustakaan." (`/penggunaan-tanda-baca/tanda-koma`).
- **Comma before *tetapi*, *melainkan*, *sedangkan*:** `Undangan ini untuk {email}, tetapi Anda sedang masuk dengan akun lain.` (`/penggunaan-tanda-baca/tanda-koma`).
- **A subordinate clause first takes a comma; main clause first takes none:** "Kalau diundang, saya akan datang." / "Saya akan datang kalau diundang." (`/penggunaan-tanda-baca/tanda-koma`).
- **Comma after a connector that opens a sentence:** `Oleh karena itu,`, `Jadi,`, `Meskipun demikian,` (`/penggunaan-tanda-baca/tanda-koma`).
- **Comma around a form of address and after an interjection:** `Terima kasih, Bu.`, `Halo, {name}.` (`/penggunaan-tanda-baca/tanda-koma`).
- **Colon before a list only after a complete statement.** "Mereka memerlukan perabot rumah tangga: kursi, meja, dan lemari." No colon when the list completes the sentence: "Kita memerlukan kursi, meja, dan lemari." (`/penggunaan-tanda-baca/tanda-titik-dua`).
- **Semicolon** separates list items that are verb phrases, or items that already contain commas. The last item takes `; dan` or `; serta` (`/penggunaan-tanda-baca/tanda-titik-koma`).
- **Numbered lists.** A period after a list number (`1.`, `A.`). No period after the last number of a multi-level heading number (`2.1 Bahasa`), and none after a marker in parentheses (`a)`, `(1)`) (`/penggunaan-tanda-baca/tanda-titik`).
- **A sentence never starts with a numeral.** Rewrite it, or put *sebanyak*, *sejumlah* or *sebesar* first: `Sebanyak 25 murid belum dinilai.` (`/penulisan-kata/angka-dan-bilangan`).
- **Quotation marks** enclose direct speech, titles of articles, chapters and songs, and terms with a special meaning. Single quotes give a meaning: `kokurikuler 'kegiatan penguat kurikulum'` (`/penggunaan-tanda-baca/tanda-petik`, `/penggunaan-tanda-baca/tanda-petik-tunggal`).
- **The em dash** sets off an aside: `Kemerdekaan bangsa itu—saya yakin akan tercapai—…` (`/penggunaan-tanda-baca/tanda-pisah`). UI copy prefers two short sentences.
- **No apostrophe shortenings** (`'kan`, `s'lalu`). EYD calls them non-standard usage (`/penggunaan-tanda-baca/tanda-apostrof`).

### Word forms in sentences

- **Kata depan *di*, *ke*, *dari* stand apart:** `di mana`, `ke mana`, `di sini`, `di sana`, `di atas`, `di luar`, `ke luar kota` (`/penulisan-kata/kata-depan`). The verb prefix *di-* is joined: `disimpan`, `dikirim`, `dimasukkan` (`/penulisan-kata/kata-turunan`). *Keluar* (to exit) and *kemari* are single words in KBBI.
- **Particles.** *-lah*, *-kah* and *-tah* are joined (`Bacalah`, `Apakah`). *Pun* stands apart (`apa pun`, `siapa pun`, `satu pun`, `mana pun`) except in the conjunctions EYD lists: *adapun, andaipun, ataupun, bagaimanapun, biarpun, jikapun, kalaupun, kendatipun, maupun, meskipun, sekalipun, sementangpun, sungguhpun, walaupun*. *Per* meaning "each" or "from" stands apart: `Rp50.000,00 per meter`, `per 1 Januari` (`/penulisan-kata/partikel`).
- **Pronoun clitics.** *ku-* and *kau-* are joined to the following word; *-ku*, *-mu* and *-nya* to the preceding one (`rumahnya`) (`/penulisan-kata/kata-ganti`). SIGRAK addresses the user as *Anda*, never with *-mu* (design system rule 8).
- ***si* and *sang* stand apart:** `si pengirim` (`/penulisan-kata/kata-sandang`).
- **Bound forms are joined:** `antarsekolah`, `antarkelas`, `nonaktif`, `pascaujian`, `praujian`, `subbagian`, `ekstrakurikuler`, `kokurikuler`, `multiguru`. Before a capital or an abbreviation, add a hyphen: `non-ASN`, `pra-TKA`, `se-Indonesia` (`/penulisan-kata/kata-turunan`, `/penggunaan-tanda-baca/tanda-hubung`).
- **Compound words are written apart:** `orang tua`, `wali kelas`, `kepala sekolah`, `tanda tangan`, `kata sandi`, `tahun ajaran`, `mata pelajaran`, `rumah sakit`. EYD lists the compounds that are joined, among them `olahraga`, `kosakata`, `beasiswa`, `karyawisata`, `perilaku`, `sukarela`, `daripada`, `bagaimana`, `barangkali`, `apalagi` (`/penulisan-kata/kata-turunan`, *Gabungan Kata*).
- **A compound with a prefix and a suffix together is joined; with only one of them it stays apart:** `ditandatangani`, `menindaklanjuti`, `pertanggungjawaban`; but `bertanda tangan`, `tindak lanjuti`, `garis bawahi` (`/penulisan-kata/kata-turunan`).
- **Reduplication is written in full with a hyphen, never with "2":** `murid-murid`, `hati-hati`, `berulang-ulang`. Compounds repeat only the first part: `rak-rak buku` (`/penulisan-kata/kata-turunan`, *Bentuk Ulang*).
- **Hyphen between a number and a suffix or affix:** `ke-2`, `tahun 2000-an`, `5.000-an`. No hyphen when the number counts letters: `P3K` (`/penggunaan-tanda-baca/tanda-hubung`, `/penulisan-kata/angka-dan-bilangan`).

## 5. Capitals: Anda, Bapak/Ibu and names

- ***Anda* always starts with a capital:** "Kata *Anda* ditulis dengan huruf awal kapital." (`/penggunaan-huruf/huruf-kapital`, note a). This applies mid-sentence too: `Dokumen Anda tetap ada.`
- ***Bapak*, *Ibu*, *Saudara* used to address or refer to the reader** start with a capital: `Bapak/Ibu dapat mengunduh rapor.`, "Surat *Saudara* telah kami terima" (`/penggunaan-huruf/huruf-kapital`). The design system allows *Bapak/Ibu* only in the principal's broadcasts; elsewhere SIGRAK writes *Anda*.
- **The same words as kinship terms, with a possessive or in a general sense, take a small letter:** "Kita harus menghormati *bapak* dan *ibu* kita." (note c). So `orang tua murid`, `ibu dari murid`.
- **Days, months and holidays** take capitals: `Senin`, `November`, `hari Natal`, `Hari Pendidikan Nasional`. *hari*, *bulan* and *tahun* stay small unless part of a name (`/penggunaan-huruf/huruf-kapital`).
- **Place names** take capitals: `Kabupaten Sleman`, `Kecamatan Depok`, `Desa Sentul`, `Jalan Kaliurang`. A geographic word without a name stays small: `kabupaten`, `kecamatan` (`/penggunaan-huruf/huruf-kapital`).
- **Institutions, organisations and official documents** capitalise every word except function words: `Kementerian Pendidikan Dasar dan Menengah`, `Peraturan Menteri … Nomor 13 Tahun 2025 tentang …` (`/penggunaan-huruf/huruf-kapital`).
- **Religions, scriptures and God** take capitals: `Islam`, `Kristen`, `Katolik`, `Hindu`, `Buddha`, `Konghucu`, `Al-Qur'an`, `Alkitab`, `Tuhan Yang Maha Esa` (`/penggunaan-huruf/huruf-kapital`, `/penulisan-kata/kata-turunan`). EYD writes *Konghucu*. Where the curriculum data writes *Khonghucu* (the official subject name), keep the official subject name.
- **Languages and peoples.** `bahasa Indonesia`, `bahasa Jawa`, `suku Dani`: the language name takes a capital, *bahasa* does not (`/penggunaan-huruf/huruf-kapital`). When *Bahasa Indonesia* is the official name of a subject, it is a proper name and is capitalised in full.
- **Academic degrees after a name** take a comma: `Siti Aminah, S.Pd.`, `Budi, S.Pd., M.Pd.` (`/penggunaan-tanda-baca/tanda-koma`).

## 6. Numbers, money, dates and times

- **Thousands with a dot, decimals with a comma:** `1.234.567`, `12,5` (`/penggunaan-tanda-baca/tanda-titik`, `/penggunaan-tanda-baca/tanda-koma`).
- **No thousands dot in numbers that are not quantities:** years (`2026`), `NIP 199701112015041002`, NPSN, NISN, account and phone numbers (`/penggunaan-tanda-baca/tanda-titik`).
- **Money:** see §2. `Rp` takes no period and no space (`/penulisan-kata/singkatan`). Large round amounts may use words: `90 juta rupiah` (`/penulisan-kata/angka-dan-bilangan`).
- **Percent:** `5%`, with no space, or `5 persen` (`/penulisan-kata/angka-dan-bilangan`).
- **Measures and durations use numerals:** `2 JP`, `35 menit`, `1 jam 20 menit`, `7 hari` (`/penulisan-kata/angka-dan-bilangan`).
- **Ordinals:** `kelas 5` or `kelas V`, `ke-2`, `kedua`. Roman numerals or `ke-` with Arabic numerals both follow EYD (`/penulisan-kata/angka-dan-bilangan`). Pick one form per document.
- **Amounts in words** in receipts, statements and formal letters follow the numerals in parentheses. Whole numbers are written out (`dua belas`, `lima puluh lima ribu`); fractions use *per* (`tiga perempat`) (`/penulisan-kata/angka-dan-bilangan`).
- **Times:** `pukul 07.00 WIB`, `14.30`; durations `01.35.20 jam` (`/penggunaan-tanda-baca/tanda-titik`). Time zones are capital abbreviations: `WIB`, `WITA`, `WIT`. EYD's acronym example writes *Wita* as a name-acronym (`/penulisan-kata/singkatan`); SIGRAK writes all three in capitals for consistency.
- **Dates:** `25 November 2026`. Place and date are joined by a comma: `Sleman, 25 November 2026`. No period after the date line of a letter (`/penggunaan-tanda-baca/tanda-koma`, `/penggunaan-tanda-baca/tanda-titik`).
- **Ranges:** see §2.
- **Letter numbers** use slashes: `Nomor: 421.2/015/SD/XI/2026` (`/penggunaan-tanda-baca/tanda-garis-miring`).

## 7. Abbreviations used in schools

EYD rules (`/penulisan-kata/singkatan`):

- **Initials of each word: capitals, no periods.** EYD's own list has `SD`, `NIP`, `PAUD`, `MAN` and `KTP`. The same rule covers SIGRAK's school abbreviations: `MI`, `MTs` (the official form keeps the small *s*), `NISN`, `NPSN`, `NUPTK`, `NIK`, `ASN`, `PNS`, `KKTP` (kriteria ketercapaian tujuan pembelajaran), `JP` (jam pelajaran), `TP` (tujuan pembelajaran), `CP` (capaian pembelajaran), `ATP`, `RPM`, `LKPD`, `KSP`, `TKA`, `STS`, `SAS`, `PAI`, `PJOK`, `IPAS`, `UKS`, `KBM`, `WIB`.
- **Acronyms of names made of syllables: first letter capital only:** `Kemendikdasmen`, `Kemenag`, `Dapodik`, `Bappenas`. **Acronyms that are not names: all small:** `pemilu`, `puskesmas`, `iptek`.
- **Document abbreviations of three or more letters end with a period:** `dll.`, `dsb.`, `dst.`, `dkk.`, `hlm.`, `yth.` (`Yth.` at the start of an address), `ttd.`, `ybs.`. **Two-letter ones take a period after each letter:** `a.n.`, `s.d.`, `u.p.`, `d.a.`. `s/d` is wrong.
- **Address abbreviations:** `Jl.`, `Gg.`, `No.`, `Kav.`, `Km.`, `Lt.`.
- **Units, chemical symbols and currency take no period:** `km`, `kg`, `cm`, `Rp`.
- **Titles and degrees:** a period after each part: `S.Pd.`, `M.Pd.`, `S.Pd.I.`, `Dr.`, `dr.`, `Prof.`, `Sdr.`, `H.`, `Hj.`. Inside the sentence, a level code from the profile (`D-3`, `S-1`) takes a hyphen (`/penggunaan-tanda-baca/tanda-hubung`).
- **Abbreviations are not split at a line end** (`/penulisan-kata/pemenggalan-kata`).
- **The first time a document uses an abbreviation, write the term in full** with the abbreviation in parentheses: `Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)` (`/penggunaan-tanda-baca/tanda-kurung`).

## 8. Words often misspelled in school administration

Standard forms from KBBI unless a page is named. The automatic check rejects the non-standard form in the left column, along with the rest of its list (`MISSPELLINGS` in `tests/unit/eyd.spec.ts`).

| Non-standard | Standard | Source |
|---|---|---|
| dimana, kemana, disini, disana, diatas, dirumah, disekolah | di mana, ke mana, di sini, di sana, di atas, di rumah, di sekolah | `/penulisan-kata/kata-depan` |
| silahkan | silakan | KBBI |
| praktek | praktik | KBBI |
| analisa | analisis | KBBI |
| kwalitas | kualitas | KBBI |
| nasehat | nasihat | KBBI; `/penulisan-kata/kata-sandang` example writes *nasihat* |
| apotik | apotek | KBBI |
| sistim | sistem | KBBI |
| jadual | jadwal | KBBI; `/penulisan-unsur-serapan/serapan-umum` (*jadwal*, Arabic *wau* → *w*) |
| ijin, mengijinkan | izin, mengizinkan | KBBI |
| resiko | risiko | KBBI; `/penggunaan-huruf/huruf-kapital` example writes *risiko* |
| standarisasi | standardisasi | KBBI |
| ekstra kurikuler, ekstrakulikuler | ekstrakurikuler | `/penulisan-kata/kata-turunan` (*ekstrakurikuler*) |
| ko-kurikuler, ko kurikuler | kokurikuler | `/penulisan-kata/kata-turunan` (bound form *ko-*, as *kosponsor*) |
| walikelas | wali kelas | `/penulisan-kata/kata-turunan` (compounds apart, as *wali kota*) |
| orangtua | orang tua | `/penulisan-kata/kata-turunan` (*orang tua* is EYD's own example) |
| terimakasih | terima kasih | KBBI |
| aktifitas, efektifitas, kreatifitas | aktivitas, efektivitas, kreativitas | KBBI |
| obyek, subyek | objek, subjek | KBBI |
| propinsi | provinsi | KBBI |
| tehnik, tehnologi | teknik, teknologi | KBBI |
| merubah, dirubah | mengubah, diubah | KBBI |
| ketrampilan | keterampilan | KBBI |
| himbauan | imbauan | KBBI |
| nomer | nomor | KBBI |
| antri, antrian | antre, antrean | KBBI |
| sekedar | sekadar | KBBI |
| ijasah | ijazah | KBBI |
| kadaluarsa | kedaluwarsa | KBBI |
| rapot, raport | rapor | KBBI |
| mempengaruhi | memengaruhi | KBBI |
| mengkoordinir, kordinasi | mengoordinasi, koordinasi | KBBI |
| apapun, siapapun, manapun, satupun | apa pun, siapa pun, mana pun, satu pun | `/penulisan-kata/partikel` |
| walau pun, meski pun, mau pun | walaupun, meskipun, maupun | `/penulisan-kata/partikel` |
| Pebruari, Nopember, Jum'at | Februari, November, Jumat | KBBI |
| sholat, Ramadhan, ustadz | salat, Ramadan, ustaz | KBBI; `/penggunaan-tanda-baca/tanda-petik` example writes *Ramadan* |
| tanda-tangan | tanda tangan | `/penulisan-kata/kata-turunan` |

Loanword spelling in general (`/penulisan-unsur-serapan/serapan-umum`, `/penulisan-unsur-serapan/serapan-khusus`): *c* before *a, o, u* becomes *k* (*konstruksi*); *c* before *e, i, y* becomes *s* (*sentral*); *x* inside a word becomes *ks* (*taksi*); *ph* becomes *f*; *ck* becomes *k* (*cek*); *q* becomes *k* (*kuota*); double consonants become single (*komisi*, *efek*). Established loanwords that break these rules keep their form (*proyek*, *populer*, *sehat*, *paham*, *napas*, *pikir*, *Senin*, *Selasa*, *Rabu*, *Kamis*).

## 9. Line breaks in generated documents

For Typst exports (D-450), from `/penulisan-kata/pemenggalan-kata`:

- Break between syllables: between two vowels (*sa-at*), before a single consonant (*ba-pak*), and between two consonants (*ban-tu*). Never inside the digraphs *kh, ng, ny, sy* or the diphthongs *ai, au, ei, oi*.
- Break affixed words between the base and the affix (*ber-jalan*, *makan-an*).
- Never leave one letter alone at the start or end of a line (*i-tu* is wrong).
- Break a person's name between its words. Never break an abbreviation.
- Set Indonesian hyphenation in the template (`text(lang: "id")`) and check samples by eye. The pattern tests do not cover PDFs.

## 10. What the automatic checks cover, and what stays manual

`tests/unit/eyd.spec.ts` runs over every value in `resources/lang/id/*.json`, with `{placeholders}` blanked. Every check has a self-test: each bad sample must be flagged and each good sample must pass.

| Check | Catches | Allows |
|---|---|---|
| standard spelling | the non-standard forms in §8 (`silahkan`, `praktek`, `resiko`, `orangtua`, `ijin`, `standarisasi`, …) and chat shorthand (`yg`, `utk`, `dgn`, `tdk`) | the standard forms |
| kata depan di/ke | *di/ke* joined to a place or direction word (`dimana`, `kemana`, `disini`, `disana`, `dirumah`, `diatas`, `diluar`, …); passive *di-* written apart from a common verb (`di simpan`, `di kirim`) | real verbs (`dimasukkan`, `disimpan`), `keluar`, `kemari`, `kemarin`, `kebagian` |
| money | `Rp 1.000`, `Rp.1.000`, `Rp. 1.000`, `RP1.000`, `Rp {amount}` | `Rp1.234.567`, `Rp1.234.567,00`, `-Rp5.000` |
| times | `14:30` (house choice: dot); `wib`/`Wib` | `14.30 WIB`, ratios such as `1:10.000` |
| reduplication | `anak2`, `Hati2` | `A4`, `S1`, `kelas 2` |
| Anda | lowercase `anda` as a word | `Anda`, `ayahanda` |
| pun | joined *pun* outside EYD's conjunction list (`apapun`, `siapapun`, `satupun`); a listed conjunction written apart (`walau pun`, `mau pun`) | `apa pun`, `walaupun`, `maupun`, `sekalipun` and `sekali pun`, `rumpun` |
| label period | a period at the end of a label, button, title or heading | final abbreviations (`No.`, `dll.`), `?`, `…` |
| punctuation spacing | a space before `. , ; : ? !`; no space after `, ; :` before a word | decimal commas (`1,5`), URLs |
| abbreviations | `dll`, `dsb`, `dst`, `dkk`, `hlm`, `yth` without a period; `s/d`, `sd.` | `dll.`, `s.d.`, `sampai` |

The label check finds labels by key name. A key is a label when its last part is or ends with `title`, `label`, `heading`, `button`, `action`, `submit`, `caption`, `legend` or `placeholder` (`invite_title`, `search_label`), or when it sits inside a group of labels: `actions`, `fields`, `labels`, `titles`, `nav`, `kinds`, `levels`, `modes`, `outcomes`, `roles`, `scenarios`, `semesters`, `sources`, `statuses`, `status`, `step_status`, `steps`, `summary`, `views`, `month_nav`, `exam_types`, `invitation_states`, `paper_sizes`. Keys ending in `hint`, `intro`, `body`, `description`, `note` or `help` hold sentences and are never treated as labels. New groups of labels should use one of these names, or be added to the list.

The existing translation tests already check: no `...` (use `…`), no stacked `!`/`?`, no `&`, no double spaces, no emoji, banned words and old terms (`tests/unit/translations.spec.ts`).

**Manual review** (pattern checks cannot judge these):

- Capitals that depend on meaning: role and position names (generic or specific), *Bapak/Ibu* as address or as kinship, subject names, and geographic words with or without a name.
- Comma use that depends on clause order, apposition and connectors. Colon before lists. Semicolons in lists.
- Numbers as words or numerals (§2 house reading). Sentences that start with a numeral.
- Compounds and bound forms outside the lists (`antarsekolah`, `non-ASN`, `ditindaklanjuti`), and affix + compound forms.
- Foreign words and loanword spelling outside the misspelling list. Whether to use an Indonesian word in place of a foreign one (the design system term list decides).
- Text outside `resources/lang/id`: exports and import templates, Typst documents (including amounts in words, date ranges and line breaks), AI template text, the public site, and the guides in `docs/server/`. Until those have their own tests, review them against this page.
- Words the misspelling list does not know. Extend `MISSPELLINGS` whenever a review finds a new one.

**Not read on the site:** the "Contoh Penggunaan Tanda Titik dalam Bagan" example on `/penggunaan-tanda-baca/tanda-titik` is an image and was not read. Every other page listed in the site's table of contents was read in full on 2026-11-28.

## 11. Open questions

- **Email and file.** KBBI's standard forms are *surel* and *berkas*/*fail*. The design system uses *Email* and *File* as UI terms. Should they stay, as plain words teachers use, or change?
- **Short date format.** EYD writes numeric dates with hyphens (`25-11-2026`). SIGRAK uses `25/11/2026` in the UI and import files (R1-02). Keep the slash as a house choice?
- **Ranges in documents.** Em dash (`5—10 April`, as on the site's dash page), en dash (`98–105`, as on its colon page), or `s.d.`? Check against Badan Bahasa's official PDF before the export templates are fixed.
- **Capitals in `Semester 1 (Ganjil)` and in nav names** (`Hari Ini`, `Pengaturan Sekolah`): are they names (capitals), or should they follow sentence case (`Semester 1 (ganjil)`, `Pengaturan sekolah`)? Left unchanged until the owner decides.
