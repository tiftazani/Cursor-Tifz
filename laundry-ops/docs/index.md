# Cuciin

Cuciin adalah aplikasi operasional laundry: aplikasi Android untuk kasir dan supervisor cabang, serta satu layanan server untuk sinkronisasi lintas cabang. Dokumentasi ini dibagi menjadi tiga keluarga, masing-masing untuk pembaca yang berbeda.

| Keluarga dokumen | Untuk siapa | Isi utama |
|---|---|---|
| Dokumentasi teknis | Pengembang dan pemelihara aplikasi | Arsitektur, data, sinkronisasi, pengujian, rilis |
| Manual peran | Kasir, Supervisor, Owner harian | Tugas harian, langkah kerja, pemecahan masalah |
| Manual Owner | Pemilik usaha | Peta aplikasi, akses, dampak keputusan, audit |

## Mulai dari mana

**Menyiapkan atau memperbaiki aplikasi** mulai dari [Dokumentasi Teknis](teknis-android/index.md). Bagian pertama menjelaskan cara membangun dan menjalankannya, sebelum masuk ke arsitektur.

**Belajar memakai aplikasi untuk kerja harian** mulai dari [Manual Peran](manual-peran/index.md). Pilih peran yang sesuai dengan akun Anda.

**Mengelola usaha dan mengatur aplikasi** mulai dari [Manual Owner](manual-owner/index.md). Dokumen ini yang paling lengkap dan memuat dampak keputusan lintas peran.

## Versi yang didokumentasikan

| Metadata | Nilai |
|---|---|
| Produk | Cuciin |
| Versi aplikasi | `1.10.30` (versionCode `49`) |
| Platform | Android, `minSdk` 26, `targetSdk` 36 |
| Server | Cloudflare Worker dan D1 |
| Tanggal pembaruan | 20 September 2026 |
| Status | Berlaku |

## Peran yang tersedia

Aplikasi mengenal empat peran bawaan. Nama di bawah ini adalah nama yang benar-benar dipakai aplikasi, bukan penyederhanaan.

| Peran | Cakupan kerja | Rincian |
|---|---|---|
| Owner | Seluruh modul dan seluruh fungsi | [Manual Owner](manual-owner/index.md) |
| Supervisor | Kerja harian cabang, tanpa transaksi dan keuangan | [Manual Supervisor](manual-peran/supervisor/index.md) |
| Kasir | Melayani pelanggan, mencatat transaksi, menutup kas | [Manual Kasir](manual-peran/kasir/index.md) |
| Gudang | Contoh role tambahan yang dibuat lewat Kontrol Akses Role | [Manual Peran](manual-peran/index.md) |

> **INFORMASI**
> Supervisor dan Kasir di atas adalah role bawaan. Owner dapat membuat role lain dengan kombinasi centang sendiri lewat menu **Kontrol Akses Role**, sehingga nama peran di pemasangan Anda bisa berbeda dari daftar ini.

## Mengenai tangkapan layar

Seluruh gambar di dokumentasi ini diambil dari aplikasi `1.10.30-debug` yang berjalan di perangkat uji pada 20 September 2026. Isi layar berasal dari data uji yang sah, bukan data buatan untuk keperluan dokumentasi.
