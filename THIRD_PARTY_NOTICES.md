# Third-party notices

SIGRAK is proprietary software of Arumi Studios ([`LICENSE`](LICENSE)). It includes or depends on the third-party components below, which stay under their own licences. Every runtime dependency and font is added here when it is added to the repository (Fondasi F-009; licence check in CI comes in R1). Allowed without asking: MIT, BSD, Apache-2.0, ISC, OFL for fonts. Ask the owner before GPL, AGPL or a commercial licence.

## Bundled in the repository

| Component | Version / source | Licence | Where | Notes |
|---|---|---|---|---|
| Noto Naskh Arabic (regular 400, bold 700) | Noto Project, [notofonts/arabic](https://github.com/notofonts/arabic), © 2022 The Noto Project Authors | SIL Open Font License 1.1 | `scripts/docs-pdf/fonts/` (full text in `scripts/docs-pdf/fonts/OFL.txt`) | Arabic text in the developer PDFs. May be bundled and embedded; may not be sold on its own. |

## Used under the owner's commercial licence

| Component | Licence | Where | Notes |
|---|---|---|---|
| Hugeicons Pro (Rounded Stroke and Rounded Solid only) | Commercial licence; licence holder: the owner of Arumi Studios (the licence certificate is kept in the password manager, not in git) (D-402, D-434) | `inertia/icons/hugeicons/` (bundled and self-hosted) | Not sublicensed by SIGRAK's `LICENSE`; may not be extracted, reused or redistributed. Any licence key lives in `stack.env` or a CI secret, never in git. |
| shadcn/studio Pro (`radix` variants) | Commercial licence; licence holder: the owner of Arumi Studios (D-434) | None yet; blocks are added through the CLI registry only when the app uses them, and listed here then. Catalog of names: `docs/drafts/shadcn-studio-catalog.md` | Email and licence key for the registry live in env or a CI secret, never in git. Not sublicensed by SIGRAK's `LICENSE`. |

## Development tools (not shipped in the app)

| Component | Licence | Where |
|---|---|---|
| Playwright 1.63.0 | Apache-2.0 | `scripts/docs-pdf/` (builds the developer PDFs) |
| Pandoc (system tool, not bundled) | GPL-2.0-or-later | Called by `scripts/docs-pdf/build.cjs`; only run as a separate program, nothing linked or shipped |
