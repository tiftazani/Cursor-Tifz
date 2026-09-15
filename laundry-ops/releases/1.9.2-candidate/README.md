# Cuciin 1.9.2 candidate

Build kandidat ini lulus 47 unit test pada debug dan rilis, lint debug/rilis tanpa error, verifikasi APK rilis, serta 20 test Worker pada 15 September 2026. Worker produksi versi `71310107-4ec5-48f8-aedb-481be9107649` aktif dengan database `ready`, dan migrasi `0004_operational_links.sql` sudah diterapkan ke D1 produksi.

- `cuciin-1.9.2-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.9.2-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.
- `cuciin-1.9.2-debug.apk`: APK debug terpisah untuk pengujian; jangan dipakai menyimpan data produksi.

Perubahan utama rilis ini adalah tema tampilan yang dapat dipilih setiap pengguna di Akun & profil: Ikut sistem, Terang, Gelap, dan Warna-warni. Pilihan disimpan di preferensi HP itu saja, tidak masuk snapshot maupun sinkronisasi, sehingga tiap perangkat bebas berbeda tampilan. Tema Terang memakai palet 1.9.1 yang sama, jadi tampilan lama tidak berubah bagi yang tidak mengganti tema.

Setiap tema memakai palet lengkapnya sendiri. Kontras teks dijaga minimal 4.5:1 dan batas kontrol minimal 3:1, dihitung memakai rumus kontras WCAG, bukan diperkirakan. Tema gelap memakai tombol biru terang dengan teks gelap mengikuti pola Material 3 dark, karena teks putih di atas biru terang hanya mencapai 3.42:1. Garis batas kontrol dipisahkan dari garis pemisah dekoratif supaya chip dan kolom isian tetap terlihat, dan status bar serta navigation bar mengikuti tema aktif termasuk warna ikonnya.

Tanda tangan rilis memakai sertifikat yang sama dengan kandidat sebelumnya: SHA-256 `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`. APK tetap non-debuggable, target SDK 36, izin hanya INTERNET, dan kompatibel dengan page size 16 KB.

Gunakan APK release untuk pilot. Ikuti `../../OPERATIONS_RUNBOOK.md` dan selesaikan tindakan Owner pada `../../android/RELEASE_READINESS.md` sebelum big-bang 20 cabang.
