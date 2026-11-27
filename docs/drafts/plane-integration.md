# Plane integration: Bank Masalah to the board and back (RS-07)

**Status:** draft for the owner, revised to the owner's answers (D-453, D-454, D-455) · **Date:** 2026-11-28 · **Task:** RS-07 · **Builds on:** D-453, D-454 and D-455 (owner's answers), D-439 (teams, Bank Masalah, forum), D-440 (Plane CE, switchable, masked worker calls, one signed internal endpoint), D-393 (masker), D-444 and D-446 (agreements held outside the repository), D-425 ("SIGRAK ops"), D-388 (process roles), D-320 (help-request status), D-431 and Fondasi F-005 (settings), Fondasi F-013 `web-baseline.md` (security, personal data, audit log), D-443/D-446 (no AI involved here)

Plane API and webhook details below come from Plane's developer docs (developers.plane.so, read 2026-11-27) and from what Plane CE has shipped so far. Every item marked **[verify]** must be checked against the Plane CE version pinned in `sigrak-plane` before the code is written; a contract test (§13) keeps it checked afterwards.

## 1. Summary

- **SIGRAK is the record; Plane is the board.** Problems, reporters, status history and every notification live in SIGRAK. Plane holds a copy for the teams to move through the ten columns (D-440, D-453). Turning Plane off loses no record.
- **Two entries for users.** Minta Bantuan for things that do not work, Kirim Masukan for ideas (D-453). Both land in one triage inbox, marked by kind (§2.1).
- **Nothing a user typed goes to Plane.** Tim Lapangan writes the problem's title and summary in their own words in the console; a light masking pass removes NIK and phone numbers (D-454, D-455, §4). The payload carries that text, role counts, level, school names, kecamatan and kabupaten/kota, and a link to the admin record.
- **Staff decide what goes to the board.** A problem reaches Plane only when triage staff press "Kirim ke papan" under the preview (D-453). Later edits to a problem already on the board update its card.
- **One way out, one way in.** Out: a `worker-default` job calls the Plane API from an outbox row, rate-limited and idempotent. In: one HMAC-signed webhook endpoint reachable only on a Docker network shared with Plane; it never trusts the payload and re-reads the work item from the API, and a scheduled reconcile covers lost webhooks. If the pinned Plane CE refuses internal webhook URLs, there is no inbound endpoint and SIGRAK polls every 2 minutes instead (§6.3).
- **Only the column comes back.** SIGRAK reads a card's state and nothing else: no comments, description edits, assignees or labels (D-453). Release notes and not-pursued reasons are written in the console.
- **Reporters hear about each stage they can see**, one notice per change, none when a card moves back (§7).
- **Off on staging by default** (D-453, §8).
- **No AI.** The flow calls no AI provider (D-443, D-446 do not apply beyond the shared masker).
- **No public API** (D-440): the webhook endpoint is not routed through nginx's public hosts or Cloudflare.

## 2. Flow

```text
Teacher / principal / operator / supervisor
  │ Minta Bantuan (kind help) or Kirim Masukan (kind idea)       app.sigrak.com
  │ → help_requests, status Baru
  ▼
Tim Lapangan in the console                                     admin.sigrak.com/bank-masalah
  │ answers directly → Selesai (no problem, no Plane)
  │ or "Catat di Bank Masalah": new problem or link to an existing one
  │    staff write title + summary, pick kind, area, level (and places for field reports)
  │    preview shows exactly what Plane will receive
  ▼
problems (status triage) ── problem_reports ── help_requests (→ Diproses, reporter told "Sudah kami catat")
  │ "Kirim ke papan" (staff, under the preview; never automatic)
  ▼
outbox: problem_plane_links.sync_status = pending ──► BullMQ queue `plane` (worker-default) ──► Plane API: create work item
                                                                                                │ state Masuk
Teams move the card; comments stay in Plane                                                     │
  ▲                                                                                             ▼
reporter told at each visible stage ◄── problems.status updated ◄── job re-reads the state ◄── signed webhook (internal network, webhook mode)
                                                                 ◄── reconcile: every 15 min (webhook mode)
                                                                                or every 2 min, the only way in (polling mode)
```

| Step              | Who (D-439 team, D-339 role)                                                           | SIGRAK action                                                                                                                | Plane                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1. Report         | School user                                                                            | `help_requests` row, kind `help` (Minta Bantuan) or `idea` (Kirim Masukan), status `new`                                     | —                                                                                                      |
| 2. Triage         | Tim Lapangan: `support`, `sales`, `regional_lead`, `marketing` (+ `admin`, `owner`)    | Answer, or create/link a problem; fix the kind if the user picked the wrong entry; merge duplicates; write title and summary | —                                                                                                      |
| 3. Send           | Same, permission `problems.triage`                                                     | Check the preview, press "Kirim ke papan": outbox row `pending`, job enqueued                                                | Work item created in **Masuk**                                                                         |
| 4. Analyse        | Tim Kurikulum & Riset: `validator`, `content`, `curriculum`, `researcher` (new, D-439) | Read-only problem view; Bank Praktik Baik stays in SIGRAK                                                                    | Moves to **Ditelaah**, **Akar masalah**; comments stay in Plane                                        |
| 5. Decide         | Forum, owner decides                                                                   | When not pursued: staff pick the reason in the console (§7.2)                                                                | **Antre prioritas** → **Dirancang**, or **Tidak dilanjutkan**; priority, cycle, assignees set in Plane |
| 6. Build and ship | Tim Produk: `owner`, `engineer`                                                        | Release note text for reporters written in the console (optional)                                                            | **Dibangun** → **Uji coba** → **Rilis** → **Dievaluasi**                                               |
| 7. Close the loop | System                                                                                 | Status mirrored, reporters told at each visible stage, help requests set `done`                                              | —                                                                                                      |

Field reports without a help request (school visits, webinars) are created in step 2 with `source = field`, places (kecamatan, optionally a school) picked by staff, and no reporter rows.

### 2.1 Kirim Masukan: ideas next to Minta Bantuan

From the pilot on, users have two entries (D-453). Paths are proposals; check them against the user routes when built.

| Item                 | Minta Bantuan                                                                 | Kirim Masukan                                                                                           |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| For                  | Something does not work or is unclear; the user wants help                    | An idea to make SIGRAK better                                                                           |
| Where                | Account menu (profile icon) > Minta Bantuan, `/minta-bantuan`                 | Account menu > Kirim Masukan, right below Minta Bantuan, `/kirim-masukan`; each page links to the other |
| Who                  | Teachers, principals, operators, pengawas (D-320)                             | The same users                                                                                          |
| Stored as            | `help_requests.kind = help`                                                   | `help_requests.kind = idea`                                                                             |
| Status the user sees | Baru, Diproses, Selesai (D-320); the stage chip (§7) once linked to a problem | Terkirim; the stage chip once recorded in Bank Masalah; Sudah dijawab when staff answer directly        |
| Problem `source`     | `help_request`                                                                | `idea`                                                                                                  |
| Plane labels         | `sumber:bantuan`, kind as triaged                                             | `sumber:masukan`, usually `jenis:usulan`                                                                |

