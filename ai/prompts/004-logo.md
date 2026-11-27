---
id: 004
name: logo
kind: logo                              # not checked by check_assets.py; Codex runs the hand checks below
batch: brand-logo
round: 1                                # 1 = directions for the owner to choose from; 2 = final set of the chosen one
pick: none                              # Claude writes the chosen direction (e.g. B) here before round 2
files: favicon.ico, img/logo/          # round 2 only; full list under "Files"
status: requested
---

# 004 — logo (SIGRAK logo: mark and wordmark)

## Purpose

SIGRAK's logo: a mark and the wordmark, in every colourway the app, its PWA icons, its PDFs and the Arumi Studios
material need (D-448). The owner chooses from 3–5 distinct directions, all inside one concept (below). The logo must
feel like a tidy teacher's workbook, the same calm as the app (`docs/final/design-system.md`): one teal, plain shapes,
readable on a cheap phone and on a photocopied page.

This brief runs in **two rounds** on the same batch:

1. **Round 1 — directions.** Codex draws 3–5 directions, each complete enough to judge (all colourways, the 16 px
   version, the app icon, mock-ups). Nothing goes into `install/` yet. The owner picks in the pull request.
2. **Round 2 — final set.** Claude writes the pick into `pick:`, sets `round: 2` and `status: requested`. Codex
   refines that one direction (and any changes the owner asked for) and delivers the full set in `ai/generated/install/`.

## Brand facts (from `docs/final/product-concept.md` → Brand, and the owner's rebranding notes)

