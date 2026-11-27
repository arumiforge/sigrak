# R0-03 — Remove old-stack passages from the remaining docs

- **Phase:** R0
- **Status:** todo
- **Owner:** —
- **Depends on:** R0-01
- **Can run in parallel with:** R0-02, R0-04, R0-05 (split per doc between sub-agents; two agents never edit the same file)

## Goal

The owner asked to remove everything about Laravel and the old stack (D-407). Clean the remaining final docs so they describe product rules without stack details, or name the new stack (D-388…D-399) where a stack choice matters.

## Read first

- `docs/agent/CONTEXT.md`, D-388…D-410 in `docs/agent/DECISIONS.md`

## Output

- `docs/final/{product-concept,content-engine,data-model,ai-provider-engine,design-system,developer-handbook,research-digest,religious-education,ifp-classroom}.md` and their `docs/pdf/src/*.md` + rebuilt `docs/pdf/*.pdf` (`node scripts/docs-pdf/build.cjs <name>`)
- Drafts and READMEs with old-stack references (`grep -ril "laravel\|filament\|svelte\|php\|mysql\|pest\|gotenberg\|tailadmin\|artisan\|eloquent" docs --exclude=DECISIONS.md --exclude-dir=archive --exclude-dir=sources`); links to the deleted docs are removed or pointed at the R4 replacements
- Finished task files and `DECISIONS.md` stay as history

## Done when

- [ ] The grep above returns only history files
- [ ] Every edited final doc has its PDF rebuilt