Kirim Masukan form (role and school come from the session, not the form):

| Field            | Column (`help_requests`)         | Rules                                                                        |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Bagian aplikasi  | `area`                           | Required; same keys as the `bagian:` labels (§3.2)                           |
| Ide Anda         | `body`                           | Required, 20 to 2,000 characters                                             |
| Manfaat          | `benefit`                        | Optional, up to 1,000 characters                                             |
| Gambar pendukung | existing help-request attachment | Optional, one JPG or PNG up to 2 MB, F-013 upload rules; never sent to Plane |

How triage tells an idea from a help request:

- The inbox shows a **Jenis** chip, "Bantuan" or "Masukan" (text + colour, D-263), with filter tabs "Semua", "Bantuan", "Masukan".
- The kind comes from the entry the user chose. Rule of thumb: an idea asks for something new or different; a help request reports something that does not work as expected. When a user chose the wrong entry, staff press "Ubah jenis" (audited); the user's chips switch to the other kind.
- Outcomes for an idea: record it in Bank Masalah (default kind `request`), link it to an existing problem, or answer directly (for example when the feature already exists). Tim Lapangan does not decline ideas; only the forum does, through Tidak dilanjutkan.
- Ideas go to the board through the same "Kirim ke papan" step as help requests.

Copy keys (`resources/lang/id/ideas.json`; keys English, text checked with `bahasa-indonesia-plain`):

| Key                   | Text                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `menu`                | Kirim Masukan                                                                                    |
| `title`               | Kirim Masukan                                                                                    |
| `lead`                | Punya ide agar SIGRAK lebih membantu pekerjaan Anda? Tulis di sini. Kami membaca setiap masukan. |
| `to_help`             | Ada yang tidak berjalan? Pakai Minta Bantuan.                                                    |
| `from_help`           | Punya ide untuk SIGRAK? Pakai Kirim Masukan. (shown on the Minta Bantuan page)                   |
| `field.area.label`    | Bagian aplikasi                                                                                  |
| `field.area.hint`     | Pilih bagian yang paling dekat dengan ide Anda.                                                  |
| `field.body.label`    | Ide Anda                                                                                         |
| `field.body.hint`     | Ceritakan apa yang ingin Anda lakukan di SIGRAK.                                                 |
| `field.benefit.label` | Apa manfaatnya untuk Anda atau murid?                                                            |
| `field.benefit.hint`  | Boleh dikosongkan.                                                                               |
| `field.image.label`   | Gambar pendukung                                                                                 |
| `field.image.hint`    | Boleh dikosongkan. Misalnya foto sketsa atau tangkapan layar, JPG atau PNG, paling besar 2 MB.   |
| `privacy`             | Nama Anda dan nama sekolah hanya dilihat Tim SIGRAK.                                             |
| `submit`              | Kirim Masukan                                                                                    |
| `sent`                | Terima kasih. Masukan Anda sudah kami terima.                                                    |
| `error.area_required` | Pilih bagian aplikasi.                                                                           |
| `error.body_required` | Tulis ide Anda dulu.                                                                             |
| `error.body_short`    | Ceritakan sedikit lebih lengkap, paling sedikit 20 karakter.                                     |
| `list.title`          | Masukan saya                                                                                     |
| `list.empty`          | Belum ada masukan dari Anda.                                                                     |
| `status.new`          | Terkirim                                                                                         |
| `status.answered`     | Sudah dijawab                                                                                    |

Console copy (`resources/lang/id/problems.json`): `console.kind.help` Bantuan · `console.kind.idea` Masukan · `console.kind.all` Semua · `console.change_kind` Ubah jenis.

## 3. The Plane side

### 3.1 Workspace, project, states

One workspace `sigrak`, one project **"Masalah→Solusi"**, identifier `MS` (cards show as `MS-12`). Bank Praktik Baik does not go to Plane. `node ace plane:setup` creates the states and labels below through the API if they are missing and stores their IDs in the settings (§8); `--check` only reports. Mapping is by Plane ID, so renaming a column in Plane does not break it. D-453 adds **Tidak dilanjutkan** as the tenth column after D-440's nine.

| Plane state (column) | Plane state group | `problems.status` |
| -------------------- | ----------------- | ----------------- |
| Masuk                | backlog           | `received`        |
| Ditelaah             | unstarted         | `reviewing`       |
| Akar masalah         | unstarted         | `root_cause`      |
| Antre prioritas      | unstarted         | `queued`          |
| Dirancang            | started           | `designing`       |
| Dibangun             | started           | `building`        |
| Uji coba             | started           | `trial`           |
| Rilis                | completed         | `released`        |
| Dievaluasi           | completed         | `evaluated`       |
| Tidak dilanjutkan    | cancelled         | `not_pursued`     |

SIGRAK-only statuses: `triage` (in Bank Masalah, not yet on the board) and `merged` (duplicate; its reporters move to the target problem).

### 3.2 Work item fields

API: `POST /api/v1/workspaces/{slug}/projects/{project_id}/work-items/` with `X-API-Key` **[verify path: older CE releases use `/issues/`]**.

| Plane field                                    | Value                                                                                        | Owned by                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- |
| `name`                                         | `problems.title` (after the light pass, ≤ 120 chars)                                         | SIGRAK                           |
| `description_html`                             | Template below, every value HTML-escaped                                                     | SIGRAK                           |
| `labels`                                       | SIGRAK labels (below) merged with labels the team added in Plane                             | SIGRAK for its own prefixes only |
| `state`                                        | `Masuk` on create; afterwards never sent, except the one-time push after an off period (§10) | Plane                            |
| `priority`                                     | `none` on create, never sent again                                                           | Plane (forum)                    |
| `assignees`, cycles, modules, dates, estimates | not sent                                                                                     | Plane                            |
| `external_source`                              | `sigrak`                                                                                     | SIGRAK                           |
| `external_id`                                  | `problems.public_id` (UUIDv7)                                                                | SIGRAK                           |

SIGRAK reads back only `state`, `updated_at` and `sequence_id`. Comments, description, name, labels, assignees and dates edited in Plane never come back (D-453).

SIGRAK labels (created by `plane:setup`, Indonesian because the teams read them). The help/idea split is the `sumber:` label, not a Plane work item type **[verify: work item types are not in CE]**.

| Prefix     | Values                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `sumber:`  | `bantuan` (Minta Bantuan), `masukan` (Kirim Masukan), `lapangan` (field report)                                    |
| `jenis:`   | `galat` (bug), `bingung` (confusing UI), `usulan` (request or idea), `regulasi`, `konten`                          |
| `bagian:`  | app area keys: `rpm`, `lkpd`, `bank-soal`, `quiz`, `tka`, `administrasi`, `ujian`, `akun`, `pembayaran`, `lainnya` |
| `jenjang:` | `sd`, `mi`                                                                                                         |
| `peran:`   | `guru`, `kepala-sekolah`, `operator`, `pengawas` (one per role among the reporters)                                |

