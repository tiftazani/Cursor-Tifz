# Cuciin 1.8.1 candidate

- `cuciin-1.8.1-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.8.1-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.
- `cuciin-1.8.1-debug.apk`: APK debug terpisah untuk pengujian; jangan dipakai menyimpan data produksi.
- `SHA256SUMS`: checksum untuk memeriksa integritas berkas.

Build ini memakai Firebase Authentication dan endpoint Cloudflare D1 produksi. Secret bootstrap dan `google-services.json` tidak disertakan sebagai berkas repository. Sebelum operasional nyata, ganti semua kata sandi awal, uji pemulihan data, dan selesaikan pengujian sinkronisasi serentak yang tercatat di `laundry-ops/android/RELEASE_READINESS.md`.
