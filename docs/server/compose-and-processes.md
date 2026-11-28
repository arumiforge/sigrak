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
| `nginx` | Pintu masuk: file statis dengan cache immutable dan kompresi, pembagian host, SSE tanpa buffering, IP asli dari `CF-Connecting-IP`, batas permintaan yang cocok untuk sekolah satu IP, batas ukuran unggahan, halaman "sedang perbaikan" | **Satu-satunya port terbuka**: `127.0.0.1:8199` (produksi), `127.0.0.1:8198` (staging); alamat tetap di jaringan `edge`, lihat [sekolah-satu-ip.md](sekolah-satu-ip.md) |
| `web` | `app.` dan `admin.` | beberapa salinan di produksi |
| `exam` | `ujian.` | bisa dikecilkan ke 0 (TKA hanya add-on, D-392) |
| `worker-ai`, `worker-exports`, `worker-default` | Antrean BullMQ | `stop_grace_period` cukup panjang untuk menyelesaikan tugas |
| `scheduler` | Tugas terjadwal | selalu tepat satu salinan |
| `migrate` | Migrasi database | dijalankan sekali `docker compose run --rm migrate` sebelum deploy, tidak pernah saat web menyala |
| `postgres` | PostgreSQL 19 + pgvector (`pgvector/pgvector:pg19`) | pgBackRest mengirim WAL ke R2 |
| `redis` | Redis 8 untuk **state**: antrean BullMQ, sesi, batas percobaan login, Transmit | `noeviction` + AOF, supaya antrean tetap ada setelah restart (D-480) |
| `redis-cache` | Redis 8 untuk **cache** yang bisa dibangun ulang (hasil resolver lapisan, cache halaman) | `allkeys-lru` + batas memori, tanpa AOF/RDB dan tanpa volume (D-480) |

GlitchTip dan pemantauan berjalan sebagai proyek terpisah, `sigrak-ops`, satu per VPS; staging dan produksi sama-sama melapor ke sana.

## Aturan untuk semua layanan

- `restart: unless-stopped`, `healthcheck`, log json-file `max-size: 10m`, `max-file: 5`, `init: true`.
- Hanya nginx yang membuka port, dan hanya di `127.0.0.1`. Database dan Redis tidak punya port terbuka.
- Kontainer berjalan sebagai user biasa (bukan root), tanpa akses Docker socket, sistem file read-only bila memungkinkan.
- Rahasia hanya di `stack.env` (mode `600`) di server.
- File berisi data pribadi murid disimpan di volume bernama di disk VPS (D-400) dan ikut dibackup.
- Image pihak ketiga dikunci ke versi pasti; pembaruan datang sebagai PR.

## Dua Redis: state dan cache

Cache yang terus tumbuh tidak boleh membuat antrean atau sesi gagal, jadi keduanya dipisah ke dua kontainer (D-480).

| | `redis` (state) | `redis-cache` (cache) |
|---|---|---|
| Isi | antrean BullMQ, sesi, batas percobaan login, Transmit, status kunci AI | hasil resolver lapisan dan cache lain yang bisa dihitung ulang |
| Saat memori penuh | `noeviction`: penulisan baru ditolak dan terlihat sebagai error; tidak ada data yang dibuang diam-diam. BullMQ mewajibkan ini | `allkeys-lru`: kunci yang paling lama tidak dipakai dibuang |
| Persistensi | AOF (`appendfsync everysec`), volume bernama, ikut backup | tidak ada (tanpa AOF, tanpa RDB, tanpa volume) |
| Batas memori | `maxmemory 2gb`, peringatan di 70% | `maxmemory 1gb` |
| Bila mati | antrean, login, dan SSE berhenti: gangguan besar | halaman lebih lambat, tidak ada data yang hilang |
| Variabel aplikasi | `REDIS_HOST=redis`, `REDIS_PASSWORD` | `REDIS_CACHE_HOST=redis-cache`, `REDIS_CACHE_PASSWORD` |

```yaml
services:
    redis:
        image: redis:8.8-alpine
        command:
            - redis-server
            - --appendonly
            - 'yes'
            - --appendfsync
            - everysec
            - --maxmemory
            - 2gb
            - --maxmemory-policy
            - noeviction
            - --requirepass
            - ${REDIS_PASSWORD}
        volumes:
            - redis:/data

    redis-cache:
        image: redis:8.8-alpine
        command:
            - redis-server
            - --save
            - ''
            - --appendonly
            - 'no'
            - --maxmemory
            - 1gb
            - --maxmemory-policy
            - allkeys-lru
            - --requirepass
            - ${REDIS_CACHE_PASSWORD}
```

Catatan:

- Staging punya `redis` dan `redis-cache` sendiri di proyek Compose-nya; tidak pernah memakai Redis produksi.
- Di laptop dan CI, `REDIS_CACHE_HOST` boleh kosong: aplikasi memakai database 3 di Redis yang sama. `compose.yaml` di akar repo juga menyediakan `redis-cache` di port 6380.
- Host perlu `vm.overcommit_memory = 1` (sysctl) supaya Redis bisa menulis AOF ulang di belakang layar tanpa gagal.
- Setelah database dipulihkan dari backup, kosongkan cache: `dc run --rm web node ace cache:clear`, lalu restart `web` dan `exam`. Kunci cache memuat stempel lapisan dari database, dan pemulihan memutar stempel itu mundur. Perintah ini hanya menghapus isi `redis-cache`, tidak menyentuh antrean atau sesi.

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
| nginx, Redis | — | nginx `worker_processes auto`; kedua Redis ringan |

Staging dibatasi 1–2 core supaya tidak pernah memperlambat produksi.

Syarat supaya banyak salinan berjalan benar:

1. **Tanpa state di memori proses**: sesi dan batas percobaan login disimpan di `redis`, cache di `redis-cache`, jadi salinan mana pun bisa melayani permintaan apa pun. Cache kecil di memori proses hanya boleh untuk nilai yang kuncinya sudah memuat versi datanya (misalnya stempel lapisan), sehingga tidak pernah basi.
2. **SSE lintas salinan**: Transmit memakai jalur Redis, sehingga pesan dari worker sampai ke pengguna di salinan web mana pun ia terhubung.
3. **Pekerjaan berat tidak pernah di web**: PDF, ekspor, dan AI selalu lewat BullMQ ke worker.
4. **Satu scheduler**: tepat satu salinan, supaya tugas terjadwal tidak jalan dobel.
5. **Pengaturan Node per kontainer**: `--max-old-space-size` disesuaikan dengan batas memori kontainer; `UV_THREADPOOL_SIZE` dinaikkan untuk hashing password dan baca-tulis file.
6. **Deploy bergilir**: salinan diganti satu per satu.

## Memori di VPS 32 GB (perkiraan awal)

| Bagian | Perkiraan |
|---|---|
| Produksi | PostgreSQL ≈ 10 GB, web ≈ 3 GB, worker ≈ 3 GB, `redis` ≈ 1 GB (batas 2 GB), `redis-cache` batas 1 GB, nginx dan lainnya ≈ 1 GB |
| Staging (batas ketat) | ≈ 4 GB |
| GlitchTip dan pemantauan | ≈ 2–3 GB |
| Sistem dan cache disk | sisanya |

Disetel ulang setelah uji k6.
