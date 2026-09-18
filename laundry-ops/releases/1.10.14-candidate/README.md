# Cuciin 1.10.14 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.14-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.14-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.14-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.14

### Perbaikan: tab Antrian macet setelah membuka Service baru

Langkah yang memicu: di layar Antrian, tekan tombol **Service baru**, lalu tekan tab **Antrian**.
Tidak terjadi apa pun. Tab lain (WA, Stok, Modul) tetap jalan, dan bila layar Service dibuka
lewat tab, tab Antrian juga jalan. Jadi bugnya bergantung pada cara masuk ke layar itu.

Penyebabnya ada di perpindahan tab:

```kotlin
// sebelum
nav.navigate(r) { launchSingleTop = true; popUpTo("home") { saveState = true }; restoreState = true }
```

`popUpTo(saveState = true)` berpasangan dengan `restoreState = true` adalah pola untuk graf
navigasi **bertingkat**, tempat tiap tab punya subgraf sendiri yang disimpan dan dipulihkan.
Graf navigasi Cuciin **datar**: semua layar berada di satu tingkat. Pada graf datar, kombinasi
itu membuat `navigate` tidak menghasilkan perpindahan apa pun pada keadaan tertentu, dan
keadaan itu terjadi tepat setelah `nota` dibuka lewat tombol.

Perbaikan:

```kotlin
// sesudah
nav.navigate(r) { launchSingleTop = true; popUpTo("home") { inclusive = false } }
```

Satu cara yang sama untuk semua tab, tanpa saveState maupun restoreState. Menekan tab yang
sedang aktif juga tidak lagi menambah entri ke tumpukan layar.

Aturan perpindahannya dipindah ke `ui/NavTransition.kt` supaya dapat diperiksa tanpa Android,
dan dikunci oleh `NavTransitionContractTest.kt`.

## Verifikasi

- VersionName `1.10.14`, versionCode `33`.
- Unit test debug dan release lulus: 115 test per varian, 0 gagal (naik dari 109 karena test perpindahan tab).
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator:
  - Kasus yang dilaporkan: masuk Service lewat tombol, lalu kelima tab ditekan satu per satu, semuanya berpindah benar.
  - Bolak-balik Antrian dan Service lima kali berturut-turut, semuanya berpindah benar.
  - Perpindahan lewat tab (bukan tombol) tetap benar.
  - Setelah tombol kembali dari layar Service, tab tetap berfungsi.
  - Bar navigasi tetap tampil di kelima tab.

## Catatan

- Layar alur seperti detail antrian, pembayaran, dan formulir tidak menampilkan bar navigasi. Itu memang desainnya: tab hanya tampil di lima layar tab.
- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.
- Nama Owner di data server masih "Tiftazani". Penggantian ditunda atas keputusan Owner.

Tidak ada kredensial, token, atau material signing di folder ini.
