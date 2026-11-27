# Membuat akun admin non-root

Penyedia VPS biasanya hanya memberi akun `root`. Untuk kerja harian sebaiknya setiap orang punya **akun pribadi dengan sudo**:

- Perintah berbahaya harus diawali `sudo`, jadi tidak terjadi tanpa sengaja.
- Jejak audit jelas: siapa menjalankan apa (aturan "satu orang, satu akun").
- Cockpit (`konsol-<label>.`) menolak login root, jadi butuh akun ini.
- Shell dan editor pribadi (zsh, Neovim) dipasang di akun ini; root tetap bash ([terminal-zsh-neovim.md](terminal-zsh-neovim.md)).

Root tetap ada untuk darurat, hanya bisa login dengan kunci.

Contoh nama akun di bawah: `arumi`. Ganti dengan nama Anda (huruf kecil, tanpa spasi).

## Cara A (disarankan): lewat `setup.sh` Fondasi

Saat menjalankan `setup.sh` ([server-setup-flow.md](server-setup-flow.md) langkah 2), sertakan `ADMIN_USER`:

```bash
sudo SERVER_NAME=sigrak-1 DOMAIN=<admin domain> ADMIN_USER=arumi bash setup.sh
```

Skrip ini:

1. membuat akun `arumi` (bila belum ada);
2. memasukkannya ke grup `sudo` dan `docker`;
3. menyalin `/root/.ssh/authorized_keys` ke akun itu, jadi kunci yang sama langsung bisa dipakai;
4. meminta password untuk `arumi`. Password ini **hanya untuk `sudo` dan Cockpit**, bukan untuk login SSH. Simpan di password manager.

Lanjut ke bagian "Uji login" di bawah.

## Cara B: manual (bila tanpa `setup.sh`)

Login sebagai root (sesi tetap terbuka sebagai tali pengaman), lalu:

```bash
adduser --gecos "" arumi                 # asks for the sudo password
usermod -aG sudo arumi
usermod -aG docker arumi                 # only if Docker is installed
install -d -m 700 -o arumi -g arumi /home/arumi/.ssh
install -m 600 -o arumi -g arumi /root/.ssh/authorized_keys /home/arumi/.ssh/authorized_keys
```

Catatan grup `docker`: anggota grup ini praktis setara root (bisa menjalankan kontainer apa pun). Hanya admin yang dipercaya yang dimasukkan. Bila ragu, jangan masukkan, dan pakai `sudo docker …`.

## Uji login (wajib, sesi root tetap terbuka)

1. Di Bitvise buat **profil baru** `sigrak-utama-arumi`: Username `arumi`, Initial method **publickey**, kunci yang sama ([bitvise.md](bitvise.md)).
2. Hubungkan profil baru itu, lalu cek:

   ```bash
   whoami          # arumi
   sudo -v         # asks for the sudo password, then returns without error
   sudo whoami     # root
   ```

3. Kalau semuanya benar, akun siap. **Jangan tutup sesi root sebelum langkah ini berhasil.**

## Setelah akun admin jadi

- Kerja harian selalu dengan akun `arumi`. Perintah root diawali `sudo`, misalnya `sudo docker compose ps` atau `sudo bash /opt/apps/_fondasi/server/check.sh`.
- Profil Bitvise root disimpan sebagai cadangan darurat saja.
- Root tetap boleh login **hanya dengan kunci**: `setup.sh` mematikan login password setelah kunci terbukti. Jangan matikan login root sama sekali sebelum akun admin terbukti di kedua server; itu jalan masuk terakhir.
- Pengembang lain: masing-masing dibuat akunnya sendiri dengan cara B, dengan public key **mereka sendiri** di `~/.ssh/authorized_keys` akun mereka (tidak menyalin milik root). Saat seseorang berhenti: `sudo deluser --remove-home <nama>` dan hapus kuncinya dari daftar kunci ([bitvise.md](bitvise.md) bagian E).

## Ringkasan perintah

| Keperluan | Perintah |
|---|---|
| Ganti password sudo sendiri | `passwd` |
| Lihat siapa yang punya sudo | `getent group sudo` |
| Lihat siapa di grup docker | `getent group docker` |
| Kunci akun sementara | `sudo usermod -L <nama>` (buka lagi: `-U`) |
| Hapus akun | `sudo deluser --remove-home <nama>` |