Description template (Indonesian, plain HTML, no user text):

```html
<p><strong>Ringkasan:</strong> {summary}</p>
<ul>
    <li>Pelapor: {count} orang ({roles, e.g. "4 guru, 1 operator"})</li>
    <li>Jenjang: {SD|MI|SD dan MI}</li>
    <li>
        Sekolah: {school name} ({kecamatan}, {kabupaten/kota}); up to 5, then "dan {n} sekolah lain"
    </li>
    <li>
        Wilayah tanpa sekolah: {kecamatan}, {kabupaten/kota} (pengawas and field reports without a
        school)
    </li>
    <li>Pertama dicatat: {4 Juni 2026}</li>
</ul>
<p><a href="https://admin.sigrak.com/bank-masalah/{public_id}">Buka di konsol SIGRAK</a></p>
```

School and region names come from the `schools` and `regions` reference data, never from typed text; the "Wilayah tanpa sekolah" line is left out when empty. The link points at `admin.` behind Cloudflare Access (`SIGRAK admin`), so it opens only for staff who also pass the console's permission check.

## 4. What goes to Plane, and what never does

School names, pupils' names and NISN in staff text, and the light masking pass rest on an agreement held outside the repository (D-454, D-455, D-444, D-446). They apply to the Plane integration only; the chatbot and every other channel keep full D-393 masking.

| Sent                                                                                 | Never sent                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Staff-written title and summary, after the light pass                                | The help request or idea body, the benefit field, or any other text the user typed   |
| Reporter **role counts** (guru, kepala sekolah, operator, pengawas)                  | User names, emails, phones, WhatsApp as structured fields                            |
| Level (SD/MI)                                                                        | NIK and phone numbers, anywhere (removed from text by the light pass, D-455)          |
| **School names** of the reporters, with **kecamatan** and **kabupaten/kota**, always | NPSN, NSM, school addresses, desa as structured fields                               |
| Kind, area, source labels; first-reported date                                       | User IDs, school IDs, sequential IDs, screenshots, attachments                       |
| Link to `admin.sigrak.com/bank-masalah/{public_id}`                                  | Fields read from student records (the console never shows them, `internal-roles.md` §3); a pupil's name or NISN reaches Plane only when staff write it in the title or summary (D-455) |

Rules:

1. **Places, always** (D-453, D-454). Every problem carries the school name, kecamatan and kabupaten/kota of each report, with no minimum number of schools. Sources: the reporter's school for school users; for pengawas, the kecamatan where most of their Sekolah Binaan are, without a school name; for field reports, the places staff pick (kecamatan required, school optional).
2. **Light masking pass** (D-454, confirmed by D-455). Only NIK and phone numbers are removed. The D-393 module `app/services/privacy/masker.ts` gets a `plane_light` profile next to the chatbot's full profile; it needs no name lookup.

    | Removed (token)                                                                                              | Goes as written                                                     |
    | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
    | NIK: 16-digit runs in any spacing (`[NOMOR]`). KK and NUPTK have the same form, so the pattern removes them too | Pupils' full names and NISN (D-455)                                 |
    | Phone numbers (`08…`, `628…`, `+62…`, with spaces, dots or hyphens, also inside `wa.me` links) (`[TELEPON]`) | School names, staff and teacher names, NPSN, NSM, NIP, emails, URLs |

3. **Fail closed.** After the pass, a residual check looks for a 16-digit run or a phone pattern. A hit sets `sync_status = blocked_personal_data`; nothing is sent until staff edit the text.
4. **Stored after the pass.** `problems.title` and `problems.summary` are saved after the light pass, so exports and Plane hold the same text. The raw text stays only in `help_requests.body` and `benefit`, under the help-request rules.
5. **Preview, then send.** The triage form shows the exact `name` and description Plane will receive. "Kirim ke papan" sits under the preview and is disabled while the residual check finds a hit. Nothing goes to the board automatically (D-453).

How masking is tested: §13, groups A and B.

## 5. Worker job

All Plane calls run on **`worker-default`**, queue **`plane`**, so one limiter covers the one API key. The database outbox (`problem_plane_links`) is the queue of record; BullMQ only executes. If Redis is lost, `plane.sweep` re-enqueues every `pending` or `retrying` row.

| Job               | Trigger                                                                                                                                     | Does                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `plane.push`      | Staff press "Kirim ke papan" (first send); afterwards title, summary, labels, reporter count or places changed (debounced 60 s per problem) | Create or update the work item for `{problem_id, revision}`                               |
| `plane.apply`     | Webhook mode: a stored webhook delivery (§6). Both modes: a changed work item found by `plane.reconcile`                                    | Re-read the work item, take its state only, update SIGRAK, queue notifications (§7)       |
| `plane.reconcile` | Webhook mode: every 15 min (safety net). Polling mode: every 2 min (the only way in, §6.3)                                                  | List work items with `external_source = sigrak` updated since the cursor; apply any drift |
| `plane.sweep`     | Scheduler every 5 min, and on "Kirim yang tertunda"                                                                                         | Enqueue outbox rows whose next attempt is due                                             |
| `plane.check`     | "Coba koneksi" button, `node ace plane:setup --check`, daily                                                                                | Key valid, project exists, all ten mapped states and every label exist                    |

Queue settings:

| Setting         | Value                                                                      | Why                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrency     | 1                                                                          | Keeps ordering per problem simple; volume is small                                                                                                                                                                                       |
| Limiter         | 50 requests per 60 s                                                       | Plane allows 60 per minute per API key (`X-RateLimit-Remaining`, `X-RateLimit-Reset`) **[verify CE default; CE reads `API_KEY_RATE_LIMIT`]**; 10 left for `plane:setup` and manual checks. Polling mode adds about one request per 2 min |
| HTTP timeout    | 10 s                                                                       |                                                                                                                                                                                                                                          |
| Attempts        | 8, backoff 30 s, 1 min, 2 min, 5 min, 15 min, 30 min, 1 h, 1 h (about 3 h) | Then `failed`                                                                                                                                                                                                                            |
| Circuit breaker | 5 network errors in a row → queue paused 10 min, health card shows it      | Plane down must not burn attempts                                                                                                                                                                                                        |

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

Kesehatan Sistem (D-316) gets one Plane card: integration on/off, inbound mode, last successful call, queue size, failed count, breaker state, problems waiting for a not-pursued reason, and per mode:

| Mode    | Shown                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------- |
| webhook | Last webhook received; "Webhook Plane mungkin mati" when reconcile finds changes no webhook announced |
| polling | Last successful poll; "Plane belum dicek sejak {time}" after 10 min without one                       |

Plane's own uptime stays with Uptime Kuma (D-426).

