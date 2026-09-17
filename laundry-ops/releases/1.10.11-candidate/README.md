# Cuciin 1.10.11 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.11-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.11-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.11-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.11

### Urutan menu Modul dirapikan

Susunan menu dipindah ke `ui/MenuOrder.kt` supaya urutannya dapat diperiksa unit test. Bagian yang tampil berurutan:

| Urutan | Bagian | Isi |
|---|---|---|
| 1 | Pekerjaan harian | Antrian laundry, Service baru, Absensi karyawan, Daftar Aset Cabang |
| 2 | Keuangan | Biaya operasional, Tutup kas |
| 3 | Pelanggan | Pelanggan, WA menunggu, Arsip WA |
| 4 | Laporan | Laporan transaksi, Laporan analitik, Riwayat aktivitas |
| 5 | Master data | Cabang, Daftar User, Layanan & harga, Produk stok, Kontrol Akses Role, Pengaturan Owner |
| 6 | Aplikasi | Akun & profil, Theme Aplikasi, Riwayat versi |

Dua perbaikan penempatan:

- **Theme Aplikasi** keluar dari bagian laporan karena ia mengatur tampilan HP, bukan laporan operasional.
- **Riwayat versi** kini berada di urutan paling bawah, tepat di atas tombol ekspor dan keluar.

### Menu baru: Atur urutan menu

Pintasan berada di paling atas layar Modul. Tiga cara mengubah susunan:

1. **Panah naik dan turun** pada tiap baris menu, untuk menggeser satu langkah di dalam bagiannya.
2. **Tombol pindah** pada tiap baris menu, membuka lembar berisi bagian tujuan. Ini yang memindahkan menu antar bagian, misalnya Theme Aplikasi keluar dari bagian Aplikasi.
3. **Panah pada judul bagian**, untuk memindahkan seluruh bagian sekaligus.

Tombol **Kembalikan urutan awal** mengembalikan susunan ke bawaan tanpa menyentuh data lain.

Susunan disimpan di HP itu saja, seperti pengaturan tema: tidak ikut sinkronisasi dan tidak mengubah pengaturan HP lain. Izin akses tetap berlaku, jadi menu yang tidak boleh dilihat suatu role tetap tidak muncul dan tidak bisa disusun.

Susunan tersimpan selalu dirapikan terhadap katalog. Bila pembaruan berikutnya menambah menu baru, menu itu otomatis muncul di bagian bawaannya tanpa menghapus susunan yang sudah dibuat pengguna.

## Verifikasi

- VersionName `1.10.11`, versionCode `30`.
- Unit test debug dan release lulus: 98 test per varian, 0 gagal (naik dari 85 karena test pengurutan menu).
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator: pintasan Atur urutan menu membuka layarnya; tombol turun memindahkan Antrian laundry satu langkah; tombol pindah memindahkan Theme Aplikasi ke bagian Keuangan; tombol Kembalikan urutan awal mengembalikan susunan; susunan tetap berlaku setelah aplikasi ditutup dan dibuka ulang.

## Catatan

- Pengaturan urutan menu belum tersedia untuk menyembunyikan menu, hanya mengubah urutan dan bagiannya.
- Nama Owner di data server masih "Tiftazani". Penggantian ditunda atas keputusan Owner.

Tidak ada kredensial, token, atau material signing di folder ini.
