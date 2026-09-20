# Cuciin 1.10.32 (versionCode 51)

Kandidat rilis 20 September 2026. Melanjutkan `1.10.31` dengan satu perbaikan tampilan.

## Isi

| Berkas | Keterangan |
|---|---|
| `cuciin-1.10.32-release.apk` | APK rilis bertanda tangan, dipakai cabang |
| `cuciin-1.10.32-release.aab` | Bundel untuk Google Play |
| `cuciin-1.10.32-debug.apk` | APK debug, pengujian internal (menunjuk Worker debug) |

## Yang berubah dari 1.10.31

Peringatan keadaan sinkronisasi (`SyncNotice`) sebelumnya hanya muncul di Beranda dan Profil.
Sekarang muncul juga di layar data: Pelanggan, Cabang, Daftar User, Layanan & harga, Produk stok,
Biaya operasional, Absensi, Daftar Aset Cabang, Tipe Aset, Riwayat aktivitas, dan Tutup kas.

Alasannya: saat server belum terhubung, angka di layar itu bisa belum sama dengan server tanpa
penjelasan apa pun. Daftar User paling berbahaya — peran yang tampak di perangkat bisa berbeda
dari yang berlaku di server.

## Verifikasi

- `testDebugUnitTest` + `testReleaseUnitTest`: **276 + 276 kasus, 0 gagal**.
- `lintDebug`: 0 error.
- `verify_release.py`: PASS.
- Sertifikat rilis `3a988c53…` — sama dengan versi sebelumnya, bisa menimpa tanpa uninstall.

## Pemasangan

```bash
adb install -r cuciin-1.10.32-release.apk
```
