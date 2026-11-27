# Docker Compose, peran proses, dan pemakaian banyak core

Susunan target untuk fase R3, mengikuti kontrak aplikasi Fondasi. Versi mengikuti aturan versi pemilik (LTS/stabil terbaru, dikunci persis, diperbarui lewat PR): Node 26, PostgreSQL 19, nginx 1.30 stable, Redis 8.

## Satu file compose, dua lingkungan

- Folder di server: `/opt/apps/sigrak/production/` dan `/opt/apps/sigrak/staging/`.
- Keduanya memakai `deploy/compose.yaml` dari repo; bedanya hanya `stack.env` dan nama proyek (`sigrak-production`, `sigrak-staging`).
- Setiap lingkungan punya database, Redis, volume, dan jaringan sendiri. Data pribadi produksi tidak pernah masuk staging.
- Laptop memakai `compose.yaml` di akar repo (hanya PostgreSQL dan Redis).

## Layanan per lingkungan

Semua layanan aplikasi memakai image yang sama dengan perintah berbeda.

| Layanan | Tugas | Catatan |
|---|---|---|
| `nginx` | Pintu masuk: file statis dengan cache immutable dan kompresi, pembagian host, SSE tanpa buffering, IP asli dari `CF-Connecting-IP`, batas ukuran unggahan, halaman "sedang perbaikan" | **Satu-satunya port terbuka**: `127.0.0.1:8199` (produksi), `127.0.0.1:8198` (staging) |
| `web` | `app.` dan `admin.` | beberapa salinan di produksi |
| `exam` | `ujian.` | bisa dikecilkan ke 0 (TKA hanya add-on, D-392) |
| `worker-ai`, `worker-exports`, `worker-default` | Antrean BullMQ | `stop_grace_period` cukup panjang untuk menyelesaikan tugas |
| `scheduler` | Tugas terjadwal | selalu tepat satu salinan |
| `migrate` | Migrasi database | dijalankan sekali `docker compose run --rm migrate` sebelum deploy, tidak pernah saat web menyala |
| `postgres` | PostgreSQL 19 + pgvector (`pgvector/pgvector:pg19`) | pgBackRest mengirim WAL ke R2 |
| `redis` | Redis 8 | AOF menyala, supaya antrean tetap ada setelah restart |

GlitchTip dan pemantauan berjalan sebagai proyek terpisah, `sigrak-ops`, satu per VPS; staging dan produksi sama-sama melapor ke sana.

## Aturan untuk semua layanan

- `restart: unless-stopped`, `healthcheck`, log json-file `max-size: 10m`, `max-file: 5`, `init: true`.
- Hanya nginx yang membuka port, dan hanya di `127.0.0.1`. Database dan Redis tidak punya port terbuka.
- Kontainer berjalan sebagai user biasa (bukan root), tanpa akses Docker socket, sistem file read-only bila memungkinkan.
- Rahasia hanya di `stack.env` (mode `600`) di server.
- File berisi data pribadi murid disimpan di volume bernama di disk VPS (D-400) dan ikut dibackup.
- Image pihak ketiga dikunci ke versi pasti; pembaruan datang sebagai PR.

## Deploy

1. CI membangun image dari commit yang pasti (label `org.opencontainers.image.revision`), tag = 12 karakter pertama commit, disimpan di GitHub Container Registry (privat) sebagai `ghcr.io/arumiforge/sigrak`. Nama `owner/repo` hanya ditulis di satu variabel CI (`REPOSITORY`).
2. Staging dulu; produksi menjalankan **image yang sama** yang sudah jalan di staging.
3. Setiap deploy: backup → `migrate` → `docker compose up -d --wait`. Salinan web diganti satu per satu supaya aplikasi tetap menyala.
4. Image sebelumnya disimpan untuk rollback satu perintah. Migrasi tidak di-rollback; pulihkan backup sebagai gantinya.

## Memakai semua core dengan Node.js

Satu proses Node.js menjalankan JavaScript di satu core. SIGRAK memakai banyak core dengan menjalankan **beberapa proses, satu per kontainer**, yang jumlahnya diatur lewat `deploy.replicas`. Tidak memakai PM2 atau mode cluster di dalam kontainer: Docker sudah mengurus restart, healthcheck, batas, dan log tiap proses; satu salinan yang macet tidak menjatuhkan yang lain; dan salinan bisa diganti satu per satu.

Pembagian awal 12 vCPU (disetel ulang setelah uji k6, R0-08):

| Bagian | Salinan | Alasan |
|---|---|---|
| `web` | 4 | sekitar satu core per salinan; nginx membagi permintaan bergiliran |
| `exam` | 1, naik ke 2–3 saat musim TKA | add-on, tidak selalu aktif |
| `worker-ai` | 1 | lebih banyak menunggu penyedia AI, jadi satu proses bisa memproses banyak tugas sekaligus (concurrency ≈ 20) |
| `worker-exports` | 2 | PDF dan Excel berat di CPU: 1–2 tugas per salinan; Typst CLI berjalan sebagai proses tersendiri |
| `worker-default`, `scheduler` | 1 + 1 | ringan |
| PostgreSQL | — | memakai banyak core sendiri; sisakan sekitar 4 core |
| nginx, Redis | — | nginx `worker_processes auto`; Redis ringan |

Staging dibatasi 1–2 core supaya tidak pernah memperlambat produksi.

Syarat supaya banyak salinan berjalan benar:

1. **Tanpa state di memori proses**: sesi, batas percobaan login, dan cache disimpan di Redis, jadi salinan mana pun bisa melayani permintaan apa pun.
2. **SSE lintas salinan**: Transmit memakai jalur Redis, sehingga pesan dari worker sampai ke pengguna di salinan web mana pun ia terhubung.
3. **Pekerjaan berat tidak pernah di web**: PDF, ekspor, dan AI selalu lewat BullMQ ke worker.
4. **Satu scheduler**: tepat satu salinan, supaya tugas terjadwal tidak jalan dobel.
5. **Pengaturan Node per kontainer**: `--max-old-space-size` disesuaikan dengan batas memori kontainer; `UV_THREADPOOL_SIZE` dinaikkan untuk hashing password dan baca-tulis file.
6. **Deploy bergilir**: salinan diganti satu per satu.

## Memori di VPS 32 GB (perkiraan awal)

| Bagian | Perkiraan |
|---|---|
| Produksi | PostgreSQL ≈ 10 GB, web ≈ 3 GB, worker ≈ 3 GB, Redis ≈ 1 GB, nginx dan lainnya ≈ 1 GB |
| Staging (batas ketat) | ≈ 4 GB |
| GlitchTip dan pemantauan | ≈ 2–3 GB |
| Sistem dan cache disk | sisanya |

Disetel ulang setelah uji k6.
