# Kandidat Cuciin 1.10.26 (versionCode 45)

Dibangun 18 Sep 2026 dari branch `codex/cuciin-1-8-1`. Basis versi: 1.10.25 (versionCode 44).

## Isi folder

| Berkas | Ukuran | Untuk |
| --- | --- | --- |
| `cuciin-1.10.26-release.apk` | 6.045.279 bytes | Dibagikan ke cabang |
| `cuciin-1.10.26-debug-test.apk` | 22.961.690 bytes | Uji internal, label "Cuciin Debug" |
| `SHA256SUMS.txt` | 2 baris | Pemeriksa keutuhan berkas |

APK tidak di-commit ke Git (aturan `.gitignore` baris 37-38); hanya berkas ini dan
`SHA256SUMS.txt` yang masuk repo.

## Perbaikan di 1.10.26

### 1. Centang fungsi di Kontrol Akses Role tidak berpengaruh (bug nyata)

Layar Kontrol Akses Role menjanjikan "Fungsi tanpa centang berarti tidak diizinkan".
Dari 17 fungsi di `AccessCatalog`, hanya dua yang benar-benar diperiksa kode:
`analytics.view` dan `service.price`. Lima belas sisanya hanya menghiasi layar.

Alur picu yang terbukti di perangkat sebelum perbaikan:

1. Owner mencabut centang **Koreksi Service** pada sebuah role di Kontrol Akses Role.
2. Owner menetapkan role itu kepada seorang Kasir.
3. Kasir membuka nota, kartu **Koreksi Service** tetap tampil dan bisa menekan
   "Edit rincian Service" sampai menyimpan, walau centangnya sudah dicabut.

Sebabnya jalur uang itu dijaga peran lama (`role != Supervisor`), bukan fungsi katalog.

Sesudah perbaikan, jalur yang diperiksa fungsi:

| Fungsi | Menjaga |
| --- | --- |
| `service.correct` | koreksi rincian Service, hapus Service |
| `service.payment` | catat pelunasan |
| `expense.write` | tambah dan hapus biaya operasional |
| `attendance.write` | absen masuk dan keluar |
| `cash.close` | tutup kas |
| `customer.write` | hapus pelanggan |
| `owner.access` | ubah role pengguna |

Pesan penolakan menyebut fungsi yang dicabut, misalnya
"Akun ini tidak dapat mengoreksi Service tersebut (service.correct)".

### 2. Layar Tutup kas buntu saat melihat semua cabang

Layar Tutup kas meminta "Pilih satu cabang" tanpa menyediakan pemilih cabang.
`viewBranch` hanya di-set dari filter tab Antrian dan kembali ke "semua cabang" setiap
aplikasi dibuka ulang, jadi Owner tidak punya cara memenuhi permintaan layarnya sendiri.
Kini layar Tutup kas punya pemilih cabang sendiri.

## Hasil uji di perangkat (emulator-5554, 1080x2400, density 420)

### Pemilih cabang Tutup kas — 8 dari 8 OK, 0 gagal, CRASH 0

Skrip `/tmp/uji_kaskas4.py`:

| Pemeriksaan | Hasil |
| --- | --- |
| `app.terbuka` | 27 elemen teks |
| `modul.terbuka` | 34 teks |
| `kaskas.terbuka` | diminta pilih cabang, 13 teks |
| `kaskas.pemilih` | baris "Cabang / Belum dipilih" clickable di (540,276) |
| `kaskas.sheet` | sheet "Pilih cabang" terbuka, 5 cabang |
| `kaskas.terisi` | pilih Bunayya, header jadi "Cuciin · Bunayya" |
| `kaskas.tombol` | "Tutup kas hari ini" di (540,820) |
| `crash` | 0 fatal |

### Izin fungsi — Kasir tidak lagi bisa koreksi Service

Skrip `/tmp/uji_izin5.py`, akun Kasir `deccintaaulia180@gmail.com`:

| Pemeriksaan | Hasil |
| --- | --- |
| `keluar` | kembali ke layar masuk |
| `kasir.login` | beranda Kasir terbuka |
| `nota.terbuka` | detail `LPD-2609-0001-E4AF2` terbuka, 28 teks |
| `koreksi.tersembunyi` | kartu "Koreksi Service" **TIDAK ADA** |
| `hapus.tersembunyi` | tombol Hapus **TIDAK ADA** |
| `pelunasan.tetap` | "Catat pelunasan" tetap ada (Kasir memang punya `service.payment`) |
| `crash` | 0 fatal |

Catatan: role Kasir di perangkat memang tidak memuat `service.correct`
(`accessRoles` → `role-kasir`), jadi kartu itu seharusnya memang hilang. Sebelum perbaikan
kartu tetap tampil karena dijaga peran lama.

### Owner tidak ikut terkunci

Skrip `/tmp/uji_izin5b.py`, akun Owner `tiftazani.khara@gmail.com`:

| Pemeriksaan | Hasil |
| --- | --- |
| `owner.login` | beranda Owner terbuka |
| `nota.terbuka` | `LPK-2609-0002-10689` terbuka |
| `owner.koreksi` | kartu "Koreksi Service" **tetap tampil** di (173,2205) |
| editor | "Edit rincian Service" di (540,1720) membuka layar Koreksi Service penuh |
| editor | "Hapus Service" tetap tersedia untuk Owner |
| `crash` | 0 fatal |

### Data tidak berubah oleh pengujian

| Entitas | Sebelum | Sesudah |
| --- | --- | --- |
| notas | 7 | 7 |
| payments | 3 | 3 |
| expenses | 0 | 0 |
| cashCloses | 1 | 1 |
| staff | 9 | 9 |
| audit | 112 | 112 |
| stockMoves | 29 | 29 |

Tally: `omzet 277.000 = paid 221.000 + piutang 56.000` (cocok, sebelum dan sesudah).

## Gate

| Gate | Hasil |
| --- | --- |
| Test Android debug | **200 lulus, 0 gagal** (naik dari 191) |
| Test Android release | **200 lulus, 0 gagal** |
| lintDebug | lulus |
| Test Worker | **53 lulus, 0 gagal** |
| Tanda tangan rilis | v2/v3 valid, `CN=Tiftazani Khara, OU=Cuciin` |

## Pengunci regresi

`AccessFunctionEnforcementTest` memeriksa dua hal:

1. Setiap fungsi di `AccessCatalog` punya pemeriksa di kode utama.
2. Setiap titik penjagaan yang sudah ada tetap ada, dengan jumlah yang diharapkan.
   Jumlah diperiksa, bukan sekadar keberadaan teks, karena koreksi dan hapus memakai fungsi
   yang sama dan satu di antaranya pernah lolos.

Test ini terbukti gagal ketika tiga penjagaan berbeda dikembalikan ke bug-nya, satu per satu:
`service.correct` (koreksi), `service.payment` (pelunasan), dan `cash.close` (tutup kas).

## Yang belum dikerjakan

- Worker **produksi** belum di-deploy dengan perbaikan antrean sinkronisasi (bug A/B/C/D dari
  1.10.25). Worker debug sudah.
- Perbaikan 1.10.26 hanya di Android; tidak ada perubahan Worker.
- Belum ada instrumented test (`androidTest`); verifikasi UI masih titik-sampel lewat adb.
- CRUD user dan registrasi dari UI belum diuji.
- `0008_owner_name_neutral.sql` belum tercatat di `d1_migrations` D1 debug (efeknya sudah
  diterapkan manual lewat jurnal 663-667; migrasi idempoten).
