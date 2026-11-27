# Membuat SSH key dari nol

SSH key adalah sepasang file: **kunci privat** (rahasia, tetap di perangkat Anda) dan **public key** (boleh dibagikan, dipasang di server). Server hanya mengizinkan orang yang memegang kunci privat pasangannya. Setiap pengembang membuat kuncinya sendiri; kunci tidak pernah dipakai bersama.

Jenis kunci: **Ed25519** (pendek, cepat, aman). Selalu beri **passphrase**, supaya kunci tidak bisa dipakai orang lain walau file-nya tercuri.

## Windows: PowerShell (OpenSSH bawaan Windows 10/11)

1. Buka **PowerShell** (tidak perlu sebagai Administrator).
2. Cek OpenSSH tersedia:

   ```powershell
   ssh -V
   ```

   Bila perintah tidak dikenal: Settings → System → Optional features → Add a feature → **OpenSSH Client**.
3. Buat kunci:

   ```powershell
   ssh-keygen -t ed25519 -C "budi-laptop sigrak"
   ```

   - `Enter file in which to save the key`: tekan Enter (lokasi bawaan `C:\Users\<nama>\.ssh\id_ed25519`).
   - `Enter passphrase`: ketik passphrase panjang (tidak terlihat saat diketik), lalu ulangi.
4. Hasilnya dua file di `C:\Users\<nama>\.ssh\`:
   - `id_ed25519` = **kunci privat**, jangan pernah dibagikan;
   - `id_ed25519.pub` = **public key**.
5. Tampilkan public key untuk disalin:

   ```powershell
   type $env:USERPROFILE\.ssh\id_ed25519.pub
   ```

   Hasilnya satu baris: `ssh-ed25519 AAAA… budi-laptop sigrak`.
6. Agar passphrase tidak ditanya terus, nyalakan ssh-agent (sekali, PowerShell sebagai Administrator):

   ```powershell
   Get-Service ssh-agent | Set-Service -StartupType Automatic
   Start-Service ssh-agent
   ssh-add $env:USERPROFILE\.ssh\id_ed25519
   ```

## Windows: Bitvise

1. Bitvise SSH Client → **Client key manager** → **Generate New**.
2. Algorithm **Ed25519**, isi **Passphrase**, Comment `budi-laptop sigrak` → **Generate**.
3. Pilih kunci → **Export** → **Export public key** → format **OpenSSH** → simpan sebagai `budi-laptop.pub`, atau salin barisnya.
4. Cadangan kunci privat: **Export** → **Export private key** → format OpenSSH, **terenkripsi dengan passphrase** → simpan ke password manager.

Kunci dari PowerShell juga bisa dipakai di Bitvise: Client key manager → **Import** → pilih `id_ed25519`. Langkah Bitvise selanjutnya ada di [bitvise.md](bitvise.md).

## macOS, Linux, dan WSL

```bash
ssh-keygen -t ed25519 -C "budi-laptop sigrak"
cat ~/.ssh/id_ed25519.pub
```

Tekan Enter untuk lokasi bawaan, lalu isi passphrase. Di macOS, simpan passphrase di Keychain:

```bash
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

## Sidik jari kunci

Sidik jari dipakai untuk mencatat kunci tanpa menyimpan kuncinya (daftar kunci, [bitvise.md](bitvise.md) bagian E):

```bash
ssh-keygen -lf ~/.ssh/id_ed25519.pub
```

(Windows: `ssh-keygen -lf $env:USERPROFILE\.ssh\id_ed25519.pub`.)

## Memasang public key di server

Lihat [first-ssh-access.md](first-ssh-access.md) langkah 2 (`ssh-copy-id` atau perintah PowerShell), atau [bitvise.md](bitvise.md) bagian B.4. Satu baris per kunci di `~/.ssh/authorized_keys`.

## Aturan

- Satu orang, satu kunci per perangkat; komentar kunci berisi nama dan perangkat.
- Kunci privat tidak pernah dikirim lewat chat, email, atau commit, dan tidak disalin ke server.
- Selalu pakai passphrase; cadangan kunci privat hanya dalam bentuk terenkripsi di password manager.
- Laptop hilang atau kunci diduga bocor: hapus barisnya dari `authorized_keys` di semua server **hari itu juga**, lalu buat kunci baru.
- Ganti kunci bila pengembang berganti perangkat; kunci lama dihapus dari server.
