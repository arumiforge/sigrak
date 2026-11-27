<!-- Draft for /perlindungan-data-murid (RS-06, D-435): data-processing agreement between each school (controller) and the operator of SIGRAK (processor) under UU PDP No. 27/2022. Indonesian page text. Reviewed offline by a lawyer before launch (D-444). Placeholders in [square brackets] are listed in ../README.md. -->

# Perjanjian Perlindungan Data Murid

> **DRAF — belum ditinjau ahli hukum**
>
> Versi: 0.1 (draf)
> Berlaku sejak: [tanggal]

Perjanjian ini mengatur cara [Nama PT] memproses data pribadi murid, orang tua atau wali, dan staf sekolah yang dimasukkan sekolah ke Sigrak. Perjanjian ini mengikuti Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

## Ringkasan

- Sekolah adalah pengendali data. [Nama PT] adalah prosesor yang hanya bekerja atas perintah sekolah.
- Data murid dipakai hanya untuk administrasi dan pembelajaran di sekolah itu. Tidak untuk iklan, tidak dijual, dan tidak untuk melatih model AI.
- Data pribadi murid tidak pernah dikirim ke AI.
- Berkas yang memuat data pribadi murid disimpan di server di Indonesia. Hanya cadangan terenkripsi yang mungkin disimpan di luar negeri.
- Bila terjadi kegagalan pelindungan data, kami memberi tahu sekolah paling lambat [jumlah] jam setelah mengetahuinya.
- Saat sekolah berhenti, sekolah bisa mengunduh datanya, lalu kami menghapusnya.

## 1. Para pihak

1. **Sekolah**, yaitu satuan pendidikan yang memakai Sigrak, dengan identitas yang tercatat di akun sekolah (nama sekolah, NPSN atau NSM, dan alamat), diwakili kepala sekolah. Dalam perjanjian ini Sekolah berperan sebagai **pengendali data pribadi**.
2. **[Nama PT]**, beralamat di [Alamat PT], yang mengelola Sigrak ("kami"). Dalam perjanjian ini kami berperan sebagai **prosesor data pribadi**.

## 2. Cara perjanjian ini berlaku

1. Perjanjian ini berlaku setelah kepala sekolah menyetujuinya di aplikasi Sigrak, atau menandatangani salinan cetaknya. Kami menyimpan nomor versi yang disetujui, nama yang menyetujui, dan waktunya.
2. Bila guru memakai Sigrak sebelum kepala sekolahnya menyetujui perjanjian ini, guru menyatakan bahwa ia memasukkan data murid untuk tugas sekolah dengan sepengetahuan kepala sekolah. [Ketentuan bagi sekolah yang belum menyetujui perjanjian ini, misalnya batas data yang boleh dimasukkan atau permintaan persetujuan kepada kepala sekolah].
3. Perjanjian ini adalah bagian dari kesepakatan kerja sama antara Sekolah dan kami, dan berlaku bersama [Syarat Penggunaan](/syarat-penggunaan).

## 3. Istilah

- **Data pribadi**: data tentang orang yang teridentifikasi atau dapat diidentifikasi.
- **Data pribadi yang bersifat spesifik**: termasuk data kesehatan dan data anak, sesuai UU PDP. Dalam perjanjian ini, data agama dan hasil asesmen yang sensitif juga diperlakukan seketat data spesifik.
- **Data murid**: data pribadi murid dan orang tua atau wali yang dimasukkan ke Sigrak oleh Sekolah atau stafnya.
- **Subjek data**: orang yang datanya diproses, yaitu murid, orang tua atau wali, dan staf sekolah.
- **Subprosesor**: pihak lain yang kami libatkan untuk membantu memproses data, misalnya penyedia server.
- **Kegagalan pelindungan data**: kebocoran, perubahan, atau hilangnya data pribadi tanpa hak, baik sengaja maupun tidak.

## 4. Kewajiban Sekolah

Sebagai pengendali data, Sekolah:

1. memastikan ada dasar yang sah untuk memproses data murid, termasuk persetujuan orang tua atau wali untuk data anak bila diwajibkan UU PDP.
2. memberi tahu orang tua atau wali data apa yang dicatat, untuk apa, siapa yang melihatnya, dan berapa lama disimpan. [Templat pemberitahuan atau kesepakatan sekolah dengan orang tua disediakan kami].
3. memasukkan data yang benar dan secukupnya untuk tujuan dalam Lampiran A.
4. mengatur siapa di sekolah yang mendapat akun dan peran apa.
5. menerima dan menjawab permintaan orang tua atau wali tentang data anaknya, dengan bantuan kami bila perlu.
6. menyalakan fitur yang memakai data lebih rinci, seperti asisten sekolah yang menjawab dari data sekolah, hanya bila Sekolah sudah punya kesepakatan dengan orang tua atau wali yang mencakupnya.

## 5. Kewajiban kami

Sebagai prosesor data, kami:

1. memproses data murid hanya untuk tujuan dalam Lampiran A dan hanya atas perintah Sekolah. Pemakaian fitur Sigrak oleh staf Sekolah dianggap sebagai perintah Sekolah.
2. tidak memakai data murid untuk iklan, tidak menjualnya, tidak memberikannya kepada pihak lain di luar Lampiran B, dan tidak memakainya untuk melatih model AI.
3. memberi tahu Sekolah bila menurut kami suatu perintah melanggar UU PDP.
4. menjaga kerahasiaan data murid. Setiap anggota Tim Sigrak yang dapat mengakses data terikat kewajiban kerahasiaan tertulis.
5. menerapkan langkah keamanan pada Pasal 8.
6. membantu Sekolah memenuhi hak subjek data, menilai dampak pelindungan data bila diperlukan, dan menanggapi pertanyaan lembaga yang berwenang.
7. menunjuk petugas pelindungan data yang dapat dihubungi Sekolah: [Nama atau jabatan petugas pelindungan data], [Email petugas pelindungan data].

## 6. AI dan data murid

1. Data pribadi murid tidak pernah dikirim ke AI. Ini termasuk nama, NISN, tanggal lahir, kehadiran, catatan, dan nilai yang terkait dengan identitas murid.
2. Bila draf rapor atau catatan wali kelas dibuat dengan bantuan AI, yang dikirim hanya capaian per tujuan pembelajaran tanpa identitas, misalnya "Murid A". Nama murid ditambahkan di server kami setelahnya.
3. Foto lembar jawaban dan tulisan tangan murid diproses di perangkat guru dan tidak diunggah. Bila teks jawaban uraian dikirim ke AI untuk saran nilai, teks itu dikirim tanpa nama murid, hanya dengan kode nomor absen dan nomor soal. Guru yang memutuskan nilainya.
4. Data agama, kesehatan, catatan bimbingan, dan hasil asesmen yang sensitif tidak pernah dikirim ke AI.
5. Murid tidak pernah memakai atau menjalankan AI. Situs Simulasi TKA tidak memanggil AI.
6. Asisten sekolah yang menjawab dari data sekolah hanya dapat dipakai staf Sekolah yang masuk ke aplikasi, hanya bila Sekolah menyalakannya sesuai Pasal 4 angka 6, dan hanya menampilkan data yang memang boleh dilihat peran penanya. Data pribadi disamarkan sebelum dikirim ke penyedia AI dalam Lampiran B. Orang tua tidak memakai asisten ini.

## 7. Akses di dalam Sekolah dan oleh Tim Sigrak

