# Cuciin 1.10.3 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.3-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.3-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.3-debug-test.apk` | APK debug untuk data uji. Bukan untuk operasi cabang nyata. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

Debug dan release dibangun dari source yang sama. Perbedaannya hanya endpoint: release menulis ke produksi, debug menulis ke database uji.

## Isi versi

- Menu laporan dipisah: Laporan transaksi (rincian, rekap, box daftar dengan gulir internal) dan Laporan analitik (tren, komposisi, peringkat).
- Laporan analitik memakai seluruh data yang terlihat akun, dengan filter periode, cabang, kasir, dan jenis data yang semuanya multi-select.
- Diagram batang tren omzet bulanan dan diagram donat untuk omzet per cabang serta penerimaan per metode.
- Nama kasir dan petugas pada laporan, PDF, dan CSV mengikuti nama terkini di Daftar User; email tetap identitas stabil.

## Verifikasi

- Android debug dan release: unit test, lint, APK, AAB, signing, dan `verify_release.py` lulus.
- APK rilis terverifikasi menunjuk Worker produksi; APK debug terverifikasi menunjuk Worker uji.
- D1 uji sudah memuat salinan data produksi per 17 September 2026 (satu arah, produksi ke uji).

Tidak ada kredensial, token, atau material signing di folder ini.
