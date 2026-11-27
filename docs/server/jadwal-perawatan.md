# Jadwal perawatan rutin

Daftar pemeriksaan harian, mingguan, bulanan, tiga bulanan, dan tahunan untuk VPS produksi `sigrak-1`, VPS cadangan `sigrak-2`, dan layanan di sekitarnya. Sebagian besar sudah berjalan otomatis dan mengirim peringatan; tugas manusia adalah memastikan peringatan itu memang datang dan membaca hasilnya.

Bila sebuah pemeriksaan menemukan masalah, pindah ke [runbook-insiden.md](runbook-insiden.md). Untuk perintah `dc` dan `$PORT`, jalankan dulu blok "Persiapan di terminal" di runbook itu.

## Waktu yang aman untuk perawatan

Sekolah memakai SIGRAK pada jam pelajaran. Pekerjaan yang bisa mengganggu (reboot, upgrade Docker atau PostgreSQL, deploy besar) dikerjakan di jendela perawatan resmi: **Sabtu, 21.00–23.00 WIB** (D-465).

Hindari juga:

- hari ujian TKA dan ANBK;
- minggu penyusunan dan pembagian rapor (biasanya Desember dan Juni);
- minggu pertama tahun ajaran baru (Juli).

Perawatan yang terlihat oleh pengguna diumumkan di halaman status **2 hari sebelumnya** ([halaman-status.md](halaman-status.md)).

## Ringkasan

| Kapan         | Yang dikerjakan                                                                                                                 | Kira-kira     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Setiap hari   | baca peringatan, heartbeat hijau, error baru di GlitchTip                                                                       | 5 menit       |
| Setiap minggu | `check.sh` dan `check-app`, disk, update sistem, PR Renovate, query lambat, CrowdSec                                            | 30 menit      |
| Setiap bulan  | hasil latihan pemulihan, salinan backup bulanan, tinjau kunci SSH dan grup Access, update terjadwal, sertifikat, uji peringatan | 2 jam         |
| Tiga bulan    | Lynis, latihan pindah ke VPS cadangan, tinjau aturan WAF, kapasitas, dan akun di GitHub/Cloudflare                              | setengah hari |
| Setiap tahun  | tinjau versi besar, perpanjangan domain, target pemulihan, jadwal ini sendiri                                                   | 1 hari        |

Catat setiap pemeriksaan bulanan, tiga bulanan, dan tahunan di proyek **"Ops"** di `sigrak-plane` (D-440, D-465), satu kartu per perawatan: tanggal, siapa, hasil, tindak lanjut. Kartu tidak boleh berisi rahasia (kunci, password, token, isi `stack.env`) atau data pribadi.

## Setiap hari

Tidak perlu masuk ke server bila semua hijau.

1. **Baca peringatan** di Slack (Better Stack, GlitchTip) dan Telegram (Uptime Kuma, Netdata). Setiap peringatan yang belum selesai dijadikan insiden atau tugas.
2. **Better Stack**: semua monitor naik, semua heartbeat hijau (backup, WAL, latihan pemulihan, `check-app`). Heartbeat yang terlambat ditangani di [runbook-insiden.md](runbook-insiden.md) bagian "Backup atau WAL terlambat".
3. **GlitchTip**: lihat error baru sejak kemarin. Error yang mengenai banyak pengguna dibuatkan tugas untuk pengembang.

## Setiap minggu

### Kesehatan server

```bash
sudo bash /opt/apps/_fondasi/server/check.sh
sudo /opt/apps/sigrak/check-app
```

Hasil yang diharapkan: `State: S9`, `check-app` tanpa baris `[!!]`. Jalankan `check.sh` juga di `sigrak-2` supaya VPS cadangan tetap siap.

### Disk dan log

```bash
df -h /
docker system df
journalctl --disk-usage
```

- Disk tersisa minimal 25%. Lihat juga tren disk di Netdata: bila turun terus, rencanakan dengan pemilik sebelum habis.
- Bersihkan image tanpa tag dan build cache: `docker image prune` dan `docker builder prune`. Image sebelumnya tetap disimpan untuk rollback.

### Update sistem

Update keamanan Ubuntu terpasang otomatis setiap hari. Periksa hasilnya:

```bash
sudo tail -n 30 /var/log/unattended-upgrades/unattended-upgrades.log
cat /var/run/reboot-required 2>/dev/null
sudo needrestart -r l
sudo pro status
```

- `reboot-required` ada: Livepatch biasanya sudah menambal kernel, jadi reboot cukup di jendela perawatan berikutnya. Setelah reboot, jalankan `check.sh` dan `check-app`.
- `needrestart` menyebut layanan sistem: restart layanan itu di jendela perawatan.

### Aplikasi dan keamanan