## 6. Webhook endpoint (webhook mode)

Used only when the pinned Plane CE accepts an internal webhook URL (`PLANE_INBOUND_MODE=webhook`). Otherwise §6.3 applies and nothing in §6.1–6.2 is deployed.

One route, `POST /internal/plane/webhooks` (route name `internal.plane.webhooks`), served only on the internal host `sigrak-hooks`. Not a user-facing path, so it stays English.

### 6.1 Reachability: internal network only

| Layer      | Rule                                                                                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker     | External network `sigrak-plane-net`, created by `sigrak-setup.sh`. Joined by Plane's API and background worker containers **[verify CE service names: `api`, `worker`]** and by SIGRAK's `worker-default` (outgoing calls) and nginx (incoming hooks). `docker compose down` in `sigrak-plane` leaves the network |
| nginx      | A separate `server` block, `server_name sigrak-hooks`, listening only on the nginx container's address on `sigrak-plane-net`; it proxies only `POST /internal/plane/webhooks`, everything else 404; `client_max_body_size 256k`                                                                                   |
| Cloudflare | No tunnel ingress rule for `sigrak-hooks`; public server blocks (`app.`, `admin.`, `ujian.`, `sigrak.com`) have no location for `/internal/`                                                                                                                                                                      |
| App        | Route bound to the `sigrak-hooks` domain (`router.….domain()`), plus middleware: source address inside `PLANE_WEBHOOK_ALLOWED_CIDRS`, else 404                                                                                                                                                                    |
| Rate       | 120 requests per minute per source; above that 429                                                                                                                                                                                                                                                                |

**Check first [verify]:** Plane validates webhook URLs and may refuse private or internal addresses (SSRF protection). §12 step 5 tests the pinned CE with `http://sigrak-hooks:8090/…` and sets `PLANE_INBOUND_MODE` from the result (D-453).

### 6.2 Verification and replay protection

Plane sends `X-Plane-Signature` (hex HMAC-SHA256 of the raw body with the webhook secret), `X-Plane-Delivery` (UUID per attempt) and `X-Plane-Event`; newer payloads also carry `event_id`, stable across retries **[verify header names and payload shape: CE has used `{event, action, data, activity}`, the current docs show `{version, event_id, delivery_id, entity_type, entity_id, data, previous_attributes}`]**. Plane sends no timestamp, so replay protection rests on deduplication and on not trusting the body.

Handler, in order:

1. Read the raw body (bodyparser keeps it; never re-serialise JSON for the HMAC).
2. Compute HMAC-SHA256 with the active secret, and with the previous secret during a rotation window (24 h); compare with `crypto.timingSafeEqual` after a length check. Missing or wrong → 401, `plane_webhook_deliveries.outcome = rejected_signature`, audit entry, nothing else.
3. Parse; accept only work item events for the configured workspace and project. Anything else, including comment events, → 200, `ignored` (D-453).
4. Insert into `plane_webhook_deliveries` with unique `dedupe_key` = `event_id` or, when absent, the delivery ID. Conflict → 200, `duplicate`.
5. Enqueue `plane.apply` (`jobId` = `dedupe_key`) and answer **202** within a second. No database work beyond the insert.
6. `plane.apply` ignores the body: it fetches the work item by ID from the API, takes only its state, and applies it only if its `updated_at` is newer than the stored one. A replayed, reordered or late delivery can therefore only cause a harmless re-read.

Plane does not retry 4xx and may disable a webhook after repeated failures without queueing events **[verify for CE]**; reconcile closes that gap. Delivery rows keep no body and are pruned after 30 days.

### 6.3 Polling mode (fallback, D-453)

If the pinned Plane CE refuses internal webhook URLs, `PLANE_INBOUND_MODE=polling`: SIGRAK polls Plane every 2 minutes and exposes no inbound endpoint.

| Part                       | Webhook mode                                             | Polling mode                                                                           |
| -------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Inbound endpoint           | `POST /internal/plane/webhooks` on `sigrak-hooks`        | None: route not registered, no nginx `sigrak-hooks` block, no webhook created in Plane |
| `sigrak-plane-net` members | Plane `api` and `worker`, SIGRAK `worker-default`, nginx | Plane's API side and SIGRAK `worker-default` only (outgoing calls)                     |
| Secrets                    | API key and webhook secret                               | API key only; webhook secret and CIDRs unset and hidden in the panel                   |
| Primary path               | Webhook → `plane.apply`                                  | `plane.reconcile` every 2 min → same apply step                                        |
| Reconcile                  | Every 15 min, safety net                                 | Every 2 min, primary                                                                   |
| Delay before a stage shows | Seconds                                                  | Up to 2 min                                                                            |
| `plane_webhook_deliveries` | Used                                                     | Stays empty                                                                            |

How `plane.reconcile` works as the primary path:

1. A BullMQ repeatable job with a fixed `jobId`, so two runs never overlap. Each run reads the cursor from `plane_sync_cursors`.
2. It lists the project's work items with `external_source = sigrak` and `updated_at` after the cursor minus a 2-minute overlap, oldest first, 100 per page **[verify filter and ordering parameters; fallback: order by `-updated_at` and page until items are older than the cursor]**.
3. Each item goes through `applyWorkItem`, the same function `plane.apply` uses in webhook mode: compare `updated_at`, map the state, write a status event, queue notifications. The overlap and repeats are harmless (idempotency rule 4).
4. The cursor moves to the newest `updated_at` seen only after every page is applied. A failed run leaves the cursor; the next run repeats it.
5. Cards deleted in Plane do not show in the list. `plane.push` finds them on its next update (404), and a daily full pass compares all synced links with the project's items and marks the missing ones `remote_missing`.
6. Budget: one list call per run in a normal week, about 720 a day, well under the limiter.
7. Plane down: the breaker stops the runs, the cursor stays, and the first run after recovery catches up.

Changing mode is an env change and a restart. Moving to webhook mode also means creating the webhook in Plane, saving its secret and deploying the nginx block; reconcile then drops to every 15 minutes.

## 7. Status mapping and notifications

### 7.1 Stages the reporter sees

Reporters see a stage chip on their request (Akun > Minta Bantuan or Kirim Masukan), not the ten columns. Columns that mean the same to a reporter share one stage.

