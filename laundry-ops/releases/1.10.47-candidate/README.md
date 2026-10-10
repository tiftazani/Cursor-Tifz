# Cuciin 1.10.47 / build 66, kandidat hotfix

Dibangun 10 Oktober 2026 dari working tree lokal. Belum commit, push, atau deploy.

Bukti: 475 tes debug + 475 release lulus, 0 failure/error/skipped. Lint 0 error/15 warning per varian. `verify_release.py` PASS dengan sertifikat `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`. APK release memuat endpoint produksi; APK debug memuat endpoint debug.

Emulator API 35 offline: kedua APK terpasang dengan `install -r`, dibuka dua kali, MainActivity resumed, crash buffer kosong. Hash APK release terpasang sama dengan SHA256SUMS. Data aplikasi tidak dicopot atau dihapus.

Batas: belum diuji di HP Owner/Widad/cabang, Firebase login nyata, upgrade dari HP lama dengan data asli, dan jaringan tertunda. Instalasi lama tanpa penanda server dapat tertahan saat startup; data tidak dihapus. Prepared legacy tanpa asal dapat menahan sinkronisasi. Uji gagal tulis uang/stok belum selesai. Worker lokal/migrasi 0010 belum dideploy.

Log build: `~/.hermes/cache/scratch/cuciin147-candidate-build.log`.
