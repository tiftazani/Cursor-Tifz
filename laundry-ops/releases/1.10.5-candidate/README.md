# Cuciin 1.10.5 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.5-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.5-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.5-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

Debug dan release memakai source fitur yang sama. Perbedaannya hanya endpoint data dan application ID debug.

## Isi versi 1.10.5

- Layout memiliki gutter compact 16dp, gap internal 8dp, dan gap antarbagian 16dp.
- Modul adalah daftar berkelompok, bukan grid kartu besar.
- Antrian memakai filter dua kolom untuk Owner dan daftar Service lazy berbentuk baris.
- Pengaturan Owner memakai sheet multi-select dengan tombol Selesai yang tetap terlihat.
- Donat aplikasi dan PDF memakai palet warna kategorikal, label persen, dan legenda konsisten.
- Grafik satu-periode tidak menyisakan ruang kosong besar.

## Verifikasi

- VersionName `1.10.5`, versionCode `24`.
- Unit test dan lint debug/release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.

Tidak ada kredensial, token, atau material signing di folder ini.