| Plane state       | `problems.status` | Reporter stage (chip)    | Rank | Notice                                | Help request             |
| ----------------- | ----------------- | ------------------------ | ---- | ------------------------------------- | ------------------------ |
| (none yet)        | `triage`          | Dicatat (grey)           | 1    | `received`, on linking                | `in_progress` (Diproses) |
| Masuk             | `received`        | Dicatat (grey)           | 1    | no (same stage)                       | Diproses                 |
| Ditelaah          | `reviewing`       | Dipelajari (info)        | 2    | `reviewing`                           | Diproses                 |
| Akar masalah      | `root_cause`      | Dipelajari (info)        | 2    | no (same stage)                       | Diproses                 |
| Antre prioritas   | `queued`          | Menunggu giliran (info)  | 3    | `queued`                              | Diproses                 |
| Dirancang         | `designing`       | Direncanakan (info)      | 4    | `planned`                             | Diproses                 |
| Dibangun          | `building`        | Sedang dibuat (info)     | 5    | `building`                            | Diproses                 |
| Uji coba          | `trial`           | Diuji coba (info)        | 6    | `trial`                               | Diproses                 |
| Rilis             | `released`        | Sudah tersedia (ok)      | 7    | `released`                            | `done` (Selesai)         |
| Dievaluasi        | `evaluated`       | Sudah tersedia (ok)      | 7    | no (same stage)                       | Selesai                  |
| Tidak dilanjutkan | `not_pursued`     | Tidak dilanjutkan (grey) | —    | `not_pursued`, once a reason is saved | Selesai                  |
| unknown state ID  | unchanged         | unchanged                | —    | no; health card warns, audit entry    | unchanged                |

Rules (D-453):

| Case                                   | What happens                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card reaches a higher-ranked stage     | One notice, for that stage. `problem_reports.notified_rank` stores the highest rank the reporter was told about                                                 |
| Card moves back                        | Chip and help request follow silently; no notice. Moving forward again to a stage already announced gives no notice either                                      |
| Several moves in a short time          | A notice is due 10 min after the change (`problems.notice_due_at`) and covers the stage the card rests on then; a drag forward and back in 10 min sends nothing |
| Card enters Tidak dilanjutkan          | One notice with the reason (§7.2). If no reason is saved yet, the notice waits; the console flags the problem "Perlu alasan"                                    |
| Card leaves Tidak dilanjutkan          | One `reopened` notice; `notified_rank` resets to the new stage's rank                                                                                           |
| Duplicate merged into another problem  | Its reporters follow the target problem and are told only about stages above their `notified_rank`                                                              |
| Reporter turned notices off (`notify`) | Chip still changes; no Kabar or push                                                                                                                            |

Channels: a Kabar plus Web Push when enabled (D-397); push waits until 06.00 WIB when the notice falls between 21.00 and 06.00. A notice replaces the generic D-320 status-change Kabar, so the reporter never gets two for one change. Push carries only the title and body below, never user text.

### 7.2 Not pursued: reason

When a card goes to Tidak dilanjutkan (or staff set the status in the console while Plane is off), staff with `problems.triage` pick one reason and may add a note. The reason can also be set before the card moves; then the notice goes at once. Reason and note go to the reporter only, never to Plane.

| `not_pursued_reason` | Console label (`reason.{key}.label`) | Text to the reporter (`reason.{key}.text`)                           |
| -------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `out_of_scope`       | Di luar cakupan SIGRAK               | Hal ini di luar yang dikerjakan SIGRAK saat ini.                     |
| `policy`             | Belum sesuai aturan resmi            | Aturan resmi yang berlaku belum memungkinkan hal ini.                |
| `already_available`  | Sudah ada di SIGRAK                  | Yang Anda minta sudah ada di SIGRAK. Panduannya ada di menu Bantuan. |
| `later`              | Ditunda                              | Kami simpan dulu untuk kami pertimbangkan lagi nanti.                |
| `other`              | Lainnya (wajib isi catatan)          | (no sentence; the note is the reason)                                |

Note: `not_pursued_note`, up to 300 characters, shown as "Catatan dari Tim SIGRAK: {note}". Console field label "Catatan untuk pelapor", hint "Boleh dikosongkan, kecuali alasan Lainnya. Hanya dikirim ke pelapor, tidak ke papan."

### 7.3 Copy keys

`resources/lang/id/problems.json`; keys English, text plain Indonesian, checked with `bahasa-indonesia-plain`. `{subject}` is `subject.help` or `subject.idea` by the request's kind.

| Key                                       | Text                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `subject.help`                            | laporan Anda                                                                                                             |
| `subject.idea`                            | ide Anda                                                                                                                 |
| `notify.received.title`                   | Sudah kami catat                                                                                                         |
| `notify.received.body`                    | Terima kasih. Kami sudah mencatat {subject}. Kami akan memberi kabar setiap ada perkembangan.                            |
| `notify.reviewing.title`                  | Sedang kami pelajari                                                                                                     |
| `notify.reviewing.body`                   | Tim kami sedang mempelajari {subject}. Anda tidak perlu melakukan apa-apa.                                               |
| `notify.queued.title`                     | Menunggu giliran                                                                                                         |
| `notify.queued.body`                      | Kami sudah selesai mempelajari {subject}. Sekarang tinggal menunggu giliran untuk dijadwalkan.                           |
| `notify.planned.title`                    | Sudah masuk rencana                                                                                                      |
| `notify.planned.body`                     | Kami sudah memasukkan {subject} ke rencana kerja. Kami kabari lagi saat mulai dibuat.                                    |
| `notify.building.title`                   | Sedang kami buat                                                                                                         |
| `notify.building.body`                    | Kami sedang membuat perubahannya. Kami kabari lagi setiap ada perkembangan.                                              |
| `notify.trial.title`                      | Sedang diuji coba                                                                                                        |
| `notify.trial.body`                       | Kami sedang menguji perubahannya supaya aman dipakai. Kami kabari lagi saat sudah bisa dipakai.                          |
| `notify.released.title`                   | Sudah bisa dipakai                                                                                                       |
| `notify.released.body`                    | Perubahan dari {subject} sudah bisa dipakai. Silakan coba. Kalau masih ada kendala, kirim lewat Minta Bantuan.           |
| `notify.not_pursued.title`                | Belum bisa kami kerjakan                                                                                                 |
| `notify.not_pursued.body`                 | Terima kasih sudah menyampaikan {subject}. Untuk saat ini kami belum bisa mengerjakannya. {reason}                       |
| `notify.reopened.title`                   | Kami pelajari lagi                                                                                                       |
| `notify.reopened.body`                    | Kami kembali mempelajari {subject}. Kami kabari lagi setiap ada perkembangan.                                            |
| `notify.note`                             | Catatan dari Tim SIGRAK: {note}                                                                                          |
| `stage.received` … `stage.not_pursued`    | Dicatat / Dipelajari / Menunggu giliran / Direncanakan / Sedang dibuat / Diuji coba / Sudah tersedia / Tidak dilanjutkan |
| `reason.{key}.label`, `reason.{key}.text` | §7.2                                                                                                                     |
| `console.needs_reason`                    | Perlu alasan                                                                                                             |
| `console.reason_field`                    | Alasan tidak dilanjutkan                                                                                                 |
| `console.send_to_board`                   | Kirim ke papan                                                                                                           |
| `console.preview_title`                   | Yang akan terkirim ke papan                                                                                              |

`{note}` on `released` is written by staff in the console (problem field `release_note`); on `not_pursued` it is `not_pursued_note`. Neither is taken from Plane (D-453).

