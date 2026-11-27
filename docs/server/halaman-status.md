# Halaman status untuk sekolah

Halaman status di `status.sigrak.com` memberi tahu sekolah apakah SIGRAK sedang berjalan normal, terganggu, atau dalam perawatan. Halaman ini dijalankan Better Stack di luar VPS kita (D-426), jadi tetap bisa dibuka saat VPS mati. Dengan halaman ini, sekolah tidak perlu menghubungi admin satu per satu untuk tahu ada gangguan.

Panduan ini menjelaskan cara menyiapkan halaman, kapan menulis laporan, cara menulisnya, dan contoh teks yang tinggal diisi. Nama menu di dasbor Better Stack bisa berubah; langkah di bawah memakai nama menu tahun 2026.

## Cara kerjanya

- Better Stack memeriksa situs publik SIGRAK dari internet setiap 3 menit (paket gratis).
- Bila sebuah situs tidak menjawab, komponennya di halaman status otomatis berubah merah, dan peringatan masuk ke Slack.
- Status otomatis hanya bilang "ada masalah". Penjelasan untuk sekolah ditulis manusia sebagai **laporan** (status report): apa yang terganggu, apa yang bisa dilakukan sekolah, dan kapan kabar berikutnya.
- Perawatan terjadwal diumumkan lebih dulu di halaman yang sama.

Yang **tidak** tampil di halaman status: staging, `admin.`, panel ops (Portainer, Netdata, PgHero, Backrest, Uptime Kuma, GlitchTip, Plane), heartbeat backup, dan `check-app`. Semua itu urusan internal.

## Menyiapkan halaman (sekali saja)

1. Better Stack → **Uptime → Monitors**: buat monitor untuk setiap situs publik di tabel komponen di bawah. Pakai alamat `<alamat cek kesehatan>`, interval 3 menit, peringatan ke Slack.
2. Better Stack → **Status pages → Create status page**:
    - nama: `SIGRAK`;
    - subdomain sendiri: `status.sigrak.com`;
    - zona waktu: `Asia/Jakarta` (WIB);
    - bahasa halaman: bahasa Indonesia bila pilihan itu tersedia;
    - logo SIGRAK, tautan kembali ke `https://sigrak.com`;
    - riwayat insiden ditampilkan (sekolah bisa melihat gangguan sebelumnya).
3. Dasbor Cloudflare → **DNS** untuk `sigrak.com`: tambahkan record CNAME `status` dengan nilai yang ditunjukkan Better Stack. Set **DNS only** (awan abu-abu) kecuali Better Stack menyebut lain, supaya Better Stack bisa membuat sertifikatnya.
4. Tambahkan komponen di bawah, dengan nama bahasa Indonesia, dan hubungkan masing-masing ke monitornya.
5. Bila paket mengizinkan, nyalakan **langganan email** supaya operator sekolah bisa menerima kabar tanpa membuka halaman.
6. Tautkan halaman status dari `sigrak.com` (bagian keamanan dan footer, D-435) dan dari halaman bantuan di aplikasi.

### Komponen

| Komponen di halaman status | Isinya                                                      | Diperiksa otomatis?                   |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| Aplikasi SIGRAK            | `app.sigrak.com`: login, modul ajar, Bank Soal, LKPD, rapor | ya                                    |
| Ujian                      | `ujian.sigrak.com`                                          | ya                                    |
| Situs sigrak.com           | `sigrak.com`: halaman informasi                             | ya                                    |
| Bantuan AI                 | pembuatan konten dengan AI dan chatbot                      | tidak, diubah manual saat ada laporan |
| Unduhan PDF dan Excel      | ekspor dan cetak dokumen                                    | tidak, diubah manual saat ada laporan |
| Email dari SIGRAK          | undangan, atur ulang kata sandi                             | tidak, diubah manual saat ada laporan |

### Arti status

