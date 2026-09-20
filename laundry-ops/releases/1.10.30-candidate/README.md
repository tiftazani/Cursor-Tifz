# Cuciin 1.10.30 candidate

Build kandidat ini lulus 262 unit test pada debug dan rilis, lint tanpa error, verifikasi APK rilis (`verify_release.py`), serta 60 test Worker pada 20 September 2026. Worker debug aktif dengan versi `717ddfa4-2fe1-49c3-ab65-1c17e9733a5d`; Worker produksi masih menunggu perintah Owner.

- `cuciin-1.10.30-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.10.30-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.
- `cuciin-1.10.30-debug.apk`: APK debug terpisah untuk pengujian; jangan dipakai menyimpan data produksi.

Rilis ini memerinci katalog izin dari 12 modul / 17 fungsi menjadi 15 modul / 41 fungsi. Perincian itu memisahkan hak BACA dari TULIS, memisahkan UBAH dari HAPUS, dan memecah modul `owner` yang sebelumnya menaungi cabang, user, layanan, produk, jenis aset, dan template WA sekaligus. Yang sebelumnya dikunci nama peran (tab Service dan WA untuk Supervisor, koreksi Service untuk Kasir) kini menjadi centang yang dapat diatur Owner. Layar Kontrol Akses Role mendapat preset peran yang dapat diterapkan sekali tekan: Owner penuh, Supervisor, Kasir, Hanya lihat, dan Kosongkan. Sesudah preset diterapkan, centangnya tetap dapat diubah satu per satu.

Role yang sudah tersimpan di server masih memakai kunci katalog lama, dan APK 1.10.29 yang masih dipakai cabang hanya mengenal kunci lama, sehingga pembaruan ini menerjemahkan kunci lama saat dibaca dan menulis cermin kunci lama saat role disimpan. Dengan begitu tidak ada akses yang tercabut di perangkat yang diperbarui, dan perangkat yang belum diperbarui tetap melihat centangnya. Penambalan role bawaan hanya terjadi sekali per versi katalog, jadi centang yang sengaja dicabut Owner tidak hidup kembali.

Dua bug sisi server ikut diperbaiki. Pertama, `order.payment` disamakan dengan `service.correct`, sehingga akun yang diberi `service.payment` tanpa `service.correct` ditolak saat mencatat pembayaran. Kedua, absensi dan jenis aset dipetakan ke kunci yang tidak ada di katalog, dan command pelanggan hanya memeriksa modulnya.

Perbaikan tampilan: kartu role dan ringkasan di layar Kontrol Akses Role menghitung cermin kunci lama sebagai fungsi, sehingga role hasil preset "Hanya lihat" tampil 10 fungsi padahal presetnya 9. Sekarang angkanya dihitung sesudah kunci lama diterjemahkan.

Layar Riwayat versi juga dilengkapi: entri 1.10.28 dan 1.10.29 sebelumnya tidak pernah dibuat, sehingga riwayat melompat dari 1.10.30 ke 1.10.27.

Hasil sapu perangkat pada 1.10.30-debug: Owner 21 dari 21 menu, Kasir 11 dari 21, Supervisor 8 dari 21, tanpa satu pun `FATAL EXCEPTION` dari paket `com.cuciin.laundryops`. Dua "crash" yang tercatat di sapu Kasir berasal dari `UiAutomationService` milik alat uji, bukan dari aplikasi. Kasir dan Supervisor tidak mendapat pelebaran hak: jumlahnya sama dengan baseline 1.10.29.

Kompatibilitas mundur diuji langsung, bukan diklaim: role Supervisor disimpan ulang lewat UI 1.10.30 sehingga cermin `attendance.write` benar-benar tertulis di `cuciin-data.json`, lalu APK **1.10.29 dipasang di atasnya**. Supervisor di 1.10.29 tetap membuka **8 dari 21** menu, sama dengan di 1.10.30, tanpa crash.

Tanda tangan rilis memakai sertifikat yang sama dengan kandidat sebelumnya: SHA-256 `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`, jadi APK ini dapat menimpa pemasangan 1.10.29 yang sudah ada. APK tetap non-debuggable, target SDK 36, izin hanya INTERNET, dan kompatibel dengan page size 16 KB.

Gunakan APK release untuk pilot. Ikuti `../../OPERATIONS_RUNBOOK.md` dan selesaikan tindakan Owner pada `../../android/RELEASE_READINESS.md` sebelum big-bang 20 cabang.