## 8. Settings (Fondasi F-005, D-431)

Env wins; when the env value is empty the admin panel's value is used ("Diatur oleh server" when env is set; secrets shown as `••••` + last 4, never shown again after saving). Panel page: `admin.sigrak.com/pengaturan/integrasi/plane`, permission `integrations.plane.manage` (owner, admin). "Coba koneksi" runs `plane.check` and reports in plain Indonesian.

| Setting              | Env name                                   | Panel                                                                       | Secret  | Notes                                                                                                                                                      |
| -------------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master switch        | `PLANE_ENABLED` (`true`/`false`)           | toggle "Integrasi Plane aktif"                                              | no      | `false` in env forces off and hides the toggle, like `AI_ENABLED`. The staging env template sets `false` (D-453)                                           |
| Inbound mode         | `PLANE_INBOUND_MODE` (`webhook`/`polling`) | read-only line "Cara menerima kabar dari Plane"                             | no      | Env only; set from the §12 step 5 check. Unset means `polling`, which needs no inbound route                                                               |
| API base URL         | `PLANE_BASE_URL`                           | yes                                                                         | no      | Internal URL on `sigrak-plane-net` (e.g. `http://plane-proxy`), not `plane.sigrak.com`, which sits behind Access **[verify CE accepts the internal Host]** |
| Workspace slug       | `PLANE_WORKSPACE_SLUG`                     | yes                                                                         | no      | `sigrak`                                                                                                                                                   |
| Project ID           | `PLANE_PROJECT_ID`                         | yes                                                                         | no      | Filled by `plane:setup`                                                                                                                                    |
| API key              | `PLANE_API_KEY`                            | yes, encrypted                                                              | **yes** | Key of a dedicated Plane user "SIGRAK Bot", member of the one project only                                                                                 |
| Webhook secret       | `PLANE_WEBHOOK_SECRET`                     | webhook mode only, encrypted, with "Ganti rahasia" (keeps the old one 24 h) | **yes** | Copied from Plane when the webhook is created                                                                                                              |
| Allowed source CIDRs | `PLANE_WEBHOOK_ALLOWED_CIDRS`              | no (env only)                                                               | no      | Webhook mode only. The subnet of `sigrak-plane-net`; infrastructure, not a panel setting                                                                   |
| State and label map  | —                                          | read-only list, "Muat ulang dari Plane"                                     | no      | Stored by `plane:setup` (ten states); not editable by hand                                                                                                 |

Staging: the integration is off by default (D-453), so Bank Masalah runs on console statuses there. To test it, the owner sets `PLANE_ENABLED=true` on staging for a while, with its own Plane project, key and secret, never production's project (F-005). Production and staging never share keys or secrets. `APP_KEY` encrypts the panel secrets; it stays in env (D-431).

## 9. Audit log

Entries follow F-013 §4: who, when, what, before/after with secrets masked; read in Indonesian; not editable. The system actor is shown as "Sistem SIGRAK"; Plane actors are stored as the Plane user ID only.

| Event key                                  | Actor                                                              | Example in the console                                                    |
| ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `integrations.plane.settings_updated`      | staff                                                              | Rina mengubah alamat Plane (rahasia tidak ditampilkan)                    |
| `integrations.plane.enabled` / `.disabled` | staff                                                              | Rina mematikan integrasi Plane                                            |
| `integrations.plane.secret_rotated`        | staff                                                              | Rina mengganti rahasia webhook Plane                                      |
| `help_requests.kind_changed`               | staff                                                              | Dani mengubah jenis permintaan 1042 dari Bantuan menjadi Masukan          |
| `problems.created`                         | staff                                                              | Dani mencatat masalah BM-0042 dari masukan pengguna                       |
| `problems.updated`                         | staff                                                              | Dani mengubah ringkasan BM-0042 (before/after, text after the light pass) |
| `problems.report_linked` / `.merged`       | staff                                                              | Dani menggabungkan BM-0045 ke BM-0042                                     |
| `problems.sent_to_board`                   | staff                                                              | Dani mengirim BM-0042 ke papan setelah melihat pratinjau                  |
| `problems.sync_failed`                     | system                                                             | Pengiriman BM-0042 ke papan gagal: kunci API ditolak                      |
| `problems.sync_blocked`                    | system                                                             | BM-0042 ditahan: masih ada data pribadi                                   |
| `problems.resync_requested`                | staff                                                              | Teknis meminta kirim ulang BM-0042                                        |
| `problems.status_changed`                  | system (source `plane`, Plane user ID) or staff (source `console`) | Status BM-0042 berubah dari Dirancang menjadi Dibangun (dari Plane)       |
| `problems.not_pursued_reason_set`          | staff                                                              | Dani memilih alasan BM-0042 tidak dilanjutkan: Di luar cakupan SIGRAK     |
| `problems.notice_held`                     | system                                                             | Kabar BM-0042 ditahan: alasan tidak dilanjutkan belum dipilih             |
| `problems.reporters_notified`              | system                                                             | 7 pelapor BM-0042 diberi kabar: Sedang diuji coba                         |
| `integrations.plane.webhook_rejected`      | system (webhook mode)                                              | Kiriman webhook ditolak: tanda tangan tidak cocok                         |
| `problems.exported`                        | staff                                                              | Rina mengunduh Bank Masalah (Excel)                                       |

Application logs carry IDs only (problem public ID, work item ID, delivery ID, HTTP status), never title, summary or body (F-013 §3).

## 10. Switching Plane off

| Situation                              | How                                                         | What SIGRAK does                                                                                                                                                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integration off                        | Panel toggle or `PLANE_ENABLED=false` (default on staging)  | No jobs enqueued, no polling; the webhook route answers 404; new problems get `sync_status = off`; the console status selector becomes editable (source `console`), including Tidak dilanjutkan with its reason; reporters notified the same way. Users see no difference |
| Plane down while the integration is on | `docker compose down` in `sigrak-plane`, or a crash         | Jobs fail on the network, the breaker pauses the queue, rows stay `retrying`/`pending` (the queue holds); health card says "Plane tidak bisa dihubungi sejak {time}". Nothing user-facing depends on Plane                                                                |
| Back on                                | Toggle on / Plane up                                        | `plane.sweep` sends what waited; problems whose status changed in the console while off get a one-time `state` push to Plane (only time SIGRAK writes `state`); `plane.reconcile` runs at once; status ownership returns to Plane                                         |
| Removed for good                       | Export (below), then toggle off, then `docker compose down` | Bank Masalah keeps working on console statuses; `problem_plane_links` stays as history                                                                                                                                                                                    |

The owner's recommended order before a long stop: toggle off in the panel first, so no alerts fire, then stop the Compose project.

Export:

