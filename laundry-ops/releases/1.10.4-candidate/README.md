# Cuciin 1.10.4 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.4-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.4-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.4-debug-test.apk` | APK debug untuk data uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

Debug dan release memakai source yang sama; yang berbeda hanya endpoint data.

## Isi versi

- PDF dan CSV laporan transaksi memuat semua bagian yang dipilih di filter Tampilan laporan, dengan halaman lanjutan bila tabel panjang.
- PDF laporan analitik memuat diagram batang dan diagram donat, plus seluruh Service pada filter.
- Tombol Excel laporan analitik mengekspor semua tabel yang tampil.
- Bilah filter lebih ringkas, dua filter per baris layar.

## Verifikasi

- Android debug dan release: unit test, lint, APK, AAB, signing, dan `verify_release.py` lulus.
- APK rilis menunjuk Worker produksi; APK debug menunjuk Worker uji.
- D1 uji memuat salinan data produksi per 17 September 2026 (satu arah).

Tidak ada kredensial, token, atau material signing di folder ini.
