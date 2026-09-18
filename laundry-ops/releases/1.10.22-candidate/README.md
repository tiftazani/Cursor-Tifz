# Cuciin 1.10.22 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.22-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.22-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.22-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.22

### Perbaikan utama: aplikasi keluar saat menu Antrian atau Service diklik

Dilaporkan Owner lewat tangkapan layar: mengklik "Antrian laundry" atau "Service baru" di layar
Modul membuat aplikasi langsung keluar, untuk peran apa pun.

Penyebabnya didapat dari logcat, bukan dugaan:

```
java.lang.IllegalArgumentException: Navigation destination that matches route queue
cannot be found in the navigation graph
    at MoreScreens.kt:120
```

Katalog menu memakai nama menunya sendiri sebagai rute (`queue` dan `service`), sedangkan graf
navigasi memakai `home` untuk Antrian dan `nota` untuk Service baru, karena kedua rute itu
dipakai bersama tab bawah. `nav.navigate("queue")` melempar pengecualian, dan pengecualian itu
tidak tertangkap sehingga aplikasi ditutup.

Perbaikan: katalog menu memetakan rutenya lewat `MenuOrder.destinationOf`. Menu yang rutenya
sudah sama tidak diubah.

### Perbaikan menyertai: menu yang tidak boleh dipakai peran tertentu disembunyikan

Layar Antrian dan tab bawah sudah menyembunyikan "Service baru" untuk SPV, tetapi menu Modul
tetap menampilkannya. Server pun menolak pembuatan Service oleh SPV, jadi pesanannya akan gagal
tersinkron tanpa penjelasan. Sekarang aturan tampil menu dibaca dari `NavTabs`, sumber yang sama
dengan bar navigasi.

### Pengunci supaya tidak terulang

`MenuRouteTest` membandingkan setiap rute menu dengan daftar `composable(...)` di `CuciinNav.kt`.
Menu baru yang rutenya belum terdaftar akan gagal di test, bukan di tangan pengguna. Diperiksa
juga seluruh pemanggilan `nav.navigate("...")` di kode: tidak ada rute lain yang menunjuk ke
tujuan yang tidak ada.

## Verifikasi

- VersionName `1.10.22`, versionCode `41`.
- Unit test debug dan release lulus: 153 test per varian, 0 gagal.
- Lint debug dan release lulus.
- APK release bertanda tangan dan lolos `verify_release.py`.

### Bukti di emulator

Kedua menu yang dilaporkan diuji ulang setelah perbaikan:

| Menu | Sebelum | Sesudah |
|---|---|---|
| Antrian laundry | aplikasi keluar | membuka layar Antrian |
| Service baru | aplikasi keluar | membuka layar Service baru |

Seluruh menu di layar Modul disapu satu per satu dengan akun Kasir, 22 dari 22 menu:

```text
diklik tanpa crash : 12
tidak tampil       : 10
CRASH              : 0
```

Catatan cara uji: `uiautomator` menulis karakter `&` sebagai `&amp;`, sehingga pencocokan nama
menu seperti "Akun & profil" gagal bila XML-nya tidak di-decode lebih dulu. Sapuan pertama
karena itu melaporkan angka yang salah (11 dan 11) dan melewatkan satu menu. Sapuan ulang
dengan XML yang di-decode memberi angka di atas.

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.
- Migrasi database tidak diperlukan untuk versi ini.

Tidak ada kredensial, token, atau material signing di folder ini.
