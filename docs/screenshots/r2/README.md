# R2 screenshots (staff console)

Every R2 console page at 360 px (phone) and 1280 px (desktop), light and dark, taken with Playwright at the end of R2-09 (D-475), plus the app pages R2 touched. File names: `<page>-<width>-<theme>.png`. Full-page shots, losslessly optimised.

Demo data is invented (`node ace db:seed` in development: `database/demo/console_demo.ts`); no real people. Console pages are seen as the demo Pemilik (owner), except Ringkasan (Support), Permintaan bantuan: detail and Lihat sekolah, which are seen as the demo Support colleague with a read-only support session open (banner at the top). School names in the directory come from the public NPSN directory in `docs/data/schools/`.

192 files, 18.2 MB. Retake when the shell changes visibly.

## Sign-in and 2FA

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Staff sign-in | [view](auth-staff-login-360-light.png) | [view](auth-staff-login-360-dark.png) | [view](auth-staff-login-1280-light.png) | [view](auth-staff-login-1280-dark.png) |
| 2FA code step | [view](auth-two-factor-code-360-light.png) | [view](auth-two-factor-code-360-dark.png) | [view](auth-two-factor-code-1280-light.png) | [view](auth-two-factor-code-1280-dark.png) |
| 2FA enrolment (forced for Admin) | [view](auth-two-factor-setup-360-light.png) | [view](auth-two-factor-setup-360-dark.png) | [view](auth-two-factor-setup-1280-light.png) | [view](auth-two-factor-setup-1280-dark.png) |
| Akun (2FA on) | [view](account-360-light.png) | [view](account-360-dark.png) | [view](account-1280-light.png) | [view](account-1280-dark.png) |

## Home

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Ringkasan (Pemilik: every group) | [view](home-owner-360-light.png) | [view](home-owner-360-dark.png) | [view](home-owner-1280-light.png) | [view](home-owner-1280-dark.png) |
| Ringkasan (Support: own groups, support banner) | [view](home-support-360-light.png) | [view](home-support-360-dark.png) | [view](home-support-1280-light.png) | [view](home-support-1280-dark.png) |

## Sekolah

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Sekolah | [view](schools-360-light.png) | [view](schools-360-dark.png) | [view](schools-1280-light.png) | [view](schools-1280-dark.png) |
| School detail | [view](school-360-light.png) | [view](school-360-dark.png) | [view](school-1280-light.png) | [view](school-1280-dark.png) |
| Pengguna (search) | [view](users-360-light.png) | [view](users-360-dark.png) | [view](users-1280-light.png) | [view](users-1280-dark.png) |
| Direktori sekolah | [view](directory-360-light.png) | [view](directory-360-dark.png) | [view](directory-1280-light.png) | [view](directory-1280-dark.png) |
| Perubahan wilayah | [view](region-changes-360-light.png) | [view](region-changes-360-dark.png) | [view](region-changes-1280-light.png) | [view](region-changes-1280-dark.png) |
| Usulan wilayah | [view](area-proposals-360-light.png) | [view](area-proposals-360-dark.png) | [view](area-proposals-1280-light.png) | [view](area-proposals-1280-dark.png) |
| Kalender wilayah | [view](calendar-360-light.png) | [view](calendar-360-dark.png) | [view](calendar-1280-light.png) | [view](calendar-1280-dark.png) |

## Konten

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Kabar | [view](announcements-360-light.png) | [view](announcements-360-dark.png) | [view](announcements-1280-light.png) | [view](announcements-1280-dark.png) |
| Kabar: new | [view](announcement-new-360-light.png) | [view](announcement-new-360-dark.png) | [view](announcement-new-1280-light.png) | [view](announcement-new-1280-dark.png) |
| Kabar: edit | [view](announcement-360-light.png) | [view](announcement-360-dark.png) | [view](announcement-1280-light.png) | [view](announcement-1280-dark.png) |
| Acara | [view](events-360-light.png) | [view](events-360-dark.png) | [view](events-1280-light.png) | [view](events-1280-dark.png) |
| Acara: edit | [view](event-360-light.png) | [view](event-360-dark.png) | [view](event-1280-light.png) | [view](event-1280-dark.png) |
| Cerita Sekolah | [view](stories-360-light.png) | [view](stories-360-dark.png) | [view](stories-1280-light.png) | [view](stories-1280-dark.png) |
| Halaman legal | [view](legal-360-light.png) | [view](legal-360-dark.png) | [view](legal-1280-light.png) | [view](legal-1280-dark.png) |
| Halaman legal: version | [view](legal-version-360-light.png) | [view](legal-version-360-dark.png) | [view](legal-version-1280-light.png) | [view](legal-version-1280-dark.png) |