- **PR Renovate**: baca daftar PR baru. Patch keamanan yang mendesak (Trivy menandai celah berat) dikerjakan minggu ini; patch biasa dikumpulkan untuk update bulanan (D-412).
- **PgHero** (lewat "SIGRAK ops"): query paling lambat dan saran indeks. Catat yang baru muncul untuk pengembang.
- **CrowdSec**: `sudo cscli decisions list` dan `sudo cscli alerts list`. Lonjakan besar atau blokir yang salah sasaran (sekolah sendiri ikut terblokir) dilaporkan ke pengembang.
- **Backrest**: snapshot terakhir berhasil untuk produksi dan staging.

## Setiap bulan

### Backup dan latihan pemulihan

1. **Latihan pemulihan otomatis** (D-430) berjalan sekali sebulan: backup terbaru dipulihkan ke kontainer PostgreSQL sementara (atau ke `sigrak-2` setelah VPS cadangan siap), datanya diperiksa, lalu kontainer dihapus. Periksa:
    - heartbeat latihan pemulihan di Better Stack hijau;
    - `check-app` menampilkan tanggal latihan terakhir bulan ini;
    - laporan latihan di `<tempat laporan latihan pemulihan>`: lama pemulihan dan hasil pemeriksaan data.
2. **Pulihkan satu file unggahan** dari restic lewat Backrest ke folder sementara, buka file-nya, lalu hapus salinan sementara itu. Ini membuktikan backup file, bukan hanya database.
3. **Salinan bulanan di luar Cloudflare** (D-404): salinan terenkripsi ke disk milik pemilik dan ke penyedia kedua dengan `<cara membuat salinan bulanan>`. Pastikan keduanya bisa dibaca dan tanggalnya bulan ini.
4. **Kunci bucket** (D-430): di dasbor R2 dan penyedia kedua, aturan kunci dan masa simpan masih sesuai (7 hari lokal, 30 hari di R2). Prune restic dan expire pgBackRest bulan ini tidak gagal.

### Kunci SSH dan grup Access

Dikerjakan setiap bulan (D-432).

```bash
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do echo "== $f"; ssh-keygen -lf "$f"; done
getent group sudo
```

1. Cocokkan sidik jari kunci di **setiap** server (`sigrak-1`, `sigrak-2`) dengan daftar kunci di password manager. Kunci yang tidak ada di daftar, atau milik orang yang sudah tidak bekerja, dihapus.
2. Cloudflare Zero Trust → **Access → Access groups**: anggota grup untuk `Server sigrak`, `SIGRAK admin`, `SIGRAK staging`, dan `SIGRAK ops` masih benar. Orang yang keluar dihapus dan sesinya dicabut (Access → Users).
3. **Service auth**: tanggal kedaluwarsa service token CI masih jauh. Perpanjang sebelum habis supaya deploy tidak tiba-tiba gagal.
4. Panel admin SIGRAK: daftar akun staf internal masih benar.

Langkah orang masuk dan keluar: [cloudflare-access.md](cloudflare-access.md) bagian 6.

### Update terjadwal

Dikerjakan di jendela perawatan, staging dulu lalu produksi dengan image yang sama ([compose-and-processes.md](compose-and-processes.md)).

1. **Patch aplikasi dan image** dari PR Renovate yang terkumpul bulan ini (D-412): gabungkan, deploy ke staging, periksa, lalu produksi.
2. **Paket dari repositori pihak ketiga** (Docker, cloudflared, PostgreSQL client) tidak selalu ikut update otomatis:

    ```bash
    sudo apt update
    apt list --upgradable
    ```

    Upgrade Docker Engine hanya di jendela perawatan. `live-restore` (dari `setup.sh`) menjaga kontainer tetap jalan, tetapi tetap jalankan `check-app` sesudahnya.

3. **Layanan ops** di proyek `sigrak-ops` dan Portainer: pasang versi stabil terbaru lewat PR Renovate bila file compose-nya di repo. Portainer selalu terbaru karena dia memegang Docker socket (D-425).
4. Ulangi `check.sh` sampai `S9`.

### Sertifikat dan domain

TLS berakhir di Cloudflare (D-414); server tidak menyimpan sertifikat sendiri.

- Dasbor Cloudflare → **SSL/TLS → Edge Certificates**: Universal SSL untuk `sigrak.com` dan `*.sigrak.com` berstatus **Active**, mode SSL **Full**, **Always Use HTTPS** menyala.
- `status.sigrak.com`: sertifikat dari Better Stack masih berlaku (buka di browser, lihat ikon gembok).
- Tanggal habis domain `sigrak.com` lebih dari 60 hari lagi dan perpanjangan otomatis menyala.

### Pemantauan dan peringatan

