# Cuciin 1.10.48 / build 67, kandidat hotfix

Dibangun 10 Oktober 2026 dari working tree lokal. Belum commit, push, atau deploy. Menggantikan kandidat 1.10.47 (build 66), yang belum memuat perbaikan di bawah.

Tambahan dibanding 1.10.47: pesan gagal simpan untuk stok, biaya, produk baru, aset baru, tutup kas, dan role baru memakai `storageError`; produk, saldo stok, dan nota disalin saat dimuat agar memori tidak mengubah snapshot sumber; role baru langsung disimpan.

Bukti: clean build 479 tes debug + 479 release lulus, 0 failure/error/skipped. Lint 0 error/15 warning per varian. `verify_release.py` PASS dengan sertifikat `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`. APK release memuat endpoint produksi; APK debug memuat endpoint debug. Worker lokal `npm run check` 143/143.

Emulator API 35 offline (wifi/data mati, mode pesawat): upgrade `install -r` dari 1.10.47 ke 1.10.48 tanpa mencopot data, dibuka dua kali, proses hidup, crash buffer kosong, 0 FATAL. Hash APK release terpasang sama dengan SHA256SUMS. Debug 1.10.48 juga dibuka dua kali tanpa crash.

Batas: belum diuji di HP Owner/Widad/cabang, login Firebase nyata, upgrade dari HP lama dengan data asli, jaringan tertunda, dan Compose runtime untuk alur gagal simpan. Prepared legacy tanpa asal dapat menahan sinkronisasi. Worker lokal/migrasi 0010 belum dideploy. Uji di satu HP Owner dulu; jangan disebar ke cabang.

Log: `~/.hermes/cache/scratch/cuciin152-build.log`, `cuciin152-emu.log`.
