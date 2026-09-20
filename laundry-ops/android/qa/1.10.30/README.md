# QA Cuciin 1.10.30

Hasil verifikasi 20 September 2026, versionCode 49.

## Otomatis

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Unit test debug | `./gradlew testDebugUnitTest` | 262 lulus, 0 gagal |
| Unit test rilis | `./gradlew testReleaseUnitTest` | 262 lulus, 0 gagal |
| Lint | `./gradlew lint` | 0 error, 18 peringatan |
| Worker | `cd cloudflare && npm test` | 60 lulus, 0 gagal |
| Sertifikat rilis | `apksigner verify --print-certs` | `3a988c53...` sama dengan 1.10.1 dan 1.10.29 |

18 peringatan lint seluruhnya bawaan lama: 12 `UseKtx`, 4 versi dependensi, 1 `ObsoleteSdkInt`,
1 versi plugin Gradle. Tidak ada yang berasal dari pekerjaan 1.10.30.

## Sapu menu per peran

Dijalankan dengan `android/scripts/sapu_role.py` pada emulator 1080 × 2400, density 420, mode
pesawat aktif.

| Peran | Menu terbuka | Catatan |
|---|---|---|
| Owner | 21/21 | 0 crash |
| Kasir | 11/21 | sama dengan 1.10.29 |
| SPV | 8/21 | sama dengan 1.10.29 |

Menu yang tertutup bagi Kasir dan SPV memang tertutup sesuai katalog hak akses, bukan karena error.
Satu-satunya pengecualian yang diperiksa: `AccessCatalog.migrate` memetakan kunci `attendance.write`
versi 1.10.29 ke `attendance.self`, sehingga perangkat lama tidak kehilangan akses Absen.

## Kompatibilitas mundur

APK 1.10.29 dibuka dengan data hasil 1.10.30: SPV membuka 8/21 menu, 0 crash. APK 1.10.29 masih
dipakai 20 cabang dan wajib tetap berfungsi; belum ada yang dipaksa memperbarui.

## Pembersihan data uji

Akun uji `UjiPreset` dibuat untuk membuktikan preset bertahan setelah restart, lalu dihapus lewat jalur
command aplikasi (bukan menyunting `cuciin-data.json` langsung). Kondisi akhir perangkat: 4 role wajar,
pending 0, rejected 0.

## Belum diuji

- CRUD registrasi pengguna penuh dari UI.
- Sapu menu tersendiri untuk peran Gudang.
- Template Excel dan importer dengan data produksi.
- Perilaku APK pada tiap tipe HP operasional milik cabang.
- Firebase debug dan produksi masih berbagi satu identity project.

## Cara mengulang

```bash
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew testDebugUnitTest testReleaseUnitTest lint
python3 scripts/sapu_role.py <email> <sandi> <label> <harus_ada_di_peran>
```

Kata sandi akun tidak disimpan di repo; kirim lewat argumen atau env saat menjalankan skrip sapu.
