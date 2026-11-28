# Panduan server

Panduan praktis untuk menyiapkan dan menjalankan server SIGRAK: VPS produksi (staging ada di mesin yang sama) dan VPS cadangan dingin (D-391). Panduan ini mengikuti playbook server dan kontrak aplikasi Fondasi, lalu menambahkan kebutuhan SIGRAK. Tidak ada alamat IP, port, password, atau kunci di sini; semuanya disimpan di password manager.

Bahasa: panduan di folder ini memakai bahasa Indonesia (permintaan pemilik). Perintah bash, pesan skrip, dan output tetap bahasa Inggris.

| Panduan | Dipakai saat |
|---|---|
| [ssh-key.md](ssh-key.md) | Membuat SSH key (public key) dari nol: Windows PowerShell, Bitvise, macOS/Linux/WSL |
| [first-ssh-access.md](first-ssh-access.md) | VPS baru hanya diberi username dan password, tanpa konsol dari penyedia |
| [akun-admin.md](akun-admin.md) | VPS hanya memberi akun root: membuat akun admin pribadi dengan sudo |
| [bitvise.md](bitvise.md) | Terhubung dari Windows dengan Bitvise SSH Client dan public key |
| [cloudflare-access.md](cloudflare-access.md) | Menyiapkan rute tunnel dan Cloudflare Access untuk SSH, Cockpit, `admin.`, dan staging |
| [server-setup-flow.md](server-setup-flow.md) | Dari server Ubuntu 26.04 yang baru diinstal sampai semua aplikasi menjawab (`check.sh` → `setup.sh` → lapisan SIGRAK → S9) |
| [compose-and-processes.md](compose-and-processes.md) | Susunan Docker Compose, peran proses, pemakaian banyak core, pembagian memori, dan dua Redis (state dan cache) |
| [sekolah-satu-ip.md](sekolah-satu-ip.md) | Banyak murid masuk dari satu IP sekolah: IP asli lewat nginx, batas `limit_req`/`limit_conn`, aturan rate limit Cloudflare, dan penyetelan CrowdSec supaya sekolah tidak terblokir |
| [terminal-safety.md](terminal-safety.md) | Bekerja di terminal server: tmux, riwayat perintah, logout otomatis |
| [terminal-zsh-neovim.md](terminal-zsh-neovim.md) | Terminal nyaman untuk kerja harian: zsh dan Neovim di akun admin, root tetap bash |
| [rekomendasi-tambahan.md](rekomendasi-tambahan.md) | Usulan peningkatan dan alat tambahan untuk diputuskan pemilik (keamanan, database, pemantauan, backup, email, alat terminal) |
| [runbook-insiden.md](runbook-insiden.md) | Ada gangguan: situs mati, disk penuh, database lambat, kunci atau rahasia bocor, backup atau WAL terlambat |
| [jadwal-perawatan.md](jadwal-perawatan.md) | Perawatan rutin harian, mingguan, bulanan, tiga bulanan, dan tahunan: update, backup dan latihan pemulihan, sertifikat, disk, log, pemantauan, tinjauan akses |
| [halaman-status.md](halaman-status.md) | Memberi tahu sekolah lewat halaman status `status.sigrak.com`: kapan menulis laporan, caranya, dan contoh teks |

Urutan untuk server baru: ssh-key → first-ssh-access → (bitvise) → server-setup-flow (dengan `ADMIN_USER`, lihat akun-admin), yang mengarahkan ke cloudflare-access di langkah tunnel → terminal-zsh-neovim.

Status: ditulis 2026-11-27 dari pilihan pemilik dalam wawancara perombakan (nginx, Ubuntu 26.04, Node 26, PostgreSQL 19, aturan tmux). Skrip yang disebut di sini (`deploy/server/sigrak-setup.sh`, `deploy/server/check-app`, `deploy/compose.yaml`) dibuat di fase R3; sampai saat itu panduan ini menggambarkan targetnya. `setup.sh`/`check.sh` Fondasi masih ditulis untuk Ubuntu 24.04; di 26.04 keduanya memberi peringatan tetapi tetap jalan (lihat server-setup-flow).
