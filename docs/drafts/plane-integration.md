# Plane integration: Bank Masalah to the board and back (RS-07)

**Status:** draft for the owner · **Date:** 2026-11-27 · **Task:** RS-07 · **Builds on:** D-439 (teams, Bank Masalah, forum), D-440 (Plane CE, switchable, masked worker calls, one signed internal endpoint), D-393 (masker), D-425 ("SIGRAK ops"), D-388 (process roles), D-320 (help-request status), D-431 and Fondasi F-005 (settings), Fondasi F-013 `web-baseline.md` (security, personal data, audit log), D-443/D-446 (no AI involved here)

Plane API and webhook details below come from Plane's developer docs (developers.plane.so, read 2026-11-27) and from what Plane CE has shipped so far. Every item marked **[verify]** must be checked against the Plane CE version pinned in `sigrak-plane` before the code is written; a contract test (§13) keeps it checked afterwards.

## 1. Summary

- **SIGRAK is the record; Plane is the board.** Problems, reporters, status history and every notification live in SIGRAK. Plane holds a masked copy for the teams to move through the D-440 columns. Turning Plane off loses no record.
- **Nothing a user typed goes to Plane.** Tim Lapangan writes the problem's title and summary in their own words in the console; the D-393 masker runs over that text as a second guard; the payload carries only role counts, level, kabupaten/kota and a link to the admin record.
- **One way out, one way in.** Out: a `worker-default` job calls the Plane API from an outbox row, rate-limited and idempotent. In: one HMAC-signed webhook endpoint reachable only on a Docker network shared with Plane; it never trusts the payload and re-reads the work item from the API. A scheduled reconcile covers lost webhooks.
- **No AI.** The flow calls no AI provider (D-443, D-446 do not apply beyond the shared masker).
- **No public API** (D-440): the webhook endpoint is not routed through nginx's public hosts or Cloudflare.

## 2. Flow

```text
Teacher / principal / operator / supervisor
  │ Minta Bantuan (help_requests, status Baru)                    app.sigrak.com
  ▼
Support / Tim Lapangan in the console                            admin.sigrak.com/bank-masalah
  │ answers directly → help request Selesai (no problem, no Plane)
  │ or "Catat di Bank Masalah": new problem or link to an existing one
  │    staff write title + summary, pick kind, area, level
  │    masker preview shows exactly what Plane will receive
  ▼
problems (status triage) ── problem_reports ── help_requests (→ Diproses, reporter gets "Masukan Anda sudah kami catat")
  │ "Kirim ke papan" (or automatic, open question Q3)
  ▼
outbox: problem_plane_links.sync_status = pending ──► BullMQ queue `plane` (worker-default) ──► Plane API: create work item
                                                                                                │ state Masuk
Tim Lapangan → Tim Kurikulum & Riset → Forum Masalah→Solusi → Tim Produk move the card          │
  ▲                                                                                             ▼
reporter notified (Kabar + Web Push) ◄── problems.status updated ◄── job re-reads work item ◄── signed webhook (internal network)
                                                                    ◄── reconcile every 15 min (safety net)
```

| Step              | Who (D-439 team, D-339 role)                                                           | SIGRAK action                                                                      | Plane                                                                        |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Report         | School user                                                                            | `help_requests` row, status `new`                                                  | —                                                                            |
| 2. Triage         | Tim Lapangan: `support`, `sales`, `regional_lead`, `marketing` (+ `admin`, `owner`)    | Answer, or create/link a problem; merge duplicates; write masked title and summary | —                                                                            |
| 3. Send           | Same, permission `problems.triage`                                                     | Outbox row `pending`, job enqueued                                                 | Work item created in **Masuk**                                               |
| 4. Analyse        | Tim Kurikulum & Riset: `validator`, `content`, `curriculum`, `researcher` (new, D-439) | Read-only problem view; Bank Praktik Baik stays in SIGRAK                          | Moves to **Ditelaah**, **Akar masalah**, comments                            |
| 5. Decide         | Forum, owner decides                                                                   | —                                                                                  | **Antre prioritas** → **Dirancang**; priority, cycle, assignees set in Plane |
| 6. Build and ship | Tim Produk: `owner`, `engineer`                                                        | Release note text for reporters written in the console (optional)                  | **Dibangun** → **Uji coba** → **Rilis** → **Dievaluasi**                     |
| 7. Close the loop | System                                                                                 | Status mirrored, reporters notified, help requests set `done`                      | —                                                                            |

Field reports without a help request (school visits, webinars) are created in step 2 with `source = field` and no reporter rows.

## 3. The Plane side

### 3.1 Workspace, project, states

One workspace `sigrak`, one project **"Masalah→Solusi"**, identifier `MS` (cards show as `MS-12`). Bank Praktik Baik does not go to Plane. `node ace plane:setup` creates the states and labels below through the API if they are missing and stores their IDs in the settings (§8); `--check` only reports. Mapping is by Plane ID, so renaming a column in Plane does not break it.

