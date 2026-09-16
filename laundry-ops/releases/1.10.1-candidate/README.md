# Cuciin 1.10.1 candidate

Kandidat rilis ini dibuat dari commit sumber terverifikasi dan siap untuk pilot perangkat operasional.

- `cuciin-1.10.1-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.10.1-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.
- `cuciin-1.10.1-debug.apk`: APK debug terpisah untuk pengujian. Jangan gunakan untuk data produksi.
- `SHA256SUMS`: checksum SHA-256 tiga artefak di atas.

## Verifikasi

- Android: 47 unit test debug dan 47 unit test rilis lulus, tanpa kegagalan atau error.
- Lint debug dan rilis lulus.
- APK rilis: application ID `com.cuciin.laundryops`, versionCode `20`, versionName `1.10.1`, non-debuggable, signature v2 valid, dan kompatibel dengan page size 16 KB.
- URL Worker produksi tertanam pada APK debug dan rilis.
- Instalasi bersih APK debug pada emulator berhasil. Layar masuk menampilkan logo Cuciin tanpa slogan atau masuk cepat, serta seluruh form berada dalam satu layar.
- Worker: 39 test lulus. Versi produksi `a539b2e0-49e2-4d1f-a6cf-8d4912c1a7a7` aktif; health menyatakan `ok`, database `ready`, dan endpoint snapshot tanpa autentikasi ditolak 401.
- Audit D1 read-only sesudah deploy: foreign key bersih dan relasi staf-cabang yatim berjumlah 0.

## Perubahan 1.10.1

- Login hanya memakai autentikasi email dan kata sandi Firebase. Peran serta cakupan cabang berasal dari server.
- Pemilih cabang dan pengguna memakai bilah filter serta daftar bottom sheet, bukan chip atau kartu berulang.
- Rincian laporan transaksi dibuat lazy agar skala data besar tetap lancar.
- PDF laporan transaksi, stok, dan nota memakai palet biru Cuciin serta label Bahasa Indonesia.
- Worker mempertahankan versi optimistic concurrency saat reproject snapshot.

Gunakan APK rilis untuk pilot. Sebelum distribusi ke seluruh cabang, jalankan pilot di perangkat nyata, pastikan seluruh akun mengganti kata sandi awal, dan ikuti `../../android/RELEASE_READINESS.md`.