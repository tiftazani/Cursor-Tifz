# Cuciin 1.10.9 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.9-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.9-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.9-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

Debug dan release memakai source fitur yang sama. Perbedaannya hanya endpoint data dan application ID debug.

## Isi versi 1.10.9

### Filter periode dua tanggal

Filter periode di layar utama menambah pilihan "Pilih dua tanggal" dengan pemilih tanggal dan jam untuk mulai dan sampai. Rentang yang tidak valid ditolak dengan pesan, dan tombol Terapkan rentang tetap terjangkau karena sheetnya dapat digulir.

### Laporan mengikuti desain terbaru

Ketiga dokumen dicetak ulang mengikuti file desain dan sample PDF terlampir.

**Laporan transaksi**

- Header navy memuat logo, judul, periode, waktu dibuat, nomor halaman, dan bilah kemajuan.
- Baris filter aktif memakai bahasa pengguna, misalnya `Bagian: Ringkasan, Per cabang, Rincian transaksi`.
- Empat kartu metrik dengan kartu hasil kas berlatar navy.
- Rekonsiliasi berdampingan dengan tabel per cabang bila keduanya muat; tabel per kasir dan komisi petugas mengalir penuh di bawahnya.
- Hanya bagian yang dipilih yang dicetak. Memilih rincian saja tidak memunculkan kartu metrik atau tabel kosong.
- Tabel rincian memuat sepuluh kolom dengan status pembayaran dan pengerjaan terpisah.

**Laporan analitik**

- Kartu metrik, blok omzet per bulan, dua donut, lalu tabel pendukung.
- Satu periode tidak disebut tren; nilainya ditampilkan langsung dengan pesan belum cukup data.
- Donut memuat total di tengah dan legenda berisi swatch, nama, nominal, serta persen satu angka desimal.
- Pemisah antarslice berupa garis tipis, bukan lingkaran yang terlihat seperti lubang.

**Nota pelanggan**

- Header navy dengan logo, nama cabang, nomor nota, dan alamat bila tersedia.
- Kapsul status pengerjaan dan status pembayaran terpisah.
- Tabel layanan dengan kolom No, Layanan, dan Subtotal rata kanan.
- Ringkasan pembayaran dengan total berlatar navy, lalu status pengerjaan.

### Perbaikan tabel

Seluruh tabel memakai baris yang membungkus: tinggi baris dihitung dari jumlah baris teks terpanjang, jadi tidak ada sel yang dipotong dengan elipsis. Kepala tabel diulang pada halaman baru dan satu transaksi tidak pernah terpotong antarhalaman.

## Verifikasi

- VersionName `1.10.9`, versionCode `28`.
- Unit test debug dan release lulus: 68 test per varian, 0 gagal.
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- PDF hasil ekspor diperiksa ulang dari perangkat: nota pelanggan satu halaman tanpa teks terpotong, laporan transaksi patuh filter (memilih rincian saja tidak memunculkan kartu metrik), dan laporan analitik dua halaman dengan tabel pendukung utuh.

## Catatan server

Tidak ada perubahan server pada versi ini. Migrasi `0006_asset_types.sql` dan `0007_access_roles.sql` sudah diterapkan sebelumnya ke D1 produksi.

Tidak ada kredensial, token, atau material signing di folder ini.
