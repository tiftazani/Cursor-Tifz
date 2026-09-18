# Cuciin 1.10.18 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.18-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.18-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.18-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.18

Versi ini melanjutkan 1.10.17 dengan satu perbaikan.

### Perbaikan: tombol kedua di halaman terakhir layar pembuka

Di halaman terakhir, tombol kedua bertulisan "Lihat panduan singkat" padahal tombol itu hanya
menutup layar. Tulisannya menjanjikan hal yang tidak dilakukan.

Sekarang tombol kedua hanya muncul selama masih ada halaman berikutnya, dan isinya selalu
"Lewati". Di halaman terakhir tidak ada lagi yang bisa dilewati, dan tombol utamanya sudah
"Masuk ke akun", jadi tombol kedua dihilangkan.

Aturannya hidup di katalog, bukan di layar, supaya bisa diuji:

| Fungsi | Halaman 1 | Halaman 2 | Halaman 3 |
|---|---|---|---|
| `Onboarding.primaryLabel` | Lanjut | Lanjut | Masuk ke akun |
| `Onboarding.hasSecondButton` | true | true | false |
| `Onboarding.secondLabel` | Lewati | Lewati | null |

Diukur di emulator setelah perbaikan: halaman 3 hanya memuat satu tombol, yaitu "Masuk ke akun"
di y 2164 sampai 2225. Tidak ada lagi tombol di bawahnya.

## Verifikasi

- VersionName `1.10.18`, versionCode `37`.
- Unit test debug dan release lulus: 124 test per varian, 0 gagal.
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Nama aplikasi dibaca balik dari APK: debug `Cuciin Debug`, rilis `Cuciin`.
- Uji emulator: ketiga halaman layar pembuka diperiksa dengan `uiautomator`, tidak ada tumpang
  tindih antara judul dan tombol. Halaman 3 diperiksa juga lewat tangkapan layar.
- Diperiksa juga halaman masuk setelah menekan "Masuk ke akun": kartu kaca tembus pandang,
  wallpaper terlihat menembus kartu, dan tidak ada bar terang di bagian bawah.

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.
- Nama Owner di data server masih "Tiftazani". Penggantian ditunda atas keputusan Owner.

Tidak ada kredensial, token, atau material signing di folder ini.
