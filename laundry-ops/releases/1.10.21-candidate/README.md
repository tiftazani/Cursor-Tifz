# Cuciin 1.10.21 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.21-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.21-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.21-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.21

### Nuansa biru Cuciin

Palet Light dan Dark diganti mengikuti warna logo dan gambar layar pembuka: biru `#0048B4`
dipadukan biru langit `#D8E4F0`.

| Bagian | Light | Dark |
|---|---|---|
| Latar | `#F4F8FD` biru langit | `#0A1220` navy tua |
| Kartu | `#FFFFFF` | `#121C2E` |
| Aksen | `#0048B4` biru Cuciin | `#7FB4FF` biru langit |
| Header | `#00306E` biru tua | `#0E1B2E` |
| Teks | `#0B1A2E` | `#EAF2FC` |

Kuning `#F7CA3A` dipertahankan sebagai aksen menu aktif: di logo pun kuning hadir (gantungan
baju), dan tanpa warna itu menu aktif tidak menonjol di antara semua biru.

Semua pasangan warna diuji WCAG AA: **28 dari 28 lulus** di kedua tema.

Warna navy lama yang masih dipaku di `GlassCard` dan `OnboardingScreen` ikut disesuaikan, dan
deskripsi tema di layar Theme Aplikasi diperbarui supaya tidak lagi menyebut pink dan hitam.

### Preset tema Custom

Tema Custom kini punya tiga preset siap pakai. Tiap preset menampilkan rangkaian warnanya
sebagai titik, jadi pengguna melihat kombinasinya sebelum memilih.

| Preset | Isi |
|---|---|
| Biru Cuciin | Sejalan dengan tema Light. Ini nilai bawaannya. |
| Biru Cuciin Gelap | Sejalan dengan tema Dark. |
| Magenta Jemur | Warna lama, disimpan bagi yang menyukainya. |

### Harga Service hanya untuk Owner

- Fungsi baru `service.price` di katalog akses, ditandai bawaan khusus Owner.
- Role bawaan Kasir dan Supervisor tidak memuat fungsi itu.
- Ditegakkan berlapis: tombolnya disembunyikan, **dan** store menolak perubahannya. Jalur
  koreksi Service juga dijaga, supaya kasir tidak bisa mengubah harga lewat koreksi nota.
- Owner tetap boleh memberikan fungsi ini ke role lain lewat Kontrol Akses Role.
- `ensureAccessRoles` sekarang menambal role bawaan yang tersimpan dengan fungsi bawaan baru,
  karena isinya dibekukan saat pertama dibuat dan fungsi baru tidak akan pernah masuk tanpa itu.

## Verifikasi

- VersionName `1.10.21`, versionCode `40`.
- Unit test debug dan release lulus: 147 test per varian, 0 gagal.
- Lint debug dan release lulus.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Nama aplikasi dibaca balik dari APK: debug `Cuciin Debug`, rilis `Cuciin`.

### Bukti di emulator, diukur per piksel

| Tema | Warna dominan yang terukur |
|---|---|
| Light | latar `#F4F8FD`, aksen `#0048B4`, header `#00306E` |
| Dark | latar `#0A1220`, kartu `#121C2E`, aksen `#7FB4FF` |
| Custom + preset Biru Cuciin Gelap | sama persis dengan tema Dark |

Preset terbaca di layar: "Biru Cuciin" ditandai "Dipakai", dan berpindah ke "Biru Cuciin Gelap"
mengubah latar menjadi navy tua.

Izin harga diuji dengan dua akun sungguhan:

| | Owner | Kasir |
|---|---|---|
| Tombol "Ubah harga" | muncul | tidak muncul |
| Tambah / hapus layanan | boleh | boleh |

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.

Tidak ada kredensial, token, atau material signing di folder ini.
