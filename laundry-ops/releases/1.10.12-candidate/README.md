# Cuciin 1.10.12 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.12-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.12-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.12-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.12

### Perbaikan: bar navigasi hilang di layar Service

Bar navigasi bawah muncul di layar Antrian, WA, Stok, dan Modul, tetapi hilang begitu masuk ke layar Service.

Penyebabnya: daftar rute yang menampilkan bar ditulis ulang sebagai himpunan terpisah di `CuciinNav.kt`, dan rute `nota` (layar Service) tertinggal di salinan itu. Daftar tab dan daftar rute berbar adalah dua sumber berbeda, jadi keduanya bisa berbeda tanpa ketahuan.

Perbaikan: rute berbar kini selalu diturunkan dari katalog tab di `ui/NavTabs.kt`, tidak pernah ditulis ulang. Tab, label, dan aturan izinnya juga pindah ke katalog yang sama supaya dapat diuji tanpa Android.

### Animasi

Aplikasi sebelumnya hanya memudar 180ms saat pindah layar, sisanya tanpa gerak sama sekali. Sekarang:

| Bagian | Gerak |
|---|---|
| Perpindahan layar | Layar baru menyusul dari samping sambil memudar, layar lama mundur sedikit. Arah mengikuti maju atau mundur. |
| Tombol utama, tombol garis, kartu status | Mengecil sedikit saat ditekan, lalu kembali dengan pegas. |
| Angka pada kartu status | Menghitung naik saat jumlahnya berubah, jadi perubahan terlihat. |
| Baris daftar antrian | Muncul mengalir satu per satu, dibatasi enam baris pertama. |
| Bar navigasi bawah | Muncul dan hilang dengan lembut saat berpindah ke layar tanpa bar. |

Animasi dipilih agar tetap mulus di HP kelas bawah:

- Hanya alpha, geser, dan skala yang berubah. Ketiganya digambar lewat `graphicsLayer`, jadi tidak ada pengukuran ulang tata letak dan tidak ada bayangan yang dihitung ulang.
- Durasi pendek: 180 sampai 240 ms. Tidak ada animasi dekoratif atau gerak berulang.
- Baris daftar dibatasi enam baris pertama supaya daftar panjang tidak memicu puluhan animasi sekaligus.

Semua durasi hidup di `ui/Motion.kt` dan mengikuti skala animasi Android. Bila pengguna memilih "Hapus animasi" di pengaturan sistem, seluruh gerak ikut mati dan layar berpindah seketika.

## Verifikasi

- VersionName `1.10.12`, versionCode `31`.
- Unit test debug dan release lulus: 104 test per varian, 0 gagal (naik dari 98 karena test kontrak bar navigasi).
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator: bar navigasi terbaca di kelima tab (Antrian, Service, WA, Stok, Modul).
- Uji animasi: rekaman layar dengan skala animasi sistem diperbesar 8x memperlihatkan dua layar tumpang tindih saat transisi, yang berarti geser dan pudar benar-benar berjalan. Dengan skala normal, waktu render 50th percentile 16 ms dan 99th percentile 18 ms, artinya tetap 60fps.

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.
- Nama Owner di data server masih "Tiftazani". Penggantian ditunda atas keputusan Owner.

Tidak ada kredensial, token, atau material signing di folder ini.
