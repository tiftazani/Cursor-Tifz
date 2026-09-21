# Laporan dan Pembacaan Data

Angka mana yang perlu dibaca, dan bagaimana memeriksanya bila terasa janggal.

> Ringkasan: laporan transaksi menjawab pertanyaan operasional harian, laporan analitik menjawab pertanyaan pertumbuhan. Keduanya membaca sumber data yang sama.

## Dampak bisnis

Angka yang dibaca tanpa tahu sumbernya mudah disalahartikan. Bagian ini menyebutkan apa yang dihitung, dari data apa, dan pada periode mana, sehingga keputusan Anda berpijak pada hal yang benar.

## Siapa yang terdampak

| Peran | Dampak | Tindakan lanjutan |
|---|---|---|
| Owner | Membaca seluruh laporan lintas cabang | Bandingkan antar cabang secara berkala |
| Supervisor | Membaca laporan transaksi cabangnya | Periksa selisih kas sebelum tutup kas |
| Kasir | Menutup kas harian | Pastikan seluruh transaksi periode itu sudah tercatat |

## Laporan transaksi

**Hasil akhir:** Anda mengetahui penghasilan, jumlah pesanan, dan isi kas pada periode yang dipilih.

## Langkah

1. Buka **Modul** → **Laporan transaksi**.
2. Pilih **Periode**.
3. Pilih **Cabang**, atau gunakan **Semua cabang**.
4. Periksa ringkasan di bagian atas.
5. Buka rincian bila ada angka yang perlu ditelusuri.

![Layar Laporan transaksi dengan penyaring periode dan cabang](aset/gambar/10-laporan-transaksi.png)

| Bagian | Isi |
|---|---|
| Ringkasan | Penghasilan, jumlah pesanan, dan jumlah pelanggan pada periode itu |
| Rincian transaksi | Daftar nota beserta layanan, berat, nilai, dan metode pembayarannya |
| Komposisi pembayaran | Perbandingan Tunai, QRIS, dan Transfer |

## Laporan analitik

**Untuk:** Owner

**Hasil akhir:** Anda melihat arah usaha, bukan hanya angka hari ini.

## Langkah

1. Buka **Modul** → **Laporan analitik**.
2. Pilih periode yang lebih panjang, mis. satu bulan atau satu kuartal.
3. Periksa tren dan perbandingannya.
4. Periksa kinerja kasir bila diperlukan.

![Layar Laporan analitik dengan tren dan komposisi layanan](aset/gambar/11-laporan-analitik.png)

| Bagian | Isi |
|---|---|
| Tren | Naik turun penghasilan sepanjang periode |
| Komposisi | Bagian tiap layanan terhadap total pesanan |
| Perbandingan | Selisih antar cabang |
| Kinerja kasir | Kontribusi tiap kasir terhadap pesanan |

## Riwayat aktivitas

**Untuk:** Owner

**Hasil akhir:** Anda dapat mengetahui siapa mengubah data apa, dan kapan.

## Langkah

1. Buka **Modul** → **Riwayat aktivitas**.
2. Saring pada periode yang dicari.
3. Cari berdasarkan nama pelaku atau jenis perubahan.

![Layar Riwayat aktivitas berisi catatan perubahan data](aset/gambar/12-riwayat-aktivitas.png)

> **INFORMASI**
> Riwayat aktivitas mencatat perubahan data yang dikirim ke server. Ini alat utama untuk menelusuri selisih antara catatan dan kenyataan.

## Menutup kas

**Hasil akhir:** Kas giliran ditutup dengan rekap yang dapat dipertanggungjawabkan.

## Langkah

1. Buka **Modul** → **Tutup kas**.
2. Periksa daftar transaksi giliran ini.
3. Isi jumlah uang fisik yang ada di kas.
4. Periksa selisih yang ditampilkan aplikasi.
5. Simpan.

![Layar Tutup kas dengan daftar transaksi dan pemeriksaan kas](aset/gambar/06-tutup-kas.png)

| Kondisi | Artinya |
|---|---|
| Sesuai | Uang fisik sama dengan catatan |
| Selisih | Ada perbedaan; tuliskan penjelasannya |

> **PERHATIAN**
> Bila muncul selisih, periksa transaksi periode itu satu per satu **sebelum** menutup kas. Setelah ditutup, angka periode tersebut terkunci.

## Cara memverifikasi

| Yang diperiksa | Caranya |
|---|---|
| Angka konsisten antar laporan | Bandingkan total penghasilan di **Laporan transaksi** dan **Laporan analitik** untuk periode yang sama |
| Perubahan tercatat | Buka **Riwayat aktivitas** pada rentang waktu kejadian |
| Selisih kas punya penjelasan | Periksa rincian transaksi pada periode itu |

## Cara memulihkan

| Tindakan | Dapat dipulihkan? | Caranya |
|---|---|---|
| Periode salah pada laporan | Ya | Ganti penyaring **Periode** |
| Selisih kas salah isi | Ya, sebelum periode berjalan lanjut | Perbaiki lewat koreksi yang sesuai, dan catat penjelasannya |
| Kas sudah ditutup keliru | Memerlukan bantuan teknis | Hubungi Owner sebelum tindakan lanjutan |

## Bila angka terasa tidak sesuai

Untuk pertanyaan status yang singkat, periksa daftar berikut secara berurutan.

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| Penghasilan lebih kecil dari dugaan | Periode atau cabang pada penyaring tidak sesuai | Set ke periode dan cabang yang benar |
| Angka berbeda antara dua perangkat | Sinkronisasi belum selesai di salah satu perangkat | Pastikan keduanya tersambung, tunggu sinkronisasi |
| Nama kasir yang muncul berbeda | Perangkat memakai akun bersama | Wajibkan tiap karyawan memakai akun sendiri |
| Data hari ini belum terlihat di perangkat lain | Perubahan belum terkirim ke server | Pastikan ada koneksi, buka aplikasi, tunggu sinkronisasi |
