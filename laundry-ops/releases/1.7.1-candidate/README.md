# Cuciin Android 1.7.1 (build 11)

Artefak kandidat:

- `cuciin-1.7.1-release.apk`: APK rilis bertanda tangan untuk pengujian perangkat.
- `cuciin-1.7.1-release.aab`: Android App Bundle untuk proses Google Play.
- `SHA256SUMS`: checksum SHA-256 kedua artefak.

Validasi lokal: unit test debug/rilis, lint debug/rilis, `assembleDebug`, `assembleRelease`, `bundleRelease`, verifikasi tanda tangan APK v2, target SDK 36, APK non-debuggable, izin minimum, dan alignment pustaka native 16 KB telah lolos.

Build rilis tidak menyertakan URL atau kunci server lama. Tanpa konfigurasi Firebase produksi, aplikasi bekerja local-first pada perangkat dengan file database utama dan cadangan. Status distribusi dan penghambat produksi dijelaskan di `laundry-ops/android/RELEASE_READINESS.md`. Instalasi APK di luar Google Play masih dapat memunculkan pemeriksaan atau peringatan Android/Play Protect. Tidak ada berkas kunci privat atau `google-services.json` di paket kandidat maupun repo.
