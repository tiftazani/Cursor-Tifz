# Cuciin 1.9.0 candidate

Build kandidat final ini lulus 41 unit test pada debug dan rilis, lint debug/rilis, verifikasi APK rilis, serta 20 test Worker pada 15 September 2026. Migrasi command sync sudah diterapkan dan Worker produksi versi `a72444e2-65ce-4447-9193-2853d5656280` aktif dengan status database `ready`.

- `cuciin-1.9.0-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.9.0-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.
- `cuciin-1.9.0-debug.apk`: APK debug terpisah untuk pengujian; jangan dipakai menyimpan data produksi.

Rilis ini mengganti penulisan snapshot global dengan persistent outbox, command idempoten, dan delta per revision. Pending-remote marker melindungi penerapan delta saat aplikasi berhenti mendadak; perubahan scope cabang memicu bootstrap ulang. D1 menangani koreksi Service, penghapusan beserta kompensasi stok, dan stok retail secara atomik untuk mencegah overwrite antardevice. Komisi diverifikasi dari katalog server dan tutup kas tidak dapat ditimpa. Penerapan snapshot cloud tidak lagi menahan thread tampilan. Akses delta staf/cabang dan absensi diperketat, sedangkan backup produksi tidak disimpan di repository publik.

Gunakan APK release untuk pilot. Ikuti `../../OPERATIONS_RUNBOOK.md` dan selesaikan tindakan Owner pada `../../android/RELEASE_READINESS.md` sebelum big-bang 20 cabang.
