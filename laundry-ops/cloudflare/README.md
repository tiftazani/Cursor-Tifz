# Cuciin Cloud — Cloudflare Workers + D1

Backend ini disiapkan agar operasional dapat mulai dari paket gratis Cloudflare dan naik ke paket berbayar tanpa mengganti database atau kontrak aplikasi. D1 menyimpan tabel relasional per cabang, transaksi, rincian layanan, petugas layanan, komisi, absensi, inventory, stok, biaya, dan audit. Foto bukti tetap berada di HP.

Endpoint produksi saat ini: `https://cuciin-api.tiftazani-cuciin.workers.dev/api/cuciin`.

## Pengamanan

- Produksi sebaiknya memakai Firebase Authentication. Worker memverifikasi ID token Firebase dengan kunci publik Google dan `FIREBASE_PROJECT_ID`.
- `SYNC_SECRET` tersedia sebagai jalur bootstrap tertutup. Secret dipasang melalui `wrangler secret put`, tidak ditulis ke repository. Jangan menganggap nilai di APK sebagai rahasia permanen.
- Semua query memakai parameter binding, payload dibatasi 4 MB, respons tidak boleh di-cache, dan kata sandi tidak memiliki kolom di D1.
- Staf ditautkan ke Firebase UID pada login pertama. UID tetap sama saat alamat email akun diperbarui.
- Sinkronisasi produksi memakai command idempoten (`POST /v1/sync/commands`) dan journal delta berurutan (`GET /v1/sync/changes`). D1 mengeksekusi setiap command secara atomik, menolak stok negatif, memeriksa role/cabang, dan menyimpan hasil command untuk retry yang aman. Kontrak lengkap ada di [SYNC_API.md](SYNC_API.md).
- Snapshot tetap tersedia untuk kompatibilitas selama rollout, tetapi APK multi-writer tidak boleh memakai snapshot PUT sebagai jalur tulis utama.

## Menyiapkan akun gratis

1. Pasang Node.js 20+, lalu jalankan `npm install` di folder ini.
2. Login dengan `npx wrangler login`.
3. Buat D1: `npx wrangler d1 create cuciin-db`.
4. Isi `database_id` pada `wrangler.toml` dari hasil langkah 3.
5. Pasang secret bootstrap dengan `npx wrangler secret put SYNC_SECRET`.
6. Isi `FIREBASE_PROJECT_ID` sebagai environment variable Worker.
7. Jalankan migrasi: `npm run db:remote`.
8. Deploy: `npm run deploy`.
9. Build Android dengan environment `CUCIIN_CLOUD_URL=https://<worker>.workers.dev/api/cuciin`. Jangan memasukkan `SYNC_SECRET` atau `CUCIIN_CLOUD_KEY` ke APK produksi; aplikasi memakai Firebase ID token.

Sebelum APK command-sync dibagikan, jalankan migrasi `0003_command_sync.sql` dan deploy Worker. `/health` memeriksa binding D1 serta tabel journal dan mengembalikan HTTP 503 bila database belum siap.

Resource aktif saat ini:

- Worker: `cuciin-api`
- D1: `cuciin-db` (`7152b13e-f23a-4576-a6bc-f38d67ac2146`)
- Firebase project: `cuciin-ops-tiftazani`

Gunakan satu proyek produksi dan satu proyek staging terpisah. Aktifkan export/backup terjadwal sebelum big bang 20 cabang. Uji pemulihan, transaksi bersamaan, pergantian perangkat, dan pencabutan akses karyawan sebelum hari operasional.

Workflow `cuciin-health.yml` memeriksa Worker serta D1 setiap 15 menit. Workflow `cuciin-backup.yml` dijalankan manual untuk menguji export, enkripsi AES-256/PBKDF2 600.000 iterasi, checksum, dekripsi, impor SQLite, dan integrity check. Repository publik tidak mengunggah hasil backup sebagai artifact. Simpan backup terjadwal ke tujuan privat yang dikuasai Owner, misalnya bucket R2 privat atau repository backup privat, dengan retensi serta uji pemulihan terpisah. Prosedur rollout dan restore ada di `../OPERATIONS_RUNBOOK.md`.
