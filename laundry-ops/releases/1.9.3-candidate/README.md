# Cuciin 1.9.3 candidate

Build kandidat ini lulus 47 unit test pada debug dan rilis, lint debug/rilis tanpa error, verifikasi APK rilis, serta 29 test Worker pada 15 September 2026. Worker produksi versi `71310107-4ec5-48f8-aedb-481be9107649` aktif dengan database `ready`.

- `cuciin-1.9.3-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.9.3-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.
- `cuciin-1.9.3-debug.apk`: APK debug terpisah untuk pengujian; jangan dipakai menyimpan data produksi.

Rilis ini memperbaiki alur pemulihan kata sandi setelah laporan Owner: tautan reset dari email sempat menampilkan "The selected page mode is invalid." Halaman reset Firebase sekarang memakai domain `cuciin-ops-tiftazani.web.app`, bukan `firebaseapp.com`, dan tampil berbahasa Indonesia karena locale project diubah ke `id`. Email reset mengikuti locale yang sama, sehingga teksnya berbahasa Indonesia.

Pesan di dialog reset juga diperjelas: pengguna diberi tahu bahwa tautan harus dibuka dari email yang sama, dan diberi langkah bila alamatnya terpotong oleh aplikasi email atau pemindai tautan. Tautan reset wajib membawa `mode`, `oobCode`, `apiKey`, dan `lang`; bila salah satu hilang, Firebase berhenti sebelum memproses kode.

Isi template email masih bawaan Firebase. Per 15 September 2026, API dan Console menolak perubahan isi template dengan `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, jadi subjek dan isi hanya dapat mengikuti locale project. Rinciannya ada di `../../firebase/README.md`.

Tanda tangan rilis memakai sertifikat yang sama dengan kandidat sebelumnya: SHA-256 `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`. APK tetap non-debuggable, target SDK 36, izin hanya INTERNET, dan kompatibel dengan page size 16 KB.

Gunakan APK release untuk pilot. Ikuti `../../OPERATIONS_RUNBOOK.md` dan selesaikan tindakan Owner pada `../../android/RELEASE_READINESS.md` sebelum big-bang 20 cabang.
