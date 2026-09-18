# Cuciin 1.10.7 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.7-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.7-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.7-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

Debug dan release memakai source fitur yang sama. Perbedaannya hanya endpoint data dan application ID debug.

## Isi versi 1.10.7

- Tampilan utama memakai dua filter sebaris: periode (bawaan hari ini) dan cabang.
- Tiga kartu status yang dapat diketuk: Sedang dikerjakan, Cucian telat, dan Selesai.
- Cucian telat berarti estimasi selesai sudah lewat tetapi pengerjaan belum selesai.
- Menu Kontrol Akses Role: pengguna melekat ke satu role yang menentukan modul dan fungsinya.
- Checklist modul dan fungsi dengan kotak centang, hitungan seperti 2/2, dan ringkasan pilihan.
- Role baru dapat dibuat; role bawaan hanya dapat diubah hak aksesnya.
- Pengaturan Owner tidak lagi memuat kontrol akses pengguna.

## Verifikasi

- VersionName `1.10.7`, versionCode `26`.
- Unit test debug dan release lulus (68 test debug, 0 gagal).
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator: role Kasir diubah dari 8 ke 9 modul, role Gudang dibuat lalu ditetapkan ke Dea.

## Migrasi server

Sudah diterapkan ke D1 produksi:

- `0006_asset_types.sql`: tabel `asset_types` dengan enam jenis bawaan.
- `0007_access_roles.sql`: tabel `access_roles` dengan tiga role bawaan.

Worker produksi sudah dideploy dan mengenal command `assetType.*` serta `accessRole.*`.

Tidak ada kredensial, token, atau material signing di folder ini.
