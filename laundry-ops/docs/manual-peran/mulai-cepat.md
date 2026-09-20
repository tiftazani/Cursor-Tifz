# Mulai Cepat

Langkah. Tujuan. Jalan pintas untuk tugas paling sering, sesuai peran Anda.

> Untuk angka dan pilihan yang harus dipahami lebih dulu, lihat [Manual Owner](../manual-owner/index.md).

## Pilih jalur Anda

| Peran | Mulai dari | Tugas pertama |
|---|---|---|
| Owner | [Buka aplikasi](#owner-membuka-aplikasi) | Siapkan cabang dan pengguna |
| Supervisor | [Buka aplikasi](#supervisor-membuka-aplikasi) | Periksa antrian dan aset cabang |
| Kasir | [Buka aplikasi](#kasir-membuka-aplikasi) | Catat service pertama |

## Owner membuka aplikasi

**Untuk:** Owner

**Hasil akhir:** Aplikasi siap dengan cabang, pengguna, dan harga yang benar.

**Sebelum mulai:**

- Daftar cabang dan alamatnya
- Daftar karyawan beserta perannya
- Daftar layanan dan tarifnya

### Langkah

1. Pasang aplikasi, lalu masuk dengan akun Anda.
2. Buka **Modul** → **Cabang**, tambahkan cabang Anda.
3. Buka **Modul** → **Layanan & harga**, pastikan tarifnya benar.
4. Buka **Modul** → **Daftar User**, tambahkan setiap karyawan dengan role dan cabang yang tepat.
5. Buka **Modul** → **Kontrol Akses Role**, periksa centang setiap role.
6. Minta setiap karyawan masuk dari perangkatnya masing-masing untuk memastikan menunya benar.

![Layar Daftar User dengan pencarian, penyaring peran, dan tombol tambah](aset/gambar/14-daftar-user.png)

> **PERHATIAN**
> Pastikan setiap karyawan memakai akun sendiri. Akun bersama membuat **Riwayat aktivitas** tidak dapat dipercaya.

**Cara memverifikasi:** Buka **Modul** pada perangkat karyawan. Judul akun dan daftar menunya harus sesuai peran yang Anda tetapkan.

**Cara memulihkan:** Role dapat diubah kembali kapan saja di **Kontrol Akses Role**.

## Supervisor membuka aplikasi

**Untuk:** Supervisor

**Hasil akhir:** Anda mengetahui beban kerja cabang hari ini.

**Sebelum mulai:** Akun yang sudah disetujui Owner.

### Langkah

1. Masuk, lalu buka **Modul**.
2. Buka **Antrian laundry**, pilih **Periode** Hari ini dan cabang Anda.
3. Periksa pesanan yang statusnya **Menunggu dikerjakan** atau **Sedang dikerjakan**.
4. Buka **Daftar Aset Cabang**, periksa peralatan yang berstatus **Perlu perbaikan** atau **Rusak**.
5. Buka **Produk stok**, periksa bahan yang hampir habis.

![Layar Antrian laundry dengan daftar pesanan berjalan](aset/gambar/01-antrian-laundry.png)

**Cara memverifikasi:** Jumlah pesanan di **Antrian laundry** harus sesuai dengan cucian fisik yang ada di cabang.

**Cara memulihkan:** Bila jumlahnya berbeda, periksa kembali penyaring **Periode** dan **Cabang**.

## Kasir membuka aplikasi

**Untuk:** Kasir

**Hasil akhir:** Satu pesanan tercatat dan pelanggan menerima perkiraan biayanya.

**Sebelum mulai:** Akun kasir yang sudah disetujui.

### Langkah

1. Buka **Modul** → **Service baru**.
2. Pilih pelanggan, atau buat pelanggan baru bila belum ada.
3. Pilih layanan, isi berat atau jumlahnya.
4. Periksa ringkasan nilainya.
5. Simpan, lalu sampaikan perkiraan waktu selesai kepada pelanggan.
6. Catat pembayarannya bila pelanggan membayar sekarang.

![Layar Service baru dengan pilihan pelanggan, layanan, dan ringkasan transaksi](aset/gambar/02-service-baru.png)

> **INFORMASI**
> Pesanan yang baru dibuat berstatus **Menunggu dikerjakan**. Perbarui ke **Sedang dikerjakan** setelah cucian mulai diproses.

**Cara memverifikasi:** Buka **Antrian laundry**, pesanan baru harus muncul di bagian atas.

**Cara memulihkan:** Buka pesanannya dan koreksi bagian yang keliru.

## Kesalahan umum

| Kesalahan | Akibat | Cara menghindari |
|---|---|---|
| Memakai akun bersama | Jejak audit menunjuk orang yang salah | Satu akun untuk satu orang |
| Membandingkan angka tanpa memeriksa periode | Keputusan diambil dari data yang salah | Periksa **Periode** dan **Cabang** sebelum membaca angka |
| Membandingkan laporan sebelum sinkronisasi selesai | Angka tampak berbeda padahal hanya belum terkirim | Tunggu sinkronisasi, pastikan ada koneksi |
| Menganggap harganya sama di semua cabang | Selisih penagihan | Periksa **Layanan & harga** per cabang |

## Hal yang perlu diketahui sejak awal

| Hal | Artinya |
|---|---|
| Bekerja tanpa internet | Tetap bisa; perubahan terkirim saat koneksi kembali |
| Foto bukti | Hanya ada di perangkat pengambilnya, tidak ikut tersinkron |
| Status pengerjaan dan pembayaran | Dua hal terpisah; **Selesai** tidak berarti **Lunas** |
| Versi aplikasi | Hanya naik, tidak pernah turun |

## Kalau ada yang tidak sesuai

| Keadaan | Hubungi |
|---|---|
| Tidak dapat masuk | Owner tempat Anda bekerja |
| Menu tidak muncul | Owner, minta periksa centang role Anda |
| Muncul selisih kas | Supervisor |
| Aplikasi menghambat pekerjaan | Owner, sertakan menu dan waktu kejadian |
