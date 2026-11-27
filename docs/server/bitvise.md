# Bitvise SSH Client (Windows) dengan public key

Pengembang di Windows memakai Bitvise SSH Client. Panduan ini menambahkan langkah Bitvise pada [first-ssh-access.md](first-ssh-access.md); semua aturan pengaman di sana tetap berlaku.

## A. Membuat kunci (sekali per pengembang)

Penjelasan dasar SSH key dan cara lain membuatnya: [ssh-key.md](ssh-key.md).

1. Bitvise → **Client key manager** → **Generate New**.
2. Algoritma **Ed25519**, isi **passphrase**, komentar = nama dan perangkat Anda, misalnya `budi-laptop`.
3. **Export → public key → format OpenSSH**. Hasilnya satu baris, `ssh-ed25519 AAAA… budi-laptop`; baris inilah yang dipasang di server.
4. Cadangkan kunci privat: **Export → private key, terenkripsi**, simpan di password manager. Jangan pernah dikirim lewat chat.

**Satu pengembang, satu kunci, satu akun.** Kunci tidak pernah dipakai bersama. Saat seseorang berhenti, hapus barisnya dari `authorized_keys` dan dari daftar kunci (bagian E).

## B. Login pertama (masih dengan password dari penyedia)

1. Tab **Login**: Host = alamat VPS, Port = port SSH dari penyedia, Username, **Initial method: password**.
2. Pada koneksi pertama, Bitvise menampilkan **sidik jari host key**. Catat, lalu cocokkan dari dalam server:

   ```bash
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
   ```

   Terima hanya bila sama. Kalau suatu saat Bitvise memperingatkan sidik jarinya berubah padahal tidak ada yang menginstal ulang server, **berhenti**: koneksi mungkin disadap.
3. **New SFTP window** untuk mengunggah `check.sh` dan `setup.sh`.
4. Pasang public key Anda dari terminal Bitvise:

   ```bash
   mkdir -p ~/.ssh && chmod 700 ~/.ssh
   nano ~/.ssh/authorized_keys      # paste the single line from A.3
   chmod 600 ~/.ssh/authorized_keys
   ```

## C. Pindah ke public key

1. Buat **profil baru** (jangan ubah profil yang sedang terhubung). Initial method **publickey**, pilih slot kunci dari bagian A, password tidak disimpan.
2. Hubungkan profil baru **selagi sesi lama masih terbuka**. Kalau berhasil, jalankan `setup.sh` lagi dari sesi baru ini supaya login password mati.
3. Simpan satu profil per server dengan nama jelas: `sigrak-utama.tlp`, `sigrak-cadangan.tlp`. Profil tidak menyimpan password.
4. Tab **Options**: nyalakan keep-alive supaya koneksi yang diam tidak putus. tmux tetap wajib untuk pekerjaan panjang ([terminal-safety.md](terminal-safety.md)).

## D. Bitvise lewat Cloudflare Access (jalan masuk kedua)

Bitvise tidak bisa membuka hostname Access sendiri, jadi `cloudflared` di laptop dipakai sebagai jembatan:

1. Pasang `cloudflared` untuk Windows (installer Cloudflare atau `winget install Cloudflare.cloudflared`).
2. Jalankan:

   ```powershell
   cloudflared access tcp --hostname ssh-<label>.<domain> --url localhost:2222
   ```

   Browser membuka halaman login Cloudflare Access (lihat [cloudflare-access.md](cloudflare-access.md)).
3. Di Bitvise buat profil `sigrak-utama-via-tunnel`: Host `localhost`, Port `2222`, kunci yang sama.

Setiap pengembang punya dua profil per server: **langsung** (port penyedia) dan **via tunnel**.

## E. Daftar kunci terdaftar

Daftar kunci yang diizinkan (pemilik, komentar kunci, sidik jari dari `ssh-keygen -lf`, server, tanggal ditambahkan) disimpan di vault bersama password manager, tidak pernah di repo bersama alamat IP, port, atau password (aturan inventaris Fondasi). Periksa daftar ini tiap tiga bulan dan hapus kunci yang tidak dipakai.
