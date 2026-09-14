# Cuciin Android 1.7.0 (build 10)

Artefak kandidat:

- `cuciin-1.7.0-release.apk`: APK release bertanda tangan untuk pengujian perangkat.
- `cuciin-1.7.0-release.aab`: Android App Bundle untuk proses Google Play.
- `SHA256SUMS`: checksum SHA-256 kedua artefak.

Validasi lokal: unit test debug/release, lint debug/release, `assembleDebug`, `assembleRelease`, `bundleRelease`, verifikasi tanda tangan APK v2, target SDK 36, APK non-debuggable, izin minimum, dan alignment pustaka native 16 KB telah lolos.

Status distribusi dan penghambat produksi dijelaskan di `laundry-ops/android/RELEASE_READINESS.md`. Instalasi APK di luar Google Play masih dapat memunculkan pemeriksaan atau peringatan dari Android/Play Protect. Tidak ada berkas kunci privat atau `google-services.json` di paket kandidat maupun repo.