| What                        | How                                                                                                                                         | Format                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bank Masalah (the record)   | Console "Unduh Bank Masalah", `worker-exports`                                                                                              | Excel/CSV, Indonesian headings (D-150): Kode, Judul, Ringkasan, Sumber (Bantuan, Masukan, Lapangan), Jenis, Bagian aplikasi, Jenjang, Kecamatan, Kabupaten/Kota, Jumlah pelapor, Status, Alasan tidak dilanjutkan, Tanggal dicatat, Tanggal rilis, Nomor kartu Plane; second sheet Riwayat status. Reporters are not in the export (counts only) |
| Plane board, before removal | `node ace plane:export`: all `external_source = sigrak` work items with state, labels, dates and comments                                   | JSON + CSV on the VPS disk next to the backups (comments hold staff names). This is a one-way export for keeping; nothing in it is read back into SIGRAK                                                                                                                                                                                         |
| Plane itself                | Plane's built-in workspace export **[verify CE formats]**; Plane's PostgreSQL and object-store volumes stay in the Backrest backups (D-430) | as Plane provides                                                                                                                                                                                                                                                                                                                                |

## 11. Data model additions

All English, plural snake_case (CONTEXT conventions). Plane-specific columns sit in their own table so the board can be removed without touching `problems`.

| Table                      | Columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Notes                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `help_requests` (D-320)    | Added: `kind` ∈ {`help`,`idea`} default `help`, `area` varchar(30) nullable (ideas), `benefit` text nullable (ideas)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | The only place the user's own text is kept. Index on (`kind`, `status`) for the triage tabs                                                                                                                                                                               |
| `problems`                 | `id`, `public_id` (UUIDv7, unique), `number` (int, unique; shown `BM-0042`), `title` varchar(120) after the light pass, `summary` text after the light pass, `kind` ∈ {`bug`,`confusion`,`request`,`regulation`,`content`}, `area` varchar(30), `level` ∈ {`sd`,`mi`,`both`}, `source` ∈ {`help_request`,`idea`,`field`}, `status` ∈ {`triage`,`received`,`reviewing`,`root_cause`,`queued`,`designing`,`building`,`trial`,`released`,`evaluated`,`not_pursued`,`merged`}, `status_changed_at`, `merged_into_id` FK `problems` nullable, `not_pursued_reason` ∈ {`out_of_scope`,`policy`,`already_available`,`later`,`other`} nullable, `not_pursued_note` varchar(300) nullable, `release_note` text nullable, `notice_due_at` timestamptz nullable, `reporter_count` int, `content_revision` int, `created_by_staff_id` FK `staff_users`, timestamps | CHECK `merged_into_id IS NOT NULL` ⇔ `status = 'merged'`; CHECK `not_pursued_reason = 'other'` ⇒ `not_pursued_note IS NOT NULL`. No user or school columns; places come from the two tables below                                                                         |
| `problem_reports`          | `id`, `problem_id` FK CASCADE, `help_request_id` FK nullable, `user_id` FK nullable, `reporter_role` ∈ {`teacher`,`principal`,`operator`,`supervisor`}, `school_id` FK nullable, `district_region_id` FK `regions` (kecamatan), `notify` bool default true, `notified_rank` smallint default 0, `last_notified_stage` varchar(20) nullable, `created_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Unique (`problem_id`, `user_id`). Never leaves SIGRAK except as school name and region in the payload. When an account is deleted the row's `user_id`, `school_id`, `help_request_id` are cleared; the count and kecamatan stay, and the next push drops that school name |
| `problem_field_places`     | `problem_id` FK CASCADE, `district_region_id` FK `regions` (kecamatan), `school_id` FK nullable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Places staff pick for field reports. Unique (`problem_id`, `district_region_id`, `school_id`)                                                                                                                                                                             |
| `problem_status_events`    | `id`, `problem_id` FK, `from_status`, `to_status`, `source` ∈ {`plane`,`console`,`system`}, `actor_staff_id` nullable, `plane_actor_id` nullable, `plane_event_key` nullable, `occurred_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Append-only; feeds Riwayat status and time-to-release figures for the forum                                                                                                                                                                                               |
| `problem_plane_links`      | `problem_id` PK/FK, `plane_work_item_id` uuid unique nullable, `plane_sequence_id` int nullable, `plane_state_id` uuid nullable, `plane_updated_at` timestamptz nullable, `sync_status` ∈ {`off`,`pending`,`retrying`,`synced`,`failed`,`blocked_personal_data`,`remote_missing`}, `synced_revision` int, `attempts` int, `next_attempt_at` nullable, `last_error_code` varchar(40) nullable, `synced_at` nullable, `state_push_pending` bool                                                                                                                                                                                                                                                                                                                                                                                                          | The outbox; a row exists only after "Kirim ke papan". Index on (`sync_status`, `next_attempt_at`)                                                                                                                                                                         |
| `plane_webhook_deliveries` | `id`, `dedupe_key` varchar(64) unique, `delivery_id` uuid, `event` varchar(60), `work_item_id` uuid nullable, `outcome` ∈ {`queued`,`applied`,`stale`,`duplicate`,`ignored`,`rejected_signature`,`rejected_source`}, `received_at`, `processed_at` nullable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Webhook mode only; empty in polling mode. No body stored; pruned after 30 days by the scheduler                                                                                                                                                                           |
| `plane_sync_cursors`       | `name` PK (`reconcile`), `cursor_at` timestamptz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Reconcile position; the primary inbound state in polling mode                                                                                                                                                                                                             |
| Settings store (R2, D-431) | keys `plane.enabled`, `plane.base_url`, `plane.workspace_slug`, `plane.project_id`, `plane.api_key` (enc), `plane.webhook_secret` (enc), `plane.webhook_secret_previous` (enc, expires), `plane.state_map`, `plane.label_map`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Same store as mail and other integrations. The inbound mode is env only, not stored here                                                                                                                                                                                  |

`problems.region_id` from the earlier draft is gone: a problem's places come from `problem_reports` and `problem_field_places`, and kabupaten/kota is the parent of each kecamatan in `regions`.

Permissions (permission-based checks, F-013): `problems.view` (all Tim SIGRAK roles except `finance`), `problems.triage` (`owner`, `admin`, `support`, `sales`, `regional_lead`, `marketing`; also covers "Ubah jenis", "Kirim ke papan" and the not-pursued reason), `problems.sync` (`owner`, `admin`, `engineer`), `problems.export` (`owner`, `admin`), `integrations.plane.manage` (`owner`, `admin`). Sales and regional leads see only problems with reports from schools in their scope (D-338). Console routes: `/bank-masalah` (`problems.index`), `/bank-masalah/{problem}` (`problems.show`), `/pengaturan/integrasi/plane` (`settings.integrations.plane`). User routes (proposed): `/minta-bantuan`, `/kirim-masukan`.

## 12. Build order