1. Setiap peran hanya melihat data yang menjadi tugasnya. Data agama, kesehatan, dan hasil asesmen yang sensitif hanya dilihat guru kelas murid itu (serta guru pendamping khusus yang ditugaskan), operator, dan kepala sekolah.
2. Pengawas hanya melihat total per sekolah dan total per kelas, bukan data pribadi murid.
3. Di peta, tempat tinggal murid ditampilkan paling rinci sampai tingkat desa. Di luar tampilan sekolah sendiri, jumlah di bawah 5 ditampilkan sebagai "<5".
4. Tim bantuan Sigrak dapat membuka tampilan Sekolah tanpa bisa mengubah data, untuk membantu Sekolah. Data agama dan kesehatan murid tetap tersembunyi. Setiap sesi bantuan dicatat (petugas, sekolah, waktu mulai dan selesai).
5. Pesan kepada orang tua dikirim guru dari WhatsApp milik guru sendiri. Sigrak tidak mengirim pesan WhatsApp dan tidak membuat tautan yang membuka data murid.

## 8. Keamanan

Kami menerapkan langkah berikut, dan memperbaruinya sesuai perkembangan:

- semua koneksi memakai HTTPS.
- data setiap sekolah dipisahkan di aplikasi dan di basis data.
- akses diberikan per peran dan per kelompok data. Akun Tim Sigrak yang berwenang besar wajib memakai verifikasi dua langkah.
- perubahan data penting dan pembukaan data sensitif dicatat.
- server tidak punya alamat IP publik dan hanya dapat dijangkau lewat terowongan terenkripsi. Akses pengelola server dilindungi lapisan masuk tambahan.
- cadangan dienkripsi sebelum keluar dari server, disimpan di lebih dari satu tempat dengan kunci pengaman, dan dipulihkan secara uji setiap bulan.
- target pemulihan: data yang hilang paling banyak 5 menit terakhir, dan layanan pulih paling lama 1 jam setelah gangguan besar.
- data asli tidak pernah dipakai di server uji coba atau di laptop pengembang.
- catatan aplikasi dan catatan kesalahan tidak memuat data pribadi.

## 9. Subprosesor

1. Sekolah menyetujui subprosesor dalam Lampiran B.
2. Kami memberi tahu Sekolah paling lambat [jumlah] hari sebelum menambah atau mengganti subprosesor. Sekolah dapat mengajukan keberatan dengan alasan yang wajar. Bila keberatan tidak dapat diselesaikan, Sekolah dapat mengakhiri perjanjian ini tanpa denda.
3. Kami mengikat setiap subprosesor dengan kewajiban pelindungan data yang tidak lebih longgar dari perjanjian ini, dan tetap bertanggung jawab kepada Sekolah atas pekerjaan subprosesor.

## 10. Pengiriman data ke luar Indonesia

1. Aplikasi, basis data, dan berkas yang memuat data pribadi murid disimpan di server di Indonesia.
2. Salinan cadangan dienkripsi di server kami sebelum dikirim, lalu disimpan di [Nama penyedia penyimpanan cadangan] dan [Nama penyedia penyimpanan cadangan kedua], yang lokasinya dapat berada di luar Indonesia. Kunci enkripsi hanya dipegang kami di Indonesia, sehingga penyedia penyimpanan tidak dapat membaca isinya.
3. [Klausul dasar pengiriman ke luar negeri sesuai Pasal 56 UU PDP: negara tujuan dengan tingkat pelindungan setara atau lebih tinggi, pelindungan yang memadai dan mengikat, atau persetujuan subjek data; disusun ahli hukum setelah lokasi penyimpanan dipastikan.]
4. [Klausul bila asisten sekolah memakai penyedia AI di luar Indonesia: data disamarkan sebelum dikirim, dasar pengirimannya, dan pilihan Sekolah untuk tidak menyalakan fitur ini.]

## 11. Kegagalan pelindungan data

1. Bila kami mengetahui kegagalan pelindungan data yang menyangkut data Sekolah, kami memberi tahu kepala sekolah paling lambat [jumlah] jam setelah mengetahuinya. Batas ini dibuat supaya Sekolah dapat memenuhi kewajiban pemberitahuan tertulis 3 x 24 jam kepada subjek data dan lembaga yang berwenang, sesuai Pasal 46 UU PDP.
2. Pemberitahuan kami memuat: data apa yang terkena, kapan dan bagaimana terjadi, perkiraan jumlah orang yang terkena, langkah yang sudah dan akan kami ambil, serta kontak yang dapat dihubungi.
3. Bila belum semua keterangan diketahui, kami mengirim yang sudah ada lebih dulu, lalu melengkapinya.
4. Kami membantu Sekolah menyusun pemberitahuan kepada orang tua atau wali dan kepada lembaga yang berwenang.

