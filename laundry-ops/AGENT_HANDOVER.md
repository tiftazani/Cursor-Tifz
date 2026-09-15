# Handover teknis Cuciin

Dokumen ini adalah titik mulai untuk Hermes, OpenCode, Cursor, Codex, atau reviewer baru. Baca bersama `CODING_AGENT_CONTEXT.md`, lalu gunakan prompt pada `AGENT_PROMPTS.md`. Untuk klaim file yang sedang berlaku dan pekerjaan yang belum di-commit, buka `AGENT_STATUS.md` lebih dulu.

## Status yang sudah diverifikasi

- Branch: `codex/cuciin-1-8-1`; PR: `https://github.com/tiftazani/Cursor-Tifz/pull/18`.
- Commit sumber terakhir saat handover: `9bd026f`.
- Android: `com.tiftazani.laundryops`, Kotlin + Jetpack Compose, versionName `1.9.3`, versionCode `18`.
- Kandidat rilis: `releases/1.9.3-candidate/`. Jangan mengubah atau mengganti APK/AAB tanpa build dan checksum baru.
- Worker produksi: `cuciin-api`, D1 `cuciin-db`, Firebase project `cuciin-ops-tiftazani`.
- Worker yang aktif saat handover: `71310107-4ec5-48f8-aedb-481be9107649`; health memberi HTTP 200 dan database `ready`.
- Skema D1 produksi: migrasi `0001` sampai `0004_operational_links.sql` sudah diterapkan.
- Validasi terakhir: 47 unit test Android debug + 47 release, lint kedua varian tanpa error, APK/AAB release, serta 29 test Worker lulus. PR bersih dan seluruh check hijau.

Kondisi ini adalah kandidat rilis, bukan keputusan big-bang. Daftar tugas Owner yang masih tersisa ada di `android/RELEASE_READINESS.md` dan `OPERATIONS_RUNBOOK.md`.

Catatan versi 1.9.3: pemulihan kata sandi memakai domain web.app dan bahasa Indonesia, pesan di aplikasi menjelaskan tautan yang terpotong. Catatan versi 1.9.2: tema tampilan dapat dipilih setiap pengguna di Akun & profil (Ikut sistem, Terang, Gelap, Warna-warni), disimpan per akun di HP masing-masing dan tidak ikut sinkronisasi. Build debug dan rilis sama-sama menyambung ke Worker; alamat cloud dibaca dari environment variable `CUCIIN_CLOUD_URL` atau berkas privat `signing-private/cuciin-cloud.properties`, dan build gagal bila keduanya kosong. Mockup web Cuciin sudah dilepas dari project Vercel `cuan-tif` dan dijalankan lokal lewat `mockup/start.sh`.

## Peta sistem

| Bagian | Lokasi | Tanggung jawab |
|---|---|---|
| Aplikasi Android | `android/app/src/main/java/com/tiftazani/laundryops/` | UI Compose, aturan operasional lokal, ekspor, outbox |
| UI | `android/app/src/main/java/com/tiftazani/laundryops/ui/` | navigasi, role-based UI, formulir, laporan, PDF/WA |
| Penyimpanan dan sync Android | `android/app/src/main/java/com/tiftazani/laundryops/data/` | `CuciinStore`, local snapshot, `CloudSync`, `SyncProtocol` |
| Worker | `cloudflare/src/` | Firebase token, role/cabang, command, D1, delta, laporan |
| Skema D1 | `cloudflare/migrations/` | tabel, index, trigger stok, journal command |
| Kontrak API | `cloudflare/SYNC_API.md` | endpoint, payload, retry, otorisasi |
| Runbook | `OPERATIONS_RUNBOOK.md` | backup, deploy, pilot, pemulihan |

Alur data: UI → `CuciinStore` → file lokal atomik + persistent outbox → `POST /v1/sync/commands` → D1 transaction + journal → `GET /v1/sync/changes` → pending-remote marker → snapshot lokal.

Firebase hanya menangani identitas. D1 adalah sumber data operasional pusat. Foto bukti tetap lokal per perangkat dan tidak boleh dipindahkan ke cloud.

## Endpoint dan konfigurasi

