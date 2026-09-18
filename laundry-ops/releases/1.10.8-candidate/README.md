# Cuciin 1.10.8 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.8-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.8-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.8-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

Debug dan release memakai source fitur yang sama. Perbedaannya hanya endpoint data dan application ID debug.

## Isi versi 1.10.8

- Lembar pilihan modul memakai kotak centang: terisi penuh saat dipilih, kosong bergaris saat tidak.
- Setiap baris menampilkan label "Dipilih" atau "Tidak dipilih" sehingga status pilihan tidak bergantung pada warna saja.
- Baris terpilih diberi latar berbeda supaya mudah dikenali sekilas.
- Lembar pilihan modul menampilkan hitungan seperti "1 dari 12 modul dipilih", plus tombol Pilih semua dan Kosongkan.
- Tombol Selesai selalu terlihat penuh; daftar panjang digulir di dalam area terbatas.
- Lembar pilihan tunggal memakai radio, pilihan banyak memakai kotak centang.

Versi ini melanjutkan 1.10.7 (tampilan utama dua filter plus tiga kartu status, dan menu Kontrol Akses Role).

## Verifikasi

- VersionName `1.10.8`, versionCode `27`.
- Unit test debug dan release lulus: 68 test per varian, 0 gagal.
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator: sheet modul menampilkan kotak centang terisi dan kosong, label Dipilih dan Tidak dipilih terbaca, hitungan "1 dari 12" dan "2 dari 12" berubah sesuai ketukan, dan tombol Selesai tampil penuh setinggi 46px.

## Catatan server

Tidak ada perubahan server pada versi ini. Migrasi `0006_asset_types.sql` dan `0007_access_roles.sql` sudah diterapkan sebelumnya ke D1 produksi, dan Worker produksi sudah mengenal command `assetType.*` serta `accessRole.*`.

Tidak ada kredensial, token, atau material signing di folder ini.