- Kirim notifikasi uji dari setiap alat: Better Stack, Uptime Kuma, Netdata, GlitchTip. Pastikan sampai di Slack atau Telegram.
- Daftar monitor dan heartbeat di Better Stack masih sesuai dengan layanan yang berjalan (paket gratis: 10 monitor, 10 heartbeat).
- Netdata: retensi tidak memakan disk lebih dari yang direncanakan.

### Catatan keamanan

```bash
sudo aureport --summary --start this-month
sudo ausearch -k <kunci aturan auditd> --start this-month | tail -50
```

- auditd: pemakaian sudo, perubahan `/etc`, kunci SSH, dan Docker socket bulan ini cocok dengan pekerjaan yang memang dilakukan tim.
- Cloudflare → **Security → Events**: aturan WAF dan rate limit untuk `/masuk` bekerja dan tidak memblokir sekolah.

## Setiap tiga bulan

1. **Lynis** (D-427): jalankan, simpan hasilnya dengan tanggal, bandingkan skor dan peringatan dengan hasil sebelumnya.

    ```bash
    sudo lynis audit system --quiet
    sudo grep hardening_index /var/log/lynis-report.dat
    sudo cp /var/log/lynis-report.dat <folder hasil Lynis>/lynis-$(hostname)-$(date +%F).dat
    ```

    Jalankan di `sigrak-1` dan `sigrak-2`. Peringatan baru dibuatkan tugas.

2. **Latihan pindah ke VPS cadangan** (D-405): pulihkan produksi ke `sigrak-2` mengikuti `<runbook pemulihan darurat>`, ukur waktunya (target di bawah 1 jam), periksa aplikasi lewat hostname staging, lalu kembalikan. Hostname produksi tidak dipindah saat latihan kecuali pemilik memutuskannya dan sekolah diberi tahu.
3. **Akun dan token di layanan luar**:
    - GitHub: kolaborator repo, deploy key (`github-sigrak`, `github-fondasi`), Actions secrets, token GHCR dan tanggal kedaluwarsanya;
    - Cloudflare: anggota akun dan token API (termasuk token situs catatan, D-436);
    - Better Stack, Slack, Telegram, penyedia AI, penyedia VPS: siapa saja yang punya akses.
4. **Kapasitas**: bandingkan CPU, RAM, dan disk tiga bulan terakhir di Netdata dengan pembagian di [compose-and-processes.md](compose-and-processes.md). Jumlah salinan atau penyetelan PostgreSQL (pgtune, D-429) diubah lewat PR.
5. **Aturan WAF dan CrowdSec**: masih sesuai dengan serangan yang terlihat; aturan yang tidak pernah terpakai di paket Free dipertimbangkan untuk diganti.
6. **Panduan ini**: perintah di runbook dan jadwal ini masih benar. Perbaiki yang sudah berubah.

## Setiap tahun

1. **Versi besar** (D-412): Node LTS baru (pindah dalam 6 bulan setelah rilis LTS), PostgreSQL versi besar baru (produksi menunggu minimal x.1), Redis, nginx stable, Ubuntu LTS berikutnya. Setiap upgrade besar punya rencana sendiri, dicoba di staging atau `sigrak-2` dulu, dan dikerjakan di tmux.
2. **Domain dan langganan**: perpanjangan `sigrak.com`, paket Better Stack, Ubuntu Pro masih terpasang di kedua VPS (`sudo pro status`).
3. **Target pemulihan** (D-404, D-405): apakah 7 hari lokal, 30 hari di R2, RPO 5 menit, dan RTO 1 jam masih cocok dengan ukuran data dan kebutuhan sekolah.
4. **Kunci yang berumur panjang**: pertimbangkan mengganti service token CI, token GHCR, dan deploy key mengikuti tabel di [runbook-insiden.md](runbook-insiden.md) bagian "Kunci bocor", di luar musim sibuk sekolah.
5. **Jadwal ini**: apa yang tidak pernah menemukan masalah, apa yang kurang. Perubahan dicatat di `docs/agent/DECISIONS.md` bila mengubah keputusan.

## Nilai yang belum ditentukan

| Tanda                                                                                           | Diisi oleh                                           |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `<tempat laporan latihan pemulihan>`                                                            | pengembang (R3, skrip latihan)                       |
| `<cara membuat salinan bulanan>` ke disk pemilik dan penyedia kedua                             | pengembang (R3) dan pemilik (memilih penyedia kedua) |
| `<kunci aturan auditd>`                                                                         | pengembang (R3, aturan auditd)                       |
| `<folder hasil Lynis>`                                                                          | pengembang (R3)                                      |
| `<runbook pemulihan darurat>`                                                                   | pengembang (R3)                                      |
| letak CrowdSec (host atau kontainer); bila di kontainer, `cscli` dijalankan lewat `docker exec` | pengembang (R3)                                      |
