# Cloudflare Tunnel dan Cloudflare Access

VPS tidak punya IP publik (D-088). Semua lalu lintas masuk lewat satu Cloudflare Tunnel per VPS (Fondasi F-004, F-008). Semua yang bukan untuk publik ditaruh di belakang Cloudflare Access: halaman login yang dijalankan Cloudflare dan hanya meloloskan orang yang terdaftar. Nama menu di dasbor Cloudflare kadang berubah; langkah di bawah memakai nama menu tahun 2026.

## Apa ke mana

| Hostname | Menuju | Di belakang Access? | Siapa boleh masuk |
|---|---|---|---|
| `app.sigrak.com` | nginx produksi (`127.0.0.1:<port produksi>`) | tidak, publik | semua orang (aplikasi punya login sendiri) |
| `ujian.sigrak.com` | nginx produksi | tidak, publik | peserta ujian (login sendiri) |
| `admin.sigrak.com` | nginx produksi | **ya** | staf internal (Tim SIGRAK) |
| hostname staging (mis. `app-staging.<domain>`, `admin-staging.…`, `ujian-staging.…`) | nginx staging | **ya**, plus `noindex` | pengembang dan penguji |
| `ssh-<label>.<domain>` | `ssh://127.0.0.1:<port ssh>` | **ya** | pengembang yang punya kunci server |
| `konsol-<label>.<domain>` | Cockpit `http://127.0.0.1:9090` | **ya** | pengembang yang punya kunci server |

`<label>` adalah nama pendek server dari `setup.sh` (`SERVER_NAME`), misalnya `sigrak-1` untuk produksi dan `sigrak-2` untuk cadangan. Port diambil dari `/opt/apps/PORTS`; tidak ditulis di repo.

## 1. Tim Zero Trust (sekali per akun Cloudflare)

1. Dasbor Cloudflare → **Zero Trust**. Pertama kali, pilih nama tim (mis. `arumi`) dan paket Free (sampai 50 pengguna).
2. **Settings → Authentication → Login methods**: pakai **One-time PIN** (kode dikirim lewat email). Boleh tambah **Google** supaya orang login dengan akun Google. Setiap orang memakai alamatnya sendiri; tidak ada akun bersama.
3. **Settings → Authentication**: durasi sesi global 24 jam.

## 2. Tunnel per VPS

1. **Networks → Tunnels → Create a tunnel → Cloudflared**, beri nama sesuai label server (`sigrak-1`).
2. Pilih Debian/Ubuntu, salin perintah `cloudflared service install <token>` dan jalankan di server (`setup.sh` sudah memasang `cloudflared`). Token tetap di server; jangan pernah ditempel di chat atau git.
3. **Public hostnames** di tunnel: tambahkan satu baris per hostname dari tabel di atas, selalu menuju `127.0.0.1` (bukan `localhost`):
   - `ssh-<label>` → tipe **SSH** → `127.0.0.1:<port ssh>`
   - `konsol-<label>` → tipe **HTTP** → `127.0.0.1:9090`
   - hostname aplikasi → tipe **HTTP** → `127.0.0.1:<port dari PORTS>`
4. Setelah menambah hostname aplikasi, tambahkan barisnya di `/opt/apps/PORTS` (`<port> sigrak-<env> <hostname>`) supaya `check.sh` mengujinya.

## 3. Aplikasi Access

**Access → Applications → Add an application → Self-hosted.** Buat yang berikut:

| Aplikasi | Hostname | Policy | Sesi |
|---|---|---|---|
| `Server sigrak` | `ssh-sigrak-1`, `konsol-sigrak-1`, `ssh-sigrak-2`, `konsol-sigrak-2` | Allow: email pengembang yang punya kunci server | 12 jam |
| `SIGRAK admin` | `admin.sigrak.com` | Allow: email staf internal (konsol staf tetap meminta login dan 2FA sendiri, D-343) | 24 jam |
| `SIGRAK staging` | semua hostname staging | Allow: pengembang dan penguji | 24 jam |

Untuk setiap policy: **Action: Allow**, **Include → Emails** (daftar alamat satu per satu) atau **Access group** seperti `pengembang`, `tim-sigrak` (Access → Access groups). Pakai grup, supaya menambah atau menghapus orang cukup di satu tempat. Aturan tambahan bila perlu: **Require → Country: Indonesia** untuk `admin.` bila staf tidak pernah bekerja dari luar negeri.

Hostname publik (`app.`, `ujian.`) tidak dimasukkan ke Access.

## 4. Terhubung lewat Access

- **Browser** (Cockpit, `admin.`, staging): buka hostname-nya, isi email, ketik PIN.
- **SSH dari terminal (Linux, macOS, WSL)**: sekali saja, tambahkan ke `~/.ssh/config`:

  ```
  Host ssh-sigrak-1.<domain>
    ProxyCommand cloudflared access ssh --hostname %h
    User <your user>
  ```

  Lalu `ssh ssh-sigrak-1.<domain>` membuka login Access di browser pada pemakaian pertama.
- **Bitvise (Windows)**: `cloudflared access tcp --hostname ssh-sigrak-1.<domain> --url localhost:2222`, lalu hubungkan Bitvise ke `localhost:2222` ([bitvise.md](bitvise.md)).
- **Otomasi** (deploy dari GitHub Actions lewat SSH): buat **Service token** (Access → Service auth), tambahkan policy **Action: Service Auth** dengan token itu di `Server sigrak`, dan simpan token ID dan secret sebagai GitHub secrets. Jangan pernah memakai login milik orang untuk otomasi.

## 5. Pengaturan situs yang terkait

- **SSL/TLS → Overview**: Full. **Edge certificates**: Always Use HTTPS menyala.
- Staging: nginx mengirim `X-Robots-Tag: noindex` dan Access tetap menyala (web baseline Fondasi).
- **Pindah ke VPS cadangan**: di tunnel VPS cadangan, tambahkan hostname aplikasi yang sama; hapus dari tunnel utama. DNS mengikuti tunnel, jadi DNS tidak perlu diubah (runbook pemulihan darurat, R3).

## 6. Orang masuk dan keluar

- Masuk: tambahkan emailnya ke Access group yang sesuai; untuk akses server tambahkan juga public key-nya ([bitvise.md](bitvise.md) bagian E).
- Keluar: hapus dari Access group, hapus kuncinya dari `authorized_keys` di setiap server, dan cabut sesi aktifnya (Access → Users).
- Periksa grup tiap bulan, bersamaan dengan daftar kunci (D-432, `jadwal-perawatan.md`).
