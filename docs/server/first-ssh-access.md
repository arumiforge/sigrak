# Akses SSH pertama: hanya password, tanpa konsol penyedia

VPS baru sering hanya diberi alamat, port SSH, username, dan password, tanpa konsol web atau mode rescue dari penyedia. Artinya SSH adalah satu-satunya jalan masuk, dan satu kesalahan di pengaturan SSH atau firewall bisa mengunci semua orang di luar selamanya. Aturan panduan ini: **setiap perubahan diuji dari sesi baru sebelum sesi lama ditutup.**

Memakai Bitvise di Windows? Ikuti juga [bitvise.md](bitvise.md); langkahnya sama.

## 0. Sebelum mulai (di laptop)

- Simpan data dari penyedia di password manager: alamat, **port SSH** (VPS NAT biasanya memakai port khusus, bukan 22), username, password.
- Tanyakan sekali ke support penyedia, secara tertulis: apakah mereka bisa reset password, punya mode rescue, atau konsol atas permintaan? Catat jawabannya di samping data tadi.
- Buat kunci sekali saja, dengan passphrase (langkah lengkap untuk Windows, Bitvise, macOS/Linux: [ssh-key.md](ssh-key.md)):

  ```bash
  ssh-keygen -t ed25519 -C "<name>-<device> sigrak"
  ```

  (Windows: perintah yang sama di PowerShell, atau Client key manager di Bitvise.)
- Simpan **kunci kedua** di perangkat lain atau sebagai ekspor terenkripsi di password manager, untuk jaga-jaga bila laptop hilang.

## 1. Login pertama

1. `ssh -p <port> <user>@<address>`
2. Langsung ganti password dari penyedia: `passwd`. Pakai password panjang dan acak, simpan di password manager.
3. Bila user bukan root, cek sudo: `sudo -v`.
4. Jalankan tmux: `tmux new -s setup` (lihat [terminal-safety.md](terminal-safety.md)).
5. **Buka jendela terminal kedua dan login juga.** Satu sesi selalu dibiarkan terbuka sebagai tali pengaman selama seluruh proses.
6. Biarkan update keamanan otomatis pertama selesai (`setup.sh` menunggunya; jangan pernah mematikan `unattended-upgr`). Satu kali reboot sekarang, selagi belum ada yang diubah, aman; setelah itu reboot hanya bila SSH dan firewall sudah terbukti aman.

## 2. Pasang kunci, buktikan, baru matikan password

1. Dari laptop:

   ```bash
   ssh-copy-id -p <port> <user>@<address>
   ```

   Windows PowerShell:

   ```powershell
   type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh -p <port> <user>@<address> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
   ```

2. **Uji di terminal baru**, paksa memakai kunci:

   ```bash
   ssh -p <port> -o PreferredAuthentications=publickey <user>@<address>
   ```

3. Unggah `check.sh` dan `setup.sh` Fondasi (lewat SFTP), lalu ikuti [server-setup-flow.md](server-setup-flow.md). `setup.sh` punya pengaman: port SSH selalu tetap terbuka, login password baru dimatikan setelah kunci terbukti, sshd hanya di-*reload* dan tidak pernah di-restart, pengaturan jaringan tidak disentuh. Dengan `ADMIN_USER=<nama>` skrip ini juga membuat akun admin pribadi dengan sudo dan menyalin kunci root ke akun itu; uji login dengan akun itu ([akun-admin.md](akun-admin.md)).
4. Jalankan `setup.sh` sekali lagi **dari sesi yang login memakai kunci**: login password mati.
5. Uji login baru dengan kunci sekali lagi. **Baru setelah itu tutup sesi lama.**

## 3. Jalan masuk kedua, secepatnya

Tanpa konsol penyedia, kita buat sendiri:

- Siapkan Cloudflare Tunnel ([cloudflare-access.md](cloudflare-access.md)) dengan `ssh-<label>.` (SSH lewat Cloudflare Access) dan `konsol-<label>.` (Cockpit, terminal di browser). Cockpit inilah pengganti konsol penyedia.
- Sekarang ada dua jalan masuk yang terpisah: port SSH langsung dan tunnel. Port SSH langsung **sengaja tetap terbuka** sebagai jalan terakhir bila tunnel mati (aturan Fondasi).

## 4. Pengaman untuk perubahan berisiko

Sebelum mengubah SSH, firewall, atau jaringan, pasang pembatal otomatis:

```bash
sudo systemd-run --on-active=10min --unit=undo-net /bin/sh -c 'ufw disable; systemctl reload ssh'
```

Lakukan perubahan, lalu login dari sesi baru. Kalau berhasil, batalkan pembatalnya: `sudo systemctl stop undo-net.timer`. Kalau terkunci, firewall mati sendiri dalam sepuluh menit dan Anda bisa masuk lagi.

## 5. Larangan

- Menutup sesi terakhir yang berhasil sebelum login baru terbukti.
- Mengganti port SSH, menyalakan `ufw` secara manual, atau mengubah netplan/jaringan tanpa pengaman di atas.
- `systemctl restart ssh` saat menguji; pakai `reload`.
- Memasang fail2ban di VPS NAT: ia bisa memblokir alamat gateway NAT penyedia dan mengunci semua orang (aturan Fondasi).
- Mengirim password atau kunci lewat chat, email, atau commit.
- Reboot di tengah perubahan SSH atau firewall.

## 6. Kalau tetap terkunci

1. Coba jalan masuk lain: SSH lewat tunnel (`ssh-<label>.`) atau Cockpit (`konsol-<label>.`).
2. Tunggu pembatal otomatis bila tadi dipasang.
3. Minta reset atau rescue ke support penyedia (langkah 0 sudah mencatat apa yang mereka sediakan).
4. Kalau semua gagal: pesan VPS baru dan pulihkan dari backup dengan runbook pemulihan darurat (R3, D-405). Itulah gunanya backup dan VPS cadangan.
