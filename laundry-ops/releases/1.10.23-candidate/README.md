# Cuciin 1.10.23 (versionCode 42) - kandidat

Kandidat ini lahir dari sapuan regresi menyeluruh setelah 1.10.22 masuk `main`. Tiga bug nyata
ditemukan dan diperbaiki, semuanya jenis yang tidak akan terlihat dari build yang lulus test.

## Cara memasang

Pasang `cuciin-1.10.23-release.apk` untuk pemakaian cabang. Versi debug
(`cuciin-1.10.23-debug-test.apk`) hanya untuk pengujian dan bisa dipasang berdampingan karena
paketnya berbeda (`com.cuciin.laundryops.debug`, nama tampil "Cuciin Debug").

Memperbarui APK tidak menghapus data lokal: paketnya tidak berubah.

## Yang diperbaiki

### 1. Izin dua menu Laporan salah, dan dua modul izin tidak pernah diperiksa

`AccessCatalog` memuat 12 modul izin. Hanya 10 yang pernah diperiksa. Modul `analytics` dan
`audit` terdaftar di katalog, bisa dicentang di layar Kontrol Akses Role, tetapi tidak pernah
diperiksa saat menu dibuka. Dua akibatnya:

- Mencentang atau mengosongkan modul Laporan di Kontrol Akses Role tidak mengubah apa pun.
- Role bawaan Supervisor sudah memuat modul `analytics` beserta fungsi `analytics.view`, tetapi
  menu "Laporan transaksi", "Laporan analitik", dan "Riwayat aktivitas" tetap terkunci untuknya
  karena menu memeriksa modul `owner`. Izin yang diberikan katalog tidak pernah berlaku.

Perbaikan: pemetaan rute ke modul izin dipindah ke `ui/RouteAccess.kt`, dan `RouteAccessTest`
mengunci agar setiap modul katalog benar-benar diperiksa di suatu tempat.

### 2. Riwayat aktivitas memakai cabang yang sudah tidak ada

Dua tempat di `CuciinStore` memakai cabang tetap `"melati"` yang sudah tidak ada di katalog
cabang. Entri audit dengan cabang itu tidak pernah lolos filter per-cabang di `pullChanges`
Worker, sehingga catatannya tidak sampai ke perangkat mana pun dan Riwayat aktivitas tampak
kosong untuk kejadian itu (persetujuan user, tutup kas tanpa cabang).

### 3. Aplikasi menutup sendiri saat katalog cabang belum tersedia

`CuciinStore.branch()` memakai `first()` dan `first { }` yang melempar `NoSuchElementException`.
Katalog cabang bisa kosong sesaat (basis data baru, impor belum jalan) atau memuat id yang belum
tersinkron. Ada 21 pemanggil di layar, jadi satu keadaan itu cukup untuk menutup aplikasi.
Sekarang selalu mengembalikan nilai, dengan cabang pengganti bernama "Cabang belum tersedia".

Tiga tempat lain dengan pola sama ikut diperbaiki: dua di formulir user (`MasterScreens`) dan
`nextNotaId` (pembuatan nota baru).

### Pengerasan (bukan bug)

Pemetaan label periode di laporan analitik memakai `first { }` yang melempar. Setelah ditelusuri,
nilainya adalah state lokal layar yang hanya bisa diisi dari daftar yang sama, jadi tidak ada
jalur nyata yang memicunya. Tetap diubah ke `firstOrNull` dengan cadangan supaya menambah pilihan
periode baru tidak bisa mematikan layar.

## Bukti

### Test

```text
testDebugUnitTest   : 173 test, 0 gagal, 0 error
testReleaseUnitTest : 173 test, 0 gagal, 0 error
```

Naik dari 153. Lima berkas test baru atau tambahan: `RouteAccessTest`, `AuditBranchTest`,
`BranchLookupTest`, `ReportPeriodTest`, dan `MenuRouteTest`.

Setiap test pengunci dibuktikan **gagal saat bug-nya dikembalikan**, lalu lulus setelah
diperbaiki:

| Test | Saat bug dikembalikan |
|---|---|
| `RouteAccessTest` | 3 test gagal (`analytics` kembali ke `owner`) |
| `AuditBranchTest` | 1 test gagal (`melati` kembali) |
| `AuditBranchTest` | 1 test gagal (`branch()` kembali memakai `first()`) |
| `ReportPeriodTest` | 2 test gagal (`first { }` kembali) |

`BranchLookupTest` membuktikan versi lama memang melempar `NoSuchElementException` untuk katalog
kosong dan id asing, supaya perbaikannya punya alasan yang terukur.

### Verifikasi di emulator

Dijalankan pada APK yang versinya sudah dipastikan terpasang (`dumpsys package` menunjukkan
`versionName=1.10.23-debug`, bukan versi lama):

```text
Laporan transaksi    TERBUKA
Laporan analitik     TERBUKA
Riwayat aktivitas    TERBUKA
CRASH                0
```

Riwayat aktivitas dibuka dengan menggulir layar Modul lebih dulu, karena menunya ada di bagian
bawah dan tidak terlihat tanpa gulir.

### Verifikasi artefak

Kelas perbaikan `RouteAccess` ditemukan di dalam APK kandidat ini, dan **tidak ada** di
1.10.22. Pemeriksaan dilakukan pada `classes*.dex` di dalam berkas APK, bukan pada kode sumber.

Tanda tangan rilis: v2, non-debuggable, target SDK sesuai, izin minimum, ZIP/ELF 16 KB.

## Checksum

```text
c5687c45df8375256123be14703677b5850e2cf8c18b083b1c4bbbf8f7dd569a  cuciin-1.10.23-debug-test.apk
ded887f22f0619fce07382892ed6fdee250d6954e502b032cde3f46c6d48ff92  cuciin-1.10.23-release.apk
c242b9e5a4eecfba4456e8ec799149385eed2375101c63f74880dc3cd23ba62a  cuciin-1.10.23-release.aab
```

## Catatan jujur

Satu klaim awal saya salah dan sudah dikoreksi: bug periode laporan analitik tidak pernah bisa
terjadi dari UI, jadi statusnya pengerasan, bukan perbaikan bug. Catatan di `CHANGELOG.md` dan
layar Riwayat versi sudah menyebutnya demikian.

Bug izin `analytics`/`audit` dibuat pada commit `3e8e631` saat pemetaan izin ditulis langsung di
dalam layar. Tidak ada test yang memeriksa apakah setiap modul katalog benar-benar diperiksa,
sehingga ketidakcocokan itu lolos 153 test yang semuanya hijau.