| Plane state (D-440 column)       | Plane state group | `problems.status` |
| -------------------------------- | ----------------- | ----------------- |
| Masuk                            | backlog           | `received`        |
| Ditelaah                         | unstarted         | `reviewing`       |
| Akar masalah                     | unstarted         | `root_cause`      |
| Antre prioritas                  | unstarted         | `queued`          |
| Dirancang                        | started           | `designing`       |
| Dibangun                         | started           | `building`        |
| Uji coba                         | started           | `trial`           |
| Rilis                            | completed         | `released`        |
| Dievaluasi                       | completed         | `evaluated`       |
| Tidak dilanjutkan (proposed, Q2) | cancelled         | `not_pursued`     |

SIGRAK-only statuses: `triage` (in Bank Masalah, not yet on the board) and `merged` (duplicate; its reporters move to the target problem).

### 3.2 Work item fields

API: `POST /api/v1/workspaces/{slug}/projects/{project_id}/work-items/` with `X-API-Key` **[verify path: older CE releases use `/issues/`]**.

| Plane field                                    | Value                                                                                        | Owned by                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- |
| `name`                                         | `problems.title` (masked, ≤ 120 chars)                                                       | SIGRAK                           |
| `description_html`                             | Template below, every value HTML-escaped                                                     | SIGRAK                           |
| `labels`                                       | SIGRAK labels (below) merged with labels the team added in Plane                             | SIGRAK for its own prefixes only |
| `state`                                        | `Masuk` on create; afterwards never sent, except the one-time push after an off period (§10) | Plane                            |
| `priority`                                     | `none` on create, never sent again                                                           | Plane (forum)                    |
| `assignees`, cycles, modules, dates, estimates | not sent                                                                                     | Plane                            |
| `external_source`                              | `sigrak`                                                                                     | SIGRAK                           |
| `external_id`                                  | `problems.public_id` (UUIDv7)                                                                | SIGRAK                           |

SIGRAK labels (created by `plane:setup`, Indonesian because the teams read them):

| Prefix     | Values                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `sumber:`  | `bantuan` (help request), `lapangan` (field report), `masukan` if Q4 adds a feedback entry                         |
| `jenis:`   | `galat` (bug), `bingung` (confusing UI), `usulan` (request), `regulasi`, `konten`                                  |
| `bagian:`  | app area keys: `rpm`, `lkpd`, `bank-soal`, `quiz`, `tka`, `administrasi`, `ujian`, `akun`, `pembayaran`, `lainnya` |
| `jenjang:` | `sd`, `mi`                                                                                                         |
| `peran:`   | `guru`, `kepala-sekolah`, `operator`, `pengawas` (one per role among the reporters)                                |

Description template (Indonesian, plain HTML, no user text):

```html
<p><strong>Ringkasan:</strong> {summary}</p>
<ul>
    <li>Pelapor: {count} orang ({roles, e.g. "4 guru, 1 operator"})</li>
    <li>Jenjang: {SD|MI|SD dan MI}</li>
    <li>Wilayah: {kabupaten/kota, or "beberapa wilayah"}</li>
    <li>Pertama dicatat: {dd/mm/yyyy}</li>
</ul>
<p><a href="https://admin.sigrak.com/bank-masalah/{public_id}">Buka di konsol SIGRAK</a></p>
```

The link points at `admin.` behind Cloudflare Access (`SIGRAK admin`), so it opens only for staff who also pass the console's permission check.

## 4. What goes to Plane, and what never does

| Sent                                                                       | Never sent                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Staff-written title and summary, after the masker                          | The help request body or any text the user typed                                     |
| Reporter **role counts** (guru, kepala sekolah, operator, pengawas)        | Names of users, pupils, parents, staff; email, phone, WhatsApp                       |
| Level (SD/MI)                                                              | NIK, KK, NISN, NPSN, NSM, NIP, NUPTK                                                 |
| **Kabupaten/kota** of the reporters; "beberapa wilayah" when more than one | School name, school address, kecamatan or desa (unless Q1 decides otherwise)         |
| Kind, area, source labels; first-reported date                             | User IDs, school IDs, sequential IDs, screenshots, attachments                       |
| Link to `admin.sigrak.com/bank-masalah/{public_id}`                        | Anything from student records (the console never shows them, `internal-roles.md` §3) |

Rules:

1. **Region granularity.** "District" in D-440 is sent as kabupaten/kota. Kecamatan combined with level and role can point at one school when few schools in it use SIGRAK; Q1 asks whether to send kecamatan when at least 5 active schools there use SIGRAK (the "<5" rule of D-437).
2. **Masker, shared with the chatbot (D-393).** One module, `app/services/privacy/masker.ts`, used by the chatbot and here. Pattern pass: digit runs of NIK/KK (16), NSM (12), NISN (10), NPSN (8), NIP (18) and NUPTK (16), in any spacing; phone numbers (`08…`, `628…`, `+62…`, with spaces, dots or hyphens); emails; URLs with query strings. Context pass: names from the reporter's own context, looked up on the server and never sent (reporter name, their school's name and NPSN, staff names of that school, the triaging staff member's name), matched case- and accent-insensitively. Replacements are fixed tokens: `[NAMA]`, `[SEKOLAH]`, `[NOMOR]`, `[TELEPON]`, `[EMAIL]`, `[TAUTAN]`.
3. **Fail closed.** After masking, a residual check looks for any run of 8+ digits, an `@`, a `wa.me` link or a word from the context list. A hit sets `sync_status = blocked_personal_data`; nothing is sent until staff edit the text.
4. **Stored masked.** `problems.title` and `problems.summary` are masked on save, so exports and Plane hold the same safe text. The raw text stays only in `help_requests.body`, under the help-request rules.
5. **Preview.** The triage form shows the exact `name` and description Plane will receive before "Kirim ke papan".

How masking is tested: §13, groups A and B.

## 5. Worker job

All Plane calls run on **`worker-default`**, queue **`plane`**, so one limiter covers the one API key. The database outbox (`problem_plane_links`) is the queue of record; BullMQ only executes. If Redis is lost, `plane.sweep` re-enqueues every `pending` or `retrying` row.

| Job               | Trigger                                                                                | Does                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `plane.push`      | Problem sent, title/summary/labels/reporter count changed (debounced 60 s per problem) | Create or update the work item for `{problem_id, revision}`                               |
| `plane.apply`     | A stored webhook delivery (§6)                                                         | Re-read the work item, map its state, update SIGRAK, queue notifications                  |
| `plane.reconcile` | Scheduler every 15 min (every 2 min in polling-only mode, Q6)                          | List work items with `external_source = sigrak` updated since the cursor; apply any drift |
| `plane.sweep`     | Scheduler every 5 min, and on "Kirim yang tertunda"                                    | Enqueue outbox rows whose next attempt is due                                             |
| `plane.check`     | "Coba koneksi" button, `node ace plane:setup --check`, daily                           | Key valid, project exists, every mapped state and label exists                            |

Queue settings:

| Setting         | Value                                                                      | Why                                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrency     | 1                                                                          | Keeps ordering per problem simple; volume is small                                                                                                                                        |
| Limiter         | 50 requests per 60 s                                                       | Plane allows 60 per minute per API key (`X-RateLimit-Remaining`, `X-RateLimit-Reset`) **[verify CE default; CE reads `API_KEY_RATE_LIMIT`]**; 10 left for `plane:setup` and manual checks |
| HTTP timeout    | 10 s                                                                       |                                                                                                                                                                                           |
| Attempts        | 8, backoff 30 s, 1 min, 2 min, 5 min, 15 min, 30 min, 1 h, 1 h (about 3 h) | Then `failed`                                                                                                                                                                             |
| Circuit breaker | 5 network errors in a row → queue paused 10 min, health card shows it      | Plane down must not burn attempts                                                                                                                                                         |

Response handling:

| Plane answer                                           | Outcome                                                                     | `sync_status`                |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------- |
| 2xx                                                    | Store `plane_work_item_id`, `plane_sequence_id`, `plane_updated_at`         | `synced`                     |
| 409 on create (same `external_id` + `external_source`) | Adopt the returned ID, then update **[verify: CE returns the existing ID]** | `synced`                     |
| 429                                                    | Delay until `X-RateLimit-Reset` + jitter; attempt not counted               | `retrying`                   |
| 5xx, timeout, connection refused                       | Retry with backoff; counts toward the breaker                               | `retrying`                   |
| 400, 422                                               | No retry; error code stored                                                 | `failed` (`invalid_payload`) |
| 401, 403                                               | No retry; queue paused; health card and audit entry                         | `failed` (`auth`)            |
| 404 on update                                          | Work item deleted in Plane                                                  | `remote_missing`             |

**Idempotency** (layers, each enough on its own for its case):

1. BullMQ `jobId` = `plane-push:{public_id}:r{revision}`: a double click or double enqueue is one job.
2. `revision` on the problem; a job older than the stored `content_revision` exits without calling Plane.
3. Plane `external_source = sigrak`, `external_id = public_id`: before a create that follows a failed or timed-out attempt, look up `GET …/work-items/?external_id=…&external_source=sigrak` **[verify filter]**; a create that races still gets 409.
4. `plane.apply` writes only when the work item's `updated_at` is newer than `plane_updated_at`, so order and repeats do not matter.

Failure states in the admin panel (problem list column and detail page; status chip = text + colour, D-263):

