# Usulan peningkatan server dan alat tambahan

Daftar usulan untuk dipelajari pemilik sebelum memutuskan. Ini **belum keputusan**: setiap baris punya kolom "Keputusan" untuk diisi. Yang sudah diputuskan (nginx, Docker Compose, PostgreSQL 19 + pgBackRest, Redis 8, GlitchTip, tmux, Cloudflare Tunnel dan Access, backup R2 + disk pribadi + penyedia kedua) tidak diulang di sini.

Arti prioritas:

- **Sangat disarankan**: risikonya besar bila tidak ada, bebannya kecil.
- **Disarankan**: jelas berguna, bisa menyusul setelah peluncuran.
- **Opsional**: bagus bila ada waktu atau kebutuhan.
- **Tidak disarankan**: dijelaskan supaya tidak dipasang tanpa sengaja.

Beban: **S** kecil (jam), **M** sedang (hari), **L** besar (minggu). Biaya ditulis "gratis" bila tidak ada tagihan.

## 1. Keamanan server

| Usulan | Fungsinya | Kenapa berguna untuk SIGRAK | Biaya / beban | Prioritas | Keputusan |
|---|---|---|---|---|---|
| **Ubuntu Pro (gratis untuk 5 mesin)** | Livepatch (patch kernel tanpa reboot) dan ESM (patch keamanan paket universe) | Server jarang perlu reboot untuk patch kernel; lebih banyak paket yang ditambal | gratis / S | Sangat disarankan | ☐ |
| **CrowdSec + bouncer Cloudflare** | Membaca log nginx, mengenali penyerang (scan, brute force), memblokir mereka **di Cloudflare** | Pengganti fail2ban yang aman di VPS NAT: blokir berdasar IP asli dari Cloudflare, bukan IP gateway NAT | gratis / M | Disarankan | ☐ |
| **Aturan WAF dan rate limit Cloudflare** | Membatasi permintaan ke `/masuk`, API, unggahan langsung di tepi Cloudflare | Serangan berhenti sebelum sampai VPS | gratis (paket Free punya batas aturan) / S | Sangat disarankan | ☐ |
| **Lynis** | Audit keamanan server, memberi skor dan saran | Pemeriksaan rutin tiap 3 bulan, hasil dibandingkan | gratis / S | Disarankan | ☐ |
| **auditd** | Mencatat siapa menjalankan perintah penting (sudo, ubah file sistem) | Jejak bila terjadi insiden; selaras dengan "satu orang satu akun" | gratis / S | Disarankan | ☐ |
| **needrestart** | Memberi tahu layanan mana yang perlu di-restart setelah update | Patch benar-benar aktif, bukan hanya terpasang | gratis / S | Disarankan | ☐ |
| **AIDE (cek integritas file)** | Memberi tahu bila file sistem berubah tanpa izin | Deteksi dini bila server disusupi | gratis / M (perlu disetel supaya tidak berisik) | Opsional | ☐ |
| **Profil AppArmor untuk kontainer** | Membatasi apa yang bisa dilakukan proses di kontainer | Lapisan tambahan bila aplikasi dibobol | gratis / L | Opsional | ☐ |
| **Docker rootless** | Docker tanpa hak root | Lebih aman, tetapi merepotkan port, volume, dan skrip Fondasi | gratis / L | Tidak disarankan sekarang | ☐ |
| **Portainer** | Panel web untuk Docker | Memudahkan, tetapi butuh akses Docker socket (setara root) dan menambah pintu masuk; Cockpit + terminal sudah cukup | gratis / S | Tidak disarankan | ☐ |

## 2. Keamanan kode dan rantai pasok

| Usulan | Fungsinya | Kenapa berguna | Biaya / beban | Prioritas | Keputusan |
|---|---|---|---|---|---|
| **Renovate atau Dependabot** | PR otomatis untuk pembaruan paket npm, image Docker, GitHub Actions | Menjalankan aturan versi yang sudah disetujui (dikunci persis, update lewat PR) | gratis / S | Sangat disarankan | ☐ |
| **Trivy di CI** | Memindai image Docker dan dependensi untuk celah keamanan | Image tidak naik ke produksi bila ada celah berat | gratis / S | Sangat disarankan | ☐ |
| **gitleaks di CI dan hook** | Menolak commit yang berisi rahasia (token, password) | Mencegah kebocoran, apalagi repo pernah publik | gratis / S | Sangat disarankan | ☐ |
| **GitHub secret scanning dan push protection** | Fitur GitHub yang sama tujuannya | Lapisan kedua; tersedia untuk repo privat di paket tertentu | tergantung paket GitHub / S | Disarankan | ☐ |
| **Tanda tangan image (cosign) dan SBOM** | Membuktikan image di server memang dibangun CI kita | Mencegah image palsu; berguna bila tim bertambah | gratis / M | Opsional | ☐ |
| **Branch protection di `main`** | CI wajib hijau, tidak boleh push langsung | Menegakkan aturan commit dan atribusi | gratis / S | Sangat disarankan | ☐ |

