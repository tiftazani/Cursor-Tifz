# Manual Kasir

Panduan kerja harian untuk kasir cabang Cuciin.

| Metadata | Nilai |
|---|---|
| Jenis dokumen | Manual Pengguna |
| Untuk | Kasir |
| Versi aplikasi | `1.10.30` |
| Diperbarui | 20 September 2026 |
| Status | Berlaku |

## Siapa pengguna panduan ini

Kasir adalah peran yang melayani pelanggan langsung: menerima cucian, mencatat transaksi, mencatat pembayaran, dan menutup kas di akhir giliran.

Ini panduan untuk Anda bila judul akun di layar **Modul** berbunyi `Cuciin · Kasir`.

## Apa yang dapat dan tidak dapat Anda lakukan

| Dapat dilakukan | Tidak dapat dilakukan |
|---|---|
| Menerima cucian dan membuat Service baru | Mengubah harga layanan |
| Mencatat pembayaran dan metode bayar | Menghapus Service |
| Mengoreksi Service di cabang sendiri | Mengoreksi Service yang sudah dikirim |
| Menambah dan mengubah data pelanggan | Menghapus pelanggan |
| Mengubah stok dan mencatat pemakaian bahan | Mengelola daftar produk dan harga produk |
| Absen masuk dan pulang | Melihat absensi karyawan lain |
| Mengirim nota WhatsApp dan melihat arsipnya | Mengubah template pesan WhatsApp |
| Mencatat dan menghapus biaya operasional | — |
| Menutup kas di akhir giliran | — |

> **INFORMASI**
> Daftar di atas adalah bawaan peran Kasir. Owner dapat menambah atau mengurangi centang fungsi untuk role Kasir lewat menu **Kontrol Akses Role**, sehingga apa yang Anda lihat bisa berbeda dari tabel ini.

## Cara masuk pertama kali

**Hasil akhir:** Anda masuk ke beranda dan dapat melihat antrian cabang Anda.

**Sebelum mulai:**

- Email dan kata sandi awal dari Owner
- Cabang yang ditugaskan kepada Anda

1. Buka aplikasi. Layar **Masuk ke akun Anda** muncul.

![Layar masuk akun Cuciin dengan kolom EMAIL dan KATA SANDI serta tombol Masuk](aset/gambar/00-masuk-akun.png)

2. Isi **EMAIL** dengan email yang diberikan Owner.
3. Isi **KATA SANDI** dengan kata sandi awal.
4. Tekan **Masuk**.
5. Ganti kata sandi Anda sendiri lewat **Akun & profil** → **Ubah kata sandi**.

> **PERHATIAN**
> Kata sandi awal dipakai bersama seluruh akun uji. Ganti segera setelah masuk pertama kali.

## Beranda kerja Anda

Setelah masuk, aplikasi membuka **Antrian laundry**. Layar ini adalah pusat kerja harian Anda.

![Beranda Antrian laundry dengan ringkasan periode, penyaring cabang, dan hitungan pekerjaan](aset/gambar/01-antrian-laundry.png)

Yang perlu diperhatikan pada layar ini:

| Bagian | Artinya |
|---|---|
| **Periode** | Rentang tanggal data yang sedang ditampilkan |
| **Cabang** | Penyaring cabang; kasir melihat cabang yang ditugaskan |
| **Sedang dikerjakan** | Jumlah cucian yang masih dalam proses |
| **Cucian telat** | Cucian yang melewati estimasi selesai; perlu ditindaklanjuti |
| **Selesai** | Cucian yang sudah siap diambil atau diserahkan |

## Tugas harian dalam urutan kerja

