# Keamanan terminal di server

Aturan untuk orang yang bekerja di terminal server (pilihan pemilik, 2026-11-27). SSH sering lewat Cloudflare Access dan bisa putus kapan saja; perintah panjang yang mati di tengah jalan itu berbahaya.

## tmux

- tmux dipasang di host produksi, cadangan, dan staging (dilakukan oleh `sigrak-setup.sh`).
- **Pekerjaan berisiko atau panjang selalu dijalankan di dalam sesi tmux yang diberi nama**: migrasi, restore, pindah ke VPS cadangan, upgrade versi besar PostgreSQL, build image.

  ```bash
  tmux new -s restore-2026-12-01      # start
  # Ctrl-b d                           detach; the work keeps running
  tmux ls                              # list sessions
  tmux attach -t restore-2026-12-01    # come back after a dropped connection
  ```

- **Proses aplikasi tidak pernah dijalankan di tmux.** Web, ujian, worker, dan scheduler tetap di Docker Compose dengan restart otomatis; tmux hanya untuk orang yang mengetik perintah.
- `/etc/tmux.conf` (dipasang saat setup) menampilkan nama sesi dan label server (`sigrak-1` utama, `sigrak-2` cadangan, staging ditandai) di status bar, supaya tidak ada yang mengetik di server yang salah, dan membatasi riwayat layar (`history-limit 5000`).

## Rahasia di layar dan di riwayat

- Jangan pernah mengetik atau menempel token atau password di baris perintah. Rahasia ada di `stack.env` dan dibaca dari sana.
- `HISTCONTROL=ignoreboth` dipasang untuk semua user: perintah yang diawali spasi tidak disimpan di riwayat shell.
- Jangan `cat stack.env` di layar yang sedang dibagikan atau sesi yang direkam.

## Sesi

- Shell yang diam di luar tmux logout sendiri setelah 15 menit (`TMOUT=900`).
- Tutup sesi root dan sesi tmux setelah pekerjaan selesai; tidak ada sesi yang terbuka berhari-hari.
- Satu orang, satu akun: tidak ada sesi tmux root yang dipakai bersama, supaya jejak audit tetap jelas.

## Bahasa

Semua perintah, pesan skrip, dan output di server memakai bahasa Inggris (`sigrak-setup.sh`, `check-app`, skrip deploy, baris log). Hanya yang dilihat pengguna di aplikasi yang berbahasa Indonesia.

## Laptop

tmux di laptop pengembang tidak wajib.
