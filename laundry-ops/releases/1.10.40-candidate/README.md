# Cuciin 1.10.40 (versionCode 59) — kandidat rilis

Tanggal build: 27 September 2026

## Isi rilis

Tiga perbaikan:

1. **Kasir multi-cabang bisa bekerja di semua cabangnya.** Laporan Owner: kasir yang ditugaskan ke
   lebih dari satu cabang hanya bisa beraktivitas di satu cabang.
2. **Foto absensi: cap waktu bisa digambar lagi.** Sebelumnya foto gagal diproses walaupun sudah
   terambil.
3. **Jam pulang absensi disimpan sebagai angka, bukan label jam** (perbaikan sisi server).

## 1. Kasir multi-cabang

### Akar masalah

Audit menyeluruh menemukan **satu syarat yang salah dipakai di lima layar**: pemilih cabang dikunci
di balik `canViewAllBranches(s)`, yang sebenarnya berarti izin `analytics.view` — "boleh melihat
laporan semua cabang". Preset **Kasir tidak memuat** izin itu, jadi kelima layar mengunci kasir
multi-cabang di cabang pertama (`session.branchId`).

| Layar | Gejala sebelum perbaikan |
| --- | --- |
| Antrian | Hanya satu baris statis "Cabang tugas Anda", tidak bisa berpindah |
| Service baru | Pemilih "Cabang transaksi" tidak muncul |
| Tutup kas | Pemilih cabang tidak muncul |
| Perubahan stok massal | Pemilih "Cabang yang diperbarui" tidak muncul |
| Laporan perubahan stok | Pemilih cabang tidak muncul |

### Perbaikan

Aturan dipindahkan ke fungsi murni baru `ui/BranchPicker.kt` (`visible`, `options`,
`writeTargets`) dan dipakai sebagai gerbang tunggal di semua layar. `writeTargets` juga menyaring
tujuan tulis massal dengan cabang penugasan.

**Lapisan store dan server sudah benar sejak awal** (tidak diubah): `visibleNotas`,
`visibleAttendance`, `saveNota`, `editStocks`, `closeCash`, `checkIn`/`checkOut` memakai seluruh
`allowedBranchIds`; `command-sync.ts` `staffJournalScopes` menulis satu entri jurnal per cabang;
`pullChanges` menyaring jurnal dengan `branch_id IN (cabang pengguna)`; `visibleSnapshot` di
`index.ts` memangkas seluruh `BRANCH_DATASETS` ke cabang penugasan sebelum dikirim ke perangkat.

### Bukti emulator (kasir 2 cabang: laupay-dayeuh + laupay-kirab)

| Titik uji | Hasil |
| --- | --- |
| Antrian | Sheet "Semua cabang saya · 2 cabang"; pilih Kirab → pindah |
| Service baru | Sheet "Pilih cabang transaksi" berisi 2 cabang |
| Tutup kas | Sheet berisi 2 cabang; pilih Kirab → piutang Rp 11.000 → Rp 0 |
| Perubahan stok massal | Sheet multi-pilih 2 cabang, keduanya bisa dicentang |
| Laporan perubahan stok | "2 cabang dipilih"; memuat entri Kirab DAN Dayeuh |
| Tulis nyata (stok) | Softener +5 di Kirab tersimpan di D1 `stock_moves` `branch_id='laupay-kirab'` |
| Absensi | Pemilih cabang berisi 2 cabang |

## 2. Foto absensi

`BitmapFactory.decodeFile(path)` mengembalikan bitmap yang tidak boleh diubah, sehingga
`Canvas(image)` melempar `IllegalStateException: Immutable bitmap passed to Canvas constructor`.
Akibatnya cap "ABSEN MASUK/PULANG" gagal digambar dan layar berbunyi "Foto belum dapat diproses.
Coba ambil kembali." padahal fotonya sudah terambil. Perbaikan: baca dengan
`BitmapFactory.Options().apply { inMutable = true }`.

Bukti emulator: foto absen masuk di Laupay Dayeuh tersimpan dengan cap
"ABSEN MASUK / Uji Dua Cabang / Laupay Dayeuh / 27 Sep 2026, 19.45 WIB" (dibaca ulang dari berkas
foto di perangkat).

## 3. Jam pulang absensi disimpan sebagai angka

Ditemukan saat audit lanjutan. Kolom `check_out_at` di tabel `attendance` bertipe INTEGER, tetapi
isinya teks siap tampil (`'27 Sep 2026, 19.58'`). Penyebabnya perangkat mengirim DUA bentuk jam
pulang sekaligus, `checkOutAt` (label) dan `checkOutAtMs` (angka), dan Worker memilih yang label
lebih dulu lewat `p.checkOutAt ?? p.checkOutAtMs`.