| Urutan | Tugas | Panduan |
|---|---|---|
| 1 | Absen masuk | [Absen masuk dan pulang](#absen-masuk-dan-pulang) |
| 2 | Menerima cucian dan membuat Service | [Menerima pesanan baru](#menerima-pesanan-baru) |
| 3 | Memperbarui status pengerjaan | [Memperbarui status pengerjaan](#memperbarui-status-pengerjaan) |
| 4 | Mencatat pembayaran | [Mencatat pembayaran](#mencatat-pembayaran) |
| 5 | Mengirim nota WhatsApp | [Mengirim nota WhatsApp](#mengirim-nota-whatsapp) |
| 6 | Mencatat biaya operasional | [Mencatat biaya operasional](#mencatat-biaya-operasional) |
| 7 | Menutup kas | [Menutup kas di akhir giliran](#menutup-kas-di-akhir-giliran) |

## Menerima pesanan baru

**Untuk:** Kasir

**Hasil akhir:** Service baru tercatat di antrian dengan nomor nota, dan pelanggan menerima rinciannya.

**Sebelum mulai:**

- Nama dan nomor telepon pelanggan
- Berat atau jumlah cucian
- Jenis layanan yang dipilih pelanggan

## Langkah

1. Buka **Modul** lalu pilih **Service baru**.
2. Pilih pelanggan yang sudah ada, atau buat pelanggan baru bila belum terdaftar.
3. Pilih jenis layanan yang diminta.
4. Isi berat atau jumlah sesuai hasil timbangan.
5. Periksa ringkasan pesanan pada bagian bawah layar.
6. Tekan tombol simpan untuk mencatat Service.

![Layar Service baru dengan pilihan pelanggan, layanan, dan ringkasan transaksi](aset/gambar/02-service-baru.png)

> **BERHASIL**
> Service baru muncul di **Antrian laundry** dengan nomor nota, dan statusnya menunggu dikerjakan.

## Jika hasilnya berbeda

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| Pelanggan tidak ditemukan saat dicari | Nama atau nomor berbeda penulisan | Buat pelanggan baru, lalu perbaiki datanya |
| Tombol simpan tidak bereaksi | Ada kolom wajib yang belum diisi | Periksa bagian ringkasan, isi kolom yang ditandai |
| Service tidak muncul di antrian | Penyaring periode atau cabang tidak sesuai | Ganti **Periode** ke Hari ini dan **Cabang** ke cabang Anda |

## Memperbarui status pengerjaan

**Untuk:** Kasir

**Hasil akhir:** Status cucian berpindah dan pelanggan dapat diberi tahu perkembangannya.

**Sebelum mulai:**

- Nomor nota atau nama pelanggan

## Langkah

1. Buka **Antrian laundry**.
2. Cari pesanan memakai nama pelanggan atau nomor nota.
3. Ketuk pesanan untuk membuka rinciannya.
4. Ubah **Status Pengerjaan** sesuai kenyataan di lapangan.
5. Tekan simpan.

> **BERHASIL**
> Status baru tampil pada daftar antrian, dan hitungan **Sedang dikerjakan** atau **Selesai** ikut berubah.

## Mencatat pembayaran

**Untuk:** Kasir

**Hasil akhir:** Pembayaran tercatat pada pesanan, dan sisa tagihan berkurang sesuai jumlah yang dibayar.

**Sebelum mulai:**

- Nomor nota yang akan dibayar
- Jumlah uang yang diterima dan metode bayarnya

## Langkah

1. Buka **Antrian laundry**.
2. Buka pesanan yang akan dibayar.
3. Buka bagian pembayaran.
4. Isi jumlah yang dibayar dan pilih metode bayar.
5. Periksa kembali sisa tagihan.
6. Tekan tombol untuk mencatat pembayaran.

> **PERHATIAN**
> Periksa jumlah sebelum menyimpan. Pembayaran yang salah catat harus dikoreksi, dan koreksi tercatat di **Riwayat aktivitas** bersama nama Anda.

## Mengirim nota WhatsApp

**Untuk:** Kasir

**Hasil akhir:** Nota terkirim ke pelanggan dan tercatat di arsip pengiriman.

**Sebelum mulai:**

- Nomor telepon pelanggan yang benar
- Aplikasi WhatsApp terpasang di perangkat

## Langkah

1. Buka **Antrian laundry** lalu buka pesanannya.
2. Pilih tindakan kirim WhatsApp.
3. Periksa isi pesan yang akan dikirim.
4. Kirim lewat WhatsApp.
5. Setelah terkirim, nota berpindah dari **WA menunggu** ke **Arsip WA**.

> **BERHASIL**
> Nota hilang dari daftar **WA menunggu** dan muncul di **Arsip WA**.

| Panduan terkait | Isi |
|---|---|
| [Menunggu kirim dan arsip](aset/gambar/08-wa-menunggu.png) | Daftar nota yang belum dan sudah dikirim |

## Absen masuk dan pulang

**Untuk:** Kasir

**Hasil akhir:** Kehadiran Anda tercatat untuk hari itu.

## Langkah

1. Buka **Modul** lalu pilih **Absensi karyawan**.
2. Periksa status hari ini pada bagian **Absensi saya hari ini**.
3. Tekan tombol absen masuk saat mulai bekerja.
4. Tekan tombol absen pulang saat giliran selesai.

![Layar Absensi karyawan dengan status absensi hari ini](aset/gambar/03-absensi-karyawan.png)

> **PERHATIAN**
> Bila status masih **Belum absen masuk** padahal Anda sudah menekan tombolnya, periksa apakah penyaring cabang sesuai dengan cabang Anda.

## Mencatat biaya operasional

**Untuk:** Kasir

**Hasil akhir:** Pengeluaran tercatat pada cabang dan ikut terhitung di laporan.

**Sebelum mulai:**

- Jumlah pengeluaran dan keterangannya

## Langkah

1. Buka **Modul** lalu pilih **Biaya operasional**.
2. Tekan tombol untuk mencatat biaya baru.
3. Isi jumlah dan keterangan pengeluaran.
4. Periksa cabang yang tercantum, pastikan sudah sesuai.
5. Simpan.

![Layar Biaya operasional dengan daftar pengeluaran per cabang](aset/gambar/05-biaya-operasional.png)

## Menutup kas di akhir giliran

**Untuk:** Kasir

**Hasil akhir:** Uang fisik yang dihitung cocok dengan catatan, dan selisihnya tercatat.

**Sebelum mulai:**

- Hitung uang tunai yang ada di tangan
- Selesaikan seluruh transaksi hari itu

## Langkah

1. Buka **Modul** lalu pilih **Tutup kas**.
2. Pilih cabang bila Anda memiliki lebih dari satu.
3. Periksa ringkasan pemasukan yang tercatat.
4. Isi jumlah uang fisik hasil hitungan.
5. Periksa selisih yang muncul.
6. Simpan penutupan kas.

![Layar Tutup kas dengan pemilihan cabang dan ringkasan pemasukan](aset/gambar/06-tutup-kas.png)

> **BAHAYA**
> Setelah kas ditutup, angka penutupan menjadi catatan resmi hari itu. Bila ada kekeliruan, laporkan ke Supervisor atau Owner untuk dikoreksi. Jangan mengulang penutupan untuk menutupi selisih.

## Data pelanggan

**Untuk:** Kasir

**Hasil akhir:** Data pelanggan tersimpan dan dapat dipakai ulang pada transaksi berikutnya.

## Langkah

1. Buka **Modul** lalu pilih **Pelanggan**.
2. Cari pelanggan memakai nama atau nomor telepon.
3. Tekan **Pelanggan baru** untuk menambah, atau ketuk satu pelanggan untuk mengubah.
4. Isi nama, nomor telepon, dan alamat.
5. Simpan.

![Layar Pelanggan dengan pencarian dan tombol tambah pelanggan](aset/gambar/07-pelanggan.png)

## Kondisi tidak biasa dan tindakan yang tepat

| Kondisi | Tindakan |
|---|---|
| Koneksi internet putus | Lanjut bekerja. Perubahan disimpan di perangkat dan terkirim saat koneksi kembali |
| Aplikasi terasa lambat karena banyak data | Ganti **Periode** ke Hari ini untuk mempersempit data yang ditampilkan |
| Pelanggan meminta koreksi berat atau layanan | Buka pesanannya dan lakukan koreksi. Perubahan tercatat di riwayat aktivitas |
| Pelanggan meminta pembatalan pesanan | Laporkan ke Supervisor atau Owner. Kasir tidak dapat menghapus Service |
| Uang tunai tidak cocok dengan catatan | Catat apa adanya pada **Tutup kas**, lalu laporkan selisihnya |
| Nota sudah dikirim tetapi isinya salah | Laporkan ke Owner. Koreksi nota yang sudah dikirim bukan wewenang Kasir |

## Kesalahan umum

| Kesalahan | Akibat | Cara menghindari |
|---|---|---|
| Membuat pesanan ganda untuk pelanggan yang sama | Antrian membingungkan dan laporan tidak akurat | Cari pelanggan lebih dulu sebelum membuat pesanan baru |
| Menekan simpan dua kali | Pesanan tercatat dua kali | Tunggu sampai layar berpindah; jangan menekan berulang |
| Menutup kas sebelum semua transaksi selesai | Selisih kas pada laporan | Selesaikan transaksi lebih dulu |
| Mengganti perangkat tanpa sinkronisasi | Perubahan hilang | Pastikan tidak ada perubahan menunggu sebelum berpindah perangkat |
| Menyimpan foto bukti lalu menghapus aplikasi | Foto hilang permanen | Foto hanya tersimpan di perangkat, tidak di server |

## Bantuan dan eskalasi

| Keadaan | Hubungi |
|---|---|
| Keliru mencatat transaksi | Supervisor cabang |
| Pembatalan atau penghapusan pesanan | Supervisor atau Owner |
| Kata sandi lupa | Owner |
| Peran atau akses terasa salah | Owner |
| Aplikasi gagal berulang pada satu tindakan | Owner, sertakan nomor nota dan waktu kejadian |

## Ringkasan cepat

| Tugas | Menu |
|---|---|
| Menerima cucian | **Service baru** |
| Melihat pekerjaan berjalan | **Antrian laundry** |
| Mencatat pembayaran | **Antrian laundry**, buka pesanannya |
| Mengirim nota | **Antrian laundry**, buka pesanannya |
| Melihat nota belum terkirim | **WA menunggu** |
| Data pelanggan | **Pelanggan** |
| Absen | **Absensi karyawan** |
| Pengeluaran | **Biaya operasional** |
| Tutup giliran | **Tutup kas** |
| Data akun sendiri | **Akun & profil** |
