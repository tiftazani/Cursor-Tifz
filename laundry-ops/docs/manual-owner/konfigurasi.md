# Konfigurasi dan Pemulihan

Cabang, pengaturan aplikasi, pesan WhatsApp, dan cara memulihkan bila keliru.

> Ringkasan: bagian ini memuat tindakan yang berdampak luas. Setiap langkah disertai akibat, cara memverifikasi, dan cara memulihkannya.

## Cabang

**Dampak bisnis:** Cabang adalah batas data. Transaksi, kas, absensi, dan aset selalu melekat pada satu cabang.

**Siapa yang terdampak:**

| Peran | Dampak | Tindakan lanjutan |
|---|---|---|
| Supervisor cabang | Melihat data cabangnya sendiri | Beri tahu bila cakupannya berubah |
| Kasir | Nota tercatat pada cabang tempat ia bertugas | Pastikan cabangnya benar saat menambah user |
| Owner | Melihat seluruh cabang | Tidak ada |

### Menambah cabang

1. Buka **Modul** → **Cabang**.
2. Tekan tombol cabang baru.
3. Isi nama, alamat, dan data kontaknya.
4. Periksa kembali, lalu simpan.
5. Tambahkan pengguna cabang itu lewat **Daftar User**.

![Layar Cabang dengan daftar cabang dan jumlah timnya](aset/gambar/13-cabang.png)

> **PERHATIAN**
> Menghapus cabang adalah tindakan yang tidak dapat dibatalkan dari dalam aplikasi. Transaksi, kas, dan aset yang melekat pada cabang itu ikut terdampak. Pindahkan atau selesaikan data cabang tersebut lebih dulu.

## Pendaftaran akun

### Pendaftaran mandiri

**Dampak bisnis:** Pendaftaran mandiri memudahkan perangkat baru masuk, tetapi tetap menunggu persetujuan Anda sebelum dapat dipakai.

1. Pasang aplikasi di perangkat.
2. Pada layar masuk, pilih pendaftaran akun.
3. Isi nama, email, dan kata sandi.
4. Pilih peran yang sesuai dan cabangnya.
5. Kirim pendaftaran.
6. Setelah Owner menyetujui, akun dapat dipakai.

![Layar Masuk dengan pilihan akun dan pendaftaran](aset/gambar/00-masuk-akun.png)

> **INFORMASI**
> Selama belum disetujui, akun tidak dapat mengakses data apa pun. Persetujuan dilakukan lewat **Daftar User**.

## Kata sandi

**Dampak bisnis:** Kata sandi per akun membuat jejak audit menunjuk orang yang benar. Akun bersama menghapus manfaat itu.

1. Buka **Modul** → **Akun & profil**.
2. Pilih tindakan mengganti kata sandi.
3. Isi kata sandi lama dan kata sandi baru.
4. Simpan.

![Layar Akun & profil dengan identitas akun dan cabang penugasan](aset/gambar/19-akun-profil.png)

> **PERHATIAN**
> Jangan bagikan kata sandi antar karyawan. Bila satu akun dipakai bergantian, **Riwayat aktivitas** tidak lagi dapat dipercaya untuk menunjukkan siapa melakukan apa.

## Template WhatsApp

**Dampak bisnis:** Pesan WhatsApp adalah kontak langsung dengan pelanggan. Perubahan template berlaku pada pesan yang dikirim setelah perubahan.

**Siapa yang terdampak:**

| Peran | Dampak | Tindakan lanjutan |
|---|---|---|
| Kasir | Mengirim pesan dengan susunan baru | Beri tahu sebelum perubahan |
| Pelanggan | Menerima pesan dengan susunan baru | Tidak ada |
| Supervisor | Tidak dapat mengubah | Menyampaikan usulan ke Owner |

### Mengubah template

1. Buka **Modul** → **Pengaturan Owner**.
2. Buka bagian **Template WhatsApp**.
3. Sunting isi pesan pada kolom yang tersedia.
4. Periksa kembali, terutama bagian yang berisi nama pelanggan dan nomor nota.
5. Simpan.

![Layar Pengaturan Owner dengan template pesan WhatsApp](aset/gambar/18-pengaturan-owner.png)

