# Cuciin 1.10.0 candidate

Build kandidat ini lulus 47 unit test debug dan 47 unit test rilis, lint debug/rilis tanpa error, verifikasi APK rilis, serta 35 test Worker pada 16 September 2026. Worker produksi versi `5a2741cc-96b8-423a-8de1-8b2e1ea66f35` aktif dengan database `ready`.

- `cuciin-1.10.0-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.10.0-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.
- `cuciin-1.10.0-debug.apk`: APK debug terpisah untuk pengujian; jangan dipakai menyimpan data produksi.

## Perubahan penting: identitas aplikasi

Paket aplikasi berpindah dari `com.tiftazani.laundryops` ke `com.cuciin.laundryops`, dan Firebase Authentication berpindah dari project `cuciin-ops-tiftazani` ke `cuciin-ops`.

**Yang harus diperhatikan sebelum memasang:**

1. Android menganggap paket baru sebagai aplikasi berbeda. Versi lama **tidak tergantikan otomatis**; ia tetap terpasang berdampingan dan harus dicopot manual setelah versi baru terbukti berjalan.
2. Data lokal versi lama (foto absensi, cache, outbox) tidak berpindah. Data operasional di server tidak terpengaruh.
3. Selama masa peralihan, Worker menerima token dari project lama **dan** baru, jadi HP yang belum diperbarui tetap dapat bekerja seperti biasa.
4. Akun operasional dibuat ulang di project baru dengan kata sandi awal `test1234`, dan wajib diubah dari Profil sebelum data nyata dipakai.

## Bukti verifikasi

- Android: 47 unit test debug dan 47 unit test rilis lulus, lint debug/rilis 0 error, APK debug/rilis dan AAB rilis dibuat dengan JDK 17.
- APK rilis: non-debuggable, application ID `com.cuciin.laundryops`, versionCode `19`, versionName `1.10.0`, target API 36, signature v2 valid, kompatibel dengan page size 16 KB.
- SHA-256 sertifikat rilis tetap sama dengan kandidat sebelumnya: `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.
- Firebase: 7 akun (2 Owner, 3 Kasir, 2 Supervisor) login berhasil di project baru; kedua app Android terdaftar dengan sidik jari SHA-1 dan SHA-256.
- Worker: 35 test lulus, termasuk 6 test baru untuk penerimaan dua project Firebase.
- Uji integrasi nyata: token project baru dan token project lama dua-duanya diterima `/v1/me` (HTTP 200). Login penuh dari APK paket baru sampai masuk dashboard diuji di emulator.
- Data D1 produksi: seluruh nama pribadi diganti menjadi `Cuciin`; alamat email Owner dipertahankan. Backup sebelum perubahan disimpan di `firebase-migration/backup-d1/` (di luar repo).

## Catatan teknis

- Endpoint `config` Firebase Management API selalu mengembalikan app pertama untuk semua permintaan, jadi konfigurasi app debug disusun dari `mobilesdk_app_id` app debug yang sebenarnya. Rinciannya di `../../firebase/README.md`.
Isi template email masih bawaan Firebase. Per 16 September 2026, API dan Console menolak perubahan isi template dengan `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, jadi subjek dan isi hanya dapat mengikuti locale project. Rinciannya ada di `../../firebase/README.md`.

Gunakan APK release untuk pilot. Ikuti `../../OPERATIONS_RUNBOOK.md` dan selesaikan tindakan Owner pada `../../android/RELEASE_READINESS.md` sebelum big-bang 20 cabang.
