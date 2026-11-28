# R2-03 — Integration settings and AI models per purpose

- **Phase:** R2
- **Status:** review
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

- [x] Tests (own database `sigrak_test_r203`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-03-integration-settings` (from `r2/r2-00-split`). Full suite 408 tests (393 before + 15 new); lint, both typechecks, `prettier --check .` and `node ace build` pass. Pages checked with Playwright at 360 and 1280 px (no sideways scroll; the model dialog becomes a bottom sheet on phones).

### Built

- **Migration** `1764520000001_create_integration_settings_tables`: `integration_settings` (one row per key `mail`, `chatbot`, `storage`, `ai_team_key`; `payload` is the whole value object encrypted with the app key, with the encryption purpose `integration:<key>`, so a payload copied to another row does not decrypt) and `ai_purpose_models` (`models text[]`, 1–5, first one active). Both are Tim SIGRAK data: no school_id, no RLS.
- **`app/integrations/`** (`#integrations/*`, alias added in `package.json`):
  - `store.ts`: typed payloads, encrypt/decrypt, `readIntegration`, `writeIntegration` (row lock, one transaction with the log row), `clearIntegration`, `hintOf` (set + last 4), `diffFields` (plain fields as from/to, secrets only as `"changed"`).
  - `mail.ts`: source `env` (MAIL_MAILER set: env wins), `console` (complete SMTP values in the console) or `none` (the `json` mailer, nothing is sent). `mailerFor()` is used by the `send-mail` job: a mail queued on the default mailer is sent with a `console` mailer built from the saved values (cached per `updated_at`); the fake mailer of the tests always wins. `sendTestMail` sends right away, not through the queue, to the staff member who pressed the button, and logs `integration.mail_tested`. Test seams: `mailSeams.envMailer()`, `mailSeams.transport()`.
  - `chatbot.ts`: base URL, model, up to 10 keys in rotation order (add, refuse duplicates, remove). Saved only.
  - `storage.ts`: endpoint, region, bucket, access key id and secret. Saved only; nothing switches storage yet.
  - `ai_models.ts`: purposes come from `config/ai.ts` (`demo`, `document_long`, `document_short`, `game_content`, `repair`; the starting values are there, and so are the timeouts). `purposeModels` / `resolvePurpose` read the console row or the starting value. `setPurposeModels` validates, logs `ai_model.updated` {from, to}, and deletes the row when the list equals the starting value again. Also `resetPurposeModels`, Tim SIGRAK's Gemini test key, and `testModel`, which calls `aiProviders.resolve()` with the team key only and logs `ai_model.tested`. With `AI_PROVIDER=fake` the fake provider answers.
  - The gateway (`app/services/ai/ai_gateway.ts`) now reads `resolvePurpose()` on every run, so a change applies to the next step without a deploy.
- **Pages** (R1-12 shell and patterns, new `SettingsTabs` across Umum / Integrasi / Model AI, each tab shown by its ability):
  - `/pengaturan/integrasi`: Email (status chip for the source and a note for env/none, form, "Kirim email uji", "Kosongkan isian"), Penyedia chatbot (form + key list + add key), Penyimpanan ("Belum dipakai"), Kunci AI Tim SIGRAK.
  - `/pengaturan/model-ai`: one card per purpose (active model + numbered fallbacks, "Uji" per model, "Ubah daftar" dialog with reorder/remove/add, "Kembalikan ke nilai awal"), the test-key status and the last 10 changes and tests.
  - Abilities: `integrations.view` / `integrations.manage`, `ai_models.view` / `ai_models.manage` (writes and tests are owner-only under the R2-01 powers).
  - Console menu: "Integrasi" and "Model AI" under Sistem. "Pengaturan" is now `exact`, so it is not highlighted on its sub-pages. New icons: `integrations` (electric-plugs) and `ai-models` (brain).
- Lang: `resources/lang/id/integrations.json`, plus `nav.console.*`, `nav.settings_tabs.*`, `staff.audit.actions.integration|ai_model.*` and validation field names. "Gemini" was added to the EYD label proper-name list.
- Tests: `tests/functional/integrations/integrations.spec.ts` (9) and `ai_models.spec.ts` (6). They cover the encryption round-trip and the purpose binding, that props never hold a secret, that an empty secret keeps the saved one, log rows without secrets, owner-only writes (admin/engineer/finance read, support 403), env vs console vs none for mail including the worker job path, the test mail (success, failure, fake mailer), chatbot keys, storage and clear, validation, the model list round-trip and reset, invalid lists, gateway fallback to the next console model on `model_unavailable`, and the test button using only the team key.

### Deviations

- Mail precedence keys on `MAIL_MAILER` alone: when it is set, env wins; when it is empty, the console values are used once they are complete. `.env.example` sets `MAIL_MAILER=json`, so local dev keeps env. Production `stack.env` must leave it empty to use the console.
- The test button needs a Tim SIGRAK key, so a fourth integration `ai_team_key` (one Gemini key) was added on the Integrasi page. Only Gemini models can be tested or chosen per purpose; the OpenAI-compatible and Anthropic adapters of D-326 are not built.
- The "Kirim email uji" goes only to the signed-in staff member's address, never a typed one.
- `SelectField` (`inertia/components/section.tsx`) got a `disabled` prop.
- The generated `.adonisjs/server/pages.d.ts` and `routes.d.ts` changed (codegen). Expect merge noise there.

### Missing ability keys

None. Every key used is in the R2-01 catalogue.

### Open questions

- **Owner:** should admin also be able to change integrations or AI models? Under the current powers only the owner can (`integrations.manage`, `ai_models.manage`); admin, engineer and finance read.
- **Owner:** are the purpose names and notes right (Coba AI, Dokumen panjang, Dokumen pendek, Isi permainan, Perbaikan hasil)? They follow the engine doc's examples; the templates will name them.
- **Owner:** one Gemini test key, or several Tim SIGRAK keys per provider (D-326)?
- **Team (R2-04/R2-09):** Kesehatan Sistem could show the mail source (`mailSource()`) and warn on `none` in production.
- **Team:** the chatbot slice should read `ChatbotSettings` through `readIntegration('chatbot')`, and the storage switch should read `readIntegration('storage')`, with env taking precedence like mail.
