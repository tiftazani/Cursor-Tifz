# Cuciin Android

Package rilis `com.cuciin.laundryops`, package debug `com.cuciin.laundryops.debug`. Versi sekarang
**1.10.30** (versionCode 49). Label aplikasi: **Cuciin** (debug: **Cuciin Debug**).

## Unduh APK

APK dibagikan lewat folder [`../releases/`](../releases):

- [`../releases/cuciin-release.apk`](../releases/cuciin-release.apk) — untuk perangkat operasional.
- [`../releases/cuciin-debug.apk`](../releases/cuciin-debug.apk) — untuk pengujian; jangan dipakai
  menyimpan data produksi.

Kandidat per versi beserta checksum ada di `../releases/<versi>-candidate/`. Jangan mengunduh APK
dari jalur lain; jalur web lama sudah dilepas dan sekarang mati.

## Server

Database ada di server: `https://cuciin-api.tiftazani-cuciin.workers.dev` (Cloudflare Worker + D1).
Debug memakai Worker dan D1 **terpisah** (`https://cuciin-api-debug.tiftazani-cuciin.workers.dev`),
supaya transaksi uji tidak pernah masuk produksi.

Aplikasi bersifat local-first: perubahan disimpan ke berkas lokal lalu masuk persistent outbox,
dikirim sebagai command idempoten, dan delta ditarik per revision. Cache JSON tetap ada di HP saat
offline.

## Build di Mac

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd laundry-ops/android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

`android/local.properties` berisi `sdk.dir=/opt/homebrew/share/android-commandlinetools` dan
di-gitignore. APK lokal: `app/build/outputs/apk/debug/app-debug.apk`.

Build rilis butuh berkas signing privat di luar repo:

```bash
export CUCIIN_SIGNING_PROPERTIES=/Users/tiftazani/Documents/ChatGPT/Laundry/signing-private/cuciin-signing.properties
./gradlew testReleaseUnitTest lintRelease assembleRelease bundleRelease
python3 scripts/verify_release.py app/build/outputs/apk/release/app-release.apk --build-tools "$ANDROID_HOME/build-tools/35.0.0"
```

Build rilis **gagal** bila `CUCIIN_SIGNING_PROPERTIES` tidak diset, dan build debug/rilis gagal bila
alamat cloud variannya kosong. Itu disengaja: aplikasi tanpa alamat cloud diam-diam jalan mode lokal
dan datanya tidak pernah naik ke server.

## Firebase

Firebase Auth memakai project `cuciin-ops`. Project lama `cuciin-ops-tiftazani` **masih diterima**
Worker selama perangkat 20 cabang belum pindah; jangan kurangi `FIREBASE_PROJECT_IDS` di
`wrangler.toml` sebelum semua pindah.

1. Firebase Console → project `cuciin-ops` → daftarkan app Android rilis `com.cuciin.laundryops` dan
   debug `com.cuciin.laundryops.debug`.
2. Unduh `google-services.json` → taruh di `laundry-ops/android/app/`.
3. Auth: Email/Password.

`google-services.json` di-gitignore; contoh bentuknya ada di `app/google-services.json.example`.
Aplikasi tetap bisa dibangun tanpa berkas itu, tetapi login Firebase mati.

Firestore **tidak dipakai**. Data operasional seluruhnya lewat Worker + D1.

## Uji di emulator

```bash
ADB=/opt/homebrew/share/android-commandlinetools/platform-tools/adb
$ADB install -r app/build/outputs/apk/debug/app-debug.apk
```

AVD debug yang dipakai: `MindChampions_API35` (tampil sebagai `emulator-5554`). Antrian awal kosong —
tambah stok & pelanggan, lalu buat nota.

## Aturan yang tidak boleh dilanggar

- Jangan menurunkan atau memakai ulang `versionCode`: APK baru harus selalu lebih tinggi, dan setiap
  publish wajib menaikkannya sekaligus di `app/build.gradle.kts`, `data/VersionHistory.kt`, dan
  `CHANGELOG.md` (ketiganya harus sama).
- Jangan mengganti `applicationId` atau sertifikat signing. Keduanya terkunci eksternal: APK baru
  tidak akan bisa menimpa pemasangan lama, dan data lokal (foto absensi, cache, outbox) tidak ikut
  pindah.
- Jangan menaruh `google-services.json`, `local.properties`, keystore, atau berkas signing di Git.
