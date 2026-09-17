# Cuciin 1.10.17 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.17-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.17-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.17-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.17

Versi ini melanjutkan 1.10.16 dengan satu perbaikan.

### Perbaikan: judul tertimpa tombol di layar pembuka

Pada layar pembuka, judul halaman ("Semua cabang dalam satu aplikasi") hanya terlihat sebagian
karena tertimpa tombol Lanjut. Yang terlihat hanya kata terakhir.

Penyebabnya tata letak dua lapisan yang bertabrakan:

- Judul berada di dalam wadah berisi penuh layar dengan pengisi fleksibel di atasnya, sehingga
  terdorong ke dasar layar.
- Tombol berada di wadah terpisah yang juga menempel di dasar layar.

Keduanya berakhir di titik yang sama. Diukur di emulator: judul di y 2187 sampai 2211, sedangkan
tombol Lanjut di y 2091 sampai 2152, sehingga judul hanya tersisa 13 piksel ruang.

Perbaikan: seluruh isi (logo, judul, baris pendukung, titik halaman, tombol) disusun dalam SATU
kolom yang mengalir dari atas ke bawah, dengan satu pengisi fleksibel di antara logo dan judul.
Dengan cara itu judul selalu duduk tepat di atas blok tombol, berapa pun tinggi layarnya.

Hasil setelah perbaikan, diukur di emulator:

| Elemen | Sebelum | Sesudah |
|---|---|---|
| Judul | y 2187 sampai 2211 (tertimpa) | y 1651 sampai 1825 (utuh, dua baris) |
| Tombol Lanjut | y 2091 sampai 2152 | y 2033 sampai 2094 |
| Jarak judul ke tombol | 13 px | 208 px |

## Verifikasi

- VersionName `1.10.17`, versionCode `36`.
- Unit test debug dan release lulus: 121 test per varian, 0 gagal.
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Nama aplikasi dibaca balik dari APK: debug `Cuciin Debug`, rilis `Cuciin`.
- Uji emulator: ketiga halaman layar pembuka diperiksa dengan `uiautomator`, tidak ada satu pun
  tumpang tindih antara judul dan tombol. Diperiksa juga lewat tangkapan layar.

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.
- Nama Owner di data server masih "Tiftazani". Penggantian ditunda atas keputusan Owner.

Tidak ada kredensial, token, atau material signing di folder ini.
