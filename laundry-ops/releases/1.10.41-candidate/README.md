# Cuciin 1.10.41 (versionCode 60) — kandidat rilis

Tanggal build: 29 September 2026

## Isi rilis

Satu perbaikan kelas besar: **absensi harian — jam dan foto yang sudah tercatat tidak boleh tertimpa.**

Aturan pemilik (29 Sep): absen pagi dan sore adalah **satu catatan harian** per karyawan per cabang;
datanya masuk ke **data sekarang dan historis**; **tidak boleh ada yang menimpa**; absen **hari ini**
menampilkan foto dan data hari ini; **foto dan data kemarin/historis disimpan**.

## Bug yang ditemukan

**Merge dan bootstrap bisa MENGOSONGKAN jam pulang yang sudah tercatat.** Karyawan absen pulang,
lalu jam pulangnya hilang sendiri setelah sinkronisasi atau buka ulang aplikasi. Titik bocornya ada
di empat tempat, bukan di UI:

| Titik | Berkas | Sebelum | Sesudah |
| --- | --- | --- | --- |
| Merge perubahan masuk (Android) | `data/SyncProtocol.kt` `apply()` | Baris lama dibuang lalu diganti kiriman; jam pulang hilang bila kiriman tidak membawanya | Baris lama dipakai sebagai dasar, `gabungAbsensi(lama, baru)`; jam yang sudah tercatat tidak pernah ditimpa |
| Materialisasi jurnal (Worker) | `src/index.ts` `applyJournalToSnapshot` | Kiriman tanpa jam pulang mengosongkan jam pulang di snapshot | Sama: `gabungAbsensi` + baris kembar dibuang lewat identitas |
| SQL upsert (Worker) | `src/command-sync.ts`, `src/index.ts` `projectSnapshot` | `check_out_at=excluded.check_out_at` | `check_in_at=attendance.check_in_at`, `check_out_at=COALESCE(attendance.check_out_at,excluded.check_out_at)`, note lama dipertahankan bila baru kosong; berlaku juga untuk `ON CONFLICT(staff_email,work_date,branch_id)` |
| Jurnal (Worker) | `src/command-sync.ts` `planGeneric` | Jurnal mencatat nilai MENTAH kiriman, sehingga perangkat lain menerima cerita yang salah | Jurnal mencatat nilai HASIL GABUNGAN (`gabungAbsensiTersimpan`) |

**Identitas absensi = (staffEmail lowercase, workDate, branchId), bukan `id`.** Perangkat lama
(1.10.37 ke bawah) memakai id acak, perangkat baru deterministik. Tanpa identitas, satu catatan yang
sama bisa menjadi dua baris, atau kehilangan jam pulang saat skema id-nya berbeda.

**Foto historis.** Foto absensi hanya ada di perangkat pencatat; server tidak menyimpannya.
Pencariannya kini lewat `id` dulu, lalu fallback ke identitas (`AttendanceScope.localPhotos`).
`LocalJson.kt` menghapus folder `attendance/` hanya saat endpoint cloud berubah (isolasi
debug/release) — itu memang tujuannya, bukan kehilangan data harian.

## Bukti emulator (emulator-5554, 29 Sep 11.15 WIB, akun `ujibranch.hermes@gmail.com`)

| Titik uji | Hasil |
| --- | --- |
| Absen masuk + pulang Laupay Dayeuh | **Satu baris** `2026-09-29 laupay-dayeuh`, jam masuk 11.15, jam pulang 11.15 |
| Foto | Dua foto tersimpan dan tampil (masuk + pulang) |
| Buka ulang aplikasi (`am force-stop` lalu start) | Baris hari itu tetap utuh dengan fotonya |
| Baris lama 27 Sep (Dayeuh + Kirab) | Tetap utuh, tidak tertimpa, foto tetap ada |
| D1 debug | `typeof(check_in_at)=integer`, `typeof(check_out_at)=integer` |
| Jurnal | seq 1085 = jam masuk saja; seq 1087 = sudah lengkap (nilai gabungan, bukan nilai mentah) |
| Berkas foto di perangkat | 8 berkas: 5 foto 27 Sep + 1 masuk + 1 pulang 29 Sep + 1 lain |
| Antrean sinkronisasi | `pending` 0, `rejected` 0, revision 1084 → 1088 |

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Tes unit Android (debug) | 343 lulus, 0 gagal |
| Tes unit Android (release) | 343 lulus, 0 gagal |
| Tes Worker (`npm run check`) | 88 lulus, 0 gagal |
| lint | lulus, 0 error (18 warning) |
| Tanda tangan rilis | PASS: v2, non-debuggable, target SDK 36, ZIP/ELF 16 KB |
| Sertifikat | `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee` (sama sejak 1.10.1) |
| Endpoint di APK rilis | Worker produksi |
| Endpoint di APK debug | Worker debug |
| Penanda kode absensi di APK | debug 12, rilis 3 (tergantikan optimasi R8) |

Tes penjaga yang dibuktikan **merah lebih dulu** (6 tes, gagal saat tambalan dilepas):

- Android `AttendanceTidakTertimpaTest` — 2 tes gagal (`AssertionError` baris 39 & 60).
- Android `AttendanceMultiBranchTest` — 1 tes foto gagal saat fallback identitas dilepas.
- Worker `command-sync.test.mjs` — tes jurnal gagal saat `gabungAbsensiTersimpan` dilepas.
- Worker `attendance-journal-dedupe.test.mjs` — tes penghapusan baris kembaran gagal saat pencocokan identitas dilepas.

## Isi berkas

| Berkas | Ukuran | SHA-256 |
| --- | --- | --- |
| `cuciin-1.10.41-release.apk` | 6.090.879 B | `aeddcb9298149769c748011c833eb23169e4116a13fadb12bc196443fb0fa1ee` |
| `cuciin-1.10.41-debug.apk` | 23.027.190 B | `4b5e5e902131fbbee5584b90a1f428620ff16e357a8ecf3cd85b1e6494fc8394` |
| `cuciin-1.10.41-release.aab` | 9.246.646 B | `642d041ed95ec2721f03b890450674e288e9e508aa6d07b193675d4399fc0e16` |

Hash lengkap ada di `SHA256SUMS`. APK dan AAB **tidak dilacak Git**; yang di-commit hanya README
ini dan `SHA256SUMS`.

## Belum terbukti

- **APK 1.10.41 belum dipasang di HP cabang mana pun.** Seluruh bukti perangkat diambil di
  `emulator-5554` dengan APK debug. APK rilis diverifikasi tanda tangannya, bukan dijalankan.
- **Absen nyata pagi + sore dengan kamera HP asli belum pernah dicoba.** Perilaku kamera, izin
  foto, dan kualitas gambar di perangkat nyata berbeda dari emulator.
- **Baris teks `check_out_at` 27 Sep di D1 produksi (`salsabilayumna2006@gmail.com`) belum
  dibersihkan.** Rilis ini tidak menyentuh baris lama; pembersihan menyentuh data produksi
  sehingga menunggu keputusan Owner.
- **Sapu menu per peran belum diulang untuk 1.10.41.** Angka sapu terakhir (Owner 21/21, Kasir
  11/21, Supervisor 8/21) berasal dari 1.10.30.
- **UAT fisik belum dijalankan** (offline/retry, WhatsApp, PDF, printer, 4 tema).