1. Masker `plane_light` profile and its test corpus, next to the chatbot's full profile (build the module here if this lands first).
2. `help_requests.kind` and the Kirim Masukan page; `problems`, `problem_reports`, `problem_field_places`, `problem_status_events`; console pages with the kind chip, "Ubah jenis", preview and not-pursued reason; notifications with ranks and the settle window; export. Bank Masalah works with Plane off.
3. `problem_plane_links`, settings page (staging template with `PLANE_ENABLED=false`), `plane:setup` with ten states, `plane.push`, `plane.check`, health card.
4. `plane.reconcile` with `applyWorkItem`. This is enough to run in polling mode.
5. Check the pinned Plane CE: does it accept `http://sigrak-hooks:8090/…` as a webhook URL? Set `PLANE_INBOUND_MODE` from the answer.
6. Webhook mode only: internal network for nginx, nginx `sigrak-hooks` block, webhook route, `plane.apply` from deliveries.
7. Contract test against the pinned Plane CE image; R3 adds the network to `sigrak-setup.sh` and the `sigrak-plane` Compose project.

## 13. Tests (Japa)

| Group                                   | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Masker (unit)                        | `plane_light` removes NIK in every spelling (`3319012345670001`, `3319 0123 4567 0001`, `3319.0123.4567.0001`) and phones in every spelling (`0812-3456-7890`, `0812 3456 7890`, `+62 812…`, `62812…`, inside `wa.me`); passes pupils' full names (incl. single-word names and diacritics) and NISN (with or without dots or spaces) through unchanged, as well as school names, staff names, NPSN, dates, money (`Rp1.250.000`), JP counts and curriculum codes; residual check blocks any NIK or phone the patterns miss (D-455); the chatbot's full profile is unchanged. Corpus in `tests/fixtures/masker/` with invented people only                                                                    |
| B. No-leak (unit + integration)         | Payload builder snapshot. Over a full flow (create, update, reporter added, merge) against the fake Plane server: a NIK and a phone number seeded into the staff title and summary, and a canary set (reporter name, email, NPSN, user and school IDs, help request body, benefit text) seeded into the help request and its context, must not appear in any byte the server receives; a pupil's full name and NISN written in the staff summary do arrive unchanged (D-455), as do school name, kecamatan and kabupaten/kota; HTML escaping of title, summary and names                                                                                                    |
| C. Push job (fake Plane HTTP server)    | No call before "Kirim ke papan"; create; update; 409 adopt; lookup after timeout; 429 waits for reset without using an attempt; 5xx backoff; 400/401/403/404 outcomes; breaker opens and closes; stale revision skips; label merge keeps Plane-added labels; `state` and `priority` never sent except the one-time push                                                                                                                                                                                                                                              |
| D. Webhook endpoint (functional)        | Webhook mode: valid signature 202; wrong, missing, truncated signature 401 with audit; previous secret accepted only in the rotation window; duplicate 200 no-op; other workspace/project and comment events 200 ignored; body over 256 KB 413; wrong Host or source address 404; route absent on `app.`, `admin.`, `ujian.` hosts; integration off 404. Polling mode: route absent on every host                                                                                                                                                                    |
| E. Apply and status mapping (unit)      | All ten states incl. Tidak dilanjutkan; unknown state ignored with warning; older `updated_at` ignored; out-of-order deliveries end in the latest state; name, description, labels and comments changed in Plane leave SIGRAK unchanged                                                                                                                                                                                                                                                                                                                              |
| F. Notifications                        | One notice per higher-ranked stage per reporter; same-stage moves (Masuk, Akar masalah, Dievaluasi) silent; moving back silent, and forward again to an announced stage silent; settle window sends one notice for the resting stage and none for a drag forward and back; not pursued held until a reason, sent at once when pre-set, `other` requires a note; reopened notice; merged reporters; `notify = false` respected; push held in quiet hours; replaces the D-320 Kabar; correct `{subject}` per kind; every `problems.*` and `ideas.*` key exists in `id` |
| G. Reconcile                            | Webhook mode: picks up changes without webhooks, drift warning on the health card. Polling mode: runs every 2 min without overlap, cursor overlap and repeats harmless, cursor stays on a failed run, daily pass marks deleted cards `remote_missing`, health card warns after 10 min without a poll                                                                                                                                                                                                                                                                 |
| H. Switch-off and staging               | Integration off: triage, console status edits (incl. not pursued with reason), notifications and export work, no job enqueued, no outbound request; Plane unreachable: user pages and console respond normally; re-enable sends pending rows and the one-time state push; staging env template boots with the integration off and the toggle hidden                                                                                                                                                                                                                  |
| I. Permissions                          | Each permission allowed and denied (F-013 §9); scope filter for sales and regional leads; settings page owner/admin only; only `problems.triage` can change kind, send to the board and set a reason                                                                                                                                                                                                                                                                                                                                                                 |
| J. Audit and logs                       | Each §9 event written; secrets never in audit, logs or panel after save; log lines carry IDs only                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| K. Export                               | Indonesian headings and values (D-150), incl. Sumber, Kecamatan, Alasan tidak dilanjutkan; no reporter identities                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| L. Contract (manual and nightly CI job) | Against the pinned Plane CE image: auth header, work item create/update/get/list paths, `external_id` filter and 409, `updated_at` filter and ordering for reconcile, ten states (incl. the cancelled group) and labels endpoints, rate-limit headers, webhook headers, signature and payload shape, private-URL acceptance (§6.1)                                                                                                                                                                                                                                   |
| M. Kirim Masukan (functional)           | Menu entry next to Minta Bantuan for each school role; form validation and Indonesian errors; stored as `kind = idea` with area and benefit; image upload rules; inbox chip and tabs; "Ubah jenis" switches the user's chips; recorded idea gets `source = idea` and `sumber:masukan`; user sees Terkirim, stage chips, Sudah dijawab                                                                                                                                                                                                                                |

## 14. Owner answers (2026-11-28, D-453, D-454, D-455)

The owner answered the eight open questions on 2026-11-28 (D-453) and amended Q1 the same day (D-454, D-455). The body above now follows these answers; this table stays as the record.

| #   | Answer                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Send kabupaten/kota and kecamatan, always, and the school name; text masking is a lighter pass that still removes pupils' direct identifiers (default, pending owner confirmation), under an agreement held outside the repository (D-453, D-454; D-444, D-446). |
| Q2  | Yes: add the tenth column "Tidak dilanjutkan", and tell the reporter, with a reason.                                                                                                                                                                             |
| Q3  | Triage staff press "Kirim ke papan" after the masked preview.                                                                                                                                                                                                    |
| Q4  | Add "Kirim Masukan" for ideas next to Minta Bantuan, from the pilot on.                                                                                                                                                                                          |
| Q5  | Not limited to five key stages: the reporter is told at each stage change they can see.                                                                                                                                                                          |
| Q6  | Yes: if Plane CE refuses internal webhook URLs, poll every 2 minutes with no inbound endpoint.                                                                                                                                                                   |
| Q7  | Integration off on staging by default.                                                                                                                                                                                                                           |
| Q8  | No: nothing from Plane comments comes back; the release note is written in the console.                                                                                                                                                                          |
