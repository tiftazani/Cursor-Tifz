# Cuciin 1.10.52 / versionCode 71

Kandidat 11 Oktober 2026. Menggantikan 1.10.51. Hanya Android; Worker tidak berubah.

## Bug

Owner tidak bisa mengubah stok dan melihat "Akses Catat stok dicabut untuk role akun ini".
Owner selalu punya 42 fungsi. Yang menolak adalah kunci antrean 1.10.51
(`SyncOutbox.blockedActor`: antrean HP berisi perubahan akun lain atau perubahan lama tanpa
pemilik), tetapi layar menampilkan pesan role.

## Perbaikan

- Pesan penolakan menyebut sebab sebenarnya: jumlah perubahan tertahan dan akun pemiliknya.
  Pesan role hanya muncul bila izin memang tidak ada. Berlaku di stok, produk, aset,
  pengeluaran, pelanggan, cabang, dan katalog layanan.
- Tombol "Kirim atas nama saya" (khusus Owner) untuk perubahan lama tanpa pemilik.
  Perubahan milik akun lain tidak disentuh; tidak ada antrean yang dihapus.
- Audit 15 modul / 42 fungsi: semua fungsi punya penjaga di store atau rute.

## Bukti lokal

- `clean testDebugUnitTest testReleaseUnitTest lintDebug lintRelease`: 510 debug + 510 release,
  gagal/error/skip 0. Lint masing-masing 0 error, 20 peringatan (semua di kode yang tidak
  diubah). Log `/tmp/cuciin152-gate.log`.
- `scripts/build_cuciin.sh semua`: BUILD SUCCESSFUL. Endpoint dalam dex: debug hanya
  `cuciin-api-debug.tiftazani-cuciin.workers.dev`, release hanya
  `cuciin-api.tiftazani-cuciin.workers.dev`. Log `/tmp/cuciin152-build.log`.
- `verify_release.py` PASS: tanda tangan v2, non-debuggable, target SDK 36, izin minimum,
  ZIP/ELF 16 KB. Sertifikat SHA-256 sama dengan 1.10.51:
  `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.
- `aapt2 dump badging`: versionCode 71, versionName 1.10.52.

## Berkas

| Berkas | SHA-256 |
|---|---|
| cuciin-1.10.52-debug.apk | 147f08b3c2445a893795a9a08181a0475ccef4444820bfb303ffd8c721f39f48 |
| cuciin-1.10.52-release.apk | da8caf2843b4aa4c6ee4c24265b10b72be8ae71997108eb56ca6666ff0dfe2e0 |
| cuciin-1.10.52-release.aab | 62a82d701b0ad2bc8c0b0e1df30b4fe50f2bf9c6f57a06b28dcc32607b99ffcf |

## BELUM dibuktikan

- Penyebab di HP pengguna (tidak ada perangkat adb tersambung saat perbaikan).
- Tombol "Kirim atas nama saya" di HP nyata dan pemasangan di atas 1.10.51 tanpa menghapus data.
- Uji dua HP nyata dengan akun sama.
