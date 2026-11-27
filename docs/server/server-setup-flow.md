# Alur setup server: Ubuntu 26.04 baru sampai S9

Dari "SSH sudah bisa" ([first-ssh-access.md](first-ssh-access.md)) sampai "semua aplikasi menjawab". Setiap langkah idempoten, jadi alur bisa diulang dari titik mana pun. Lapisan A milik Fondasi dan sama untuk semua aplikasi Arumi Studios; lapisan B milik SIGRAK sendiri (dibuat di R3). Semua perintah, pesan skrip, dan output memakai bahasa Inggris; hanya yang dilihat pengguna di aplikasi yang berbahasa Indonesia.

## Catatan Ubuntu 26.04

Server memakai Ubuntu 26.04 LTS (pilihan pemilik, 2026-11-27). Docker (`resolute`), repo apt PostgreSQL (`resolute-pgdg`), dan cloudflared (`any`) sudah mendukungnya. `setup.sh`/`check.sh` Fondasi masih ditulis untuk 24.04: `check.sh` menandai baris OS dengan `[!!]`, `setup.sh` memberi peringatan lalu tetap jalan. Sampai pemilik memperbarui Fondasi:

- Jalankan alur ini di **VPS cadangan lebih dulu**, simpan output lengkap `check.sh` sebelum dan sesudah, dan catat apa pun yang gagal.
- Catat masalahnya di `docs/drafts/fondasi-uptake.md`; jangan pernah mengubah Fondasi dari repo ini.

## A. Lapisan Fondasi

| Langkah | Perintah atau aksi | Status `check.sh` sesudahnya |
|---|---|---|
| 1. Cek | `sudo bash check.sh` (hanya membaca; unggah `check.sh` dan `setup.sh` lewat SFTP dulu) | S0 (baru) |
| 2. Setup | `sudo SERVER_NAME=sigrak-1 DOMAIN=<domain admin> ADMIN_USER=<nama> bash setup.sh`: Docker, Compose, Buildx, cloudflared, Cockpit di `127.0.0.1:9090`, update keamanan otomatis, swap, batas journald, ufw, `/opt/apps` dengan `PORTS` | S1 |
| 3. Tunnel | Buat tunnel dan rutenya, jalankan `cloudflared service install <token>` ([cloudflare-access.md](cloudflare-access.md)) | S2 |
| 4. Access | Aplikasi Access untuk `ssh-`, `konsol-`, `admin.`, dan staging ([cloudflare-access.md](cloudflare-access.md)) | S2 |
| 5. SSH hanya kunci | Kunci untuk root dan user admin, dibuktikan dari sesi baru, lalu `setup.sh` lagi: login password mati ([first-ssh-access.md](first-ssh-access.md)) | S2 |
| 6. Fondasi di server | Deploy key read-only dan alias `github-fondasi`, `git clone git@github-fondasi:arumiforge/fondasi.git /opt/apps/_fondasi` | S2 |

Beri label `sigrak-2` untuk VPS cadangan. Jangan pernah memasang fail2ban di VPS NAT ini.

## B. Lapisan SIGRAK (R3)

1. **Repo di server**: deploy key read-only dengan alias `github-sigrak`, checkout di `/opt/apps/sigrak/src` (hanya skrip dan file compose; aplikasinya berjalan dari image).
2. **`sudo bash /opt/apps/sigrak/src/deploy/server/sigrak-setup.sh`** (idempoten):
   - membuat `/opt/apps/sigrak/{staging,production}` beserta folder `backups/` (`0700`);
   - menambah baris `PORTS`: `8199 sigrak-production app.sigrak.com`, `8198 sigrak-staging <hostname staging>` (port kosong diambil dari atas, sesuai kontrak aplikasi);
   - memasang tmux, `/etc/tmux.conf` dengan label server di status bar, `TMOUT`, dan `HISTCONTROL` ([terminal-safety.md](terminal-safety.md));
   - menyiapkan konfigurasi pgBackRest dan restic yang masih kosong, serta folder proyek `sigrak-ops` (GlitchTip, pemantauan);
   - membuat `stack.env` untuk tiap lingkungan **hanya bila belum ada**, mode `600`, berisi rahasia acak (`openssl rand -hex 32`); rahasia tidak pernah dicetak, dan skrip mengingatkan untuk menyalin kunci enkripsi ke password manager.
3. **Isi bagian yang harus diisi manusia** di `stack.env`: kunci R2, SMTP, kunci penyedia AI untuk chatbot. Tidak pernah di git, tidak pernah di chat.
4. **Login ke registry image** (GitHub Container Registry, token read-only) lalu deploy: staging dulu, kemudian produksi dengan image yang sama ([compose-and-processes.md](compose-and-processes.md)).
5. **`/opt/apps/sigrak/check-app`** (tautan ke `deploy/server/check-app`): hanya membaca, mencetak baris `[ok]`/`[--]`/`[!!]` dan `NEXT:`, selesai dalam 120 detik. Yang diperiksa:
   - semua kontainer produksi dan staging sehat;
   - backup terakhir kurang dari 26 jam, kiriman WAL ke R2 tertinggal kurang dari 5 menit (RPO, D-405);
   - tidak ada migrasi yang tertunda;
   - disk tersisa minimal 25 %;
   - GlitchTip menjawab;
   - tanggal latihan pemulihan terakhir.
6. `sudo bash /opt/apps/_fondasi/server/check.sh` sampai melaporkan **S9**.

## VPS cadangan

Lapisan A dan B1–B2 yang sama dengan label `sigrak-2`, tanpa aplikasi berjalan. Dijaga siap oleh runbook pemulihan darurat (R3): pulihkan backup, `docker compose up -d --wait`, pindahkan hostname aplikasi dari tunnel utama ke tunnel cadangan. Target: kembali dalam satu jam (D-405). Latih secara terjadwal.

## Urutan singkat

`check.sh` → `setup.sh` → tunnel + Access → SSH hanya kunci → clone Fondasi → `sigrak-setup.sh` → isi `stack.env` → deploy staging, lalu produksi → `check.sh` = S9.
