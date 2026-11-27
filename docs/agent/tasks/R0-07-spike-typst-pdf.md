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