## 12. Hak subjek data

1. Orang tua atau wali mengajukan permintaan tentang data anaknya kepada Sekolah, misalnya permintaan melihat, memperbaiki, atau menghapus data.
2. Sigrak menyediakan alat bagi Sekolah untuk melihat, mengekspor, memperbaiki, dan menghapus data murid.
3. Bila permintaan sampai kepada kami, kami meneruskannya kepada Sekolah paling lambat [jumlah] hari kerja dan tidak menjawabnya sendiri, kecuali atas perintah Sekolah.
4. Kami membantu Sekolah menjawab permintaan dalam [jangka waktu sesuai UU PDP].

## 13. Masa simpan, pengembalian, dan penghapusan

1. Selama perjanjian berlaku, data disimpan sesuai pengaturan masa simpan di Sigrak. Rapor, leger, data kelulusan, dan buku induk tidak dihapus otomatis. Hasil supervisi dan PKKS disimpan paling sedikit 5 tahun. Tahun ajaran yang sudah ditutup menjadi arsip yang hanya bisa dibaca dan diunduh.
2. Bila perjanjian berakhir, Sekolah dapat mengunduh seluruh datanya dalam format yang umum (Excel, PDF) selama [jumlah] hari.
3. Setelah itu, kami menghapus data Sekolah dari aplikasi paling lambat [jumlah] hari. Salinan di cadangan ikut terhapus saat masa simpan cadangan berakhir: 30 hari untuk cadangan harian, dan [jumlah] bulan untuk salinan bulanan. Selama menunggu, cadangan tetap terenkripsi dan tidak dipakai.
4. Atas permintaan Sekolah, kami memberikan surat keterangan penghapusan.
5. Kami dapat menyimpan data lebih lama hanya bila diwajibkan hukum, dan hanya sebatas yang diwajibkan.

## 14. Pemeriksaan kepatuhan

1. Atas permintaan tertulis Sekolah, kami memberikan keterangan yang wajar tentang cara kami memenuhi perjanjian ini, paling banyak [frekuensi] dalam setahun, kecuali setelah kegagalan pelindungan data.
2. [Ketentuan pemeriksaan oleh dinas pendidikan, kantor Kementerian Agama, atau pihak yang ditunjuk Sekolah].

## 15. Tanggung jawab

[Klausul tanggung jawab dan ganti rugi para pihak, disusun ahli hukum.]

## 16. Jangka waktu dan berakhirnya perjanjian

1. Perjanjian ini berlaku selama Sekolah atau stafnya memakai Sigrak, dan tetap berlaku untuk kewajiban pada Pasal 13 setelah pemakaian berhenti.
2. Sekolah dapat mengakhiri perjanjian ini kapan saja dengan pemberitahuan tertulis. [Akibat bagi langganan yang sudah dibayar].

## 17. Perubahan perjanjian

Setiap versi perjanjian ini diberi nomor dan tanggal berlaku. Bila ada perubahan yang berpengaruh pada data Sekolah, kami memberi tahu kepala sekolah paling lambat [jumlah] hari sebelum berlaku dan meminta persetujuan ulang di aplikasi. Versi sebelumnya tetap bisa dibaca di halaman ini.

## 18. Hukum yang berlaku

Perjanjian ini tunduk pada hukum Republik Indonesia, termasuk UU PDP dan Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik. Perselisihan diselesaikan sesuai [Syarat Penggunaan](/syarat-penggunaan), Pasal 14.

## Lampiran A: Rincian pemrosesan

**Subjek data:** murid, orang tua atau wali murid, serta guru dan tenaga kependidikan Sekolah.

