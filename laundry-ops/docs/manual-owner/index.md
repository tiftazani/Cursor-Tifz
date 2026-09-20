# Manual Owner

Referensi lengkap Cuciin untuk pemilik usaha laundry.

| Metadata | Nilai |
|---|---|
| Jenis dokumen | Manual Owner |
| Untuk | Owner |
| Versi aplikasi | `1.10.30` |
| Diperbarui | 20 September 2026 |
| Status | Berlaku |

## Tujuan dokumen

Dokumen ini adalah rujukan terlengkap. Isinya bukan sekadar rangkaian langkah, melainkan gambaran menyeluruh: apa yang mengubah apa, siapa yang terdampak, bagaimana memverifikasi, dan bagaimana memulihkan bila terjadi kekeliruan.

Ini panduan untuk Anda bila judul akun di layar **Modul** berbunyi `Cuciin · Owner`. Owner adalah satu-satunya peran yang memiliki seluruh modul dan seluruh fungsi.

## Daftar isi

| Bagian | Isi |
|---|---|
| [Peta aplikasi](peta-aplikasi.md) | Seluruh menu, bagiannya, dan kegunaannya |
| [Akses dan peran](akses-dan-peran.md) | Peran, matriks hak akses, dan cara mengubahnya |
| [Siklus transaksi](operasional.md) | Perjalanan satu cucian dari masuk sampai diserahkan |
| [Layanan, harga, dan stok](layanan-dan-harga.md) | Tarif, produk, bahan, dan aset |
| [Laporan dan pembacaan data](laporan.md) | Angka yang perlu dibaca dan artinya |
| [Konfigurasi dan pemulihan](konfigurasi.md) | Pengaturan aplikasi, audit, koreksi, dan pemulihan |

## Peran Owner dalam sistem

| Cakupan | Keterangan |
|---|---|
| Modul | 15 dari 15 |
| Fungsi | 41 dari 41 |
| Fungsi terkunci | 15 fungsi yang hanya Owner dapat memberikannya |
| Cabang | Melihat seluruh cabang sekaligus |

Owner juga satu-satunya peran yang dapat **mengubah siapa boleh melakukan apa**. Keputusan itu berdampak langsung ke seluruh pengguna yang memakai role tersebut, sehingga dokumen ini memuat dampak setiap perubahan sebelum langkahnya.

## Empat hal yang paling sering berdampak

| Keputusan | Dampak utama | Rincian |
|---|---|---|
| Mengubah centang role | Berlaku untuk **semua** pengguna dengan role itu | [Akses dan peran](akses-dan-peran.md) |
| Mengubah harga layanan | Berlaku untuk transaksi **baru**, tidak mengubah yang sudah tercatat | [Layanan dan harga](layanan-dan-harga.md) |
| Menghapus data | Ada yang dapat dipulihkan, ada yang tidak | [Konfigurasi dan pemulihan](konfigurasi.md) |
| Mengubah template WhatsApp | Berlaku untuk pesan yang dikirim sesudahnya | [Konfigurasi dan pemulihan](konfigurasi.md) |

> **PERHATIAN**
> Banyak tindakan Owner tidak dapat dibatalkan dari dalam aplikasi. Pahami bagian **Cara memulihkan** sebelum menyimpan perubahan yang besar.