- URL build Android untuk endpoint lama/snapshot: `https://cuciin-api.tiftazani-cuciin.workers.dev/api/cuciin` melalui `CUCIIN_CLOUD_URL`, atau `cloudUrl` pada `signing-private/cuciin-cloud.properties`.
- Android membentuk endpoint command dan delta dari host yang sama: `/v1/me`, `/v1/sync/commands`, dan `/v1/sync/changes`.
- Health: `GET https://cuciin-api.tiftazani-cuciin.workers.dev/health`.
- Jangan menaruh token, password, `google-services.json`, `local.properties`, keystore, signing properties, atau secret Cloudflare/Firebase di Git atau chat.

## Aturan data yang tidak boleh dilanggar

1. Semua mutasi Android harus local-first, memiliki command ID stabil, dan tidak dihapus dari outbox sebelum acknowledgement server.
2. Gangguan sementara harus retryable; validasi, hak akses, dan konflik permanen dapat masuk daftar konflik.
3. Cursor delta hanya maju setelah snapshot lokal selesai. Marker pending-remote dan generation tidak boleh dihapus atau disederhanakan tanpa skenario recovery yang setara.
4. Perubahan scope role/cabang harus bootstrap ulang. Akun non-Owner tidak boleh menyisakan data cabang lama atau menerima staf/absensi di luar cakupannya.
5. Stok, inventory, biaya, absensi, kas, transaksi, audit, dan laporan selalu terkait cabang. Stok tidak boleh negatif dan mutasi retail harus atomik dengan Service.
6. Harga per baris nota dapat dikoreksi dan harus diaudit. Komisi tidak pernah dipercaya dari perangkat: ambil dari katalog aktif, atau dari baris historis nota yang sama ketika layanannya sudah dipensiunkan.
7. Hapus pelanggan hanya Owner di UI, store, dan Worker. Tutup kas append-only; ID yang sudah ada wajib ditolak.
8. Kasir dan petugas Service berasal dari sesi login. Hanya Owner yang dapat mengubah petugas.
9. QRIS hanya metode pencatatan pembayaran. Jangan membuat payment gateway.
10. Jangan menghidupkan kembali snapshot PUT global setelah journal command aktif. Jangan mengirim kompensasi stok sebelum penghapusan Service yang menjadi prasyarat diakui server.

## Peran

| Peran | Hak utama |
|---|---|
| Owner | Semua cabang dan modul; kelola master; ganti petugas; hapus pelanggan/master sesuai aturan |
| Kasir | Service, pelanggan, stok, kas, biaya, inventory, dan absensi sendiri pada cabang tugas |
| SPV | Antrian/status pengerjaan, stok, inventory, dan absensi sendiri pada cabang tugas; tanpa Service, pembayaran, WA, pelanggan, biaya, dan kas |

## Build dan validasi

Jalankan dari sumber yang bersih dan jangan mencetak nilai signing properties. Alamat cloud wajib tersedia, kalau tidak build Android berhenti dengan pesan yang jelas.

```sh
cd laundry-ops/cloudflare
npm ci
npm run check

cd ../android
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
./gradlew testDebugUnitTest lintDebug assembleDebug
```

Di mesin Owner, `local.properties` sudah memuat `sdk.dir` dan berkas `signing-private/cuciin-cloud.properties` sudah menyediakan alamat cloud.

Untuk rilis bertanda tangan, gunakan instruksi pada `android/RELEASE_READINESS.md`. Hanya lakukan deploy Worker, push, atau perubahan data produksi bila tugas secara eksplisit mengizinkannya.

## Handover antar-agent

Sebelum mulai, setiap agent harus menyatakan file yang akan disentuh dan mencatatnya di `AGENT_STATUS.md`. Bila kontrak Android–Worker berubah, tulis dahulu perubahan payload, kompatibilitas versi lama, migrasi, dan strategi rollback. Sertakan pada handover:

- tujuan dan file yang diubah;
- aturan bisnis atau data yang dilindungi;
- perintah validasi dan hasilnya;
- migrasi/deploy yang diperlukan atau pernyataan bahwa tidak ada;
- risiko yang belum bisa diuji otomatis.