| `sync_status`           | Chip text                       | Colour | Action offered (permission `problems.sync`) |
| ----------------------- | ------------------------------- | ------ | ------------------------------------------- |
| `off`                   | Plane tidak dipakai             | grey   | —                                           |
| `pending`               | Menunggu dikirim                | grey   | —                                           |
| `retrying`              | Dicoba lagi pukul {time} WIB    | info   | Kirim sekarang                              |
| `synced`                | Di papan · MS-{n}               | ok     | Buka di Plane                               |
| `blocked_personal_data` | Ditahan: masih ada data pribadi | warn   | Ubah ringkasan                              |
| `failed`                | Gagal dikirim: {plain reason}   | danger | Kirim ulang                                 |
| `remote_missing`        | Kartu di papan sudah dihapus    | warn   | Buat ulang di papan                         |

Kesehatan Sistem (D-316) gets one Plane card: integration on/off, last successful call, last webhook received, queue size, failed count, breaker state, and "Webhook Plane mungkin mati" when reconcile finds changes no webhook announced. Plane's own uptime stays with Uptime Kuma (D-426).

## 6. Webhook endpoint

One route, `POST /internal/plane/webhooks` (route name `internal.plane.webhooks`), served only on the internal host `sigrak-hooks`. Not a user-facing path, so it stays English.

### 6.1 Reachability: internal network only

| Layer      | Rule                                                                                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker     | External network `sigrak-plane-net`, created by `sigrak-setup.sh`. Joined by Plane's API and background worker containers **[verify CE service names: `api`, `worker`]** and by SIGRAK's `worker-default` (outgoing calls) and nginx (incoming hooks). `docker compose down` in `sigrak-plane` leaves the network |
| nginx      | A separate `server` block, `server_name sigrak-hooks`, listening only on the nginx container's address on `sigrak-plane-net`; it proxies only `POST /internal/plane/webhooks`, everything else 404; `client_max_body_size 256k`                                                                                   |
| Cloudflare | No tunnel ingress rule for `sigrak-hooks`; public server blocks (`app.`, `admin.`, `ujian.`, `sigrak.com`) have no location for `/internal/`                                                                                                                                                                      |
| App        | Route bound to the `sigrak-hooks` domain (`router.….domain()`), plus middleware: source address inside `PLANE_WEBHOOK_ALLOWED_CIDRS`, else 404                                                                                                                                                                    |
| Rate       | 120 requests per minute per source; above that 429                                                                                                                                                                                                                                                                |

**Risk [verify first]:** Plane validates webhook URLs and may refuse private or internal addresses (SSRF protection). If the pinned CE version refuses `http://sigrak-hooks:8090/…`, there is no inbound endpoint at all: `plane.reconcile` runs every 2 minutes as the only way in (Q6). The rest of this design is unchanged.

### 6.2 Verification and replay protection

Plane sends `X-Plane-Signature` (hex HMAC-SHA256 of the raw body with the webhook secret), `X-Plane-Delivery` (UUID per attempt) and `X-Plane-Event`; newer payloads also carry `event_id`, stable across retries **[verify header names and payload shape: CE has used `{event, action, data, activity}`, the current docs show `{version, event_id, delivery_id, entity_type, entity_id, data, previous_attributes}`]**. Plane sends no timestamp, so replay protection rests on deduplication and on not trusting the body.

Handler, in order:

1. Read the raw body (bodyparser keeps it; never re-serialise JSON for the HMAC).
2. Compute HMAC-SHA256 with the active secret, and with the previous secret during a rotation window (24 h); compare with `crypto.timingSafeEqual` after a length check. Missing or wrong → 401, `plane_webhook_deliveries.outcome = rejected_signature`, audit entry, nothing else.
3. Parse; accept only work item events for the configured workspace and project. Anything else → 200, `ignored`.
4. Insert into `plane_webhook_deliveries` with unique `dedupe_key` = `event_id` or, when absent, the delivery ID. Conflict → 200, `duplicate`.
5. Enqueue `plane.apply` (`jobId` = `dedupe_key`) and answer **202** within a second. No database work beyond the insert.
6. `plane.apply` ignores the body's state: it fetches the work item by ID from the API and applies it only if its `updated_at` is newer than the stored one. A replayed, reordered or late delivery can therefore only cause a harmless re-read.

Plane does not retry 4xx and may disable a webhook after repeated failures without queueing events **[verify for CE]**; reconcile closes that gap. Delivery rows keep no body and are pruned after 30 days.

## 7. Status mapping and notifications

Reporters see a short stage on their help request (Akun > Minta Bantuan), not the nine columns. A reporter is notified only the first time their problem reaches a higher stage; moving back on the board never notifies. Notifications are a Kabar plus Web Push when enabled (D-397); push waits until 06.00 WIB when the change happens between 21.00 and 06.00. A notification replaces the generic D-320 status-change Kabar, so the reporter never gets two for one change.

