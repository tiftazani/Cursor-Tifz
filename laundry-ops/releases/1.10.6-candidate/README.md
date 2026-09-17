# Cuciin 1.10.6 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.6-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.6-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.6-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

Debug dan release memakai source fitur yang sama. Perbedaannya hanya endpoint data dan application ID debug.

## Isi versi 1.10.6

- Menu menjadi Daftar Aset Cabang dengan filter cabang dan jenis aset berupa dropdown.
- Registrasi aset pada layar terpisah dengan Aset ID otomatis dari kode cabang, kode jenis, dan nomor urut.
- Form aset memuat merek, nomor seri, jumlah, satuan, kondisi, tanggal beli, catatan, dan foto aset.
- Kondisi dipilih lewat kartu Normal, Perlu perbaikan, atau Rusak.
- Katalog jenis aset dapat ditambah; jenis yang dipakai aset tidak dapat dihapus.
- Foto aset hanya tersimpan di perangkat dan tidak dikirim ke server.

## Verifikasi

- VersionName `1.10.6`, versionCode `25`.
- Unit test dan lint debug serta release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator: aset pertama memperoleh `BNY-MC-001`, aset kedua `BNY-MC-002`.

## Migrasi server

`cloudflare/migrations/0006_asset_types.sql` menambah tabel `asset_types` beserta enam jenis bawaan.
Worker menerima command `assetType.upsert` dan `assetType.delete`.

Tidak ada kredensial, token, atau material signing di folder ini.
