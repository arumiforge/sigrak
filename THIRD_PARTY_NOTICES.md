# Third-party notices

SIGRAK is proprietary software of Arumi Studios ([`LICENSE`](LICENSE)). It includes or depends on the third-party components below, which stay under their own licences. Every runtime dependency and font is added here when it is added to the repository (Fondasi F-009; licence check in CI comes in R1). Allowed without asking: MIT, BSD, Apache-2.0, ISC, OFL for fonts. Ask the owner before GPL, AGPL or a commercial licence.

## Bundled in the repository

| Component | Version / source | Licence | Where | Notes |
|---|---|---|---|---|
| Noto Naskh Arabic (regular 400, bold 700) | Noto Project, [notofonts/arabic](https://github.com/notofonts/arabic), © 2022 The Noto Project Authors | SIL Open Font License 1.1 | `scripts/docs-pdf/fonts/` (full text in `scripts/docs-pdf/fonts/OFL.txt`) | Arabic text in the developer PDFs. May be bundled and embedded; may not be sold on its own. |

## Used under the owner's commercial licence

| Component | Licence | Where | Notes |
|---|---|---|---|
| Hugeicons Pro | Commercial licence held by the owner (D-402) | App icons, bundled and self-hosted once the owner uploads the licensed files | Not sublicensed by SIGRAK's `LICENSE`; may not be extracted, reused or redistributed. Any licence key lives in `stack.env` or a CI secret, never in git. |

## Development tools (not shipped in the app)

| Component | Licence | Where |
|---|---|---|
| Playwright 1.63.0 | Apache-2.0 | `scripts/docs-pdf/` (builds the developer PDFs) |
| Pandoc (system tool, not bundled) | GPL-2.0-or-later | Called by `scripts/docs-pdf/build.cjs`; only run as a separate program, nothing linked or shipped |