| Plane state       | `problems.status` | Reporter stage (chip)    | Notify                             | Help request             |
| ----------------- | ----------------- | ------------------------ | ---------------------------------- | ------------------------ |
| (none yet)        | `triage`          | Dicatat (grey)           | yes, on linking: `received`        | `in_progress` (Diproses) |
| Masuk             | `received`        | Dicatat (grey)           | no                                 | Diproses                 |
| Ditelaah          | `reviewing`       | Dipelajari (info)        | yes: `reviewing`                   | Diproses                 |
| Akar masalah      | `root_cause`      | Dipelajari (info)        | no                                 | Diproses                 |
| Antre prioritas   | `queued`          | Dipelajari (info)        | no                                 | Diproses                 |
| Dirancang         | `designing`       | Direncanakan (info)      | yes: `planned`                     | Diproses                 |
| Dibangun          | `building`        | Sedang dibuat (info)     | no                                 | Diproses                 |
| Uji coba          | `trial`           | Sedang dibuat (info)     | no                                 | Diproses                 |
| Rilis             | `released`        | Sudah tersedia (ok)      | yes: `released`                    | `done` (Selesai)         |
| Dievaluasi        | `evaluated`       | Sudah tersedia (ok)      | no                                 | Selesai                  |
| Tidak dilanjutkan | `not_pursued`     | Tidak dilanjutkan (grey) | yes: `not_pursued` (Q2)            | Selesai                  |
| unknown state ID  | unchanged         | unchanged                | no; health card warns, audit entry | unchanged                |

Copy keys (`resources/lang/id/problems.json`; keys English, text plain Indonesian; to be checked with `bahasa-indonesia-plain` when built):

| Key                                                                                                                | Text                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `notify.received.title`                                                                                            | Masukan Anda sudah kami catat                                                                                            |
| `notify.received.body`                                                                                             | Terima kasih. Tim SIGRAK sudah mencatat masalah ini dan akan memberi kabar setiap ada perkembangan.                      |
| `notify.reviewing.title`                                                                                           | Masukan Anda sedang kami pelajari                                                                                        |
| `notify.reviewing.body`                                                                                            | Tim kami sedang mencari tahu penyebabnya. Anda tidak perlu melakukan apa-apa.                                            |
| `notify.planned.title`                                                                                             | Perbaikannya sudah direncanakan                                                                                          |
| `notify.planned.body`                                                                                              | Masalah yang Anda laporkan masuk rencana kerja kami. Kami kabari lagi saat sudah bisa dipakai.                           |
| `notify.released.title`                                                                                            | Sudah bisa dipakai                                                                                                       |
| `notify.released.body`                                                                                             | Masalah yang Anda laporkan sudah kami selesaikan. Silakan coba lagi. Kalau masih ada kendala, kirim lewat Minta Bantuan. |
| `notify.released.note`                                                                                             | Catatan dari Tim SIGRAK: {note}                                                                                          |
| `notify.not_pursued.title`                                                                                         | Masukan Anda belum bisa kami kerjakan                                                                                    |
| `notify.not_pursued.body`                                                                                          | Terima kasih sudah memberi tahu kami. Untuk saat ini kami belum bisa mengerjakannya. {reason}                            |
| `stage.received` / `stage.reviewing` / `stage.planned` / `stage.building` / `stage.released` / `stage.not_pursued` | Dicatat / Dipelajari / Direncanakan / Sedang dibuat / Sudah tersedia / Tidak dilanjutkan                                 |
| `reason.out_of_scope`                                                                                              | Hal ini di luar yang dikerjakan SIGRAK saat ini.                                                                         |
| `reason.policy`                                                                                                    | Aturan resmi yang berlaku belum memungkinkan.                                                                            |
| `reason.later`                                                                                                     | Kami simpan untuk dipertimbangkan lagi nanti.                                                                            |

`{note}` is written by staff in the console (problem field `release_note`), never taken from Plane. `{reason}` is chosen from the list above.

## 8. Settings (Fondasi F-005, D-431)

Env wins; when the env value is empty the admin panel's value is used ("Diatur oleh server" when env is set; secrets shown as `••••` + last 4, never shown again after saving). Panel page: `admin.sigrak.com/pengaturan/integrasi/plane`, permission `integrations.plane.manage` (owner, admin). "Coba koneksi" runs `plane.check` and reports in plain Indonesian.

