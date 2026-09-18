# Cuciin 1.10.15 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.15-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.15-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.15-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.15

### Nama aplikasi debug dibedakan

Versi debug dipasang berdampingan dengan versi rilis di HP yang sama, tetapi keduanya tampil
sebagai "Cuciin" di launcher sehingga mudah tertukar.

| Varian | Paket | Nama di layar HP |
|---|---|---|
| Release | `com.cuciin.laundryops` | Cuciin |
| Debug | `com.cuciin.laundryops.debug` | **Cuciin Debug** |

Nama debug diambil dari `app/src/debug/res/values/strings.xml`, berkas yang hanya berlaku untuk
varian debug. Nama pada versi rilis tidak tersentuh.

## Perbaikan yang sudah ada di versi ini

Versi 1.10.15 memuat seluruh perbaikan sampai 1.10.14, termasuk:

- **Tab Antrian tidak macet lagi** setelah membuka Service baru dari layar Antrian (1.10.14).
- **Layar login tidak terpotong** saat keyboard Android terbuka (1.10.13).
- **Bar navigasi tampil di layar Service** seperti di tab lain (1.10.12).
- **Animasi** perpindahan layar, tekan tombol, dan baris daftar yang tetap mulus di HP kelas bawah (1.10.12).
- **Menu Atur urutan menu** dan susunan menu Modul yang dirapikan (1.10.11).

Catatan penting: bug tab macet **hanya** ada di rilis 1.10.13 dan sebelumnya. Bila ada perangkat
yang sudah memakai APK rilis 1.10.13 atau lebih lama, perangkat itu perlu dipasangi 1.10.14 atau
1.10.15.

## Verifikasi

- VersionName `1.10.15`, versionCode `34`.
- Unit test debug dan release lulus: 115 test per varian, 0 gagal.
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Label aplikasi dibaca balik dari APK: debug `Cuciin Debug`, rilis `Cuciin`.
- Perbaikan navigasi dibuktikan ada di dalam APK rilis: kelas `NavTransition` ditemukan di `classes.dex` APK rilis 1.10.15, dan tidak ada di APK rilis 1.10.13.

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.
- Nama Owner di data server masih "Tiftazani". Penggantian ditunda atas keputusan Owner.

Tidak ada kredensial, token, atau material signing di folder ini.
