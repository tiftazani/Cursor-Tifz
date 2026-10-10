# Cuciin 1.10.46 · build 65

Kandidat lokal, 9 Oktober 2026. Belum commit/push atau deploy baru. Worker tidak berubah.

## Perbaikan

Login lokal dan Firebase tidak lagi ditolak karena outbox. Pengiriman antrean tetap memeriksa pemilik dan akun Firebase. Unknown/foreign pending tidak dihapus atau diadopsi oleh akun berikutnya. Edit bisnis ditahan bila antrean berasal dari akun lain/tidak diketahui.

Migrasi legacy satu kali memakai bukti sesi tersimpan sebelum restore/persist. Startup memuat jenis aset dan memakai snapshot bisnis tersimpan untuk pemulihan command, bukan perubahan normalisasi tanpa aktor. Respons pull/bootstrap/recovery/legacy dari sesi lama diabaikan setelah login/logout/ganti akun. Hapus akun sendiri tidak melaporkan sukses lokal pada server yang mewajibkan Owner.

## Bukti

- Android: 418 tes debug dan 418 tes release, 0 failures/errors/skipped. Tes dijalankan ulang dengan cleanTest.
- Lint: 0 error dan 20 warning per varian.
- Worker: npm run check, 120/120 lulus. Tidak ada perubahan Worker.
- Build debug/release/AAB selesai; endpoint semua dex diperiksa jalur build resmi.
- verify_release.py PASS: signature v2, non-debuggable, target 36, ZIP/ELF 16 KB.
- Sertifikat SHA256: 3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee.
- Emulator API35 offline: install 1.10.45 lalu update -r ke 1.10.46 berhasil tanpa uninstall. Versi 1.10.46 tampil di login dan tetap tampil setelah force-stop/restart. Debug fresh install/onboarding terbuka. Hash APK terpasang sama dengan hasil build, kedua varian. Buffer crash kosong.
- Log merah login dan edit tersimpan bersama bukti gate/build/XML layar.

## Belum terbukti

Login Firebase nyata pada HP Owner pelapor, respons jaringan tertunda nyata saat ganti akun, dua perangkat nyata, dan semua menu setelah login belum diuji. Uji epoch/session adalah JVM ditambah cek titik guard pada source, bukan integrasi Firebase nyata. Upgrade emulator hanya memakai state seed, bukan antrean bisnis HP pelapor.

Jika origin lama sudah hilang di 1.10.45, antrean tetap unknown dan pengiriman/edit tertahan. APK ini tidak menebak asal dan tidak menghapus antrean. Perlu diagnosis aman perangkat untuk pemulihan asal itu.

Pasang APK release sebagai update. Jangan uninstall atau hapus data.