| Setting              | Env name                         | Panel                                                         | Secret  | Notes                                                                                                                                                      |
| -------------------- | -------------------------------- | ------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master switch        | `PLANE_ENABLED` (`true`/`false`) | toggle "Integrasi Plane aktif"                                | no      | `false` in env forces off and hides the toggle, like `AI_ENABLED`                                                                                          |
| API base URL         | `PLANE_BASE_URL`                 | yes                                                           | no      | Internal URL on `sigrak-plane-net` (e.g. `http://plane-proxy`), not `plane.sigrak.com`, which sits behind Access **[verify CE accepts the internal Host]** |
| Workspace slug       | `PLANE_WORKSPACE_SLUG`           | yes                                                           | no      | `sigrak`                                                                                                                                                   |
| Project ID           | `PLANE_PROJECT_ID`               | yes                                                           | no      | Filled by `plane:setup`                                                                                                                                    |
| API key              | `PLANE_API_KEY`                  | yes, encrypted                                                | **yes** | Key of a dedicated Plane user "SIGRAK Bot", member of the one project only                                                                                 |
| Webhook secret       | `PLANE_WEBHOOK_SECRET`           | yes, encrypted, with "Ganti rahasia" (keeps the old one 24 h) | **yes** | Copied from Plane when the webhook is created                                                                                                              |
| Allowed source CIDRs | `PLANE_WEBHOOK_ALLOWED_CIDRS`    | no (env only)                                                 | no      | The subnet of `sigrak-plane-net`; infrastructure, not a panel setting                                                                                      |
| State and label map  | —                                | read-only list, "Muat ulang dari Plane"                       | no      | Stored by `plane:setup`; not editable by hand                                                                                                              |
| Polling-only mode    | —                                | toggle (shown only if Q6 applies)                             | no      | Reconcile every 2 min, endpoint off                                                                                                                        |

Staging and production use separate keys and secrets (F-005); staging either points at its own Plane project or runs with the integration off (Q7). `APP_KEY` encrypts the panel secrets; it stays in env (D-431).

## 9. Audit log

Entries follow F-013 §4: who, when, what, before/after with secrets masked; read in Indonesian; not editable. The system actor is shown as "Sistem SIGRAK"; Plane actors are stored as the Plane user ID only.

| Event key                                  | Actor                                                              | Example in the console                                              |
| ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `integrations.plane.settings_updated`      | staff                                                              | Rina mengubah alamat Plane (rahasia tidak ditampilkan)              |
| `integrations.plane.enabled` / `.disabled` | staff                                                              | Rina mematikan integrasi Plane                                      |
| `integrations.plane.secret_rotated`        | staff                                                              | Rina mengganti rahasia webhook Plane                                |
| `problems.created`                         | staff                                                              | Dani mencatat masalah BM-0042 dari permintaan bantuan               |
| `problems.updated`                         | staff                                                              | Dani mengubah ringkasan BM-0042 (before/after, masked text only)    |
| `problems.report_linked` / `.merged`       | staff                                                              | Dani menggabungkan BM-0045 ke BM-0042                               |
| `problems.sent_to_board`                   | staff                                                              | Dani mengirim BM-0042 ke papan                                      |
| `problems.sync_failed`                     | system                                                             | Pengiriman BM-0042 ke papan gagal: kunci API ditolak                |
| `problems.sync_blocked`                    | system                                                             | BM-0042 ditahan: masih ada data pribadi                             |
| `problems.resync_requested`                | staff                                                              | Teknis meminta kirim ulang BM-0042                                  |
| `problems.status_changed`                  | system (source `plane`, Plane user ID) or staff (source `console`) | Status BM-0042 berubah dari Dirancang menjadi Dibangun (dari Plane) |
| `problems.reporters_notified`              | system                                                             | 7 pelapor BM-0042 diberi kabar: Sudah bisa dipakai                  |
| `integrations.plane.webhook_rejected`      | system                                                             | Kiriman webhook ditolak: tanda tangan tidak cocok                   |
| `problems.exported`                        | staff                                                              | Rina mengunduh Bank Masalah (Excel)                                 |

Application logs carry IDs only (problem public ID, work item ID, delivery ID, HTTP status), never title, summary or body (F-013 §3).

## 10. Switching Plane off

| Situation                              | How                                                         | What SIGRAK does                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integration off                        | Panel toggle or `PLANE_ENABLED=false`                       | No jobs enqueued; the webhook route answers 404; new problems get `sync_status = off`; the console status selector becomes editable (source `console`); reporters notified the same way. Users see no difference                  |
| Plane down while the integration is on | `docker compose down` in `sigrak-plane`, or a crash         | Jobs fail on the network, the breaker pauses the queue, rows stay `retrying`/`pending` (the queue holds); health card says "Plane tidak bisa dihubungi sejak {time}". Nothing user-facing depends on Plane                        |
| Back on                                | Toggle on / Plane up                                        | `plane.sweep` sends what waited; problems whose status changed in the console while off get a one-time `state` push to Plane (only time SIGRAK writes `state`); `plane.reconcile` runs at once; status ownership returns to Plane |
| Removed for good                       | Export (below), then toggle off, then `docker compose down` | Bank Masalah keeps working on console statuses; `problem_plane_links` stays as history                                                                                                                                            |

The owner's recommended order before a long stop: toggle off in the panel first, so no alerts fire, then stop the Compose project.

Export:

