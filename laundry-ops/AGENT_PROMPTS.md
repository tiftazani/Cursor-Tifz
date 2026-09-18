# Prompt siap-tempel untuk coding agent Cuciin

Salin satu prompt di bawah, lalu tambahkan tugas spesifik Anda. Jangan menyertakan password, token, atau lokasi berkas signing privat.

## Blok klaim file (tempel di awal percakapan)

```text
Repo: https://github.com/tiftazani/Cursor-Tifz, branch codex/cuciin-1-8-1, commit dasar 76545ad.
Sebelum menyentuh kode, baca laundry-ops/AGENT_STATUS.md. Di situ ada klaim file per agent, pekerjaan yang belum di-commit, dan blocker yang sedang berjalan.

Tulis di AGENT_STATUS.md daftar file yang menjadi milik pekerjaan ini sebelum mulai. Jangan mengedit file yang sedang dipegang agent lain; kalau butuh, sebutkan alasannya lebih dulu dan tunggu jawaban. Jangan menyentuh CuciinStore.kt, Models.kt, SyncProtocol.kt, ReceiptText.kt, dan MoreScreens.kt tanpa menjalankan git diff lebih dulu dan menyebut alasan perubahan.
```

## Implementasi umum

```text
Saya melanjutkan Cuciin dari repository https://github.com/tiftazani/Cursor-Tifz pada branch codex/cuciin-1-8-1. Baca laundry-ops/AGENT_HANDOVER.md, laundry-ops/AGENT_STATUS.md, laundry-ops/CODING_AGENT_CONTEXT.md, dan dokumentasi yang dirujuk sebelum mengubah code.

Tugas saya: [TULIS TUGAS SPESIFIK].

Paket aplikasi adalah `com.cuciin.laundryops` (versionCode 19) dan Firebase project aktif adalah `cuciin-ops`. Selama masa peralihan, Worker juga menerima token dari project lama `cuciin-ops-tiftazani`; jangan kurangi daftar itu di `wrangler.toml` selama masih ada perangkat yang memakai paket lama.

Batasi perubahan hanya pada file yang relevan. Sebelum mengedit, laporkan file yang akan disentuh. Pertahankan CRUD, audit trail, alur periksa Service–pembayaran–nota, local-first outbox, command idempoten, dan data foto lokal. Semua UI berbahasa Indonesia dan harus nyaman untuk HP sempit maupun tablet. Jangan mengubah API, Firebase project, applicationId, signing identity, secret, atau version tanpa alasan dan dampak yang jelas. Jangan force-push atau menimpa perubahan agent lain.

Sebelum menyerahkan, jalankan validasi yang relevan, laporkan file yang berubah, hasil test, risiko kompatibilitas, serta apakah migrasi/deploy diperlukan. Jangan deploy atau push tanpa instruksi eksplisit.
```

## Android UI/UX

```text
Fokus pada Android Compose Cuciin. Baca AGENT_HANDOVER.md dan CODING_AGENT_CONTEXT.md. Tugas UI: [TULIS TUGAS].

Paket aplikasi sekarang `com.cuciin.laundryops`; seluruh sumber Kotlin ada di `android/app/src/main/java/com/cuciin/laundryops/`. Jangan menurunkan `versionCode` (sekarang 19) karena paket baru berdampingan dengan paket lama di perangkat yang sama.

Pertahankan perilaku data dan role yang sudah ada. Gunakan komponen dan UiMetrics yang tersedia; pastikan layar bekerja sekitar 320dp, HP normal, landscape, dan tablet dengan rail. Semua tombol memiliki target sentuh jelas, loading/error/empty state yang nyata, haptic atau umpan balik saat aksi penting, serta teks Indonesia. Jangan membuat tombol palsu, jangan menghapus CRUD, dan jangan mengubah sinkronisasi untuk memperbaiki tampilan.

Jalankan test/lint/build Android yang relevan dan jelaskan perubahan perilaku pengguna.
```
## Data, sinkronisasi, dan Worker

```text
Fokus pada sinkronisasi Android dan Cloudflare Worker Cuciin. Baca AGENT_HANDOVER.md dan cloudflare/SYNC_API.md secara penuh. Tugas: [TULIS TUGAS].

Anggap D1 sebagai sumber data pusat dan Android local-first. Command harus idempoten, retry aman, scope role+cabang tidak boleh bocor, cursor tidak boleh maju sebelum penerapan lokal selesai, dan foto bukti harus tetap lokal. Lindungi uang, stok, komisi, kas, audit, dan tombstone Service dari duplikasi atau overwrite lintas perangkat. Jika kontrak berubah, dokumentasikan payload, kompatibilitas, migrasi, dan rollback sebelum implementasi.

Perhatikan `FIREBASE_PROJECT_IDS` di `wrangler.toml`: selama masa peralihan identitas aplikasi, Worker menerima token dari project Firebase lama dan baru. Jangan kurangi daftar itu selama masih ada perangkat yang memakai paket lama.

Tambahkan test untuk skenario gagal atau konflik yang diperbaiki. Jalankan npm run check dan validasi Android yang terdampak. Jangan deploy produksi tanpa instruksi eksplisit.
```

## Reviewer keamanan dan integritas data

```text
Review perubahan Cuciin sebagai aplikasi operasional laundry 20 cabang. Baca AGENT_HANDOVER.md, CODING_AGENT_CONTEXT.md, dan SYNC_API.md. Jangan mengubah file kecuali saya meminta perbaikan.

Cari temuan dengan dampak nyata pada: kehilangan data, retry menggandakan mutasi, dead-letter pada error sementara, race multi-perangkat, OCC, scope cabang/peran, IDOR, PII/secret, stok negatif, pembayaran/kas/komisi, tombstone Service, backup/restore, zona waktu Asia/Jakarta, PDF/CSV, dan upgrade data lokal. Perhatikan juga masa peralihan identitas aplikasi: paket `com.cuciin.laundryops` berdampingan dengan paket lama di perangkat yang sama, dan Worker harus tetap menerima token dari dua project Firebase sampai seluruh perangkat pindah. Laporkan hanya temuan yang bisa direproduksi: file+baris, langkah skenario, dampak, tingkat keparahan, dan perbaikan konkret. Tandai temuan lama yang sudah tertutup sebagai tidak berlaku.
```

## Release dan operasi

```text
Saya menangani rilis Cuciin. Baca AGENT_HANDOVER.md, android/RELEASE_READINESS.md, OPERATIONS_RUNBOOK.md, dan cloudflare/README.md. Tugas: [TULIS TUGAS].

Jangan menampilkan atau menulis secret. Jangan commit google-services.json, local.properties, keystore, atau signing properties. Build release hanya dengan konfigurasi privat yang sudah tersedia. Setelah source berubah, perbarui changelog, VersionHistory, artefak kandidat, checksum, dan dokumen rilis secara konsisten. Lakukan deploy, perubahan D1, push, atau merge hanya bila instruksi eksplisit diberikan.
```
