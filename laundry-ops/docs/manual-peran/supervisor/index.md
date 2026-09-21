# Manual Supervisor

Panduan kerja harian untuk supervisor cabang Cuciin.

| Metadata | Nilai |
|---|---|
| Jenis dokumen | Manual Pengguna |
| Untuk | Supervisor |
| Versi aplikasi | `1.10.30` |
| Diperbarui | 20 September 2026 |
| Status | Berlaku |

## Siapa pengguna panduan ini

Supervisor mengawasi kerja harian cabang: memastikan cucian berpindah status dengan benar, absensi karyawan tertib, dan stok bahan terkendali. Supervisor tidak menangani uang dan tidak membuat transaksi penjualan.

Ini panduan untuk Anda bila judul akun di layar **Modul** berbunyi `Cuciin · Supervisor`.

## Apa yang dapat dan tidak dapat Anda lakukan

| Dapat dilakukan | Tidak dapat dilakukan |
|---|---|
| Melihat seluruh antrian cabang | Membuat Service baru |
| Mengubah status pengerjaan dan menyerahkan cucian | Mencatat pembayaran atau mengubah harga |
| Menyerahkan cucian ke pelanggan | Mengoreksi transaksi |
| Melihat dan mengubah stok serta aset | Menutup kas |
| Melihat absensi seluruh karyawan cabang | Mengoreksi absensi karyawan |
| Absen masuk dan pulang | Melihat data pelanggan dan mengirim WhatsApp |
| Melihat laporan operasional | Mengakses data master dan pengaturan |

> **INFORMASI**
> Supervisor tidak memiliki modul pelanggan, WhatsApp, biaya, dan kas. Bila Anda memerlukan salah satunya untuk pekerjaan tertentu, mintalah Owner menambah centangnya lewat **Kontrol Akses Role**.

## Tugas harian dalam urutan kerja