| What                        | How                                                                                                                                         | Format                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bank Masalah (the record)   | Console "Unduh Bank Masalah", `worker-exports`                                                                                              | Excel/CSV, Indonesian headings (D-150): Kode, Judul, Ringkasan, Jenis, Bagian aplikasi, Jenjang, Kabupaten/Kota, Jumlah pelapor, Status, Tanggal dicatat, Tanggal rilis, Nomor kartu Plane; second sheet Riwayat status. Reporters are not in the export (counts only) |
| Plane board, before removal | `node ace plane:export`: all `external_source = sigrak` work items with state, labels, dates and comments                                   | JSON + CSV on the VPS disk next to the backups (comments hold staff names)                                                                                                                                                                                             |
| Plane itself                | Plane's built-in workspace export **[verify CE formats]**; Plane's PostgreSQL and object-store volumes stay in the Backrest backups (D-430) | as Plane provides                                                                                                                                                                                                                                                      |

## 11. Data model additions

All English, plural snake_case (CONTEXT conventions). Plane-specific columns sit in their own table so the board can be removed without touching `problems`.

| Table                      | Columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Notes                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `problems`                 | `id`, `public_id` (UUIDv7, unique), `number` (int, unique; shown `BM-0042`), `title` varchar(120) masked, `summary` text masked, `kind` ∈ {`bug`,`confusion`,`request`,`regulation`,`content`}, `area` varchar(30), `level` ∈ {`sd`,`mi`,`both`}, `region_id` FK `regions` nullable (kabupaten/kota; NULL = several), `source` ∈ {`help_request`,`field`}, `status` ∈ {`triage`,`received`,`reviewing`,`root_cause`,`queued`,`designing`,`building`,`trial`,`released`,`evaluated`,`not_pursued`,`merged`}, `status_changed_at`, `merged_into_id` FK `problems` nullable, `not_pursued_reason` nullable, `release_note` text nullable, `reporter_count` int, `content_revision` int, `created_by_staff_id` FK `staff_users`, timestamps | CHECK `merged_into_id IS NOT NULL` ⇔ `status = 'merged'`. No user or school columns                                                                                |
| `problem_reports`          | `id`, `problem_id` FK CASCADE, `help_request_id` FK nullable, `user_id` FK nullable, `reporter_role` ∈ {`teacher`,`principal`,`operator`,`supervisor`}, `school_id` FK nullable, `notify` bool default true, `last_notified_stage` nullable, `created_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Unique (`problem_id`, `user_id`). Never leaves SIGRAK. When an account is deleted the row's `user_id`, `school_id`, `help_request_id` are cleared; the count stays |
| `problem_status_events`    | `id`, `problem_id` FK, `from_status`, `to_status`, `source` ∈ {`plane`,`console`,`system`}, `actor_staff_id` nullable, `plane_actor_id` nullable, `plane_event_key` nullable, `occurred_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Append-only; feeds Riwayat status and time-to-release figures for the forum                                                                                        |
| `problem_plane_links`      | `problem_id` PK/FK, `plane_work_item_id` uuid unique nullable, `plane_sequence_id` int nullable, `plane_state_id` uuid nullable, `plane_updated_at` timestamptz nullable, `sync_status` ∈ {`off`,`pending`,`retrying`,`synced`,`failed`,`blocked_personal_data`,`remote_missing`}, `synced_revision` int, `attempts` int, `next_attempt_at` nullable, `last_error_code` varchar(40) nullable, `synced_at` nullable, `state_push_pending` bool                                                                                                                                                                                                                                                                                           | The outbox. Index on (`sync_status`, `next_attempt_at`)                                                                                                            |
| `plane_webhook_deliveries` | `id`, `dedupe_key` varchar(64) unique, `delivery_id` uuid, `event` varchar(60), `work_item_id` uuid nullable, `outcome` ∈ {`queued`,`applied`,`stale`,`duplicate`,`ignored`,`rejected_signature`,`rejected_source`}, `received_at`, `processed_at` nullable                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | No body stored; pruned after 30 days by the scheduler                                                                                                              |
| `plane_sync_cursors`       | `name` PK (`reconcile`), `cursor_at` timestamptz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Reconcile position                                                                                                                                                 |
| Settings store (R2, D-431) | keys `plane.enabled`, `plane.base_url`, `plane.workspace_slug`, `plane.project_id`, `plane.api_key` (enc), `plane.webhook_secret` (enc), `plane.webhook_secret_previous` (enc, expires), `plane.state_map`, `plane.label_map`, `plane.polling_only`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Same store as mail and other integrations                                                                                                                          |

Permissions (permission-based checks, F-013): `problems.view` (all Tim SIGRAK roles except `finance`), `problems.triage` (`owner`, `admin`, `support`, `sales`, `regional_lead`, `marketing`), `problems.sync` (`owner`, `admin`, `engineer`), `problems.export` (`owner`, `admin`), `integrations.plane.manage` (`owner`, `admin`). Sales and regional leads see only problems with reports from schools in their scope (D-338). Console routes: `/bank-masalah` (`problems.index`), `/bank-masalah/{problem}` (`problems.show`), `/pengaturan/integrasi/plane` (`settings.integrations.plane`).

## 12. Build order