Terukur di D1 produksi: 1 baris berisi teks (`'27 Sep 2026, 14.48'`, cabang shelly). Akibatnya
aritmetika durasi di sisi mana pun yang membaca kolom itu rusak.

Perbaikan (sisi server, `cloudflare/src/command-sync.ts`): Worker hanya menerima angka; label dari
perangkat versi lama diabaikan alih-alih ditulis ke kolom angka.

Bukti emulator sesudah perbaikan ter-deploy: absen pulang Dayeuh tersimpan sebagai
`typeof(check_out_at) = 'integer'` (`1790514686732`), sementara baris lama yang ditulis sebelum
perbaikan masih `'text'`.

## Migrasi database

**D1 debug belum menjalankan migrasi `0009_attendance_per_branch.sql`**, sehingga absen di cabang
kedua ditolak batas unik `UNIQUE(staff_email, work_date)` versi lama dan **hilang tanpa pesan** di
layar. Ini ditemukan saat menguji dan sudah diperbaiki: migrasi diterapkan ke `cuciin-debug-db`.
D1 produksi sudah memakai skema yang benar (`UNIQUE (staff_email, work_date, branch_id)`), terbaca
dari `sqlite_master`.

Pelajaran yang dicatat: menguji absensi multi-cabang di D1 debug **wajib** memastikan migrasi 0009
sudah tercatat di `d1_migrations` lebih dulu.

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Tes unit Android (debug) | 336 lulus, 0 gagal |
| Tes unit Android (release) | 336 lulus, 0 gagal |
| Tes Worker (`npm run check`) | 84 lulus, 0 gagal (+2 baru) |
| lint | lulus, tanpa error |
| Tanda tangan rilis | PASS: v2, non-debuggable, target SDK 36, ZIP/ELF 16 KB |
| Sertifikat | `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee` (sama sejak 1.10.1) |
| Endpoint di APK rilis | Worker produksi (bukan debug) |
| Endpoint di APK debug | Worker debug |

Tes penjaga yang dibuktikan **merah lebih dulu**:

- `BranchPickerTest` — aturan pemilih cabang dikembalikan ke perilaku lama → merah.
- `AttendancePhotoStampTest` — `inMutable` dilepas → 1 dari 2 tes gagal.
- Dua tes Worker baru untuk jam pulang → `actual: 'text'`, `actual: '24 Sep 2026, 17.00'` saat
  perbaikan dilepas.

## Isi berkas

| Berkas | Ukuran | SHA-256 (awal) |
| --- | --- | --- |
| `cuciin-1.10.40-release.apk` | 6.074.495 B | `396d16af05e669c9…` |
| `cuciin-1.10.40-debug.apk` | 23.010.806 B | `0de81c5c47229d0b…` |
| `cuciin-1.10.40-release.aab` | 9.244.557 B | `a2a1f39f4351b8d7…` |

Hash lengkap ada di `SHA256SUMS`. APK dan AAB **tidak dilacak Git**; yang di-commit hanya README
ini dan `SHA256SUMS`.

## Belum terbukti

- **APK 1.10.40 belum dipasang di HP cabang mana pun.** Seluruh bukti perangkat diambil di
  `emulator-5554` dengan APK debug. APK rilis diverifikasi tanda tangannya, bukan dijalankan.
- **Absen pulang di dua cabang belum diuji dengan urutan terbalik** (Dayeuh dulu lalu Kirab).
  Yang terbukti: Kirab lengkap lebih dulu, lalu Dayeuh lengkap, dan absen pulang di satu cabang
  tidak menutup catatan cabang lain.
- **Absen multi-cabang belum pernah dicoba di HP sungguhan.** Perilaku kamera, izin foto, dan
  kualitas gambar di perangkat nyata berbeda dari emulator.
- **Sapu menu per peran belum diulang untuk 1.10.40.** Angka sapu terakhir (Owner 21/21, Kasir
  11/21, Supervisor 8/21) berasal dari 1.10.30.
- **Perbaikan `checkOutAt` hanya terbukti di D1 debug.** Data produksi yang sudah telanjur berisi
  teks (1 baris) **tidak dibersihkan** oleh rilis ini; baris itu akan diperbaiki sendiri saat
  karyawan tersebut absen pulang lagi, atau bisa dibersihkan manual bila Owner menghendaki.
- **Worker produksi belum di-deploy dengan perbaikan ini** saat README ini ditulis.