## Bantuan

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Permintaan bantuan | [view](help-requests-360-light.png) | [view](help-requests-360-dark.png) | [view](help-requests-1280-light.png) | [view](help-requests-1280-dark.png) |
| Permintaan bantuan: detail | [view](help-request-360-light.png) | [view](help-request-360-dark.png) | [view](help-request-1280-light.png) | [view](help-request-1280-dark.png) |
| Sesi bantuan | [view](support-sessions-360-light.png) | [view](support-sessions-360-dark.png) | [view](support-sessions-1280-light.png) | [view](support-sessions-1280-dark.png) |
| Lihat sekolah (read-only support view) | [view](support-view-360-light.png) | [view](support-view-360-dark.png) | [view](support-view-1280-light.png) | [view](support-view-1280-dark.png) |
| Bank Masalah | [view](problems-360-light.png) | [view](problems-360-dark.png) | [view](problems-1280-light.png) | [view](problems-1280-dark.png) |
| Bank Masalah: detail | [view](problem-360-light.png) | [view](problem-360-dark.png) | [view](problem-1280-light.png) | [view](problem-1280-dark.png) |
| Forum Masalah→Solusi | [view](forum-meetings-360-light.png) | [view](forum-meetings-360-dark.png) | [view](forum-meetings-1280-light.png) | [view](forum-meetings-1280-dark.png) |
| Forum: meeting | [view](forum-meeting-360-light.png) | [view](forum-meeting-360-dark.png) | [view](forum-meeting-1280-light.png) | [view](forum-meeting-1280-dark.png) |

## Kurikulum

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Kurikulum | [view](curriculum-360-light.png) | [view](curriculum-360-dark.png) | [view](curriculum-1280-light.png) | [view](curriculum-1280-dark.png) |
| Kurikulum: version | [view](curriculum-version-360-light.png) | [view](curriculum-version-360-dark.png) | [view](curriculum-version-1280-light.png) | [view](curriculum-version-1280-dark.png) |
| Kurikulum: compare | [view](curriculum-compare-360-light.png) | [view](curriculum-compare-360-dark.png) | [view](curriculum-compare-1280-light.png) | [view](curriculum-compare-1280-dark.png) |
| Kurikulum: impact | [view](curriculum-impact-360-light.png) | [view](curriculum-impact-360-dark.png) | [view](curriculum-impact-1280-light.png) | [view](curriculum-impact-1280-dark.png) |
| Bank Praktik Baik | [view](good-practices-360-light.png) | [view](good-practices-360-dark.png) | [view](good-practices-1280-light.png) | [view](good-practices-1280-dark.png) |

## Sistem

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Pengaturan (trial length and Tambah hari limit) | [view](settings-360-light.png) | [view](settings-360-dark.png) | [view](settings-1280-light.png) | [view](settings-1280-dark.png) |
| Integrasi | [view](integrations-360-light.png) | [view](integrations-360-dark.png) | [view](integrations-1280-light.png) | [view](integrations-1280-dark.png) |
| Model AI | [view](ai-models-360-light.png) | [view](ai-models-360-dark.png) | [view](ai-models-1280-light.png) | [view](ai-models-1280-dark.png) |
| Kesehatan sistem | [view](system-health-360-light.png) | [view](system-health-360-dark.png) | [view](system-health-1280-light.png) | [view](system-health-1280-dark.png) |

## Tim

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Staf (with 2FA column) | [view](staff-360-light.png) | [view](staff-360-dark.png) | [view](staff-1280-light.png) | [view](staff-1280-dark.png) |
| Staf: member | [view](staff-member-360-light.png) | [view](staff-member-360-dark.png) | [view](staff-member-1280-light.png) | [view](staff-member-1280-dark.png) |
| Log aktivitas | [view](activity-log-360-light.png) | [view](activity-log-360-dark.png) | [view](activity-log-1280-light.png) | [view](activity-log-1280-dark.png) |
| Peran (sticky first column) | [view](roles-360-light.png) | [view](roles-360-dark.png) | [view](roles-1280-light.png) | [view](roles-1280-dark.png) |

## App (teacher)

| Page | 360 light | 360 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Kabar | [view](app-news-360-light.png) | [view](app-news-360-dark.png) | [view](app-news-1280-light.png) | [view](app-news-1280-dark.png) |
| Kabar: item | [view](app-news-item-360-light.png) | [view](app-news-item-360-dark.png) | [view](app-news-item-1280-light.png) | [view](app-news-item-1280-dark.png) |
| Minta bantuan | [view](app-request-help-360-light.png) | [view](app-request-help-360-dark.png) | [view](app-request-help-1280-light.png) | [view](app-request-help-1280-dark.png) |
| Bantuan saya | [view](app-my-help-360-light.png) | [view](app-my-help-360-dark.png) | [view](app-my-help-1280-light.png) | [view](app-my-help-1280-dark.png) |
| Bantuan saya: request | [view](app-my-help-item-360-light.png) | [view](app-my-help-item-360-dark.png) | [view](app-my-help-item-1280-light.png) | [view](app-my-help-item-1280-dark.png) |
| Account menu open (bottom navigation at 360) | [view](app-account-menu-360-light.png) | [view](app-account-menu-360-dark.png) | [view](app-account-menu-1280-light.png) | [view](app-account-menu-1280-dark.png) |
