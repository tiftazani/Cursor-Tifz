# Cuciin 1.10.13 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.13-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.13-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.13-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.13

### Perbaikan: layar login terpotong saat keyboard muncul

Saat pengguna mengetuk kolom email atau kata sandi, keyboard Android muncul dan bagian bawah kartu login terpotong: tulisan "Lupa kata sandi?" hanya terlihat separuh dan tombol "Daftar akun" tidak terjangkau sama sekali.

Penyebabnya: layar login dirancang muat dalam satu layar **tanpa gulir sama sekali**. Rancangan itu benar selama ruang tetap penuh, tetapi saat keyboard terbuka ruang tersisa menyusut 300 sampai 400dp dan isi tidak lagi muat. Karena tidak ada gulir, bagian yang tidak muat langsung terpotong tanpa cara menjangkaunya.

Perbaikan:

- Saat ruang sempit, isi dipadatkan (logo mengecil, jarak dirapatkan) dan layar boleh digulir. Tidak ada lagi bagian yang tidak terjangkau.
- Saat keyboard muncul, layar menggulir otomatis secukupnya supaya kartu isian, tombol Masuk, dan tulisan Lupa kata sandi terlihat penuh. Yang digulir adalah kartu login, bukan ke dasar layar, karena bagian yang sedang diisi justru ada di kartu itu.
- Saat keyboard tertutup pada layar normal, tampilan tetap satu layar penuh tanpa gulir seperti desain aslinya.

Aturan tata letaknya hidup di `ui/LoginLayout.kt` supaya dapat diperiksa tanpa menjalankan Android, dan dikunci oleh `LoginLayoutTest.kt`.

## Verifikasi

- VersionName `1.10.13`, versionCode `32`.
- Unit test debug dan release lulus: 109 test per varian, 0 gagal (naik dari 104 karena test tata letak login).
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator pada lima tinggi ruang (2400 sampai 1100 piksel): pada semua keadaan sempit, tulisan "Lupa kata sandi?", tombol "Daftar akun", dan tombol Masuk dapat dijangkau lewat gulir. Sebelum perbaikan, pada tinggi 1150 tulisan "Lupa kata sandi?" hilang sepenuhnya dan pada tinggi 1350 tombol "Daftar akun" hilang.
- Pada tinggi penuh, keempat elemen terlihat tanpa perlu menggulir.

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.
- Nama Owner di data server masih "Tiftazani". Penggantian ditunda atas keputusan Owner.

Tidak ada kredensial, token, atau material signing di folder ini.
