# QA Cuciin 1.6.1 (9)

Diuji pada emulator Android API 35 dengan data lokal. Pengujian ini tidak mengirim WhatsApp ke penerima dan tidak memakai pembayaran nyata.

## Hasil

- `testDebugUnitTest`: 7 tes, 0 gagal. Cakupan mencakup login rilis, tanggal, status, tautan Maps, cabang pada nota WhatsApp, tanggal layanan, grafik, dan indikator operasional.
- `clean`, `assembleDebug`, `assembleRelease`, `bundleRelease`, dan `lintRelease` berhasil. Lint tidak memiliki error.
- APK rilis: versi 1.6.1 (9), tanda tangan yang diharapkan, non-debuggable, target 36, izin minimum, ZIP/ELF 16 KB. AAB valid menurut bundletool.
- Share `text/plain` Google Maps diterima oleh activity `singleTask`, kembali ke cabang yang sedang diedit, memperlihatkan URL, menyimpan URL otomatis, dan tidak diproses ulang setelah rotasi.
- Stok Cibaduyut dinaikkan dari 10 ke 15; stok Melati tetap 10. Riwayat dan waktu mutasi mengikuti cabang Cibaduyut.
- Grafik analytics menampilkan omzet dan kas masuk dari nota nyata pada kelompok waktu yang sesuai.
- Nota selesai yang belum lunas menolak serah-terima. Sesudah pelunasan, serah-terima dapat dicatat lengkap dengan waktu.
- Cabang transaksi pada nota Owner berubah dari Melati ke Cibaduyut dan langsung tercermin pada header. Formatter WhatsApp diuji memakai cabang nota, tanggal masuk, target keluar, selesai dikerjakan, dan tanggal keluar aktual.

## Bukti

- `analytics.png`
- `maps-share.png`
- `stok-cibaduyut.png`
- `serah-terima.png`
- XML hasil tes dan laporan lint HTML berada di folder ini.

Getaran fisik tetap perlu dirasakan pada perangkat nyata. Sinkronisasi live tidak dijalankan agar data produksi tidak berubah.