| Status di halaman            | Kapan dipakai                                                        |
| ---------------------------- | -------------------------------------------------------------------- |
| Berjalan normal              | tidak ada masalah yang dirasakan pengguna                            |
| Gangguan sebagian (degraded) | bisa dipakai tetapi lambat, atau satu fitur tidak jalan              |
| Gangguan besar (downtime)    | tidak bisa dipakai sama sekali oleh sebagian besar sekolah           |
| Perawatan (maintenance)      | sengaja dimatikan atau dibatasi untuk perawatan yang sudah diumumkan |

## Kapan menulis laporan

| Keadaan                                                                                        | Yang dilakukan                                                                  |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Gangguan terlihat oleh pengguna dan sudah dipastikan nyata                                     | laporan pertama paling lambat **15 menit** sejak diketahui                      |
| Monitor merah sebentar lalu hijau lagi dalam satu kali pemeriksaan, tanpa laporan dari sekolah | tidak perlu laporan; catat saja di catatan internal                             |
| Satu fitur mati (AI, ekspor, email) dan banyak sekolah memakainya                              | laporan dengan status "Gangguan sebagian"                                       |
| Aplikasi jauh lebih lambat dari biasa selama lebih dari 10 menit                               | laporan dengan status "Gangguan sebagian"                                       |
| Perawatan yang membuat aplikasi mati atau terbatas                                             | umumkan **minimal 3 hari sebelumnya**, ingatkan lagi 1 jam sebelum mulai        |
| Perbaikan darurat kecil yang tidak terasa oleh pengguna                                        | tidak perlu laporan                                                             |
| Masalah satu sekolah atau satu akun saja                                                       | tidak di halaman status; dibantu lewat jalur bantuan biasa                      |
| Staging, panel ops, backup atau WAL terlambat                                                  | tidak di halaman status; tangani lewat [runbook-insiden.md](runbook-insiden.md) |

### Siapa yang menulis

Pemegang insiden ([runbook-insiden.md](runbook-insiden.md)) atau orang yang dia tunjuk. Akun Better Stack yang boleh menulis laporan: `<daftar akun Better Stack>`. Setiap akun memakai email orangnya sendiri, tanpa akun bersama.

### Seberapa sering diperbarui

- Gangguan besar: pembaruan paling lambat setiap **30 menit**, juga bila belum ada kabar baru.
- Gangguan sebagian: paling lambat setiap **60 menit**.
- Setiap pembaruan menyebut jam pembaruan berikutnya, dan janji itu ditepati.
- Setelah pulih, status "Sudah pulih, masih dipantau" selama 30 menit, baru "Selesai".

## Cara menulis

Pembacanya kepala sekolah, guru, dan operator sekolah. Mereka ingin tahu tiga hal: apa yang tidak bisa dipakai, apa yang sebaiknya mereka lakukan, dan kapan ada kabar lagi.

- **Mulai dari yang dirasakan pengguna**: "Aplikasi SIGRAK tidak bisa dibuka", bukan "server error 502" atau "database down".
- **Tanpa istilah teknis**: tidak ada "server", "database", "tunnel", "deploy", "query", atau kode error.
- **Jujur dan tenang.** Tidak ada "masalah kecil" bila sekolah tidak bisa bekerja. Tidak ada tanda seru.
- **Jangan menjanjikan jam selesai** kecuali sudah pasti. Yang dijanjikan adalah jam kabar berikutnya.
- **Jangan menyalahkan** siapa pun, termasuk penyedia lain. Cukup sebut "gangguan di penyedia jaringan kami" bila memang begitu.
- **Tulis "data aman" hanya bila sudah dipastikan.** Bila belum tahu, jangan tulis apa pun soal data.
- **Tanpa data pribadi**: tidak ada nama sekolah, nama orang, NPSN, atau alamat email.
- **Masalah keamanan**: tulis hanya akibatnya bagi pengguna. Jangan menjelaskan celah atau cara serangan sebelum selesai diperbaiki. Pemberitahuan kebocoran data pribadi (UU PDP) dikirim lewat jalur resmi tersendiri yang diputuskan pemilik, bukan lewat halaman status.
- **Jam dalam WIB**, format `10.15 WIB`. Tanggal ditulis `4 Desember 2026`.
- Sapa pembaca dengan "Bapak dan Ibu", dan pakai "kami" untuk Tim SIGRAK.

