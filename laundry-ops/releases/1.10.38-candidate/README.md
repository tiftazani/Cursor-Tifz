# Cuciin 1.10.38 (versionCode 57) — kandidat rilis

Tanggal build: 24 September 2026

## Isi rilis

Perbaikan bug absensi multi-cabang: kasir yang ditugaskan ke lebih dari satu cabang kini bisa
absen di **setiap** cabang penugasannya, satu catatan per cabang per hari.

Laporan awal dari lapangan: Aida (`aidanurita25@gmail.com`) terdaftar di dua cabang, tetapi di
layar Absensi hanya muncul satu cabang (Bunayya) dan absen di cabang kedua selalu ditolak.
Pemeriksaan D1 produksi menunjukkan empat kasir terdampak, bukan hanya Aida:

| Kasir | Cabang penugasan |
| --- | --- |
| Aida (`aidanurita25@gmail.com`) | laupay-kirab, bunayya |
| alfin (`alfinhumendru@gmail.com`) | laupay-dayeuh, laupay-kirab, bunayya |
| febri (`febriansyah.atmaja98@gmail.com`) | laupay-kirab, shelly |
| ihsan (`ihsanibnuabdurrauf@gmail.com`) | bunayya, laupay-dayeuh, laupay-kirab, shelly |

## Akar masalah

Ada di aplikasi, bukan di data. `Session` hanya menyimpan satu `branchId`, yaitu cabang pertama dari
daftar penugasan. Seluruh layar menyaring dengan `it.id == session.branchId`, sehingga cabang kedua
tidak pernah tampil. `checkOut` juga menutup baris pertama hari itu tanpa melihat cabang, sehingga
absen pulang di cabang kedua justru menutup catatan cabang pertama.

Satu lubang tambahan ditemukan saat perbaikan: sesi yang sudah login tidak pernah disegarkan saat
daftar cabang berubah di server. Aida ditambahkan Owner ke cabang kedua 24 Sep 13:19 WIB, tetapi
sesi yang sudah terbuka tetap memegang satu cabang sampai aplikasi dimulai ulang.

## Perubahan

Aplikasi:

- `Session` menyimpan seluruh `branchIds` penugasan; `allowedBranchIds` jadi sumber tunggal bagi
  seluruh layar.
- `AttendanceScope` (baru): aturan absensi murni yang bisa diuji. Id baris deterministik per
  (cabang, tanggal, karyawan) supaya dua perangkat tidak membuat baris kembar.
- `SessionScope` (baru): penyegaran sesi saat daftar cabang dari server berubah, tanpa perlu logout.
- `AttendanceScreen`: pemilih cabang memakai seluruh cabang penugasan, plus ringkasan "sudah absen
  hari ini di cabang lain" supaya catatan sebelumnya tidak tampak hilang.
- `checkIn`/`checkOut`/`todayAttendance` menerima cabang eksplisit.
- Layar lain yang ikut terkurung satu cabang: Nota, Biaya, Aset, Kas, Persediaan, Riwayat mutasi stok.

Server:

- Migrasi `0009_attendance_per_branch.sql`: kunci `UNIQUE(staff_email, work_date)` menjadi
  `UNIQUE(staff_email, work_date, branch_id)`.
- Penulisan absensi menjaga dua kunci sekaligus (`id` dan tuple staff/tanggal/cabang) agar perangkat
  versi lama yang masih mengirim id acak tetap diterima, bukan ditolak 409 lalu antreannya macet.

## Bukti

Tes Android: 313 lulus, 0 gagal, di varian debug dan release.

Tes penjaga yang dibuktikan merah sebelum perbaikan:

- `AttendanceMultiBranchTest` — 6 tes gagal saat aturan lama dipasang kembali.
- `SessionBranchRefreshTest` — 4 tes gagal saat penyegaran sesi dimatikan.
- `AttendanceSnapshotMergeTest` — mengunci agar perubahan satu cabang tidak menghapus absensi cabang lain.
- `cloudflare/tests/command-sync.test.mjs` — "absensi satu karyawan dicatat per cabang, bukan satu per
  hari"; merah saat migrasi 0009 dikeluarkan dari daftar migrasi harness.

Tes Worker: 74 lulus, 0 gagal.

Migrasi diterapkan ke D1 produksi `cuciin-db`; kunci `UNIQUE (staff_email, work_date, branch_id)`
diverifikasi langsung pada `sqlite_master`. Tabel `attendance` produksi berisi 0 baris saat migrasi
dijalankan, jadi tidak ada data yang tersentuh.

Worker ter-deploy: versi `888c2844-0327-400e-8e66-98d5134d5f26`, `/health` menjawab 200.

## Artefak

| Berkas | Ukuran | SHA-256 |
| --- | --- | --- |
| `cuciin-1.10.38-release.apk` | 6.061.655 B | `4e143e86821368383e89e0c81de415832c7d8f0fcfbe9e08d364eff60ecdce59` |
| `cuciin-1.10.38-debug.apk` | 23.373.651 B | lihat `SHA256SUMS` |
| `cuciin-1.10.38-release.aab` | 9.229.590 B | lihat `SHA256SUMS` |

APK rilis lulus `verify_release.py`: tanda tangan v2, non-debuggable, target SDK 36.

## Belum terbukti

- Absen nyata di dua cabang oleh kasir asli di HP cabang. Verifikasi di emulator tertahan di layar
  login; sandi tidak dipakai dari chat. Yang terbukti sejauh ini adalah aturan dan jalur datanya,
  bukan pengalaman pengguna di perangkat cabang.
- Migrasi 0009 pada perangkat versi lama yang masih mengirim id absensi acak: jalur kompatibilitasnya
  diuji di harness Worker, belum diuji dengan perangkat 1.10.37 asli.
