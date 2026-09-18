# Cuciin 1.10.24 (versionCode 43) - kandidat

Kandidat ini memperbaiki bug uang yang ditemukan saat mengaudit tally pembayaran, setelah Owner
bertanya apakah aplikasi sudah benar-benar bebas bug.

## Cara memasang

Pasang `cuciin-1.10.24-release.apk` untuk pemakaian cabang. Versi debug
(`cuciin-1.10.24-debug-test.apk`) hanya untuk pengujian dan bisa dipasang berdampingan karena
paketnya berbeda (`com.cuciin.laundryops.debug`, nama tampil "Cuciin Debug").

Memperbarui APK tidak menghapus data lokal: paketnya tidak berubah.

## Yang diperbaiki

### Uang yang diterima sebelum jurnal pembayaran ada hilang dari laporan kas

`paymentRecords()` membuang SELURUH `paid` sebuah nota begitu nota itu punya SATU entri jurnal.
Nota yang dibayar sebagian SEBELUM jurnal pembayaran ada, lalu dilunasi setelahnya, kehilangan
bagian lamanya dari laporan kas dan tutup kas.

Contoh nyata di data: nota `SHL-2609-0001-A34F8` (paid 30.000, tanpa entri jurnal) dilunasi dengan
45.000. Jurnalnya memuat 45.000, tetapi penerimaan yang dilaporkan hanya 45.000 padahal uang yang
diterima 75.000.

Perbaikan: penerimaan lama dihitung sebagai SELISIH antara `paid` nota dan jumlah jurnalnya.
Aturannya dipindah ke `data/PaymentTally.kt` supaya dapat diuji tanpa Android.

## Bukti

### Test

```text
testDebugUnitTest   : 184 test, 0 gagal, 0 error
testReleaseUnitTest : 184 test, 0 gagal, 0 error
```

Naik dari 178. `PaymentLedgerTallyTest` mengunci aturan perhitungannya, dan sudah dibuktikan
**GAGAL** saat aturan lama dikembalikan (2 test), lalu lulus setelah diperbaiki.

Catatan cara uji yang perlu dibaca siapa pun yang menyentuh berkas ini: versi pertama test itu
menyalin ulang logikanya di dalam test, sehingga tetap LULUS walaupun bug-nya dikembalikan. Test
seperti itu tidak mengunci apa pun. Aturannya harus hidup di fungsi murni di kode produksi, lalu
dipanggil dari test.

### Uji di perangkat dengan skenario yang benar

Dijalankan pada APK 1.10.24 yang versinya sudah dipastikan terpasang, di data lokal perangkat
dengan mode pesawat menyala supaya tidak naik ke D1:

```text
uang sebenarnya (sum paid) : 266.000
cara LAMA (bug)            : 236.000   -> hilang 30.000
cara BARU (perbaikan)      : 266.000   -> hilang 0
```

Catatan penting tentang cara menguji: uji pertama saya memakai nota yang jurnalnya sudah mencakup
seluruh `paid`, sehingga selisihnya nol dan kedua cara menghasilkan angka yang sama. Uji seperti
itu tidak membuktikan apa pun. Kondisi yang berbahaya adalah nota **tanpa** jurnal yang lalu
mendapat jurnal untuk pembayaran berikutnya, sehingga `paid` lebih besar dari jumlah jurnalnya.

### Verifikasi artefak

Tanda tangan rilis: v2, non-debuggable, target SDK sesuai, izin minimum, ZIP/ELF 16 KB.

## Checksum

```text
1353cbf98e4227d3c66e5a35d2cff829570468f5d48fdc1f110c95c2da74fc5a  cuciin-1.10.24-debug-test.apk
cf7ebfdb1e769816e1e20e1ffc3c1f0bb93a23ca013804227fa2fc2b5485a573  cuciin-1.10.24-release.apk
edc42d505587454e06d31fb2b3bb810cc6647e3286f9e29c2ffca5a7c83e75ee  cuciin-1.10.24-release.aab
```

## Catatan jujur

Bug ini ditemukan karena Owner bertanya "ini udah dicek end to end, dah bener2 bugs free? yakin?"
Saya menjawab tidak, lalu memeriksa lebih dalam dan menemukan bug uang ini. Pertanyaan itu yang
memicu pemeriksaan tally.

Satu keterbatasan yang tetap ada dan bukan bug: untuk nota yang dibayar sebelum jurnal pembayaran
ada, waktu penerimaannya diperkirakan dari waktu nota dibuat. Kalau ada nota yang dibuat 16 Sep
tapi baru dibayar 18 Sep, penerimaannya tercatat di tanggal 16 Sep. Setelah semua transaksi baru
punya entri jurnal, keterbatasan ini hilang sendiri.

Kegagalan lint yang muncul saat mengerjakan ini (`NoClassDefFoundError` pada
`WrongNavigateRouteDetector`) bukan masalah kode: itu crash di dalam detector lint
androidx.navigation sendiri dan hilang setelah `./gradlew --stop` lalu dijalankan ulang.
