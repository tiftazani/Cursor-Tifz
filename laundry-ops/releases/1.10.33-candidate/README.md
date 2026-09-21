# Cuciin 1.10.33 (versionCode 52)

Kandidat rilis 21 September 2026. Melanjutkan `1.10.32` dengan perbaikan kata sandi.

## Isi

| Berkas | Keterangan |
|---|---|
| `cuciin-1.10.33-release.apk` | APK rilis bertanda tangan, dipakai cabang |
| `cuciin-1.10.33-release.aab` | Bundel untuk Google Play |
| `cuciin-1.10.33-debug.apk` | APK debug, pengujian internal (menunjuk Worker debug) |

## Yang berubah dari 1.10.32

Kata sandi ada di dua tempat dan sebelumnya tidak pernah berubah bersama:

1. **Kata sandi Firebase** untuk masuk ke layanan identitas.
2. **Hash lokal** di perangkat sebagai cadangan saat server tidak terjangkau.

Karena `FirebaseCloud.enabled` selalu bernilai benar di rilis, tombol "Simpan kata sandi"
selalu memakai jalur Firebase saja. Akibatnya hash lokal tetap kata sandi lama. Orang yang
mengganti kata sandi lalu keluar tidak bisa masuk lagi dengan kata sandi barunya, meski
Firebase sudah menerimanya. Sekarang setelah Firebase menerima kata sandi baru, hash lokal
ikut diperbarui, dan bila perangkat menolak, penolakan itu ditampilkan bukan dilaporkan sebagai sukses.

Jalur "Lupa kata sandi" punya celah yang sama: kata sandi Firebase berubah di luar aplikasi
lewat tautan email, sedangkan hash lokal tetap yang lama sehingga menolak kata sandi baru.
Sekarang hash lokal akun itu dibuang setelah tautan reset dikirim, sehingga layar masuk
memverifikasi lewat Firebase.

## Verifikasi

- `testDebugUnitTest` + `testReleaseUnitTest`: **281 + 281 kasus, 0 gagal**.
- `lintDebug`: 0 error.
- `verify_release.py`: PASS.
- Sertifikat rilis `3a988c53…` sama dengan versi sebelumnya, bisa menimpa tanpa uninstall.
- `PasswordSyncTest` mengunci ketiga jalur di atas supaya tidak terulang.

## Pemasangan

```bash
adb install -r cuciin-1.10.33-release.apk
```
