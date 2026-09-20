# Cuciin 1.10.31 (versionCode 50)

Kandidat rilis 20 September 2026, malam. Menggantikan `1.10.30` yang dibangun pagi
hari itu dan **tidak** memuat perbaikan sinkronisasi hak akses.

## Isi

| Berkas | Keterangan |
|---|---|
| `cuciin-1.10.31-release.apk` | APK rilis bertanda tangan, dipakai cabang |
| `cuciin-1.10.31-release.aab` | Bundel untuk Google Play |
| `cuciin-1.10.31-debug.apk` | APK debug, pengujian internal (menunjuk Worker debug) |

## Yang berubah dari 1.10.30

Tiga cacat sinkronisasi yang membuat keadaan server tidak pernah sampai ke perangkat:

1. `reconcileBootstrap` mengangkat perubahan entitas hak akses (`staff`, `accessRole`,
   `accessPolicy`) dari perangkat ke server. Server adalah pemilik data itu.
2. Entri hak akses yang sudah hilang di server tidak pernah dibuang dari perangkat,
   sehingga akun dan role uji bertahan sesudah dihapus di server.
3. Worker mengembalikan `nextRevision` = `after` saat tidak ada baris jurnal yang cocok,
   sehingga kursor klien yang berada di depan server dipantulkan dan halaman jurnal yang
   lebih tua tidak pernah dibaca lagi.

Perbaikan Worker (`nextRevision` di-clamp ke `latestRevision`) sudah **dideploy** ke
produksi: versi `07442ff9-6f7f-4d13-a932-261a3f40dfc3`.

## Verifikasi

- `testDebugUnitTest` + `testReleaseUnitTest`: **276 + 276 kasus, 0 gagal**.
- `lintDebug`: 0 error.
- `verify_release.py`: PASS (tanda tangan rilis v2, non-debuggable, target SDK, izin minimum, ZIP/ELF 16 KB).
- Sertifikat rilis `3a988c53…` — sama dengan versi sebelumnya, jadi APK ini bisa
  menimpa pemasangan lama tanpa uninstall.

## Pemasangan

```bash
adb install -r cuciin-1.10.31-release.apk
```

Naik dari 1.10.30 (`versionCode` 49 ke 50), jadi pemasangan menimpa tanpa mencopot
dan data cabang tetap.