| Bagian | Isi |
|---|---|
| Template nota siap | Pesan yang dikirim saat cucian selesai |
| Template pengingat | Pesan yang dikirim untuk cucian yang belum diambil |
| Tombol simpan | Menyimpan perubahan ke seluruh perangkat |

> **PERHATIAN**
> Hindari menghapus penanda nama pelanggan atau nomor nota dari template. Pesan tetap terkirim, tetapi isinya tidak lagi memuat rincian yang dibutuhkan pelanggan.

### Nota yang menunggu dan arsipnya

| Layar | Isi |
|---|---|
| **WA menunggu** | Nota yang belum dikirim ke pelanggan |
| **Arsip WA** | Riwayat nota yang sudah pernah dikirim |

![Layar Arsip WA berisi riwayat nota yang sudah dikirim](aset/gambar/09-arsip-wa.png)

![Layar WA menunggu berisi nota yang belum terkirim](aset/gambar/08-wa-menunggu.png)

## Tampilan aplikasi

Layar **Theme Aplikasi** mengatur tampilan terang, gelap, dan warna. Pilihan ini berlaku per perangkat.

![Layar Theme Aplikasi dengan pilihan tampilan dan warna](aset/gambar/20-theme-aplikasi.png)

## Pembaruan aplikasi

Layar **Riwayat versi** mencatat pembaruan yang pernah dipasang di perangkat, sedangkan **Aplikasi** memuat versi yang sedang berjalan.

![Layar Riwayat versi berisi catatan pembaruan aplikasi](aset/gambar/21-riwayat-versi.png)

> **INFORMASI**
> Versi aplikasi hanya naik, tidak pernah turun. Bila nomor versi terlihat lebih rendah dari yang Anda harapkan, ulangi pemasangan berkas pembaruan yang benar.

## Cara memverifikasi

| Yang diperiksa | Caranya |
|---|---|
| Cabang baru tercatat benar | Buka **Cabang**, periksa jumlah timnya |
| Perubahan template berlaku | Kirim satu nota uji, periksa isi pesannya di **Arsip WA** |
| Versi aplikasi yang berjalan | Buka **Modul** → **Aplikasi** |
| Akun sudah aktif | Masuk dengan akun itu, periksa judul di layar **Modul** |

## Cara memulihkan

| Tindakan | Dapat dipulihkan? | Caranya |
|---|---|---|
| Perubahan template WhatsApp | Ya | Kembalikan isi pesannya, lalu simpan |
| Mengubah tampilan | Ya | Pilih kembali tema sebelumnya |
| Memindahkan pengguna antar cabang | Ya | Ubah kembali penugasan cabangnya di **Daftar User** |
| Menghapus cabang | Tidak dari aplikasi | Anggap permanen |
| Menghapus pengguna | Tidak dari aplikasi | Buat ulang akunnya bila memang masih dibutuhkan |

## Hal yang perlu disadari

| Hal | Artinya |
|---|---|
| Foto bukti hanya di perangkat | Tidak ikut tersinkron; foto di perangkat lain tidak akan muncul |
| Perangkat tetap bekerja tanpa internet | Pekerjaan tersimpan dan terkirim saat koneksi kembali |
| Data berjalan di latar belakang | Angka yang sama dapat terlihat berbeda sesaat antar perangkat |
| Akun tidak dapat dihapus dari aplikasi | Penghentian akses dilakukan dengan menghapus atau mengganti role |

## Bila hasilnya berbeda

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| Menu **Pengaturan Owner** tidak terbuka | Fungsi template WhatsApp tidak dicentang pada role Anda | Periksa **Kontrol Akses Role** |
| Perubahan belum terlihat di perangkat lain | Sinkronisasi belum selesai | Tunggu, pastikan koneksi tersedia |
| Foto tidak muncul setelah ganti perangkat | Foto memang tidak ditinggalkan di server | Ambil ulang foto di perangkat baru |
| Versi aplikasi tidak berubah setelah pembaruan dipasang | Pemasangan gagal atau berkas salah | Pasang ulang berkas pembaruan yang benar |