## 3. Database dan performa

| Usulan | Fungsinya | Kenapa berguna | Biaya / beban | Prioritas | Keputusan |
|---|---|---|---|---|---|
| **PgBouncer** | Menggabungkan koneksi database dari banyak proses | Dengan 4+ salinan web dan beberapa worker, koneksi ke PostgreSQL bisa membengkak; PgBouncer menjaganya tetap kecil | gratis / M | Sangat disarankan | ☐ |
| **pg_stat_statements + PgHero** | Melihat query paling lambat dan saran indeks | Menemukan halaman lambat sebelum guru mengeluh | gratis / S | Disarankan | ☐ |
| **Penyetelan PostgreSQL (pgtune)** | `shared_buffers`, `work_mem`, dll sesuai RAM 32 GB | Database memakai RAM dengan benar | gratis / S | Sangat disarankan | ☐ |
| **Modul brotli di nginx** | Kompresi lebih kecil dari gzip | File JS/CSS lebih cepat dimuat di HP | gratis / S | Opsional (Cloudflare juga bisa) | ☐ |
| **Cache Rules dan Tiered Cache Cloudflare** | File statis disimpan di server Cloudflare dekat pengguna | Halaman lebih cepat, beban VPS turun | gratis / S | Sangat disarankan | ☐ |
| **Replika baca PostgreSQL** | Salinan database untuk laporan berat | Baru perlu bila sekolah sangat banyak | biaya VPS / L | Opsional (nanti) | ☐ |

## 4. Pemantauan dan peringatan

| Usulan | Fungsinya | Kenapa berguna | Biaya / beban | Prioritas | Keputusan |
|---|---|---|---|---|---|
| **Pemantau dari luar (UptimeRobot, Better Stack, atau sejenisnya)** | Mengecek `app.sigrak.com` dari internet tiap menit | Bila VPS mati, pemantau di VPS yang sama ikut mati; pemantau luar tetap memberi tahu | gratis (paket dasar) / S | Sangat disarankan | ☐ |
| **Uptime Kuma (di VPS)** | Pemantau internal plus halaman status | Halaman status untuk sekolah ("layanan normal / sedang perbaikan") | gratis / S | Disarankan | ☐ |
| **Healthchecks.io (atau sejenisnya)** | "Saklar orang mati" untuk tugas terjadwal: backup, sinkron WAL, latihan pemulihan | Memberi tahu bila backup **tidak** jalan, bukan hanya bila gagal | gratis (paket dasar) / S | Sangat disarankan | ☐ |
| **Netdata** | Grafik CPU, RAM, disk, kontainer secara langsung | Pasang cepat, ringan, langsung terlihat | gratis / S | Disarankan | ☐ |
| **Prometheus + Grafana + exporter** | Metrik lengkap dan dasbor jangka panjang | Lebih kuat dari Netdata, tetapi butuh RAM dan perawatan | gratis / M–L | Opsional (setelah ramai) | ☐ |
| **Dozzle** | Melihat log kontainer lewat browser (read-only) | Membaca log tanpa SSH; ditaruh di belakang Access | gratis / S | Disarankan | ☐ |
| **Loki** | Menyimpan dan mencari log terpusat | Berguna bila server bertambah; untuk satu VPS, Dozzle + log Docker cukup | gratis / M | Opsional | ☐ |
| **Peringatan ke Telegram** | Semua peringatan (pemantau, backup, GlitchTip) masuk ke satu grup | Cepat terbaca di HP | gratis / S | Sangat disarankan | ☐ |
| **Laporan CSP ke GlitchTip** | Browser melapor bila ada skrip asing yang diblokir | Deteksi dini XSS atau ekstensi nakal | gratis / S | Disarankan | ☐ |

## 5. Backup dan pemulihan

