# R1-12 — UI shell: layouts, navigation, icons, design tokens, SPA feel

- **Phase:** R1
- **Status:** in-progress
- **Owner:** r1/r1-12-ui-shell
- **Depends on:** R1-08, R1-09 (so their pages are in place); D-473
- **Can run in parallel with:** R1-11

## Goal

One UI shell every page uses, so the app looks and feels like SIGRAK on phones and desktops: persistent layouts and navigation per area, Hugeicons Pro, design tokens from the design system, shadcn/studio Pro blocks restyled, and the SPA behaviour of D-389. The R1 pages are moved onto it; R5 builds on the same patterns.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/final/design-system.md` (Direction, Stack mapping, Colour tokens, Type/space/shape, Components, Status labels, Mobile rules, UI writing rules)
- `docs/final/product-concept.md` (roles and navigation per role)
- Decisions D-389, D-390, D-402, D-434, D-445, D-471, D-472, D-473
- `docs/drafts/shadcn-studio-catalog.md`, `inertia/icons/hugeicons/README.md`, `docs/drafts/eyd-rules.md`
- Existing shell: `inertia/layouts/`, `inertia/components/`, `inertia/app.tsx` (or the Inertia entry), the R1 pages in `inertia/pages/`
- Fondasi `fondasi-ui` and `fondasi-feedback` skills only if Fondasi is attached (`docs/agent/fondasi-check.md` §1)

## Output

- **Layouts per area:** `app.` (school roles), `admin.` (staff console), `ujian.` (exam site), guest/auth. Persistent layouts so navigation keeps state. App: bottom navigation on phones (max five items per role), sidebar on desktop, role switch and account in the header; menus from one role-aware config, labels from `nav.json` (first word capitalised, D-472). The layer pages of R1-07 and every R1 page get their menu entries.
- **Icons:** `inertia/components/icon.tsx` maps names to the licensed Hugeicons Pro files (Rounded Stroke default, Rounded Solid for active states only, D-402, D-434); placeholder icons removed; unused icons tree-shaken.
- **Design tokens:** colours, type scale, spacing, radius and shadows from the design system as Tailwind 4 theme tokens (light and dark), status label colours (D-445); shadcn/ui components restyled to them; one place to change them.
- **Shared patterns:** page header, empty state, skeletons, toast (Sonner) with undo, confirm dialog, drawer (Vaul) on phones vs dialog on desktop, data table (TanStack Table + Virtual) with mobile cards, form field with hint and error, source badge from R1-07 aligned to the tokens.
- **SPA feel (D-389):** persistent layouts, link prefetch on hover/touch, deferred props with skeletons, optimistic updates with undo where a page already saves, view transitions between pages, progress bar for slow visits; respects reduced motion.
- **Pages moved onto the shell:** login and auth pages, Akun, Guru, Tahun Ajaran, Kelas, Kalender, Jadwal, the layer pages, the console pages, the exam home, error pages.
- **Checks:** Playwright screenshots of every page at 360 and 1280 px, light and dark; no horizontal scroll; tap targets at least 44 px; visible focus; axe accessibility check without serious issues; translation and EYD tests still pass. Screenshots go in the PR description summary, not the repository.

## Done when

- [ ] Every R1 page uses the shell; tests, lint, typecheck and format check pass
- [ ] Screenshot set reviewed by the owner (360 and 1280 px)
- [ ] Result filled, open questions listed (visual direction choices for the owner)

## Result

### Part A (branch `r1/r1-12-ui-shell`)

R1-08 and R1-09 merged into `r1/r1-00-gate-split` while part A ran; the branch merges that base (one merge commit), so their pages already sit inside the new shell. Their page files, `calendar.json` and `timetable.json` were not edited.

**What exists now**

- **Tokens** (`inertia/css/tokens.css`, the one place to change the look; mapped in `inertia/css/app.css` `@theme`): design-system colours light and dark, plus status tints (`ok/warn/danger/info-tint`), `surface-hover`, `line-strong` (input outline, 3:1), `overlay`, radius 6/10/16, `shadow-float` (floating layers only), type scale with line heights, shell sizes. `dark:` follows the device unless `<html class="light">`, or `.dark` forces it.
- **Icons** (`inertia/components/icon.tsx`): 41 names mapped to Hugeicons Pro Rounded Stroke, 19 with a Rounded Solid twin used only for `active`. Static `?raw` imports, so only these files are bundled (icon chunk 90 kB, 29 kB gzip); `#141B34` becomes `currentColor`. Old names (`grid`, `list`, `school`, …) kept, so R1-08/R1-09 code still compiles. Placeholders removed.
- **Layouts** by page folder in `inertia/layouts/resolve_layout.ts` (default layout of `createInertiaApp`; a page's own `layout` still wins): `auth/*` AuthLayout, `errors/*` ErrorLayout, `exam/*` ExamLayout, `admin/*` and `console/*` ConsoleLayout, everything else AppLayout. `plain_layout.tsx` stays as an area-aware alias (console on admin., exam on ujian.) for pages that still import it.
- **Menus** (`inertia/lib/navigation.ts`, labels in `nav.json`): one item list per area, each role picks and orders items. App: sidebar from 1024 px, bottom navigation below (at most five slots, fifth is "Lainnya" with a Vaul sheet when a role has more), header with the role switch (from 768 px; on phones in the account menu), account menu (Ganti peran, Akun, Keluar) and the email banner. Console: sidebar from 1024 px, menu button with a sheet below. Jadwal (`/jadwal`), Jadwal mengajar (`/kelas-saya/jadwal`) and Kalender wilayah (console `/kalender`) are linked, since their pages merged.
- **Patterns** (`inertia/components/patterns/`): `PageHeader` (title + tab title, back link, intro, actions), `EmptyState`, `SkeletonText/List/Cards` and `DeferredSection` (Inertia `Deferred` + skeleton), `StatusChip` + `statusToneClass` (D-445 tones), `ConfirmDialog` + `ConfirmAction` (named action, never "Ya"), `ResponsiveDialog` (dialog from 640 px, Vaul sheet below), `DataTable` (TanStack Table v9 + Virtual on the window above 60 rows; cards below 640 px), `FormField` + `controlClass`, `postWithUndo` / `queueFlashUndo` / `toastWithUndo` (optimistic props, "Urungkan" on the server's success toast). UI primitives added in `components/ui/`: `dialog`, `drawer` (Vaul), `dropdown_menu`; `button`, `card`, `skeleton`, `sonner` restyled. The R1-07 source badge uses the status tones and `useIsDesktop` from `lib/media.ts`.
- **SPA feel** (`inertia/app.tsx`): hover prefetch on menu and header links (30 s cache), view transition on full GET visits only (content cross-fade, header and menus stay), skipped with reduced motion; brand-coloured progress bar after 250 ms without spinner; global reduced-motion rule kept.
- **Pages on the shell**: auth pages, Akun, Ganti peran, Guru (teacher list is the first `DataTable`), Tahun ajaran (+ ubah), Kelas, Kelas detail (Jadwal kelas button in the header), Ekstrakurikuler (Pakai lagi is optimistic with undo; Sembunyikan offers undo), Paket daerah (Berhenti mengikuti asks first), Usulan, console pages (home with shortcuts, Sekolah, sekolah detail, Pengguna, Pengaturan, Direktori sekolah, Perubahan wilayah, Usulan wilayah), exam home, error page. `window.confirm` is gone from these pages; `LayerNav` and `RegionNav` tabs are removed (the menus replace them).
- **D-472 sweep** (lang files except calendar/timetable): Hari ini, Pengaturan sekolah, Tahun ajaran (menu, title, back links), Direktori sekolah, Perubahan wilayah, Semester 1 (ganjil) / Semester 2 (genap), extracurricular categories (Kepramukaan dan kepemimpinan, Seni dan budaya, Bela diri, Teknologi dan sains); "file" → "berkas" (`errors.import_failed`, `validation.fields.file`, `validation.messages.nativeFile`). Kept as names: SIGRAK, Tim SIGRAK, Dokumen Saya, Bank Soal, Kunci AI, Simulasi TKA, Berkas Administrasi, subject names (Seni Musik/Rupa/Tari/Teater, Cabang Seni dan Budaya), Word, Anda, "Kabupaten {name}"-style place names. "Paket daerah" is a menu label, not a feature name, so it stays sentence case. The email banner copy moved to `common.email_banner.*` (the layer routes never loaded `auth`, so the banner showed raw keys there).
- **Tests**: `tests/unit/eyd.spec.ts` gains a "label capitals" check by key name (labels, buttons, titles, every `nav.json` value; names in `LABEL_PROPER_NAMES` and words before a placeholder allowed; sentence values skipped) with self-test samples; `nav.json` counts as a label file. `tests/unit/translations.spec.ts` rejects "file" (D-472). One functional test follows the new "Perubahan wilayah" title. `docs/drafts/eyd-rules.md` records the decided open questions and the new check.
- **Checks**: Playwright (Chromium, deviceScaleFactor 1) over 36 pages × 360/1280 × light/dark, plus open states (Lainnya sheet, account menu, confirmation as sheet and dialog): no horizontal scroll, no tap target under 44 px at 360, focus outline visible on the first three Tab stops, axe (injected, `bypassCSP`) without serious or critical findings on the part A pages. Error pages were shot on a production-mode server (dev mode shows the debug page).

**Shared files touched outside the UI folders**: `package.json`, `pnpm-lock.yaml` (`vaul` 1.1.2, `@tanstack/react-table` 9.3.1, `@tanstack/react-virtual` 3.14.28, pinned exactly; no install scripts), `resources/lang/id/{nav,common,accounts,auth,classes,console,errors,layers,regions,validation}.json`, `tests/unit/eyd.spec.ts`, `tests/unit/translations.spec.ts`, `tests/functional/regions/region_changes.spec.ts`, `docs/drafts/eyd-rules.md`, this task file. `database/schema.ts`, `start/`, `app/` untouched.

**Part B must do**

1. Move the calendar and timetable pages onto the patterns: drop their `Page.layout = …` lines and layout imports (the resolver picks AppLayout / ConsoleLayout), use `PageHeader`, `EmptyState`, `StatusChip`, skeleton helpers, `controlClass`; replace `window.confirm` in `pages/school/calendar.tsx`, `pages/timetable/class.tsx`, `pages/timetable/draft.tsx` with `ConfirmAction`/`ConfirmDialog` (or `postWithUndo` where a change can be undone); swap `rounded-xl` → `rounded-lg` and `bg-*/10` → `*-tint`.
2. Fix what the checks found on those pages: `/kalender` (school) has a `summary` "Ubah" of 38×44 px at 360 px; console `/kalender` has a serious axe colour-contrast finding on the `border-ok/30` chip (use `StatusChip tone="ok"`).
3. D-472 review of `calendar.json` and `timetable.json` (the automated check already passes on both; review sentence case of buttons and titles by hand, and "berkas").
4. Final screenshot set of every page at 360 and 1280 px, light and dark, for the PR summary and the owner. The part A script and its demo-data setup are in the part A session's scratchpad (`r112a/shots.cjs`, `r112a/setup.cjs`): dev server on 3395 with its own database, production-mode server on 3396 for error pages (`node --import=@poppinss/ts-exec bin/server.ts` after `node ace build`), Chromium with `--host-resolver-rules=MAP *.sigrak.test 127.0.0.1`, axe injected from a local `axe-core` copy. Many logins in a row can hit the login throttle; rerun the failing part.
5. Optional, if the owner agrees: a light/dark choice in Akun > Tampilan (tokens already support `.light`/`.dark` on `<html>`).

**Visual direction questions for the owner**

1. Wordmark: plain "SIGRAK" text in brand colour until the logo is chosen (D-462). Fine as a stand-in?
2. Operator bottom navigation: Tahun ajaran, Kelas, Guru, Jadwal, Lainnya (Kalender, Ekstrakurikuler, Paket daerah, Usulan, Coba AI). Keep this order, or put Kalender in the bar instead of Tahun ajaran?
3. Sidebar groups with small headings ("Sekolah", "Data daerah dan sekolah") or one flat list?
4. Icon picks: desk for Kelas, medal for Ekstrakurikuler, map pin for Paket daerah, note-edit for Usulan, clock-calendar for Jadwal. Any to change?
5. Input outlines are darker than card lines (3:1 for WCAG 1.4.11). Keep, or prefer the lighter line look?
6. Invitation "Menunggu" as a grey chip, "Lewat 7 hari" as warn. OK?
7. Coba AI (the R0 spike) still has a menu slot for every role. Keep until the content slices, or hide it?
8. Dark mode follows the device only. Add a Tampilan setting now (Akun), or later with the sound settings?

### Part B (branch `r1/r1-12b-ui-pages`, from `r1/r1-12-ui-shell`)

**Pages moved onto the shell** (layout lines and imports dropped; the resolver picks AppLayout or ConsoleLayout)

- **Kalender (school `/kalender`)**: `PageHeader` (year chips as header actions), `DeferredSection` + `SkeletonList`, `EmptyState` for empty month, year and "Tidak dipakai", `StatusChip` for the class chip and "Masuk sekolah", warn boxes on `warn-tint`, `controlClass`. Every row action is now a 44 px button: "Ubah" and "Usulkan perubahan" open the event form in a `ResponsiveDialog` (sheet on phones, dialog from 640 px), and so do "Tidak dipakai di sekolah ini"/"Jadikan hari masuk sekolah" and the proposal forms (reason field). "Hapus" uses `ConfirmAction` ("Hapus {title}?", button "Hapus acara"), so `window.confirm` is gone. "Pakai lagi" is optimistic with undo (`postWithUndo`); hiding offers "Urungkan" on the success toast. This fixes the 38×44 px `summary` "Ubah" finding.
- **Kalender wilayah (console `/kalender`)**: `PageHeader`, `StatusChip` for the check result (ok/danger) and the package status (Berlaku ok, Draf warn, Tidak berlaku neutral), `EmptyState`, `rounded-lg`. This fixes the serious axe contrast finding on the green chip.
- **Jadwal (`/jadwal`)**: `PageHeader` with "Susun draf jadwal" as the header action; the class list is a `DataTable` (table on desktop, cards on phones) with status chips (Lengkap, progress, Jadwal masih kosong, warnings).
- **Jadwal kelas (`/kelas/:class/jadwal`)**: `PageHeader` with a back link to the class and "Semua jadwal" as action; status chips per subject; warnings on `warn-tint`. "Ubah" opens the row form in a `ResponsiveDialog`, and the side card keeps "Tambah baris". "Kunci"/"Buka kunci" are optimistic with undo, and "Hapus" goes through `ConfirmAction` ("Hapus baris {title}?"). Row buttons carry full accessible names ("Ubah Matematika", "Kunci Matematika").
- **Susun draf jadwal**, **Draf jadwal**: `PageHeader` with back links, `EmptyState`, status chips for draft states. On the draft page, `SkeletonText` shows while the draft waits, and "Simpan draf" goes through `ConfirmAction` ("Simpan draf ke {count} kelas?"; not destructive styled, since locked rows stay).
- **Jadwal mengajar (`/kelas-saya/jadwal`)**: `PageHeader`, `EmptyState`. The no-year text for teachers no longer tells them to create a year.
- Shared timetable parts: the locked badge is `StatusChip tone="brand"`, and the year chips prefetch. The "Jadwal kelas" button on the class page was already done in part A.
- `ConfirmAction` gains an optional `ariaLabel` (fuller name for buttons repeated on every row).

**D-472 review of `calendar.json` and `timetable.json`** (by hand; the automated checks passed before and after): labels, buttons and titles were already sentence case. Changes: "menu Tahun Ajaran" → "menu Tahun ajaran"; "Tanggal dari Tahun ajaran sekolah" / "Tanggal di Tahun ajaran sekolah" → lower case (running text about the school's year, not the menu name). The confirm texts were rewritten as title + consequence + named action (no "Lanjutkan?"). New keys: `calendar.list.{edit_label,delete_label,delete_title,delete_action}`, `timetable.class.{edit_label,lock_label,unlock_label,delete_label,delete_title,delete_row_action}`, `timetable.draft.save_title`, `timetable.index.{year_meta,table_caption,class_column,status_column,warnings_column,no_warnings,open_label}`, `timetable.no_year_teacher`. Unused `calendar.list.actions` removed. Neither file uses "file"; "berkas" was already in place.

**Checks**: lint, typecheck, format check, `node ace build` and all 349 tests pass (`sigrak_test_r112b`). Playwright (Chromium, scale 1) over 40 pages × 360/1280 × light/dark (160 page checks): no horizontal scroll, no tap target under 44 px at 360, visible focus on the first three Tab stops, no serious or critical axe findings, 0 flagged. Open states were shot too: Lainnya sheet/account menu, invitation cancel confirm, calendar edit sheet/dialog and delete confirm, timetable row edit and delete confirm, draft save confirm. In total there are 188 images and a contact sheet (`index.html`), all kept in the session scratchpad (`r112b/`), not in the repository. Demo data for the shots: `setup.cjs` (part A), then `setup2.cjs` (guru kelas and guru mapel for 1A, saved frame, a saved draft for 1A with one locked row, and a ready draft for all classes) and `setup3.cjs` (two school events). The dev database needs `node ace curriculum:import` and a dev-server restart before the class page lists subjects.

**Shared files touched**: `inertia/components/patterns/confirm_dialog.tsx` (`ariaLabel`), `inertia/components/timetable/parts.tsx`, `resources/lang/id/{calendar,timetable}.json`, this task file. No new dependencies; `app/`, `start/`, `database/`, tests untouched.

**Visual questions from part B**

9. The phone view of a full class timetable is long (six days × about 10 rows, each with three buttons). Should rows collapse per day (one day open at a time), or should a day picker sit above the list?
10. Draft states as chips: Menunggu giliran (grey), Sedang disusun (info), Siap dilihat (brand), Belum berhasil (danger), Sudah disimpan (ok). OK?
11. "Tambah acara sekolah" stays as a card under the calendar. Should it become a header button with a sheet, like the row edits?
