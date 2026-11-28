# Runbook insiden

Langkah singkat saat SIGRAK bermasalah: situs mati, disk penuh, database lambat, kunci atau rahasia bocor, dan backup terlambat. Panduan ini juga ada di situs catatan `note.sigrak.com` (D-436), jadi tetap bisa dibaca saat VPS mati.

Bacalah bagian "Aturan dasar" sekali sebelum ada insiden. Saat insiden, langsung ke bagian yang sesuai.

Dalam panduan ini:

- [Aturan dasar](#aturan-dasar)
- [Persiapan di terminal](#persiapan-di-terminal)
- [Alur umum setiap insiden](#alur-umum-setiap-insiden)
- [Situs mati](#situs-mati)
- [Disk penuh](#disk-penuh)
- [Database lambat](#database-lambat)
- [Kunci bocor](#kunci-bocor)
- [Backup atau WAL terlambat](#backup-atau-wal-terlambat)
- [Catatan insiden](#catatan-insiden)
- [Nilai yang belum ditentukan](#nilai-yang-belum-ditentukan)

## Aturan dasar

- **Satu orang memegang insiden.** Dia yang memutuskan langkah dan memperbarui halaman status. Orang lain membantu atas permintaannya.
- **Catat waktu setiap langkah** sejak menit pertama, termasuk yang gagal. Catatan ini dipakai untuk laporan sesudahnya.
- **Jangan menghapus data untuk "mencoba".** Jangan pernah menghapus file di folder data PostgreSQL atau `pg_wal`, jangan `docker compose down -v`, jangan `docker volume rm`.
- **Satu perubahan, lalu periksa.** Jangan mengubah beberapa hal sekaligus, supaya jelas mana yang menolong.
- **Pekerjaan panjang di tmux** yang diberi nama, misalnya `tmux new -s insiden-2026-12-01` ([terminal-safety.md](terminal-safety.md)).
- **Rahasia tidak pernah masuk chat**, termasuk chat dengan agen AI. Yang boleh ditempel: blok `State`/`Next`/`Needs attention` dari `check.sh` dan output `check-app`, bukan isi `stack.env`.
- **Data pribadi produksi tidak pernah dibawa ke staging**, juga tidak untuk "mencoba ulang masalahnya".
- **Sekolah diberi tahu** lewat halaman status bila gangguan terlihat oleh pengguna ([halaman-status.md](halaman-status.md)).

### Tingkat insiden

| Tingkat | Contoh                                                                                                                              | Mulai ditangani                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Berat   | `app.` atau `ujian.` mati untuk semua orang, data terancam, kunci bocor dan sudah dipakai orang lain, ujian terganggu saat berjalan | segera, jam berapa pun                |
| Sedang  | sebagian fitur mati (AI, ekspor PDF), aplikasi sangat lambat, backup atau WAL terlambat, disk tersisa kurang dari 10%               | dalam 1 jam pada hari dan jam sekolah |
| Ringan  | staging mati, satu panel ops mati, peringatan disk di bawah 25%                                                                     | hari kerja berikutnya                 |

Tingkat dan batas waktu ini aturan yang berlaku (D-465).

### Ke mana peringatan datang

| Sumber               | Isi                                                                                             | Dikirim ke |
| -------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| Better Stack         | `app.`/`ujian.` tidak menjawab dari luar; heartbeat backup, WAL, latihan pemulihan, `check-app` | Slack      |
| Uptime Kuma (di VPS) | pemeriksaan internal: kontainer, port lokal, layanan ops                                        | Telegram   |
| Netdata (di VPS)     | CPU, RAM, disk, kontainer                                                                       | Telegram   |
| GlitchTip (di VPS)   | error aplikasi                                                                                  | Slack      |

Bila Better Stack berbunyi tetapi Uptime Kuma dan Netdata diam, kemungkinan besar VPS atau tunnelnya sendiri yang mati.

### Jalan masuk ke server

Coba dari atas ke bawah. Alamat, port, dan kunci ada di password manager.

1. SSH lewat Access: `ssh ssh-sigrak-1.<domain>` ([cloudflare-access.md](cloudflare-access.md)).
2. Cockpit lewat Access: `https://konsol-sigrak-1.<domain>` → **Terminal**.
3. Portainer lewat Access: `https://portainer.sigrak.com`. Hanya untuk melihat kontainer, membaca log, dan restart.
4. SSH langsung ke port SSH dari penyedia, dengan kunci. Ini jalan terakhir saat tunnel mati.
5. Panel penyedia VPS: lihat status mesin dan reboot. Pakai hanya bila semua jalan di atas gagal.

## Persiapan di terminal

Semua contoh perintah di bawah memakai produksi. Jalankan blok ini sekali setiap membuka sesi:

```bash
cd /opt/apps/sigrak/production
dc() { docker compose -p sigrak-production -f /opt/apps/sigrak/src/deploy/compose.yaml --env-file stack.env "$@"; }
PORT=$(awk '$2=="sigrak-production"{print $1}' /opt/apps/PORTS)
echo "$PORT"
```

Untuk staging, ganti `production` dengan `staging` di ketiga tempat. Susunan perintah `dc` ini mengikuti [compose-and-processes.md](compose-and-processes.md); bila skrip R3 menyediakan pembungkus sendiri, pakai itu.

Perintah yang sering dipakai:

```bash
sudo bash /opt/apps/_fondasi/server/check.sh   # whole server, read-only
sudo /opt/apps/sigrak/check-app                # SIGRAK checks, read-only, under 120 s
dc ps                                          # containers and health
dc logs --tail=200 web                         # last lines of one service
docker stats --no-stream                       # CPU and memory per container
```

## Alur umum setiap insiden

1. **Pastikan masalahnya nyata.** Buka `https://app.sigrak.com` dari HP dengan data seluler (bukan Wi-Fi kantor). Lihat Better Stack: dari berapa lokasi gagal, sejak kapan.
2. **Tentukan pemegang insiden dan tingkatnya.** Mulai catatan insiden (format di bagian akhir) sebagai kartu baru di proyek "Ops".
3. **Beri tahu sekolah** bila gangguan terlihat oleh pengguna: tulis laporan pertama di halaman status dalam 15 menit ([halaman-status.md](halaman-status.md)).
4. **Masuk ke server** dan jalankan `check.sh` lalu `check-app`. Simpan output-nya di catatan insiden.
5. **Ikuti bagian yang sesuai** di bawah.
6. **Pulihkan dulu, cari akar masalah kemudian.** Restart atau rollback boleh dilakukan sebelum penyebabnya jelas, asal tidak menghapus data.
7. **Tutup insiden**: halaman status "Selesai", catatan insiden lengkap, dan tindak lanjut ditulis sebagai tugas dalam 2 hari kerja.

## Situs mati

Gejala: Better Stack melaporkan `app.sigrak.com` atau `ujian.sigrak.com` tidak menjawab, atau sekolah melapor tidak bisa membuka aplikasi.

### 1. Baca pesan di browser

| Yang terlihat                                         | Artinya                                                     | Lanjut ke |
| ----------------------------------------------------- | ----------------------------------------------------------- | --------- |
| Halaman error Cloudflare **1033** atau "Tunnel error" | `cloudflared` di VPS tidak terhubung, atau VPS mati         | langkah 2 |
| Halaman error Cloudflare **502** atau **504**         | tunnel hidup, tetapi nginx tidak menjawab atau terlalu lama | langkah 3 |
| Halaman error milik nginx atau aplikasi (500, 503)    | nginx hidup, aplikasi di belakangnya bermasalah             | langkah 4 |
| Semua situs lain di Cloudflare juga error             | gangguan di Cloudflare sendiri                              | langkah 6 |
| Tidak bisa SSH, Cockpit, dan Portainer sama sekali    | VPS mati atau jaringannya putus                             | langkah 5 |

### 2. Tunnel

```bash
systemctl status cloudflared --no-pager
journalctl -u cloudflared --since "30 min ago" --no-pager | tail -50
sudo systemctl restart cloudflared
```

Masuk lewat SSH langsung (jalan nomor 4) bila SSH lewat Access juga mati. Setelah restart, tunggu 1 menit lalu cek di dasbor Cloudflare: **Networks → Tunnels**, status `sigrak-1` harus **Healthy**. Bila log menyebut token tidak sah, lihat [Kunci bocor](#kunci-bocor) bagian token tunnel.

### 3. nginx

```bash
curl -sI "http://127.0.0.1:$PORT/healthz"
dc ps nginx
dc logs --tail=100 nginx
dc up -d --wait nginx
```

`curl` harus menjawab `HTTP/1.1 200`. Bila nginx hidup tetapi menjawab 502, masalahnya di layanan `web` atau `exam` (langkah 4). Pastikan juga port di rute tunnel sama dengan angka di `/opt/apps/PORTS`.

### 4. Aplikasi

```bash
dc ps
dc logs --tail=200 web
dc logs --tail=200 exam
```

Lihat juga GlitchTip untuk error yang baru muncul. Lalu, sesuai yang ditemukan:

- **Kontainer `unhealthy` atau berhenti**: `dc up -d --wait web` (atau `exam`). Salinan diganti satu per satu.
- **Masalah muncul tepat setelah deploy**: kembalikan ke image sebelumnya dengan `<perintah rollback>`. Migrasi tidak di-rollback. Bila migrasi merusak data, pulihkan backup bersama pengembang ([compose-and-processes.md](compose-and-processes.md) bagian Deploy).
- **Error koneksi database atau Redis** di log: periksa `dc ps postgres <layanan pgbouncer> redis`, lalu lanjut ke [Database lambat](#database-lambat) atau [Disk penuh](#disk-penuh).
- **RAM habis** (`docker stats` menunjukkan kontainer di batasnya, log berisi `heap out of memory` atau `OOMKilled`): restart layanan itu, lalu catat untuk penyetelan `--max-old-space-size`.
- **Hanya fitur AI atau ekspor yang macet**: periksa `dc logs --tail=200 worker-ai` atau `worker-exports`. Bila penyedia AI sedang gangguan, cukup umumkan di halaman status; aplikasi lain tetap jalan.

Perbaikan butuh waktu lama dan pengguna perlu diberi tahu? Nyalakan halaman "sedang perbaikan" di nginx dengan `<cara menyalakan halaman perbaikan>`.

### 5. VPS mati

1. Cek panel penyedia VPS: apakah mesin menyala? Ada pengumuman gangguan dari penyedia?
2. Bila mesin mati atau macet, nyalakan ulang dari panel. Kontainer hidup sendiri (`restart: unless-stopped`). Setelah menyala, jalankan `check.sh` dan `check-app`.
3. Hubungi support penyedia secara tertulis, minta perkiraan waktu.
4. Bila VPS belum kembali dalam `<batas menit sebelum pindah>` menit, mulai pindah ke VPS cadangan `sigrak-2` mengikuti `<runbook pemulihan darurat>`. Target: layanan kembali dalam 1 jam, data hilang paling banyak 5 menit (D-405). Pindah hostname di tunnel dijelaskan di [cloudflare-access.md](cloudflare-access.md) bagian 5.

### 6. Gangguan Cloudflare

Lihat `https://www.cloudflarestatus.com`. Tidak ada yang bisa diperbaiki dari server. Tulis di halaman status bahwa gangguan ada di penyedia jaringan, lalu pantau. Jangan mengubah DNS atau tunnel selama gangguan berlangsung.

## Disk penuh

Gejala: Netdata atau `check-app` memperingatkan disk tersisa kurang dari 25%, aplikasi gagal menyimpan, atau log berisi `No space left on device`.

Disk 100% berbahaya: PostgreSQL bisa berhenti. Kerjakan dengan tenang tetapi segera.

### 1. Lihat apa yang memenuhi disk

```bash
df -h /
docker system df
sudo ncdu -x /
sudo du -sh /opt/apps/sigrak/*/backups
journalctl --disk-usage
```

### 2. Penyebab yang paling sering, dari yang paling aman

| Penyebab                                  | Cara memeriksa                                                | Cara membereskan                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image dan build cache lama                | `docker system df`                                            | `docker image prune` (hanya image tanpa tag) dan `docker builder prune`. Jangan `docker image prune -a` tanpa memeriksa: image sebelumnya disimpan untuk rollback.                                            |
| Backup lokal menumpuk                     | `du -sh /opt/apps/sigrak/*/backups`                           | Backup lokal disimpan 7 hari (D-404). Bila lebih tua dari itu masih ada, pembersihannya gagal: catat untuk perbaikan. Hapus hanya yang lebih tua dari 7 hari, dan hanya setelah memastikan salinan di R2 ada. |
| WAL menumpuk karena kiriman ke R2 gagal   | lihat [Backup atau WAL terlambat](#backup-atau-wal-terlambat) | Perbaiki pengirimannya. PostgreSQL menghapus WAL lama sendiri setelah terkirim. **Jangan pernah menghapus file di `pg_wal` dengan tangan.**                                                                   |
| Log journald                              | `journalctl --disk-usage`                                     | `sudo journalctl --vacuum-size=500M`                                                                                                                                                                          |
| Staging memakan tempat                    | `docker system df -v`                                         | Matikan staging sementara: `docker compose -p sigrak-staging stop`. Datanya tetap ada.                                                                                                                        |
| File unggahan atau database memang tumbuh | `ncdu`, Netdata (tren disk)                                   | Bukan sesuatu untuk dihapus. Rencanakan tambah disk dengan pemilik.                                                                                                                                           |

Log kontainer sudah dibatasi 10 MB × 5 per layanan, jadi jarang menjadi penyebab.

### 3. Setelah ada ruang

```bash
dc ps
sudo /opt/apps/sigrak/check-app
```

Bila PostgreSQL sempat berhenti, dia hidup lagi sendiri. Periksa lognya: `dc logs --tail=100 postgres`. Pastikan backup berikutnya berjalan dan WAL kembali terkirim.

## Database lambat

Gejala: halaman lambat, log aplikasi berisi timeout ke database, atau PgHero menunjukkan query lama. Selalu periksa bersama pengembang sebelum mengubah pengaturan PostgreSQL.

### 1. Cek beban server

```bash
docker stats --no-stream
btop
```

- CPU kontainer `postgres` penuh terus: ada query berat (langkah 2).
- RAM habis dan swap dipakai banyak: lihat layanan mana yang membengkak; staging bisa dihentikan sementara.
- Disk penuh: ke [Disk penuh](#disk-penuh).

### 2. Lihat query yang sedang berjalan

Buka PgHero (lewat "SIGRAK ops"): bagian **Queries** dan **Live queries**. Atau dari terminal:

```bash
dc exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

```sql
-- longest running statements
SELECT pid, now() - query_start AS runtime, state, wait_event_type, left(query, 120) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND pid <> pg_backend_pid()
ORDER BY runtime DESC
LIMIT 15;

-- who is blocking whom
SELECT pid, pg_blocking_pids(pid) AS blocked_by, left(query, 80) AS query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;

-- connection count by state
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
```

### 3. Hentikan query yang macet (bila perlu)

Pakai `pg_cancel_backend` dulu (membatalkan query, koneksi tetap). `pg_terminate_backend` hanya bila cancel tidak berhasil. Catat `pid` dan isi query di catatan insiden.

```sql
SELECT pg_cancel_backend(<pid>);
SELECT pg_terminate_backend(<pid>);
```

Jangan menghentikan proses milik migrasi, backup (`pgbackrest`), atau `autovacuum` tanpa bertanya ke pengembang.

### 4. Cek PgBouncer

Aplikasi terhubung ke PostgreSQL lewat PgBouncer (D-429). Bila banyak permintaan menunggu koneksi:

```bash
dc logs --tail=100 <layanan pgbouncer>
```

Konsol admin PgBouncer (`SHOW POOLS;`, `SHOW CLIENTS;`) dibuka dengan `<perintah konsol admin PgBouncer>`. Kolom `cl_waiting` yang terus naik berarti koneksi kurang atau ada transaksi yang terlalu lama memegang koneksi (kembali ke langkah 2).

### 5. Sesudahnya

- Simpan query lambat dari PgHero (**Queries**, urut berdasarkan total waktu) di catatan insiden.
- Pengembang memeriksa indeks dan kode yang memanggilnya. Perubahan indeks atau pengaturan datang lewat PR dan deploy biasa, bukan diketik langsung di produksi.

## Kunci bocor

Kunci, token, password, atau rahasia lain dianggap bocor bila pernah muncul di tempat yang bisa dibaca orang lain: chat, tangkapan layar, commit git, log, email, atau laptop yang hilang. Tidak perlu menunggu bukti bahwa kunci sudah disalahgunakan.

### 1. Urutan kerja

1. **Ganti dulu, bersih-bersih kemudian.** Buat kunci baru dan cabut yang lama sebelum menghapus jejaknya di chat atau git. Kunci yang sudah terbaca orang tidak kembali aman meski pesannya dihapus.
2. **Satu kunci, satu baris catatan**: kunci apa, bocor di mana, jam berapa diketahui, jam berapa dicabut.
3. **Periksa apakah sudah disalahgunakan**: log akses di penyedia kunci itu, log aplikasi, `sudo ausearch -m USER_LOGIN --start today` dan log auditd, catatan audit di panel admin.
4. **Bila ada tanda data pribadi ikut terbaca**, ini juga insiden data pribadi. Beri tahu pemilik saat itu juga. UU PDP mewajibkan pemberitahuan tertulis kepada pemilik data dan lembaga paling lambat 3 × 24 jam; pemilik dan pengembang yang memutuskan langkah hukumnya (D-444).
5. **Kunci yang bocor lewat commit git**: setelah diganti, pemilik memutuskan apakah riwayat git perlu dibersihkan. gitleaks di CI dan hook seharusnya mencegah ini; catat kenapa lolos.

### 2. Cara mengganti per jenis kunci

Simpan setiap kunci baru di password manager lebih dulu, baru di server. Setelah `stack.env` diubah, jalankan `dc up -d --wait` supaya kontainer membaca nilai baru.

| Kunci                                               | Tempatnya                                      | Cara mengganti                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private key SSH seseorang                           | laptop orang itu                               | Hapus public key-nya dari `authorized_keys` root dan akun admin di **setiap** server, cabut sesi Access-nya (Access → Users), lalu orang itu membuat kunci baru ([ssh-key.md](ssh-key.md)). Perbarui daftar kunci di password manager.                                                                                |
| Password database                                   | `stack.env`                                    | `ALTER ROLE <user aplikasi> PASSWORD '<baru>';` di `psql` (awali baris dengan spasi supaya tidak tersimpan), ubah di `stack.env`, perbarui `<file auth PgBouncer>`, lalu `dc up -d --wait`.                                                                                                                           |
| `APP_KEY` aplikasi                                  | `stack.env`                                    | **Jangan diganti sendiri.** Nilai di panel admin (SMTP, kunci integrasi) dienkripsi dengan kunci ini (D-431). Hubungi pengembang dan ikuti `<prosedur rotasi APP_KEY>`. Mengganti kunci ini juga mengeluarkan semua pengguna.                                                                                         |
| Kunci API R2 (backup atau file)                     | `stack.env`, konfigurasi pgBackRest dan restic | Dasbor Cloudflare → **R2 → Manage API tokens**: buat token baru dengan izin yang sama, pasang di server, jalankan backup uji, lalu hapus token lama. Bucket backup dikunci (D-430), jadi backup lama tidak bisa dihapus dengan kunci bocor.                                                                           |
| Kunci enkripsi backup (restic, pgBackRest)          | `stack.env`, password manager                  | Kunci saja yang bocor (bucket aman): ganti kata sandi restic dengan `restic key add` lalu `restic key remove <id lama>`. Kunci dan akses bucket sama-sama bocor: buat repositori backup baru dengan kunci baru, jalankan backup penuh, dan biarkan yang lama sampai masa kuncinya habis. Kerjakan bersama pengembang. |
| Kunci penyedia AI untuk chatbot                     | panel admin atau `stack.env`                   | Cabut di dasbor penyedia, buat yang baru, simpan di panel admin (atau `stack.env`). Kunci Gemini milik guru diganti oleh guru itu sendiri; beri tahu dia.                                                                                                                                                             |
| App password Gmail (SMTP)                           | panel admin                                    | Akun Google → **Keamanan → App passwords**: hapus yang lama, buat yang baru, simpan di panel admin, kirim email uji.                                                                                                                                                                                                  |
| Token Cloudflare Tunnel                             | systemd service `cloudflared`                  | Dasbor Cloudflare → **Networks → Tunnels** → `sigrak-1`: putar (refresh) token bila tersedia, lalu `sudo cloudflared service uninstall` dan `sudo cloudflared service install <token baru>`. Bila tidak tersedia, buat tunnel baru dan pindahkan hostname.                                                            |
| Service token Access untuk CI                       | GitHub Actions secrets                         | Access → **Service auth**: buat token baru, ganti di policy `Server sigrak` dan di GitHub secrets, lalu hapus token lama.                                                                                                                                                                                             |
| Token GitHub (GHCR di server, token pribadi)        | `~/.docker/config.json` di server, laptop      | Cabut di GitHub → **Settings → Developer settings**, buat token read-only baru, lalu `docker login ghcr.io` lagi di server.                                                                                                                                                                                           |
| Deploy key repo (`github-sigrak`, `github-fondasi`) | `/root/.ssh/` di server                        | Hapus di GitHub → repo → **Settings → Deploy keys**, buat kunci baru di server, daftarkan sebagai read-only.                                                                                                                                                                                                          |
| Token API Cloudflare (situs catatan)                | GitHub Actions secrets                         | Cloudflare → **My Profile → API Tokens** → **Roll**, lalu perbarui `CLOUDFLARE_API_TOKEN` di GitHub secrets.                                                                                                                                                                                                          |
| Token bot Telegram, webhook Slack                   | Uptime Kuma, Netdata, GlitchTip, Better Stack  | Telegram: `/revoke` di BotFather. Slack: buat ulang webhook. Pasang yang baru di setiap alat, kirim notifikasi uji.                                                                                                                                                                                                   |
| Token Ubuntu Pro                                    | password manager                               | Atur ulang token di dasbor Ubuntu Pro, lalu `sudo pro detach` dan `sudo pro attach` di setiap VPS.                                                                                                                                                                                                                    |
| Password akun admin atau staf aplikasi              | aplikasi                                       | Paksa ganti password dan keluarkan semua sesinya dari panel admin. Periksa catatan audit akun itu.                                                                                                                                                                                                                    |

### 3. Bila server diduga dibobol

Tanda-tandanya: proses atau kontainer yang tidak dikenal, akun Linux baru, kunci asing di `authorized_keys`, atau auditd mencatat perintah yang tidak dijalankan siapa pun dari tim.

1. Jangan mematikan atau menghapus apa pun dulu; bukti bisa hilang. Catat apa yang terlihat.
2. Cabut semua akses dari luar: Access policy dan service token, kunci SSH yang tidak dikenal.
3. Hubungi pengembang. Langkah yang aman biasanya: bangun ulang di VPS cadangan dari backup yang dibuat sebelum waktu pembobolan, ganti **semua** kunci di tabel di atas, lalu pindahkan hostname.

## Backup atau WAL terlambat

Gejala: heartbeat backup, WAL, atau latihan pemulihan di Better Stack berbunyi, atau `check-app` menulis `[!!]` untuk backup (lebih tua dari 26 jam) atau WAL (tertinggal lebih dari 5 menit). Situs masih jalan, tetapi data tidak terlindungi sepenuhnya. Tingkat: sedang.

```bash
sudo /opt/apps/sigrak/check-app
dc exec -u postgres postgres pgbackrest --stanza=<stanza pgBackRest> info
dc exec -u postgres postgres pgbackrest --stanza=<stanza pgBackRest> check
dc exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT last_archived_time, failed_count, last_failed_wal, last_failed_time FROM pg_stat_archiver;"'
```

Penyebab yang sering:

- **Kunci R2 salah, kedaluwarsa, atau baru diganti**: pesan `403` atau `AccessDenied` di log. Pasang kunci yang benar di konfigurasi pgBackRest dan restic.
- **Bucket R2 terkunci atau penuh aturan**: masa kunci bucket tidak cocok dengan jadwal prune (D-430). Hubungi pengembang.
- **Internet VPS ke luar putus**: `curl -sI https://www.cloudflare.com` dari server.
- **Disk penuh**: ke [Disk penuh](#disk-penuh).

File backup (restic) bisa dilihat di Backrest lewat "SIGRAK ops": snapshot terakhir dan pesan error-nya. Setelah diperbaiki, jalankan backup secara manual dengan `<perintah backup manual>` dan pastikan heartbeat kembali hijau.

## Catatan insiden

Tulis untuk setiap insiden tingkat sedang dan berat di proyek **"Ops"** di `sigrak-plane` (D-440, D-465), satu kartu per insiden. Kartu tidak boleh berisi data pribadi atau rahasia (kunci, password, token, isi `stack.env`); bila perlu, sebut nama kuncinya saja, bukan nilainya.

```text
Judul:
Tingkat: berat / sedang / ringan
Pemegang insiden:
Mulai (WIB):                 Diketahui (WIB):              Pulih (WIB):
Yang terdampak: (fitur, berapa sekolah kira-kira, berapa lama)
Kronologi:
  10.02  Better Stack: app.sigrak.com tidak menjawab
  10.05  ...
Penyebab:
Yang menolong:
Data hilang?: tidak / ya, rentang waktu ...
Tindak lanjut: (tugas, pemilik tugas, tenggat)
```

Dalam 2 hari kerja, pemegang insiden dan pemilik membaca catatan ini bersama. Tujuannya mencari apa yang perlu diperbaiki di sistem dan panduan, bukan mencari siapa yang salah. Bila panduan ini kurang atau salah, perbaiki di PR yang sama dengan tindak lanjutnya.

## Nilai yang belum ditentukan

Ditandai `<…>` di atas. Diisi saat R3 membangun skrip dan konfigurasinya.

| Tanda                                                                               | Diisi oleh                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `<domain>`                                                                          | hostname SSH dan Cockpit dari [cloudflare-access.md](cloudflare-access.md) |
| susunan perintah `dc` (file compose, `--env-file`)                                  | pengembang (R3)                                                            |
| `<perintah rollback>`                                                               | pengembang (R3, skrip deploy)                                              |
| `<cara menyalakan halaman perbaikan>`                                               | pengembang (R3, konfigurasi nginx)                                         |
| `<layanan pgbouncer>`, `<perintah konsol admin PgBouncer>`, `<file auth PgBouncer>` | pengembang (R3)                                                            |
| `<user aplikasi>` (role database)                                                   | pengembang (R1/R3)                                                         |
| `<stanza pgBackRest>`, `<perintah backup manual>`                                   | pengembang (R3)                                                            |
| `<prosedur rotasi APP_KEY>`                                                         | pengembang                                                                 |
| `<runbook pemulihan darurat>`                                                       | pengembang (R3)                                                            |
| `<batas menit sebelum pindah>` ke VPS cadangan                                      | pemilik (usulan: 15 menit, supaya target 1 jam tercapai)                   |
