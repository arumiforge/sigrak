# R0-07 — Spike: Typst PDF (two weeks)

- **Phase:** R0
- **Status:** in-progress
- **Owner:** igi/dazzling-franklin-5i1w8n
- **Depends on:** R0-01
- **Can run in parallel with:** R0-05, R0-06

## Goal

Decide D-399: can Typst (WASM in the browser, CLI on the server) produce SIGRAK documents?

## Read first

- D-399, F-020, `docs/final/content-engine.md` (export section), `docs/final/religious-education.md` (Arabic for MI)

## Output

- `spikes/typst/` with templates for one RPM and one LKPD page: letterhead image, tables, Arabic RTL with harakat, math (LaTeX → Typst conversion of 20 sample formulas), A4 and F4
- Report `docs/drafts/typst-spike.md`: fidelity, render time on a low-end Android phone and on the server, font licensing, gaps; recommendation

## Done when

- [ ] Owner sees sample PDFs and the report; decision recorded

## Result

Spike built in `spikes/typst/` (standalone pnpm project with its own `pnpm-workspace.yaml`, outside the root workspace): RPM and one-page LKPD templates read from content JSON, letterhead image, A4 and F4, an Arabic test sheet and a 20-formula sheet; sample PDFs in `spikes/typst/pdf/`; report in [`docs/drafts/typst-spike.md`](../../drafts/typst-spike.md).

Recommendation: Typst passes; make it the PDF engine (CLI on `worker-exports`, WASM for browser previews) with Gotenberg as the fallback, on three conditions: pinned fonts in the image (Noto Naskh Arabic 2.021, not the distribution's 2.004), LaTeX converted with tex2typst plus SIGRAK fixes (19 of 20 formulas correct; column arithmetic becomes its own block), and the 8.3 MB WASM loaded only on preview pages and cached. Known gap: Arabic text in Typst PDFs prints correctly but cannot be copied or searched.

Waiting for the owner to look at the PDFs and record D-399.
