# Cuciin 1.8.0 candidate

- `cuciin-1.8.0-release.apk`: APK produksi bertanda tangan untuk instalasi perangkat operasional.
- `cuciin-1.8.0-release.aab`: Android App Bundle bertanda tangan untuk distribusi melalui Google Play bila nanti diperlukan.
- `cuciin-1.8.0-debug.apk`: APK debug terpisah untuk pengujian; jangan dipakai menyimpan data produksi.

Build ini belum menunjuk endpoint cloud karena akun Cloudflare belum selesai dihubungkan. Data tetap tersimpan local-first di HP. Setelah Worker/D1 aktif, build ulang dengan `CUCIIN_CLOUD_URL` dan Firebase produksi sebelum big bang 20 cabang.
