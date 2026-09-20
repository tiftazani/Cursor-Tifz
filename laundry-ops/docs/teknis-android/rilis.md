# Rilis

Bagaimana versi baru Cuciin disiapkan, ditandatangani, dan dibagikan ke cabang.

> Ringkasan: satu versi dirilis untuk seluruh cabang dari satu sumber kode. Versi tidak diturunkan, dan versi lama tetap harus berfungsi selama masa perpindahan perangkat.

## Tujuan

Cabang memakai aplikasi versi berbeda selama beberapa minggu. Karena itu nomor versi harus naik satu arah, dan perubahan yang menyentuh format data harus tetap dapat dibaca oleh perangkat yang belum diperbarui.

## Aturan versi

| Aturan | Alasan |
|---|---|
| `versionCode` tidak pernah diturunkan | Perangkat menolak memasang versi dengan nomor lebih rendah |
| Satu `versionName` untuk seluruh cabang | Menyederhanakan dukungan dan pelaporan |
| Perubahan format data harus tetap terbaca versi lama | `1.10.29` masih dipakai selama masa perpindahan |

Nilai pada versi ini:

```kotlin
versionCode = 49
versionName = "1.10.30"
```

Letaknya di `android/app/build.gradle.kts`.

## Langkah merilis

1. Naikkan `versionCode` dan `versionName` di `android/app/build.gradle.kts`.
2. Tambahkan catatan versi ke `VersionHistory` agar tampil di menu **Riwayat versi**.
3. Jalankan tes debug dan rilis, pastikan tidak ada yang gagal.
4. Bangun varian rilis dengan berkas penandatanganan yang benar.
5. Periksa isi APK: nama paket, nomor versi, dan sertifikat penandatangan.
6. Perbarui berkas APK distribusi di `releases/`.
7. Catat nilai sidik jari berkas di `releases/SHA256SUMS.txt`.

```bash
cd android
./gradlew assembleDebug assembleRelease

aapt2 dump badging app/build/outputs/apk/release/app-release.apk | grep package
sha256sum app/build/outputs/apk/release/app-release.apk
```

> **BAHAYA**
> Berkas penandatanganan dan kata sandinya tidak boleh masuk repositori. Simpan di luar proyek dan hanya lewat variabel lingkungan `CUCIIN_SIGNING_PROPERTIES`.

## Memeriksa versi yang benar-benar terpasang

Versi berkas APK dan versi yang terpasang di perangkat bisa berbeda. Selalu periksa dua-duanya:

```bash
aapt2 dump badging app/build/outputs/apk/debug/app-debug.apk | grep package
adb shell dumpsys package com.cuciin.laundryops.debug | grep -E "versionName|versionCode"
```

> **PERHATIAN**
> Perangkat uji pernah menyimpan versi `1.10.28` lama sementara berkas yang dibangun sudah `1.10.30`. Selisih itu membuat gejala yang sudah diperbaiki tampak masih ada. Pasang ulang sebelum menyimpulkan ada bug.

## Berkas rilis di repositori

| Berkas | Perlakuan |
|---|---|
| `releases/cuciin-release.apk` | APK distribusi, diperbarui setiap rilis |
| `releases/cuciin-debug.apk` | APK debug untuk pengujian lapangan |
| Folder kandidat | Hanya `README.md` dan `SHA256SUMS.txt` yang dilacak; APK dan AAB tidak |

## Verifikasi

| Yang diperiksa | Caranya |
|---|---|
| Nama paket dan versi benar | `aapt2 dump badging` pada berkas APK |
| Versi terpasang sama dengan berkas | `dumpsys package` di perangkat |
| Sidik jari berkas tercatat | `sha256sum` dibandingkan dengan `SHA256SUMS.txt` |
| Aplikasi tidak menutup sendiri | Jalankan di perangkat, amati beberapa menit |
| Semua menu masih terbuka | Sapu seluruh menu memakai `android/scripts/sapu_role.py` |

## Bila hasilnya berbeda

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| `Rilis memerlukan CUCIIN_SIGNING_PROPERTIES` | Variabel penandatanganan belum diisi | Isi variabel sebelum membangun rilis |
| Perangkat menolak memasang | `versionCode` lebih rendah dari yang terpasang | Naikkan `versionCode`, jangan menurunkan yang terpasang |
| Menu baru tidak muncul di perangkat lama | Menu bergantung pada data yang belum tersinkron | Tunggu sinkronisasi selesai, lalu buka ulang |

## Risiko dan batasan

- **Masa perpindahan belum selesai.** Selama `1.10.29` masih dipakai, jalur kompatibilitas tidak boleh disederhanakan.
- **Distribusi masih manual.** Berkas APK dibagikan lewat repositori rilis; belum ada pembaruan otomatis di perangkat.
- **Pencadangan server belum pernah dijalankan.** Prosedur pencadangan sudah ada tetapi belum pernah diuji dengan passphrase pemilik, dan retensinya masih diatur manual selama 7 hari. Uji lebih dulu sebelum mengandalkannya.
