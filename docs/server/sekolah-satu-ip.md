# Sekolah di balik satu IP: IP asli, batas permintaan, Cloudflare, dan CrowdSec

Satu laboratorium komputer berisi 40–300 murid biasanya keluar ke internet lewat **satu IP publik** (NAT sekolah). Hal yang sama terjadi pada pengguna HP di jaringan operator seluler (CGNAT) dan pada pelatihan guru di satu aula. Di awal pelajaran atau ujian, ratusan orang masuk dari IP yang sama dalam satu menit. Itu pemakaian normal, bukan serangan (D-479).

Panduan ini menjelaskan cara server membaca IP asli pengguna dan cara menyetel setiap lapisan supaya IP sekolah tidak pernah terblokir saat dipakai wajar. Konfigurasinya dibuat di fase R3 (`deploy/compose.yaml`, konfigurasi nginx, CrowdSec); angka di sini adalah angka awal yang disetel ulang setelah uji k6.

## Ringkasan aturan

| Lapisan | Kuncinya | Batas awal | Tujuan |
|---|---|---|---|
| Aplikasi: gagal masuk | akun + IP | 5 gagal per menit, lalu tunggu 5 menit | menghentikan tebak kata sandi satu akun |
| Aplikasi: `POST /masuk` di `app.` dan `admin.` | IP | 600 per menit | rem banjir, cukup untuk 300 orang yang masing-masing mencoba dua kali |
| Aplikasi: `POST /masuk` di `ujian.` | sesi ujian | 900 per menit per sesi; kartu yang tidak dikenal 300 per menit per IP | rem banjir per sesi, bukan per IP |
| Aplikasi: lupa kata sandi | IP, lalu akun | 30 per menit per IP; 3 email per 15 menit per akun | kotak surat tidak dibanjiri |
| nginx `limit_req` | IP asli | `/masuk`: 10/detik, `burst=300` | rem banjir sebelum aplikasi |
| nginx `limit_conn` | IP asli | 1.000 koneksi | satu IP tidak menghabiskan semua koneksi |
| Cloudflare rate limit | IP | `POST /masuk` di atas batas aplikasi | serangan besar berhenti di tepi Cloudflare |
| CrowdSec | IP | hanya pola serangan (pemindaian, file sensitif, eksploit) | lalu lintas wajar tidak pernah memicu blokir |

Prinsipnya: **batas per orang selalu memakai akun** (atau sesi ujian); batas yang hanya memakai IP adalah rem banjir yang longgar. Sesi login tidak pernah diikat ke IP, jadi murid yang pindah dari Wi-Fi sekolah ke data seluler tetap masuk.

## 1. IP asli: Cloudflare → nginx → aplikasi

Jalur permintaan: browser → Cloudflare → tunnel `cloudflared` di host → nginx (`127.0.0.1:8199`) → `web` atau `exam`.

1. **Cloudflare** menulis IP pengguna di header `CF-Connecting-IP`. Header ini ditimpa oleh Cloudflare, jadi pengguna tidak bisa memalsukannya.
2. **nginx** hanya percaya header itu dari koneksi `cloudflared`. Karena port nginx hanya terbuka di `127.0.0.1`, koneksi `cloudflared` sampai ke kontainer dari gateway jaringan Docker. nginx lalu meneruskan IP itu sebagai satu-satunya nilai `X-Forwarded-For` (ditimpa, bukan ditambah).
3. **Aplikasi** hanya percaya `X-Forwarded-For` dari alamat nginx, yang ditulis di `TRUSTED_PROXIES`. Dari alamat lain, header itu diabaikan dan aplikasi memakai alamat koneksi.

Supaya alamatnya tetap, jaringan di `deploy/compose.yaml` memakai subnet tetap, berbeda untuk produksi dan staging, dan nginx mendapat alamat tetap:

```yaml
networks:
    edge:
        ipam:
            config:
                - subnet: ${EDGE_SUBNET}        # production 172.31.250.0/24, staging 172.31.251.0/24

services:
    nginx:
        networks:
            edge:
                ipv4_address: ${NGINX_ADDRESS}  # production 172.31.250.10
```

Di `stack.env` (tanpa rahasia, boleh ditulis di sini sebagai contoh):

