# Cuciin 1.10.37 (versionCode 56)

Kandidat rilis 22 Sep 2026. APK dan AAB **tidak** dilacak Git (aturan `releases/`); hanya
`README.md` dan `SHA256SUMS` di folder ini yang masuk repo. Berkas binary-nya dibagikan
di luar Git, dengan salinan di `laundry-ops/releases/cuciin-release.apk` dan `cuciin-debug.apk`.

## Isi rilis ini

### Perubahan peran dari server langsung berlaku di perangkat

Penyamaan hak akses pada perangkat yang sudah pernah sinkron kini meminta endpoint
`/v1/snapshot`. Sebelumnya aplikasi memanggil `open("GET")` tanpa argumen path, yang
mengakses alamat dasar Worker (`/`), menerima 404, lalu diam-diam menelan exception dan
mengembalikan `null`. Akibatnya `samakanHakAkses` tidak pernah berjalan:

1. Peran yang sudah diubah di server (mis. Supervisor diturunkan jadi Kasir) tidak pernah
   berubah di aplikasi perangkat.
2. Akun yang sudah dihapus dari server tetap muncul di layar Daftar User.

Dengan perbaikan ini, perangkat menarik snapshot terbaru saat sinkronisasi dan memperbarui
data peran lokal secara otomatis.

## Hasil test

Gate dijalankan dari build rilis bertanda tangan, `BUILD SUCCESSFUL`:

| Varian | Test | Gagal | Error |
| --- | --- | --- | --- |
| `testDebugUnitTest` | 290 | 0 | 0 |
| `testReleaseUnitTest` | 290 | 0 | 0 |

`lintRelease`: **0 error**, 18 warning.

Tes penjaga baru `SnapshotPrivilegeEndpointTest.kt` (2 tes):
- `penyamaanHakAksesMemakaiAlamatSnapshot` (lulus)
- `penyamaanHakAksesTidakMemakaiAlamatDasar` (lulus)
- Terbukti merah (2 gagal) saat perbaikan dibalikkan ke kode lama `open("GET")`.

## Verifikasi artefak

`verify_release.py`: **PASS** (tanda tangan rilis v2, non-debuggable, target SDK 36, izin minimum,
ZIP/ELF 16 KB). Sertifikat penandatangan **tidak berubah**:
`3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.

Checksum sha256:
```
66fdd5828dd59f53c1fe0e183d998c71a715311070b21db56fbf8f28fd71f7cc  cuciin-1.10.37-release.apk
18437ae0b8a8070e9ca913ba79f31ca903450f482ec11be0544cc0f0bb2a49e4  cuciin-1.10.37-debug.apk
0a720c9dc187971b9195e4e4a9431f92ae93f2d2e8d033026ce775ab6ce673d0  cuciin-1.10.37-release.aab
```

Salinan di `laundry-ops/releases/` sudah disamakan dengan kandidat ini (`cuciin-release.apk`,
`cuciin-debug.apk`, hash identik, `shasum -c` OK).