## Contoh teks

Bagian dalam `[kurung siku]` diganti sebelum dikirim. Kalimat yang diberi tanda "(hanya bila sudah dipastikan)" dihapus bila belum pasti.

### Gangguan besar: sedang diperiksa

Judul: **Aplikasi SIGRAK tidak bisa dibuka**

> Sejak [10.05] WIB, Aplikasi SIGRAK tidak bisa dibuka oleh sebagian besar sekolah. Tim kami sedang mencari penyebabnya.
>
> Bapak dan Ibu tidak perlu mengulang login atau menghapus riwayat browser. Kabar berikutnya paling lambat pukul [10.35] WIB.

### Penyebab sudah ditemukan

> Kami sudah menemukan penyebabnya dan sedang memperbaikinya. Aplikasi SIGRAK masih belum bisa dibuka.
>
> Pekerjaan yang sudah tersimpan sebelum pukul [10.05] WIB tetap aman (hanya bila sudah dipastikan). Kabar berikutnya paling lambat pukul [11.05] WIB.

### Sudah pulih, masih dipantau

> Sejak [10.48] WIB, Aplikasi SIGRAK sudah bisa dibuka lagi. Kami masih memantau selama 30 menit ke depan.
>
> Bila halaman masih tidak terbuka, muat ulang halaman sekali. Bila tetap tidak bisa, hubungi kami lewat [jalur bantuan].

### Selesai

> Gangguan sudah selesai. Aplikasi SIGRAK tidak bisa dibuka dari pukul [10.05] sampai [10.48] WIB pada [4 Desember 2026].
>
> Penyebabnya [penjelasan satu kalimat tanpa istilah teknis, misalnya "pembaruan sistem yang tidak berjalan semestinya"]. Kami sudah [langkah supaya tidak terulang, misalnya "menambah pemeriksaan sebelum setiap pembaruan"].
>
> Mohon maaf atas terganggunya pekerjaan Bapak dan Ibu.

### Aplikasi lambat

Judul: **Aplikasi SIGRAK lebih lambat dari biasa**

> Sejak [08.20] WIB, beberapa halaman di Aplikasi SIGRAK terbuka lebih lambat dari biasa. Aplikasi tetap bisa dipakai. Kami sedang memperbaikinya.
>
> Kabar berikutnya paling lambat pukul [09.20] WIB.

### Satu fitur terganggu: bantuan AI

Judul: **Bantuan AI sedang tidak bisa dipakai**

> Sejak [13.10] WIB, pembuatan konten dengan bantuan AI dan chatbot tidak menjawab. Penyebabnya gangguan di penyedia layanan AI yang kami pakai. Fitur lain di Aplikasi SIGRAK berjalan normal.
>
> Bapak dan Ibu tetap bisa menyusun modul ajar, soal, dan LKPD tanpa bantuan AI. Kabar berikutnya paling lambat pukul [14.10] WIB.

### Satu fitur terganggu: unduhan PDF dan Excel

Judul: **Unduhan PDF dan Excel tertunda**

> Sejak [09.30] WIB, unduhan PDF dan Excel memakan waktu lebih lama dari biasa, dan sebagian belum selesai. Permintaan yang sudah dikirim tetap antre dan akan diproses (hanya bila sudah dipastikan).
>
> Bapak dan Ibu tidak perlu mengirim ulang permintaan unduhan. Kabar berikutnya paling lambat pukul [10.30] WIB.

### Situs ujian terganggu saat ujian berjalan

Judul: **Situs Ujian terganggu**

> Sejak [08.15] WIB, sebagian peserta tidak bisa membuka atau melanjutkan ujian di situs Ujian. Kami sedang memperbaikinya.
>
> Untuk pengawas: minta peserta tidak menutup browser. Jawaban yang sudah tersimpan tidak hilang (hanya bila sudah dipastikan). Kabar berikutnya paling lambat pukul [08.35] WIB.