1. Masker module and its test corpus (shared with the chatbot task; build here if this lands first).
2. `problems`, `problem_reports`, `problem_status_events`, console pages, notifications, export: Bank Masalah works with Plane off.
3. `problem_plane_links`, settings page, `plane:setup`, `plane.push`, `plane.check`, health card.
4. `plane.reconcile` (works with or without webhooks).
5. Internal network, nginx `sigrak-hooks` block, webhook route, `plane.apply`.
6. Contract test against the pinned Plane CE image; R3 adds the network to `sigrak-setup.sh` and the `sigrak-plane` Compose project.

## 13. Tests (Japa)

| Group                                   | Tests                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Masker (unit)                        | Each pattern in all spellings (`3319 0123 4567 0001`, `0812-3456-7890`, `+62 812…`, `62812…`, NISN with dots); context names incl. single-word names, case and diacritics; no false hit on dates, money (`Rp1.250.000`), JP counts, curriculum codes; residual check blocks what the patterns miss. Corpus in `tests/fixtures/masker/` with invented people only |
| B. No-leak (unit + integration)         | Payload builder snapshot; a canary set (reporter name, school name, NPSN, NISN, phone, email) seeded into a help request and its context must not appear in any byte the fake Plane server receives over a full flow (create, update, reporter added, merge); HTML escaping of title and summary                                                                 |
| C. Push job (fake Plane HTTP server)    | Create; update; 409 adopt; lookup after timeout; 429 waits for reset without using an attempt; 5xx backoff; 400/401/403/404 outcomes; breaker opens and closes; stale revision skips; label merge keeps Plane-added labels; `state` and `priority` never sent except the one-time push                                                                           |
| D. Webhook endpoint (functional)        | Valid signature 202; wrong, missing, truncated signature 401 with audit; previous secret accepted only in the rotation window; duplicate 200 no-op; other workspace/project 200 ignored; body over 256 KB 413; wrong Host or source address 404; route absent on `app.`, `admin.`, `ujian.` hosts; integration off 404                                           |
| E. Apply and status mapping (unit)      | Every mapped state; unknown state ignored with warning; older `updated_at` ignored; out-of-order deliveries end in the latest state                                                                                                                                                                                                                              |
| F. Notifications                        | One per stage per reporter; no notification on moving back; `notify = false` respected; push held in quiet hours; replaces the D-320 Kabar; every `problems.*` key exists in `id`                                                                                                                                                                                |
| G. Reconcile                            | Picks up changes without webhooks; cursor advances; drift warning on the health card                                                                                                                                                                                                                                                                             |
| H. Switch-off                           | Integration off: triage, console status edits, notifications and export work, no job enqueued, no outbound request; Plane unreachable: user pages and console respond normally; re-enable sends pending rows and the one-time state push                                                                                                                         |
| I. Permissions                          | Each permission allowed and denied (F-013 §9); scope filter for sales and regional leads; settings page owner/admin only                                                                                                                                                                                                                                         |
| J. Audit and logs                       | Each §9 event written; secrets never in audit, logs or panel after save; log lines carry IDs only                                                                                                                                                                                                                                                                |
| K. Export                               | Indonesian headings and values (D-150); no reporter identities                                                                                                                                                                                                                                                                                                   |
| L. Contract (manual and nightly CI job) | Against the pinned Plane CE image: auth header, work item create/update/get paths, `external_id` filter and 409, states and labels endpoints, rate-limit headers, webhook headers, signature and payload shape, private-URL acceptance (§6.1)                                                                                                                    |

## 14. Open questions for the owner

| #   | Question                                                                                                                   | Proposal                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Q1  | D-440 says "district". Send kabupaten/kota only, or also kecamatan?                                                        | Kabupaten/kota; kecamatan only where at least 5 active schools use SIGRAK              |
| Q2  | Add a tenth column "Tidak dilanjutkan" (cancelled) to the nine of D-440, and tell reporters when a problem is not pursued? | Yes to both, with a reason chosen from a short list                                    |
| Q3  | Does a triaged problem go to the board automatically, or does someone press "Kirim ke papan"?                              | Triage staff press it after the masked preview                                         |
| Q4  | Keep only Minta Bantuan as the entry, or add a separate "Kirim Masukan" for ideas?                                         | Minta Bantuan only for the pilot; add later if ideas get lost among help requests      |
| Q5  | Which stages notify the reporter?                                                                                          | Dicatat, Dipelajari, Direncanakan, Sudah tersedia, Tidak dilanjutkan; not every column |
| Q6  | If Plane CE refuses webhook URLs on the internal network, accept polling every 2 minutes with no inbound endpoint at all?  | Yes; it is simpler and has no inbound surface                                          |
| Q7  | Staging: its own Plane project, or the integration off on staging?                                                         | Off by default; a separate project only when the integration itself is being changed   |
| Q8  | Should anything from Plane comments ever come back into SIGRAK (for example the release note)?                             | No; the release note is written in the console, Plane comments stay in Plane           |
