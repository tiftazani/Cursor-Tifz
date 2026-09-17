# Cuciin 1.10.16 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.16-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.16-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.16-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.16

### Layar pembuka sebelum halaman masuk

Tiga halaman geser yang muncul **sekali setelah aplikasi dipasang**, lalu tidak muncul lagi.
Bisa dibuka lagi lewat tautan **Tentang aplikasi** di halaman masuk.

| Halaman | Gambar | Judul | Baris pendukung |
|---|---|---|---|
| 1 | Ruang cuci lengkap | Semua cabang dalam satu aplikasi | Antrian, nota, stok, dan kas. |
| 2 | Rak pakaian | Tetap jalan tanpa internet | Nota tersimpan di HP, terkirim otomatis. |
| 3 | Petugas Cuciin | Akses sesuai peran | Kasir, SPV, dan Owner punya menu sendiri. |

Tombol: **Lanjut** dan **Lewati** di dua halaman pertama, **Masuk ke akun** dan **Lihat panduan
singkat** di halaman terakhir. Ada tombol Lewati kecil di pojok kanan atas juga.

Gambar memakai rasio 9:20 (841 x 1870 piksel), sama dengan rasio layar HP modern, sehingga tidak
terpotong. Teks diletakkan langsung di atas gambar tanpa kotak, dengan gradien gelap hanya di
tepi atas dan bawah supaya bagian tengah gambar tetap bersih.

### Halaman login memakai kartu kaca

Kartu login sekarang tembus pandang: latar navy 42 persen, isian bening dengan garis putih tipis,
dan wallpaper terlihat di belakangnya. Kaca gelap dipilih, bukan kaca terang, karena wallpaper
login cukup ramai sehingga tulisan putih kehilangan kontras di atas kaca terang.

Perubahan lain di halaman masuk:

- Judul dipendekkan: "Pakai email dan kata sandi akun Anda."
- Isian memakai label kecil di atasnya (EMAIL, KATA SANDI) dengan ikon di dalam kolom.
- "Lupa kata sandi?" pindah ke baris sendiri di atas tombol Masuk.
- Tombol "Daftar akun baru" dan tautan "Tentang aplikasi" ditambahkan.

### Perbaikan: bar putih di bawah halaman login

Sebelumnya ada pita terang 60 piksel di bawah layar login sehingga wallpaper terlihat terpotong.
Ternyata bukan dari tema saja: window sudah edge-to-edge, tetapi `Scaffold` memotong area bar
sistem dari kontennya, sehingga latar `Scaffold` yang terang terlihat di bagian yang tidak
tertutup wallpaper.

Perbaikan:

- Layar penuh (pembuka, masuk, daftar, menunggu) tidak lagi dipotong padding `Scaffold`; layar
  itu mengatur insetnya sendiri.
- Bar sistem dibuat tembus pandang dari tema, bukan diwarnai palet.
- Atribut tema yang butuh API lebih baru dipisah ke `values-v27` dan `values-v29`, karena
  minSdk aplikasi 26. Tanpa pemisahan itu, perangkat Android 8.0 gagal memasang aplikasi ini.

## Verifikasi

- VersionName `1.10.16`, versionCode `35`.
- Unit test debug dan release lulus: 121 test per varian, 0 gagal (naik dari 115 karena test layar pembuka).
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator: layar pembuka tampil setelah data paket dibersihkan; tombol Lanjut berpindah
  halaman 1 ke 2 ke 3; tombol Masuk ke akun membuka halaman login; bar putih di bawah sudah
  hilang dan wallpaper mencapai tepi layar (diukur dari piksel: 60 piksel terbawah kini berwarna
  wallpaper, bukan `#F7F7F9`).

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.
- Nama Owner di data server masih "Tiftazani". Penggantian ditunda atas keputusan Owner.

Tidak ada kredensial, token, atau material signing di folder ini.