**Tujuan pemrosesan:**

| Tujuan | Kategori data | Catatan |
| --- | --- | --- |
| Data kelas dan murid | Nama, NISN, jenis kelamin, tanggal lahir, kelas, nomor absen, status pindah atau keluar | [Sesuaikan dengan kolom akhir di aplikasi] |
| Pengelompokan kelas agama | Agama murid | Hanya untuk mengelompokkan kelas agama; tidak dilihat pengawas, tidak dikirim ke AI |
| Kehadiran harian | Tanggal, status hadir, alasan tidak hadir | |
| Jurnal dan catatan murid | Catatan anekdot, bimbingan, prestasi | Catatan bimbingan tidak masuk Berkas Administrasi, tampilan pengawas, atau AI |
| Asesmen dan rapor | Nilai per tujuan pembelajaran, hasil observasi dan rubrik, deskripsi capaian, catatan wali kelas, tanggapan orang tua | |
| Hasil asesmen sensitif | Hasil sosial-emosional, kebutuhan khusus, minat dan bakat | Tidak dijadikan label tetap atau diagnosis |
| Kenaikan dan kelulusan | Keputusan kenaikan, data SKL dan ijazah | |
| Kunjungan rumah dan kesehatan ringan | Catatan kunjungan, keadaan kesehatan ringan | Data spesifik; hanya guru kelas, operator, kepala sekolah |
| Hubungan dengan orang tua | Nama dan nomor WhatsApp orang tua atau wali, catatan kontak | Pesan dikirim dari WhatsApp guru |
| Peta sebaran murid | Desa atau kelurahan tempat tinggal | Tidak ada titik rumah |
| Ekstrakurikuler | Keanggotaan, kehadiran, deskripsi | |
| Tabungan dan keuangan kelas | Setoran, penarikan, sumbangan sukarela | Hanya bila Sekolah menyalakan menu ini |
| Simulasi TKA | Kartu login sekali pakai, jawaban, nilai | Kartu login berhenti berlaku saat sesi ditutup |
| Akun staf sekolah | Nama, email, peran, NIP bila diisi | |
| Bantuan kepada Sekolah | Tampilan baca saja | Lihat Pasal 7 angka 4 |

**Lama pemrosesan:** selama perjanjian berlaku, ditambah masa pada Pasal 13.

**Lokasi pemrosesan:** server di Indonesia; cadangan terenkripsi sesuai Pasal 10.

## Lampiran B: Daftar subprosesor

| Layanan | Subprosesor | Data yang diproses | Lokasi |
| --- | --- | --- | --- |
| Server aplikasi, basis data, dan berkas | [Nama penyedia server] | Semua data Sekolah | Indonesia, [kota] |
| Server cadangan siaga | [Nama penyedia server cadangan] | Dipulihkan dari cadangan saat gangguan besar | Indonesia, [kota] |
| Jaringan, terowongan terenkripsi, dan perlindungan serangan | [Nama penyedia jaringan] | Lalu lintas terenkripsi menuju aplikasi | [Lokasi] |
| Penyimpanan cadangan terenkripsi dan berkas tanpa data pribadi | [Nama penyedia penyimpanan cadangan] | Cadangan terenkripsi; berkas tanpa data pribadi | [Lokasi] |
| Penyimpanan cadangan kedua | [Nama penyedia penyimpanan cadangan kedua] | Salinan bulanan terenkripsi | [Lokasi] |
| Email layanan | [Penyedia email] | Nama dan email staf sekolah; tidak ada data murid | [Lokasi] |
| Asisten sekolah (bila dinyalakan) | [Daftar penyedia AI asisten] | Pertanyaan dan potongan data yang sudah disamarkan | [Lokasi] |

Catatan: pembuatan bahan ajar memakai kunci AI Gemini milik guru sendiri, bukan milik kami. Data pribadi murid tidak dikirim ke layanan itu (Pasal 6). Halaman status layanan dan pemantauan dari luar tidak memproses data pribadi.