| Urutan | Tugas | Panduan |
|---|---|---|
| 1 | Absen masuk | [Mencatat kehadiran sendiri](#mencatat-kehadiran-sendiri) |
| 2 | Memeriksa antrian dan cucian telat | [Memeriksa beban kerja cabang](#memeriksa-beban-kerja-cabang) |
| 3 | Memperbarui status pengerjaan | [Memperbarui status pengerjaan](#memperbarui-status-pengerjaan) |
| 4 | Menyerahkan cucian ke pelanggan | [Menyerahkan cucian ke pelanggan](#menyerahkan-cucian-ke-pelanggan) |
| 5 | Memeriksa absensi tim | [Memeriksa absensi tim](#memeriksa-absensi-tim) |
| 6 | Memeriksa stok dan aset | [Memeriksa stok dan aset](#memeriksa-stok-dan-aset) |
| 7 | Meninjau laporan | [Meninjau laporan](#meninjau-laporan) |

## Memeriksa beban kerja cabang

**Untuk:** Supervisor

**Hasil akhir:** Anda mengetahui berapa cucian yang sedang dikerjakan dan mana yang terlambat.

## Langkah

1. Buka **Antrian laundry**.
2. Atur **Periode** ke Hari ini.
3. Pastikan **Cabang** sesuai cabang Anda.
4. Perhatikan hitungan **Sedang dikerjakan** dan **Cucian telat**.
5. Tindak lanjuti pesanan yang masuk hitungan **Cucian telat**.

![Beranda Antrian laundry dengan hitungan pekerjaan dan penyaring cabang](aset/gambar/01-antrian-laundry.png)

> **PERHATIAN**
> **Cucian telat** adalah pekerjaan yang melewati estimasi selesai. Angka ini sebaiknya mendekati nol menjelang akhir hari.

## Memperbarui status pengerjaan

**Untuk:** Supervisor

**Hasil akhir:** Status cucian sesuai kenyataan di lapangan, dan pelanggan dapat diberi tahu perkembangannya.

**Sebelum mulai:**

- Nomor nota atau nama pelanggan

## Langkah

1. Buka **Antrian laundry**.
2. Cari pesanan yang akan diperbarui.
3. Ketuk pesanan untuk membuka rinciannya.
4. Ubah **Status Pengerjaan**.
5. Simpan.

> **BERHASIL**
> Status baru tampil pada daftar antrian dan hitungan ringkasan ikut berubah.

## Menyerahkan cucian ke pelanggan

**Untuk:** Supervisor

**Hasil akhir:** Cucian berpindah status menjadi sudah diambil, dan pesanan tertutup sebagai pekerjaan selesai.

**Sebelum mulai:**

- Cucian sudah selesai dan siap diserahkan
- Nama pelanggan atau nomor nota

## Langkah

1. Buka **Antrian laundry**.
2. Buka pesanan yang akan diserahkan.
3. Periksa identitas pelanggan yang datang.
4. Lakukan tindakan serah terima.
5. Simpan.

> **PERHATIAN**
> Periksa apakah pesanan sudah dibayar sebelum diserahkan. Bila belum, arahkan pelanggan ke kasir.

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| Pesanan tidak dapat diserahkan | Pesanan belum melewati tahap pengerjaan yang diperlukan | Perbarui status lebih dulu, lalu lakukan serah terima |
| Pesanan tidak ditemukan | Penyaring periode atau cabang tidak sesuai | Ganti **Periode** ke Hari ini dan **Cabang** ke cabang Anda |

## Memeriksa absensi tim

**Untuk:** Supervisor

**Hasil akhir:** Anda mengetahui siapa yang sudah dan belum masuk hari itu.

## Langkah

1. Buka **Modul** lalu pilih **Absensi karyawan**.
2. Periksa daftar kehadiran hari itu.
3. Perhatikan karyawan yang belum absen.
4. Tindak lanjuti sesuai kebutuhan cabang.

![Layar Absensi karyawan dengan status kehadiran per cabang](aset/gambar/03-absensi-karyawan.png)

> **PERHATIAN**
> Supervisor dapat **melihat** absensi seluruh karyawan cabang, tetapi tidak dapat mengoreksinya. Bila ada jam yang salah, laporkan ke Owner.

## Mencatat kehadiran sendiri

**Untuk:** Supervisor

**Hasil akhir:** Kehadiran Anda tercatat untuk hari itu.

## Langkah

1. Buka **Modul** lalu pilih **Absensi karyawan**.
2. Periksa bagian **Absensi saya hari ini**.
3. Tekan tombol absen masuk saat mulai bekerja.
4. Tekan tombol absen pulang saat selesai.

## Memeriksa stok dan aset

**Untuk:** Supervisor

**Hasil akhir:** Jumlah bahan dan kondisi peralatan diketahui, dan pemakaian tercatat.

**Sebelum mulai:**

- Hasil hitung fisik bahan atau pemeriksaan peralatan

## Langkah

1. Buka **Modul** lalu pilih **Produk stok** untuk bahan dan barang yang dijual.
2. Periksa jumlah tiap bahan pada cabang Anda.
3. Perbarui jumlah bila ada pemakaian.
4. Buka **Daftar Aset Cabang** untuk mesin dan peralatan.
5. Perbarui kondisi aset bila ada perubahan.

![Layar Produk stok dengan bahan dan barang per cabang](aset/gambar/16-produk-stok.png)

![Layar Daftar Aset Cabang dengan peralatan operasional per cabang](aset/gambar/04-daftar-aset-cabang.png)

> **INFORMASI**
> Supervisor dapat mengubah jumlah dan kondisi, tetapi tidak dapat menghapus aset maupun membuat jenis aset baru.

## Meninjau laporan

**Untuk:** Supervisor

**Hasil akhir:** Anda memahami beban dan hasil operasional cabang.

## Langkah

1. Buka **Modul** lalu pilih **Laporan transaksi**.
2. Pilih periode yang ingin ditinjau.
3. Periksa jumlah pesanan dan nilai transaksi.

![Layar Laporan transaksi dengan pilihan periode dan ekspor PDF](aset/gambar/10-laporan-transaksi.png)

> **INFORMASI**
> Supervisor dapat melihat laporan operasional, tetapi tidak dapat mengekspornya. Mintalah Owner bila perlu berkas laporan.

## Kondisi tidak biasa dan tindakan yang tepat

| Kondisi | Tindakan |
|---|---|
| Koneksi internet putus | Lanjut bekerja; perubahan terkirim saat koneksi kembali |
| Cucian telat menumpuk | Periksa urutan pengerjaan dan bagi beban ke karyawan yang tersedia |
| Karyawan salah absen | Laporkan ke Owner; koreksi absensi bukan wewenang Supervisor |
| Stok fisik tidak cocok dengan catatan | Perbarui jumlah sesuai hitungan fisik, lalu sampaikan ke Owner |
| Peralatan rusak | Perbarui kondisi aset dan laporkan ke Owner |
| Pelanggan meminta pembatalan | Arahkan ke Owner; Supervisor tidak dapat membatalkan transaksi |

## Kesalahan umum

| Kesalahan | Akibat | Cara menghindari |
|---|---|---|
| Menyerahkan cucian yang belum dibayar | Tagihan hilang jejaknya | Periksa status pembayaran lebih dulu |
| Memperbarui status tanpa memeriksa kenyataan | Pelanggan menerima informasi yang salah | Periksa cucian fisik sebelum mengubah status |
| Menyamakan hitungan stok dari ingatan | Selisih bahan tidak terdeteksi | Hitung fisik lebih dulu |

## Bantuan dan eskalasi

| Keadaan | Hubungi |
|---|---|
| Perlu mengoreksi transaksi atau absensi | Owner |
| Perlu membatalkan pesanan | Owner |
| Perlu menambah akses menu | Owner |
| Kata sandi lupa | Owner |

## Ringkasan cepat

| Tugas | Menu |
|---|---|
| Beban kerja hari ini | **Antrian laundry** |
| Status pengerjaan | **Antrian laundry**, buka pesanannya |
| Serah terima ke pelanggan | **Antrian laundry**, buka pesanannya |
| Kehadiran tim dan diri sendiri | **Absensi karyawan** |
| Bahan dan barang | **Produk stok** |
| Mesin dan peralatan | **Daftar Aset Cabang** |
| Laporan operasional | **Laporan transaksi** |
| Data akun sendiri | **Akun & profil** |
