# Typst spike (R0-07)

Spike for decision D-399: can Typst produce SIGRAK's PDFs, on the server (CLI) and in the browser (WASM)? The report is [`docs/drafts/typst-spike.md`](../../docs/drafts/typst-spike.md).

This folder is throwaway spike code. Nothing in the app imports it.

## What is here

| Path                                      | What it is                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `templates/lib.typ`                       | Shared print frame: A4/F4, letterhead image, running header and footer with page numbers, unsplittable table rows, Arabic and math helpers    |
| `templates/rpm.typ`, `templates/lkpd.typ` | RPM (MI Matematika kelas 4, pecahan senilai) and one-page LKPD (MI Bahasa Arab kelas 1, perkenalan), both read from content JSON              |
| `templates/arab.typ`                      | Arabic test sheet: Al-Ikhlas with harakat, waqf and ayah numbers, hard harakat cases, bidi, justified Arabic, Noto Naskh Arabic next to Amiri |
| `templates/rumus.typ`                     | The 20 SD/MI formulas, LaTeX to Typst three ways, with the visual verdicts                                                                    |
| `templates/check-math.typ`                | Compiles one formula on its own (used by `scripts/formulas.mjs`)                                                                              |
| `data/rpm.json`, `data/lkpd.json`         | Sample content in the document-model shape: text, `{ "tex": … }` math and `{ "ar": … }` Arabic segments                                       |
| `data/formulas.json`                      | The 20 formulas (LaTeX as KaTeX stores it, hand-written Typst, review verdicts); `formulas.result.json` is generated                          |
| `data/kop-contoh.png`, `kop/kop.typ`      | Sample letterhead image (2409 × 425 px, a fictional madrasah) and its source                                                                  |
| `scripts/`                                | `fonts.sh` (font set), `latex.mjs` (LaTeX → Typst with SIGRAK fixes), `prepare.mjs`, `build.mjs` (render + server timing), `formulas.mjs`     |
| `browser/`                                | WASM test: `compile.mjs` (shared compile code), `index.html` + `page.mjs`, `bench.mjs` (Playwright runner), `smoke-node.mjs`                  |
| `pdf/`                                    | The rendered sample PDFs (committed)                                                                                                          |
| `results/`                                | Measured times: `server-times.json`, `browser-times.json`                                                                                     |

## Standalone setup

`spikes/typst/` has its own `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml`. pnpm uses the nearest `pnpm-workspace.yaml`, so running pnpm here never touches the root workspace or the root lockfile, and the root `pnpm install` never installs this folder. The local `pnpm-workspace.yaml` repeats the root's `minimumReleaseAge` rule (D-422). Playwright is not a dependency: the browser test uses the preinstalled copy (`NODE_PATH`).

## Rebuild

Needs the `typst` CLI 0.15.1, Node 26, pnpm 12, `unzip`, the `fonts-liberation` package, and `pdftoppm` for looking at pages.

```sh
cd spikes/typst
pnpm install --frozen-lockfile   # WASM compiler and tex2typst, local to this folder
pnpm fonts                       # fills fonts/ (pinned versions, not committed)
pnpm formulas                    # converts and checks the 20 formulas
pnpm build                       # renders every PDF into pdf/
```

Every render uses only the fonts in `fonts/` (`--ignore-system-fonts --ignore-embedded-fonts`), so the CLI and the browser use the same fonts. `rumus.typ` imports the `@preview/mitex:0.2.7` package, which the CLI downloads on first use.

Options of the document templates, for `typst compile --root . --input key=value`:

- `paper`: `a4` (default) or `f4` (215 × 330 mm)
- `font`: `sans` (Liberation Sans, metric twin of Arial, default) or `serif` (Liberation Serif, metric twin of Times New Roman)
- `kop`: letterhead path, or `none`

## Measure

```sh
pnpm bench:server                                          # 15 CLI renders per PDF, median → results/server-times.json
pnpm smoke:wasm                                            # WASM compiler in Node, PDFs match the CLI pixel for pixel
NODE_PATH=/opt/node-tools/node_modules pnpm bench:browser  # Chromium, desktop and emulated phone → results/browser-times.json
```

The phone numbers are an emulation (Chrome DevTools CPU throttling 4×, 6× and 10×, a 360 × 780 phone viewport and a 9 Mbit/s network) on the test machine, not a measurement on a real Android phone.

## Look at the pages

```sh
pdftoppm -r 110 -png pdf/lkpd-a4.pdf /tmp/lkpd
```
