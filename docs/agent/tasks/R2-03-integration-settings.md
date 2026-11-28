# R2-03 — Integration settings and AI models per purpose

- **Phase:** R2
- **Status:** in-progress
- **Owner:** r2/r2-03-integration-settings
- **Depends on:** R2-01
- **Can run in parallel with:** R2-02, R2-04…R2-06, R2-08

## Goal

One Pengaturan area in the console for integrations (D-431, Fondasi F-005): mail SMTP, the owner's OpenAI-compatible chatbot keys, storage, and the AI model plus ordered fallback list per purpose with a test button (D-315). Core secrets stay in env.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- Decisions D-315, D-394, D-431, D-451; Fondasi F-005 only if attached (`docs/agent/fondasi-check.md` §1); `app/accounts/settings.ts` (`app_settings`), `config/mail.ts`, the AI job code (`app/jobs/`, `app/services/`)

## Output

- Migration block `17645200xxxxx` if needed (encrypted values in `app_settings` or an `integration_settings` table); values encrypted with the app key, never shown back in full (last 4 characters), every change audited.
- Mail: env wins when `MAIL_*` is set; otherwise the panel values are used; "Kirim email uji" button.
- AI models per purpose: purposes listed in code with starting values in config; owner edits model and fallback order; test button calls with a Tim SIGRAK key, never a teacher's key; the AI job runtime reads the active choice.
- Chatbot provider keys (owner only) and storage settings (S3/R2 endpoint, bucket, keys) as forms; no live storage switch yet.
- Tests: encryption round-trip, env precedence, owner-only writes, audit rows, model fallback selection.

## Done when

- [ ] Tests (own database `sigrak_test_r203`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
