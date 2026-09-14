# Cuciin 1.9.0 candidate

Build kandidat ini lulus 22 unit test, lint debug/rilis, verifikasi APK rilis, dan pemeriksaan Worker pada 14 September 2026. Migrasi command sync sudah diterapkan dan Worker produksi versi `c3e454b5-f655-45d1-95b1-95480bd0967f` sudah aktif dengan status database `ready`.

- `cuciin-1.9.0-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.9.0-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.
- `cuciin-1.9.0-debug.apk`: APK debug terpisah untuk pengujian; jangan dipakai menyimpan data produksi.

Rilis ini mengganti penulisan snapshot global dengan persistent outbox, command idempoten, dan delta per revision. D1 menangani koreksi Service dan stok retail secara atomik untuk mencegah overwrite antardevice. Perbaikan PDF, rentang laporan, riwayat stok lama, CI, health monitoring, serta backup terenkripsi juga termasuk dalam kandidat ini.

Gunakan APK release untuk pilot. Ikuti `../../OPERATIONS_RUNBOOK.md` dan selesaikan tindakan Owner pada `../../android/RELEASE_READINESS.md` sebelum big-bang 20 cabang.
