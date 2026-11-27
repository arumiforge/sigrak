# Typst spike (R0-07): report

**Status:** draft for the owner · **Date:** 2026-11-27 · **Decides:** D-399 · **Task:** [`R0-07`](../agent/tasks/R0-07-spike-typst-pdf.md) · **Code and PDFs:** [`spikes/typst/`](../../spikes/typst/README.md)

## Recommendation

**Typst passes.** Make Typst the PDF engine as D-399 proposes: the CLI on the `worker-exports` process for downloads, the WASM compiler in the browser for previews, Gotenberg only as the fallback. Typst rendered every SIGRAK requirement the spike tested correctly, including Arabic shaping and harakat for MI and A4 and F4. It is fast on the server, and the browser compiler renders the same PDF pixel for pixel. Three conditions come with the recommendation (details under [Gaps](#gaps-and-risks)):

1. **Pin the fonts in the image and the app.** The CLI and the browser must load the same font files at fixed versions, never the distribution's fonts. Debian/Ubuntu's Noto Naskh Arabic (2.004) breaks the Qur'anic end-of-ayah sign; the current release (2.021) is correct.
2. **Keep math as LaTeX (KaTeX on screen) and convert at render time** with `tex2typst` plus SIGRAK's small fixes (19 of 20 sample formulas correct). Column arithmetic (_bersusun_) becomes a SIGRAK block, not a LaTeX array.
3. **Load the browser compiler only where a preview is needed, and cache it.** It is an 8.3 MB download (brotli). After that, renders on an emulated low-end phone are well under a second.

One gap does not block printing but must be known: **Arabic text in Typst PDFs cannot be copied or searched correctly** (the text layer is scrambled; the print is correct). If a searchable Arabic PDF is ever required, that document goes through the Gotenberg fallback.

## What was built

Everything is in `spikes/typst/` and rebuilds with the steps in its README.

| Sample            | File                                 | Content                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPM, A4           | `pdf/rpm-a4.pdf`                     | MI Matematika kelas 4, pecahan senilai (TP03 of `SIGRAK-SD-2026-R1-MTK-K4-02`), 2 meetings, KBC fields with a Qur'anic phrase, rubric, evaluation items with math, signers; 4 pages                                              |
| RPM, F4           | `pdf/rpm-f4.pdf`                     | Same content on 215 × 330 mm; 3 pages                                                                                                                                                                                            |
| RPM, A4, Times    | `pdf/rpm-a4-times.pdf`               | Same with the serif font (D-125 "Times New Roman" option)                                                                                                                                                                        |
| LKPD, A4 and F4   | `pdf/lkpd-a4.pdf`, `pdf/lkpd-f4.pdf` | MI Bahasa Arab kelas 1, perkenalan (TP02 of `SIGRAK-MI-2026-R1-BAR-K1-01`), one page: tracing hijaiyah letters, matching lines, a right-to-left dialogue table, short answers, reflection                                        |
| Arabic test sheet | `pdf/arab-a4.pdf`                    | Al-Ikhlas with full harakat, waqf marks and ayah numbers; hard harakat cases; CP sentence patterns from SK Dirjen Pendis 9941/2025; mixed Indonesian/Arabic lines; a justified Arabic paragraph; Noto Naskh Arabic next to Amiri |
| Formula sheet     | `pdf/rumus-a4.pdf`                   | The 20 formulas below, converted three ways, with the verdicts                                                                                                                                                                   |

The templates read content JSON in the shape of the document model (text, `{ "tex": … }` math and `{ "ar": … }` Arabic segments), so every PDF comes from data, never from a screenshot. A preparation step converts LaTeX to Typst before rendering; the same code runs on the server and in the browser. The letterhead is an image (a fictional madrasah, 2409 × 425 px, ratio 5.7:1), placed across the content width on the first page and capped at 4 cm (D-031).

## Fidelity

I rendered every page to PNG and checked it by eye, at 400 dpi for the Arabic.

**Looks right:**

- **Page sizes:** A4 is 210 × 297 mm; F4 is exactly 215 × 330 mm (609.45 × 935.43 pt). The page count adapts (RPM: 4 pages on A4, 3 on F4).
- **Letterhead image** across the content width on the first page only, at 2.9 cm high; the code would shrink a taller image to 4 cm.
- **Running header** from page 2 (short title and school) and a **footer on every page** with "Halaman X dari Y" and the paper size.
- **Tables:** header rows repeat on each new page; no row splits across a page (`table.cell(breakable: false)`, checked where the RPM's meeting table breaks); the last section stays with the signature block, so signers never stand alone.
- **Arabic:** letters join correctly in every position; harakat sit in the right place, including shaddah with kasrah and fathah, tanwin, sukun, small alif (هٰذَا, الرَّحْمٰنِ), hamza forms, lam-alif, alif wasla and tatweel. The Qur'anic end-of-ayah sign with Arabic-Indic digits and the waqf marks (ج, لا) render as in a mushaf with Noto Naskh Arabic 2.021 and with Amiri. Right-to-left blocks, a right-to-left table (speaker column on the right), and Arabic phrases inside Indonesian sentences (bidi) are all ordered correctly. Hollow outline letters for tracing work (`text(stroke: …)`).
- **Math:** fractions, mixed numbers, roots, powers, units, degrees, overlines, the empty box, negative numbers and money print cleanly in New Computer Modern Math, which looks like KaTeX on screen.
- **WASM equals CLI:** the browser compiler's RPM and LKPD PDFs match the CLI's pixel for pixel at 100 dpi.

**Looked wrong at first, fixed in the templates (these become rules for R4):**

| Problem                                                         | Cause                                                                         | Fix                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Ayah numbers drawn over the preceding word                      | Noto Naskh Arabic 2.004 from Ubuntu's `fonts-noto-core`                       | Use the 2.021 release, pinned                                         |
| Math in a sans font with wrong spacing and a missing macron (x̄) | Ubuntu's Noto Sans Math (2020) has no OpenType MATH table, so Typst fell back | New Computer Modern Math, the Typst default, as a font file           |
| Display fractions and harakat ran into table borders            | Line boxes use the font's ascender and descender, not the real glyph height   | `top-edge: "bounds"`, `bottom-edge: "bounds"` for formulas and Arabic |
| Inline fractions too small for SD/MI pupils                     | Text-style fractions                                                          | Inline formulas in display size                                       |
| Long words spread out in narrow cells                           | Justified text inside table cells                                             | No justification in cells                                             |

**Still not ideal (not blocking):**

- Typst justifies Arabic by widening spaces only; it does not stretch with kashida. Justified Arabic paragraphs look acceptable but not like a printed Arabic book. Right-aligned (not justified) Arabic is the better default.
- Money and words written inside math (`\text{Rp}12.500`) print in the math font, so they look different from the sentence around them. The editor should store money as text, not as math.
- Lines that hold a display-size fraction or an Arabic phrase are taller than the lines around them, so paragraph spacing is a little uneven. It reads fine; a template can move long formulas and Arabic quotations to their own line.
- On F4 the one-page LKPD leaves free space at the bottom; a template could grow its writing areas on F4.

## Math: LaTeX to Typst, 20 formulas

SIGRAK stores formulas as LaTeX because KaTeX shows them on screen (content engine, Rendering libraries). Three ways were tested: **tex2typst** (JavaScript, Apache-2.0) as it is; **tex2typst plus fixes** (`spikes/typst/scripts/latex.mjs`: decimal comma, degree sign, gaps after `\text{}`, `\dfrac`); and **mitex** (Typst package `@preview/mitex:0.2.7`, reads LaTeX inside Typst). Each result was compiled on its own and then checked by eye in `pdf/rumus-a4.pdf`.

|  No | Topic                    | LaTeX                                                       | tex2typst                              | + fixes  | mitex                           |
| --: | ------------------------ | ----------------------------------------------------------- | -------------------------------------- | -------- | ------------------------------- |
|   1 | Penjumlahan pecahan      | `\frac{3}{4} + \frac{1}{4} = 1`                             | pass                                   | pass     | pass                            |
|   2 | Pecahan campuran         | `2\frac{1}{2} = \frac{5}{2}`                                | pass                                   | pass     | pass                            |
|   3 | Pecahan senilai          | `\frac{2}{3} = \frac{2 \times 2}{3 \times 2} = \frac{4}{6}` | pass                                   | pass     | pass                            |
|   4 | Perkalian dan pembagian  | `12 \times 5 = 60, \quad 48 \div 6 = 8`                     | pass                                   | pass     | pass                            |
|   5 | Desimal dan persen       | `0{,}75 = \frac{75}{100} = 75\%`                            | **fail**: prints "0, 75"               | pass     | **fail**: prints "0, 75"        |
|   6 | Luas persegi panjang     | `L = p \times l`                                            | pass                                   | pass     | pass                            |
|   7 | Keliling persegi panjang | `K = 2 \times (p + l)`                                      | pass                                   | pass     | pass                            |
|   8 | Luas lingkaran           | `L = \pi r^2, \quad \pi \approx \frac{22}{7}`               | pass                                   | pass     | pass                            |
|   9 | Volume kubus             | `V = s^3 = 5^3 = 125\ \text{cm}^3`                          | pass                                   | pass     | pass                            |
|  10 | Akar kuadrat             | `\sqrt{144} = 12`                                           | pass                                   | pass     | pass                            |
|  11 | Akar pangkat tiga        | `\sqrt[3]{27} = 3`                                          | pass                                   | pass     | pass                            |
|  12 | Satuan panjang           | `1\ \text{km} = 1.000\ \text{m}`                            | pass                                   | pass     | pass                            |
|  13 | Besar sudut              | `\angle ABC = 90^\circ`                                     | pass (small circle, not a degree sign) | pass     | pass                            |
|  14 | Garis sejajar            | `\overline{AB} \parallel \overline{CD}`                     | pass                                   | pass     | pass                            |
|  15 | KPK                      | `\text{KPK}(4, 6) = 12`                                     | minor: gap before "("                  | pass     | pass                            |
|  16 | Bilangan bulat negatif   | `(-2) \times 3 = -6`                                        | pass                                   | pass     | pass                            |
|  17 | Rata-rata                | `\bar{x} = \dfrac{x_1 + x_2 + \cdots + x_n}{n}`             | minor: `\dfrac` loses display size     | pass     | pass                            |
|  18 | Kotak isian              | `\square + 7 = 15`                                          | pass                                   | pass     | pass                            |
|  19 | Uang dan pembagian       | `\text{Rp}12.500 : 5 = \text{Rp}2.500`                      | minor: gap after "Rp"                  | pass     | pass                            |
|  20 | Penjumlahan bersusun     | `\begin{array}{r} 125 \\ +\ 378 \\ \hline 503 \end{array}`  | **fail**: compile error (`hline`)      | **fail** | **fail**: line silently missing |
|     | **Correct of 20**        |                                                             | **15** (+3 minor)                      | **19**   | **18**                          |

Findings:

- **Use tex2typst with the fixes**, in the shared preparation step. It runs in Node and the browser, needs no Typst package, and 19 of 20 are right. The fixes are four lines of rules; the R4 export work should grow the sample set to the full Bank Soal range and keep it as a test.
- **Column arithmetic (no. 20) needs its own block.** Neither converter handles `\hline` in an array, and mitex drops the line without an error. A SIGRAK `column_arithmetic` block drawn by the renderer (a Typst grid with a rule, as in the hand-written column) is more reliable, and KaTeX cannot show long division either.
- **tex2typst can lose content silently:** `{\displaystyle \frac{x_1}{n}}` converts to an empty result. The preparation step must compare and fall back to printing the LaTeX source with a warning rather than dropping text; the spike already prints the source when conversion throws.
- **Never evaluate teacher text as Typst markup.** Plain text stays data; only converted math is evaluated, in math mode, and only after a guard that refuses `#` (which would switch to code).
- mitex is a good second opinion and handles `\dfrac`, but it needs a Typst package at render time (fetched from `packages.typst.org` by the CLI, and a package hook in the browser), and it shares the decimal-comma error.

## Render times

### Server (Typst CLI)

Wall time of one `typst compile` process per PDF (process start, font loading, layout, PDF write), 15 runs each, one at a time, on the test container (Intel Xeon 2.1 GHz, 4 vCPU). Data: `spikes/typst/results/server-times.json`.

| PDF                | Pages | Median |    Min |    Max |
| ------------------ | ----: | -----: | -----: | -----: |
| `rpm-a4.pdf`       |     4 |  71 ms |  59 ms |  98 ms |
| `rpm-f4.pdf`       |     3 |  67 ms |  55 ms |  84 ms |
| `rpm-a4-times.pdf` |     3 |  68 ms |  57 ms |  77 ms |
| `lkpd-a4.pdf`      |     1 |  55 ms |  46 ms |  96 ms |
| `lkpd-f4.pdf`      |     1 |  52 ms |  47 ms |  87 ms |
| `arab-a4.pdf`      |     2 |  50 ms |  39 ms |  64 ms |
| `rumus-a4.pdf`     |     2 | 122 ms | 106 ms | 139 ms |

A full RPM renders in well under 0.1 s on one core, so a `worker-exports` process can render several documents per second; a package of RPM + LKPD + rubric is one document and stays far below a second. Gotenberg was not measured here; it runs a Chromium service, which needs far more memory than a Typst process. A long-running renderer (the same WASM compiler in Node, or `typst.node`) would skip process start and font loading; the Node smoke test renders the RPM in about 0.4 s cold and much faster warm, so the plain CLI is good enough to start with.

### Browser (WASM) on desktop and an emulated low-end Android phone

**This is an emulation, not a real device.** Chromium (Playwright) on the test machine, with Chrome DevTools CPU throttling at 4×, 6× (taken as a low-end Android phone; Lighthouse uses 4× for a mid-range one) and 10× (worst case), a 360 × 780 phone viewport, and a throttled network of 9 Mbit/s with 150 ms latency. Each figure is the median of 3 runs in a fresh browser profile. The compiler is `@myriaddreamin/typst-ts-web-compiler` 0.8.0-rc4, which contains Typst 0.15.1 (same as the CLI).

Data: `spikes/typst/results/browser-times.json` (Chromium 158).

|                                                 |       Desktop |   Phone 4× | Phone 6× (low-end) |    Phone 10× |
| ----------------------------------------------- | ------------: | ---------: | -----------------: | -----------: |
| First visit until ready (download, WASM, fonts) | 0.3 s (local) |     15.2 s |             15.2 s |       15.8 s |
| Returning visit until ready (from cache)        |         0.4 s |      1.0 s |              1.5 s |        2.4 s |
| … of which WASM compile and start               |        230 ms |     581 ms |             839 ms |        1.4 s |
| RPM, first render (4 pages)                     |        112 ms |     441 ms |             592 ms |        1.1 s |
| RPM, switch A4 to F4                            |         41 ms |     187 ms |             250 ms |       479 ms |
| RPM, render after an edit (median / max)        |     9 / 12 ms | 44 / 67 ms |         67 / 88 ms | 136 / 206 ms |
| LKPD, first render (1 page)                     |         24 ms |      89 ms |             143 ms |       278 ms |
| LKPD, render after an edit (median / max)       |     6 / 12 ms | 30 / 38 ms |         42 / 71 ms |  82 / 106 ms |
| WASM memory                                     |         36 MB |      36 MB |              36 MB |        36 MB |

What this means:

- **Rendering is fast enough on a low-end phone.** At 6×, the first RPM render takes about 0.6 s and every later edit re-renders in under 0.1 s, so a live preview while the teacher edits is realistic. Memory stays at 36 MB of WASM heap.
- **The first visit is the problem.** On the emulated phone network, getting ready takes about 15 s, almost all of it downloading the compiler (10.5 MB gzip as served here; 8.3 MB with brotli) and the fonts (2.5 MB). The CPU throttle barely changes it. From the cache, the phone is ready in 1 to 2.5 s.
- **So:** never block a page on the compiler. Show the page and an HTML preview first, load the compiler in the background only on pages with a PDF preview, serve it with brotli and long-lived caching (or a service worker), and fall back to the server PDF when the compiler is not ready. Subsetting the fonts per document and dropping unused styles would cut the font download.

## Fonts and licences

All fonts are embedded (subset) in the PDFs and loaded from one pinned folder by the CLI and the browser.

| Font                     | Version                    | Used for                                               | Licence                                                        | Source                            |
| ------------------------ | -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------- |
| Liberation Sans          | 2.1.5                      | Body text, the "Arial" option (same metrics)           | SIL OFL 1.1                                                    | Ubuntu `fonts-liberation`         |
| Liberation Serif         | 2.1.5                      | Body text, the "Times New Roman" option (same metrics) | SIL OFL 1.1                                                    | Ubuntu `fonts-liberation`         |
| Liberation Mono          | 2.1.5                      | Code on the formula sheet only                         | SIL OFL 1.1                                                    | Ubuntu `fonts-liberation`         |
| Noto Naskh Arabic        | 2.021                      | All Arabic (default)                                   | SIL OFL 1.1                                                    | `notofonts/arabic` GitHub release |
| Amiri                    | 1.003                      | Arabic comparison; option for Qur'anic text            | SIL OFL 1.1                                                    | `aliftype/amiri` GitHub release   |
| New Computer Modern Math | from `typst-assets` 0.15.1 | Math                                                   | GUST Font License (free, embedding and redistribution allowed) | `typst/typst-assets`              |

- Arial and Times New Roman themselves cannot be shipped in a Linux image or a browser bundle; the Liberation fonts have the same metrics, so line breaks match documents set in Arial or Times. The UI should call the options "Arial (Liberation Sans)" or keep the names and say the PDF uses a metric-compatible font.
- Noto Naskh Arabic is the better default for children: larger letters, clearer separation of harakat. Amiri is closer to a printed mushaf and is a reasonable option for Qur'anic passages.
- OFL and GUST allow embedding in PDFs and bundling with the app; the copyright notices go into `THIRD_PARTY_NOTICES.md` when the fonts enter the app (R4).
- The spike's own tools: Typst 0.15.1 (Apache-2.0), typst.ts 0.8.0-rc4 (Apache-2.0), tex2typst 0.6.2 (Apache-2.0), mitex 0.2.7 (Apache-2.0).

## Gaps and risks

1. **Arabic copy and search (open).** Text extracted from Typst PDFs with Arabic is scrambled (letters duplicated and reordered), with and without harakat, and also with `--pdf-standard a-2a` or `ua-1`. A Chromium PDF of the same text, read with the same tools, gives the letters in the right order (with stray spaces), so the problem is Typst's text layer, not the tools. Print and screen are correct; copy/paste, search and screen readers are not. Indonesian text extracts correctly. Accept for printables; follow Typst upstream; use the Gotenberg fallback if a document must have searchable Arabic.
2. **Browser download size.** The WASM compiler is 28.8 MB raw, 10.5 MB gzip, 8.3 MB brotli, plus 2.5 MB of fonts (gzip; 4.6 MB raw). On a phone network this is the slowest part of the first preview. Load it only on preview pages after the page is usable (F-022: content first), keep it in the HTTP cache or a service worker, and offer the server PDF as the immediate fallback on slow connections.
3. **Browser compiler is pre-1.0.** typst.ts is maintained outside the Typst project and the version that matches Typst 0.15 is a release candidate (0.8.0-rc4); the latest stable (0.7.0) carries an older Typst. Pin both the CLI and the WASM to the same Typst version and test them together (the pixel comparison in `browser/smoke-node.mjs` is a ready check).
4. **Distribution fonts differ.** Shown twice above (Arabic, math). The image must ship its own font files.
5. **Charts and three.js figures were not tested.** The plan is SVG from ApexCharts and three.js's SVG renderer, which Typst embeds as images; a short check belongs in the R4 export task.
6. **Kashida justification** is not available (see Fidelity).
7. **Typst package downloads.** mitex (if used) and any other package must be vendored into the image; the server must not reach `packages.typst.org` at render time.
8. **Religious text in the samples.** The Qur'anic phrases and Al-Ikhlas were typed for the rendering test only; real content still needs the Tim Validasi SIGRAK check (D-113).

## Done-when status

- Sample PDFs and this report: ready for the owner (`spikes/typst/pdf/`).
- Decision: waits for the owner. Suggested wording for D-399: "Typst 0.15 is the PDF engine (CLI on `worker-exports`, WASM for browser previews, fonts pinned in the image, LaTeX converted with tex2typst and SIGRAK fixes); Gotenberg stays as the fallback, including for documents that need searchable Arabic text."
