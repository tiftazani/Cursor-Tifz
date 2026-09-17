# Cuciin 1.10.2 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.2-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.2-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.2-debug-test.apk` | APK debug khusus data test. Jangan dipakai untuk operasi cabang nyata. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` test |

Debug memakai akun Firebase yang sama agar Owner dapat memakai kredensialnya sendiri, tetapi tidak membaca atau menulis data operasional produksi. Database debug diawali dengan satu Cabang Debug dan dua Owner test, tanpa pelanggan, transaksi, pembayaran, stok, atau biaya produksi.

Saat APK debug baru pertama dibuka, cache debug lama dari endpoint sebelumnya dihapus otomatis. Ini mencegah snapshot, outbox, foto absensi, dan ekspor debug lama terbawa ke lingkungan test.

## Verifikasi

- Android debug: unit test, lint, dan assemble berhasil.
- Android release: unit test, lint, APK, AAB, signing, dan `verify_release.py` berhasil.
- Worker debug dan production: `npm run check` lulus.
- Worker debug health: `ok`, D1 test `ready`.

Tidak ada kredensial, token, ataupun material signing dalam folder ini.