- **Name**: SIGRAK — Javanese for lively, quick, energetic. Tagline "Kerja guru, lebih sigrak." (not part of the logo).
- **Wordmark**: lowercase **sigrak**, set in Plus Jakarta Sans 700 (the app's font, SIL Open Font Licence) with the
  letter spacing slightly tightened, then converted to outlines. Small custom touches are allowed when a direction
  needs them (a terminal of the `k`, the dot of the `i`, a tighter `ra` pair) but it must still read as Plus Jakarta
  Sans, not a new typeface. Never uppercase, never title case, never another script, never translated.
- **Mark**: two slanted strokes drawn like **chalk on a board**, with rounded ends, together forming a **check mark**
  and at the same time a **step forward**. Meaning: "done, and on to the next". The mark is used alone as the app icon
  (white on teal) and as the favicon.
- **Colour** (`inertia/css/tokens.css`):

  | Token | Light | Dark | Used for |
  | --- | --- | --- | --- |
  | `--brand` | `#0F766E` | `#2DD4BF` | The mark; the app icon tile |
  | `--brand-strong` | `#115E59` | `#5EEAD4` | Not in the logo; listed so Codex does not invent another teal |
  | `--text` | `#1C2420` | `#E6ECE9` | The wordmark in full colour |
  | `--bg` / `--surface` | `#F7F8F7` / `#FFFFFF` | `#151B19` / `#1C2321` | Backgrounds the logo must sit on |
  | `--on-brand` | `#FFFFFF` | `#0B1F1C` | Mark on a teal tile |

  No other colours: no second accent, no tints, no gradients.

## Where it is used

- App header and sidebar (inline SVG, 24–32 px high), login page, PWA install icon and splash, browser tab (favicon),
  share previews, the guide pages, the internal console (`admin.`), Arumi Studios presentations.
- Printed and PDF output: the small mark or lockup in document footers and covers (Typst embeds the SVG), in **black
  on white**, often photocopied or printed on cheap inkjets. A school's own letterhead is an uploaded image and is
  never replaced by this logo; the SIGRAK logo only sits beside it.
- Dark mode in the app (`#151B19`), teal panels (`#0F766E`), and plain white paper.

## Concept and directions

Every direction keeps the same idea: **two separate chalk strokes**, a short one and a long one, slanted so that
together they read as a check mark, while the long stroke also reads as a stride or step forward. Directions differ in
how the two strokes relate, their angle and weight, and how the mark sits with the wordmark. Make 3–5 directions that
are genuinely different, for example:

| Direction | Idea (a starting point; Codex may replace one with a better idea in the same concept) |
| --- | --- |
| A — centang kapur | A classic check from two strokes with a small gap at the joint, as if drawn in two quick moves; long stroke leaning forward about 30–35°. Clean rounded ends. |
| B — langkah | The two strokes as two strides: short stroke low and left, long stroke higher and further right, slightly parallel, so the pair reads as a check and as walking forward. |
| C — naik satu anak tangga | The long stroke ends with a short forward kick toward horizontal, as if stepping onto the next stair; still two strokes only. |
| D — goresan bertekanan | Gestural: each stroke heavier where the chalk lands and thinner where it lifts (a taper, not a texture); the most hand-made of the set. |
| E — menyatu dengan tulisan | Mark A or B, but the lockup ties it to the wordmark: the mark's angle repeats in the `k` arm or the dot of the `i`. The mark must still stand alone. |

Chalk feeling comes from the **shape** (rounded ends, a slight taper, a small irregularity of the edge built from a
few nodes), never from noise, grain, dry-brush raster texture, halftone or a blackboard background. Each direction may
have a slightly richer large version, but the 16 px version is always plain and solid.

## Deliverables per direction (round 1)

For each direction, in `ai/generated/logo/arah-<letter>-<slug>/` (e.g. `arah-b-langkah/`):

**Layouts**

| Name | What |
| --- | --- |
| `sigrak-tanda` | Mark alone, square `viewBox` |
| `sigrak-logo` | Horizontal lockup: mark left of the wordmark, baselines and optical centres aligned (the main logo) |
| `sigrak-logo-tumpuk` | Stacked lockup: mark above the wordmark, centred (covers, square spaces) |
| `sigrak-tulisan` | Wordmark alone |

**Colourways** (suffix added to every layout, e.g. `sigrak-logo-hitam.svg`)

| Suffix | Colours | Shown on |
| --- | --- | --- |
| _(none)_ | Full colour: mark `#0F766E`, wordmark `#1C2420` | `#FFFFFF`, `#F7F8F7` |
| `-gelap` | Full colour for dark: mark `#2DD4BF`, wordmark `#E6ECE9` | `#151B19`, `#1C2321` |
| `-hitam` | Single colour: everything `#000000` | White paper, print, photocopies, fax |
| `-putih` | Negative: everything `#FFFFFF` | Teal `#0F766E` **and** near-black `#151B19` |
| `-app` | Everything `fill="currentColor"`; mark in `<g class="logo__mark">`, wordmark in `<g class="logo__word">` | Inlined in the app; CSS sets `.logo__mark { color: var(--brand) }` and the word to `var(--text)` |

**Small sizes and icons**

| File | What |
| --- | --- |
| `sigrak-favicon.svg` | A separate drawing of the mark for **16 px**: white mark on a `#0F766E` tile (rounded corners, radius about 20 % of the side), strokes snapped to a 16-unit grid, at least 2 px thick at 16 px, no taper, no gaps under 1 px. Readable on light and dark browser tabs without a media query. |
| `sigrak-ikon-aplikasi.svg` | PWA app icon, 512×512 `viewBox`, full-bleed `#0F766E` square (no rounded corners; the OS masks it), white mark kept **inside the maskable safe zone**: a centred circle of 40 % radius (diameter 409.6 px); aim for the mark to fit a centred box of about 300–340 px so it survives circle, squircle and rounded-square masks. |
| `lembar.png` | Presentation sheet, 2400×1600 PNG: every layout × colourway on its intended background, the favicon at real 16 px and 32 px and enlarged 8× (pixels visible), the app icon in circle, squircle and rounded-square masks, an app header mock at 360 px wide, and a black-on-white A4 footer mock at real print size plus a "photocopied" copy (thresholded, slightly blurred). Text on the sheet: only the logo itself; labels go in the demo page and the PR body. |

Round 1 also adds `ai/generated/demo/logo.html` (linked from `ai/generated/demo/index.html`; create that index with a
link list if it does not exist yet): all directions side by side, labelled with letter and slug, in light and dark at
360 and 1280 px, plus the favicon at 16 px and the app icon in the three masks.

## Files (round 2, after the owner's pick)

Masters (SVG, plus any working files) in `ai/generated/logo/final/`; ready-to-install files in `ai/generated/install/`:

| File (`ai/generated/install/…`) | What |
| --- | --- |
| `img/logo/<layout><suffix>.svg` | All 4 layouts × 5 colourways from the tables above (20 SVGs) |
| `img/logo/favicon.svg` | The 16 px drawing (tile) |
| `favicon.ico` | 16, 32 and 48 px from the 16 px drawing, hand-checked at each size (served from `public/`) |
| `img/logo/apple-touch-icon.png` | 180×180, full-bleed teal, white mark, no transparency |
| `img/logo/ikon-192.png`, `img/logo/ikon-512.png` | PWA `purpose: any`: white mark on a `#0F766E` rounded square (radius about 20 %), transparent outside the square |
| `img/logo/ikon-maskable-192.png`, `img/logo/ikon-maskable-512.png` | PWA `purpose: maskable`: full-bleed teal, mark inside the safe zone |
| `img/logo/png/sigrak-tanda<suffix>-<w>.png` | Mark, suffixes _(none)_, `-gelap`, `-hitam`, `-putih`, widths 64, 256, 1024 |
| `img/logo/png/sigrak-logo<suffix>-<w>.png` | Horizontal lockup, same 4 suffixes, widths 320, 640, 1280, 2560 (2560 is for 300 dpi print) |
| `img/logo/png/sigrak-logo-tumpuk<suffix>-<w>.png` | Stacked lockup, same 4 suffixes, widths 256, 512, 1024 |
| `img/logo/png/sigrak-tulisan<suffix>-<w>.png` | Wordmark, same 4 suffixes, widths 320, 1280 |

Plus `ai/generated/logo/final/lembar.png` (the round-1 sheet for the final logo) and a short usage page in
`ai/generated/demo/logo.html`: clear space, minimum sizes, the colourways and what not to do (stretch, recolour,
outline, add shadow, put on a busy photo).

File rules:

- SVG: `viewBox` always, outlines only (wordmark converted to paths; no `<text>`, no font files, no `@font-face`), no
  `<script>`, `<image>`, `<foreignObject>`, event handlers, external references or embedded rasters; no strokes in
  the masters (strokes expanded to fills so the weight scales); tight `viewBox` with the clear space **outside** it;
  optimised (SVGO or by hand), each ≤ 6 KB, `favicon.svg` ≤ 2 KB. Hex colours are allowed in the logo files (they
  are the brand itself and go into PDFs and PNGs), except the `-app` files, which use `currentColor` only.
- PNG: sRGB, transparent background (except `apple-touch-icon.png` and the maskable icons), exported from the SVG
  masters at exact pixel sizes, losslessly optimised; ≤ 60 KB for widths up to 640 px.
- Clear space around every lockup: at least the height of the wordmark's `s` (x-height) on all sides; show it on the
  usage page.
- Minimum sizes: mark 16 px on screen (favicon drawing below 24 px), 5 mm in print; horizontal lockup 80 px wide on
  screen, 25 mm in print.

## Constraints (strict)

- **Never**: gradients, shadows, glows, bevels, 3D, outlines around the mark, glassmorphism; a mascot or any
  character; batik, menara or other ornament; a pencil, book, graduation cap, lightbulb, brain, star, AI sparkle or
  chat bubble; the mark inside a circle, shield or tinted badge (only the app icon and favicon get a tile, because
  platforms need one); a tagline, letters or numbers other than the wordmark.
- **No government or institutional marks**: nothing that resembles Tut Wuri Handayani, Garuda Pancasila, the logos of
  Kemendikdasmen, Kemenag, Merdeka Mengajar or any school, madrasah or organisation; no flags.
- **No look-alikes**: the mark must not be confused with the Nike swoosh (the biggest risk for a check mark), Google
  Classroom, Canva, Ruangguru, or the check icons of to-do apps. Mention in the PR how each direction avoids this.
- **No generic AI look** (Fondasi `ui.md` "Never", `ai/style-guide.md` §10): no purple–blue, no floating shapes, no
  "tech startup" lettermark, nothing that looks like a template logo.
- **Works in black and white**: the `-hitam` version must read on a photocopied A4 letterhead footer at 5 mm, and the
  full-colour version must still read when printed in greyscale (teal turns mid grey; the mark must not vanish).
- Do not commit the Plus Jakarta Sans font files; outline the letters and keep only the outlines.

## Alt text / accessibility

- In the app the logo is a link to the home page: `<a aria-label="SIGRAK, ke beranda">` with the SVG
  `aria-hidden="true"`. Elsewhere the `<img>` alt is `SIGRAK`.
- Contrast: mark and wordmark at least 3:1 against every background they are shown on (the token pairs above already
  meet this; check the `-gelap` mark on `#1C2321` too).

## Acceptance checks

Codex (hand checks, because `check_assets.py` skips `kind: logo`):

- [ ] Every SVG parses as XML, has a `viewBox`, has no `<text>`, `<script>`, `<image>`, `<foreignObject>`, `on…`
      attributes, external `href` or `url(…)`, and is within budget (`ai/style-guide.md` §9 rules)
- [ ] `-app` files use only `currentColor`; `-hitam` only `#000000`; `-putih` only `#FFFFFF`
- [ ] Every PNG has the exact size in its name and the right transparency
- [ ] `python3 ai/tools/check_assets.py` still passes for the other briefs (nothing else touched)

Claude and the owner (review):

- [ ] 3–5 directions, clearly different, all inside the concept (two chalk strokes, check mark, step forward)
- [ ] Wordmark is lowercase `sigrak` in Plus Jakarta Sans 700, outlined, spelled correctly
- [ ] Favicon readable at real 16 px on a light and a dark tab; app icon survives circle, squircle and rounded masks
- [ ] Black version readable on the photocopied A4 footer mock; full colour readable in greyscale
- [ ] Negative version reads on `#0F766E` and on `#151B19`
- [ ] No gradient, shadow, mascot, batik, government emblem or look-alike of a known mark
- [ ] Does not look like a generic AI or template logo
- [ ] Round 2: all files in the table present with the exact names; the usage page shows clear space and minimum sizes

## Codex starter prompt (this batch)

The queue's general prompt takes the first requested batch; to run the logo first, paste this instead:

```
Work in the GitHub repository arumiforge/sigrak, starting from the latest main. Read AGENTS.md and ai/CODEX.md and follow them exactly; they point you to ai/style-guide.md and the briefs in ai/prompts/. Make the batch "brand-logo" from the brief ai/prompts/004-logo.md, in the round its front matter names (round 1: 3–5 logo directions; round 2: the final set of the direction in "pick"). Do the hand checks the brief lists, run python3 ai/tools/check_assets.py, and deliver only in ai/generated/ (plus the status lines) on a new branch art/codex-<YYYYMMDD>-brand-logo, with one pull request into main that names each direction and how it avoids look-alikes. Commit as Arumi Studios <arumiforge@gmail.com>. Do not change anything else, do not merge, and add no AI attribution anywhere.
```