```bash
EDGE_SUBNET=172.31.250.0/24
EDGE_GATEWAY=172.31.250.1
NGINX_ADDRESS=172.31.250.10
TRUSTED_PROXIES=172.31.250.10
```

Bagian nginx untuk IP asli dan header ke aplikasi:

```nginx
# Real client IP from Cloudflare, accepted only from the Docker gateway
# (cloudflared on the host reaches nginx through 127.0.0.1:8199).
set_real_ip_from 172.31.250.1;
real_ip_header   CF-Connecting-IP;

# Every proxied location
proxy_set_header Host              $host;
proxy_set_header X-Forwarded-For   $remote_addr;   # replaced, never appended
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host  "";             # the app routes on Host only
```

Log nginx mencatat `$remote_addr`, yang setelah langkah di atas sudah berisi IP asli. CrowdSec membaca log ini.

Cara memeriksa setelah deploy: buka `app.` dari HP dengan data seluler, lalu cari baris permintaannya di log nginx (`dc logs --tail=50 nginx`). Alamat yang tercatat harus IP HP itu, bukan `172.31.250.1`. Bila yang tercatat alamat gateway, `set_real_ip_from` belum cocok dengan `EDGE_GATEWAY`.

## 2. nginx: `limit_req` dan `limit_conn`

Batas nginx lebih longgar dari batas aplikasi, supaya pengguna biasa melihat pesan yang ramah dari aplikasi ("Terlalu banyak percobaan masuk…"), bukan halaman 429 polos dari nginx.

```nginx
# http {}
limit_req_zone  $binary_remote_addr zone=sign_in:10m rate=10r/s;    # 600 per minute per IP
limit_req_zone  $binary_remote_addr zone=pages:20m   rate=100r/s;
limit_conn_zone $binary_remote_addr zone=per_ip:10m;
limit_req_status  429;
limit_conn_status 429;

# server {} of app., admin. and ujian.
limit_conn per_ip 1000;     # a lab of 300 with open SSE streams and parallel requests

location = /masuk {
    limit_req zone=sign_in burst=300 nodelay;   # a whole lab at once
    proxy_pass http://web;                      # http://exam on ujian.
}

location / {
    limit_req zone=pages burst=2000 nodelay;
    proxy_pass http://web;
}

location /__transmit/ {                         # SSE: no buffering, no limit_req
    proxy_buffering off;
    proxy_read_timeout 1h;
    proxy_pass http://web;
}

location /assets/ {                             # static files: no limit_req
    # served from disk with immutable cache headers
}
```

Catatan:

- `burst=300 nodelay` berarti 300 permintaan sekaligus langsung dilayani, lalu 10 per detik berikutnya. Satu lab yang masuk bersamaan tidak pernah menunggu.
- `limit_conn` menghitung permintaan yang sedang berjalan per IP, termasuk aliran SSE yang terbuka lama. 1.000 cukup untuk 300 guru yang membuka aplikasi bersamaan.
- Jangan memakai `limit_req` dengan angka per orang (misalnya 5 per menit) di nginx: nginx hanya melihat IP, dan satu IP bisa berarti satu sekolah.

## 3. Cloudflare: rate limit dan WAF

Paket Free hanya punya sedikit aturan, jadi aturan dipakai di tempat serangan datang: `/masuk` dulu (D-427).

**Aturan rate limit** (Security → WAF → Rate limiting rules):

| Isian | Nilai |
|---|---|
| Nama | `Masuk: rem banjir per IP` |
| Ekspresi | `(http.request.uri.path eq "/masuk" and http.request.method eq "POST")` |
| Dihitung per | IP |
| Batas | 150 permintaan per 10 detik (≈ 900 per menit, di atas batas aplikasi 600 per menit) |
| Tindakan | Block, selama waktu terpendek yang tersedia di paket |

Batas Cloudflare sengaja di atas batas aplikasi: dalam pemakaian wajar aplikasi yang lebih dulu menahan, dengan pesan yang jelas. Cloudflare hanya bekerja saat ada banjir yang jauh melebihi satu lab.

**Pengaturan yang bisa memblokir satu sekolah**, periksa sebelum musim ujian:

- **Under Attack Mode**: jangan dinyalakan untuk `app.` dan `ujian.` saat jam sekolah, kecuali benar-benar diserang. Tantangan JavaScript bisa gagal di browser lab yang lama.
- **Security Level**: biarkan Medium atau lebih rendah. IP sekolah dan IP operator seluler sering punya reputasi buruk karena dipakai bersama banyak orang.
- **Bot Fight Mode**: bila sekolah melaporkan halaman tantangan, matikan. Di paket Free fitur ini tidak bisa dikecualikan per path.
- **Aturan WAF custom**: jangan memblokir berdasarkan negara atau ASN untuk `app.` dan `ujian.`; sekolah memakai banyak penyedia internet yang berbeda.

Cara memeriksa: Security → Events, saring host `app.sigrak.com` atau `ujian.sigrak.com`. Banyak kejadian dari satu IP pada jam pelajaran, dengan path halaman biasa, hampir selalu berarti satu sekolah, bukan serangan.

## 4. CrowdSec

CrowdSec membaca log nginx dan memblokir IP lewat bouncer Cloudflare (D-427). Karena blokirnya per IP, **satu keputusan salah memblokir satu sekolah penuh**. Jadi CrowdSec hanya dipakai untuk pola serangan, bukan untuk "terlalu banyak permintaan".

**Skenario yang dipakai** (pola serangan jelas, tidak dipicu oleh murid):

- `crowdsecurity/http-probing` (banyak 404 berbeda), `crowdsecurity/http-sensitive-files`, `crowdsecurity/http-path-traversal-probing`, `crowdsecurity/http-sqli-probing`, `crowdsecurity/http-xss-probing`, `crowdsecurity/http-bad-user-agent`, `crowdsecurity/http-admin-interface-probing`, dan koleksi CVE.

**Skenario yang dimatikan**, karena satu lab yang wajar bisa memicunya:

```bash
sudo cscli scenarios remove crowdsecurity/http-crawl-non_statics
sudo cscli scenarios remove crowdsecurity/http-generic-bf
sudo systemctl reload crowdsec
```

Banjir permintaan sudah ditahan oleh aplikasi, nginx, dan Cloudflare; tebakan kata sandi ditahan per akun di aplikasi.

**Daftar putih IP sekolah** untuk sekolah yang pernah terblokir atau yang dilaporkan lewat Minta Bantuan (`/etc/crowdsec/postoverflows/s01-whitelist/sigrak-sekolah.yaml`):

```yaml
name: sigrak/sekolah-whitelist
description: "Public IPs of partner schools: never banned (D-479)"
whitelist:
  reason: "school NAT, many pupils behind one IP"
  ip:
    - "203.0.113.10"      # example: SD Negeri Contoh 1, reported 2026-12-01
  cidr: []
```

Setiap baris diberi komentar nama sekolah dan tanggalnya. Daftar ini ditinjau tiga bulan sekali bersama aturan WAF ([jadwal-perawatan.md](jadwal-perawatan.md)), karena IP sekolah bisa berganti saat sekolah pindah penyedia internet.

**Lama blokir**: profil default memblokir 4 jam. Untuk host aplikasi, blokir pertama cukup 1 jam (`duration: 1h` di `/etc/crowdsec/profiles.yaml`), supaya sekolah yang salah terblokir tidak kehilangan satu hari pelajaran.

**Membuka blokir yang salah**:

```bash
sudo cscli decisions list --ip 203.0.113.10
sudo cscli decisions delete --ip 203.0.113.10
```

Lalu tambahkan IP itu ke daftar putih di atas, `sudo systemctl reload crowdsec`, dan catat di catatan insiden ([runbook-insiden.md](runbook-insiden.md)).

## 5. Uji beban: 300 murid dari satu IP

Skrip `spikes/k6/shared_ip.js` memasukkan 300 kartu ujian di `ujian.` dan 300 guru di `app.` dalam satu menit, semuanya dengan IP yang sama. Semua harus berhasil: tidak ada pesan "terlalu banyak percobaan", tidak ada 429, tidak ada error. Cara menjalankannya ada di `spikes/k6/README.md`.

Di staging, uji yang sama dijalankan lewat Cloudflare dan nginx (bukan langsung ke aplikasi) setelah konfigurasi R3 selesai, supaya batas nginx dan Cloudflare ikut teruji. Jalankan dari satu mesin saja, supaya semua permintaan benar-benar dari satu IP, dan beri tahu pemilik sebelumnya karena Cloudflare akan mencatatnya di Security → Events.