| Usulan | Fungsinya | Kenapa berguna | Biaya / beban | Prioritas | Keputusan |
|---|---|---|---|---|---|
| **Latihan pemulihan otomatis bulanan** | Skrip memulihkan backup terbaru ke VPS cadangan, lalu mengecek datanya | Backup yang tidak pernah diuji belum tentu bisa dipakai; menjaga target pulih ≤ 1 jam (D-405) | gratis / M | Sangat disarankan | ☐ |
| **Backrest (UI untuk restic)** | Panel web untuk melihat dan memulihkan backup restic | Memudahkan orang non-teknis memeriksa backup | gratis / S | Opsional | ☐ |
| **Object Lock / versi di bucket backup** | Backup tidak bisa dihapus atau ditimpa selama N hari | Melindungi dari ransomware atau kunci yang bocor | biaya kecil / S | Sangat disarankan | ☐ |
| **Snapshot VPS dari penyedia** | Salinan seluruh disk dari panel penyedia | Lapisan tambahan; bukan pengganti backup | biaya kecil / S | Opsional | ☐ |

## 6. Email

| Usulan | Fungsinya | Kenapa berguna | Biaya / beban | Prioritas | Keputusan |
|---|---|---|---|---|---|
| **SPF, DKIM, DMARC untuk sigrak.com** | Catatan DNS yang membuktikan email benar dari kita | Email undangan dan reset password tidak masuk spam | gratis / S | Sangat disarankan | ☐ |
| **Penyedia email transaksional (Brevo, Postmark, Amazon SES, dll)** | Pengganti Gmail SMTP (D-110) | Gmail punya batas kirim harian; penyedia khusus lebih andal saat sekolah banyak | gratis–murah / S | Disarankan (sebelum ramai) | ☐ |

## 7. Alat terminal untuk pengembang (di server)

Kecil, aman, memudahkan kerja harian. Bisa dipasang sekaligus oleh `sigrak-setup.sh`.

| Alat | Fungsinya | Prioritas | Keputusan |
|---|---|---|---|
| `btop` | Melihat CPU, RAM, proses | Disarankan | ☐ |
| `ncdu` | Mencari apa yang memenuhi disk | Disarankan | ☐ |
| `lazydocker` | Tampilan terminal untuk kontainer, log, dan restart | Disarankan | ☐ |
| `jq` | Membaca output JSON | Disarankan | ☐ |
| `chrony` | Jam server selalu tepat (penting untuk token, log, ujian) | Sangat disarankan | ☐ |
| `zram` | Swap terkompresi di RAM, mengurangi tulis ke SSD | Opsional | ☐ |

## 8. Proses dan dokumentasi

| Usulan | Fungsinya | Prioritas | Keputusan |
|---|---|---|---|
| **Runbook insiden** | Langkah singkat untuk "situs mati", "disk penuh", "database lambat", "kunci bocor" | Sangat disarankan | ☐ |
| **Jadwal perawatan rutin** | Bulanan: latihan pemulihan, cek Lynis, cek kunci SSH dan grup Access. Tahunan: tinjau versi besar | Sangat disarankan | ☐ |
| **Halaman status untuk sekolah** | Sekolah tahu bila ada gangguan tanpa menghubungi admin | Disarankan | ☐ |
| **Lingkungan pratinjau per PR** | Tiap PR dapat alamat uji sendiri | Opsional (mahal untuk satu VPS) | ☐ |

## Saran urutan bila ingin mulai dari yang paling penting

1. **Sebelum peluncuran**:
   - Ubuntu Pro, WAF dan rate limit Cloudflare, branch protection.
   - Renovate, Trivy, gitleaks.
   - PgBouncer, penyetelan PostgreSQL, Cache Rules Cloudflare.
   - Pemantau dari luar, Healthchecks.io, peringatan Telegram.
   - Latihan pemulihan otomatis, Object Lock.
   - SPF/DKIM/DMARC, chrony, runbook insiden.
2. **Bulan pertama setelah peluncuran**:
   - CrowdSec, auditd, needrestart, Lynis.
   - Netdata, Dozzle, Uptime Kuma, laporan CSP.
   - pg_stat_statements + PgHero, penyedia email transaksional.
3. **Nanti, bila perlu**: Prometheus + Grafana, Loki, AIDE, AppArmor, cosign/SBOM, replika baca, lingkungan pratinjau.

Setelah Anda mengisi kolom "Keputusan", usulan yang dipilih dicatat sebagai keputusan dan dimasukkan ke tugas R3.