Untuk situs ujian, pembaruan dikirim setiap 20 menit karena waktu ujian terbatas.

### Gangguan di penyedia jaringan

> Sejak [19.40] WIB, Aplikasi SIGRAK sulit dibuka dari beberapa daerah. Penyebabnya gangguan di penyedia jaringan yang kami pakai, bukan di SIGRAK. Data di SIGRAK tidak terpengaruh (hanya bila sudah dipastikan).
>
> Kami terus memantau dan akan mengabari paling lambat pukul [20.40] WIB.

### Masalah keamanan

Judul: **Pemeliharaan keamanan**

> Pada [4 Desember 2026], kami melakukan pemeliharaan keamanan. Selama pemeliharaan, [Bapak dan Ibu perlu login ulang / fitur … tidak bisa dipakai sementara].
>
> Kabar berikutnya paling lambat pukul [jam] WIB.

Kalimat tentang data pribadi tidak ditulis di sini. Bila data pribadi ikut terdampak, pemilik memutuskan isi dan jalur pemberitahuannya ([runbook-insiden.md](runbook-insiden.md) bagian "Kunci bocor").

### Perawatan terjadwal: pengumuman

Dibuat sebagai **maintenance** di Better Stack, dengan jam mulai dan selesai, minimal 3 hari sebelumnya.

Judul: **Perawatan terjadwal, [Sabtu, 12 Desember 2026], [21.00–23.00] WIB**

> Pada [Sabtu, 12 Desember 2026] pukul [21.00–23.00] WIB, Aplikasi SIGRAK tidak bisa dipakai selama sekitar [30 menit] di antara jam tersebut. Kami memperbarui sistem supaya aplikasi tetap aman dan cepat.
>
> Simpan pekerjaan Bapak dan Ibu sebelum pukul [21.00] WIB. Tidak ada yang perlu diubah setelah perawatan selesai.

### Perawatan terjadwal: mulai dan selesai

> Perawatan sudah dimulai. Aplikasi SIGRAK tidak bisa dipakai sampai paling lambat pukul [23.00] WIB.

> Perawatan sudah selesai pukul [21.40] WIB. Aplikasi SIGRAK sudah bisa dipakai lagi. Terima kasih atas kesabaran Bapak dan Ibu.

### Pesan singkat untuk grup operator sekolah

Dipakai bila pemilik memutuskan mengabari lewat grup WhatsApp atau saluran lain. Isinya mengarah ke halaman status supaya kabar hanya ada di satu tempat.

> Bapak dan Ibu, Aplikasi SIGRAK sedang terganggu sejak [10.05] WIB. Kami sedang memperbaikinya. Kabar terbaru ada di status.sigrak.com.

## Sesudah insiden

- Pastikan laporan di halaman status sudah "Selesai" dan semua komponen kembali "Berjalan normal".
- Ringkasan di laporan "Selesai" sama dengan catatan insiden internal, tanpa istilah teknis dan tanpa rahasia.
- Bila sekolah banyak bertanya lewat jalur bantuan padahal laporan sudah ada, catat: mungkin tautan ke halaman status kurang terlihat di aplikasi.

## Nilai yang belum ditentukan

| Tanda                                                                                           | Diisi oleh      |
| ----------------------------------------------------------------------------------------------- | --------------- |
| `<alamat cek kesehatan>` untuk monitor Better Stack (misalnya `https://app.sigrak.com/healthz`) | pengembang (R3) |
| `<daftar akun Better Stack>` yang boleh menulis laporan                                         | pemilik         |
| `[jalur bantuan]` di contoh teks (halaman `/bantuan`, WhatsApp, atau email)                     | pemilik         |
| langganan email di halaman status (tergantung paket Better Stack)                               | pemilik         |
| banner gangguan di dalam aplikasi yang menautkan ke halaman status                              | pengembang (R3) |
