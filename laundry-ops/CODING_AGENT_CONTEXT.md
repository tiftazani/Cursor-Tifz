# Konteks kerja bersama Cuciin

Dokumen ini adalah sumber konteks ringkas untuk Hermes, OpenCode, Router, Codex, atau agen pemrograman lain. Salin blok di bawah ke awal percakapan baru dan tambahkan tugas khusus setelahnya.

```text
Repo: https://github.com/tiftazani/Cursor-Tifz
Branch kerja: codex/cuciin-1-8-1
PR aktif: https://github.com/tiftazani/Cursor-Tifz/pull/18
Folder produk: laundry-ops/
Versi source saat ini: 1.9.0 (versionCode 15)
Android: Kotlin + Jetpack Compose, package com.tiftazani.laundryops
Backend: Cloudflare Worker + D1, autentikasi Firebase Email/Password
Endpoint produksi: https://cuciin-api.tiftazani-cuciin.workers.dev

Sumber data utama adalah D1. Android wajib local-first: perubahan disimpan lokal dan masuk persistent outbox, dikirim sebagai command idempoten, lalu mengambil delta berdasarkan revision. Foto bukti hanya berada di perangkat dan tidak boleh dikirim ke cloud.
Penerapan delta memakai pending-remote marker yang persisten; jangan menulis snapshot lokal sebelum marker tersimpan atau memajukan cursor sebelum snapshot lokal selesai. Scope role+cabang berasal dari server; perubahan scope wajib bootstrap ulang sebelum cursor dilanjutkan.
Kompensasi stok yang bergantung pada penghapusan Service tidak boleh dikirim selama command Service dengan ID yang sama masih antre. Delta staff/branch untuk non-Owner harus dijurnal per cabang lama/baru; absensi hanya boleh terkirim kepada pemiliknya dan harus memeriksa pemilik baris server, bukan hanya email payload. Scope sinkronisasi non-Owner wajib membedakan role, email, dan daftar cabang.
Server adalah sumber tarif komisi; harga nota boleh berubah tetapi `commissionPerUnit` tidak boleh dipercaya dari klien. Jika layanan lama sudah tidak ada di katalog, koreksi nota hanya boleh memakai komisi historis yang tersimpan pada baris nota itu. Hapus pelanggan hanya untuk Owner di UI, store, dan server. Tutup kas append-only dan ID collision harus 409. Pending remote marker harus menyimpan generation agar acknowledgement yang cepat tidak mengembalikan shadow lama.

Peran:
- Owner: semua cabang dan modul; boleh mengganti petugas Service.
- Kasir: Service, pelanggan, stok, kas pada cabang yang ditugaskan; petugas Service selalu akun sesi.
- SPV: antrian dan stok pada cabang yang ditugaskan; tanpa pembuatan Service/WhatsApp.

Aturan yang tidak boleh dilanggar:
- Jangan hapus atau melemahkan CRUD, audit trail, sinkronisasi, alur periksa Service, pembayaran, atau nota.
- Jangan mengganti API, Firebase project, applicationId, signing identity, atau key.
- Jangan menaruh secret, token, google-services.json, local.properties, file keystore, atau password signing di Git.
- QRIS hanya metode pencatatan pembayaran, bukan payment gateway.
- Semua teks pengguna berbahasa Indonesia.
- Stok, inventory, biaya, absensi, nomor Service, laporan, dan akses operasional harus terkait cabang.
- Harga tiap baris Service boleh dikoreksi dan perubahan masuk audit trail.
- Jangan force-push. Jangan menimpa perubahan agen lain. Periksa git status dan diff sebelum mengubah file.
- Jangan menghidupkan kembali PUT snapshot setelah journal command aktif. Jangan menjalankan kompensasi stok penghapusan sebelum command penghapusan Service berhasil.

Area kode utama:
- UI: laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/
- Data/sync: laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/
- Ekspor: laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/export/
- Worker: laundry-ops/cloudflare/src/
- Skema D1: laundry-ops/cloudflare/migrations/
- Operasional: laundry-ops/OPERATIONS_RUNBOOK.md

Validasi minimum sebelum menyerahkan perubahan:
cd laundry-ops/cloudflare && npm ci && npm run check
cd laundry-ops/android && ./gradlew testDebugUnitTest lintDebug assembleDebug
Jelaskan file yang diubah, alasan, hasil uji, migrasi yang diperlukan, dan risiko kompatibilitas. Jangan melakukan deploy produksi atau push bila tugas tidak secara eksplisit memintanya.
```

Gunakan tambahan berikut ketika beberapa agen bekerja serentak:

```text
Sebelum mulai, nyatakan daftar file yang akan menjadi milik pekerjaanmu. Jangan menyunting file yang sedang dimiliki agen lain. Buat perubahan kecil dan terfokus, sertakan test untuk aturan bisnis atau sinkronisasi, lalu kirim hash commit atau diff ringkas kepada koordinator. Jika kontrak API perlu berubah, tulis request/response JSON dan strategi kompatibilitas sebelum mengubah kedua sisi.
```

Router/reviewer dapat memakai instruksi ini:

```text
Review perubahan Cuciin sebagai sistem operasional 20 cabang. Prioritaskan kehilangan data, overwrite lintas perangkat, idempotensi, otorisasi cabang/peran, kebocoran PII/secret, ketepatan uang/stok/komisi, zona waktu Asia/Jakarta, ekspor PDF/CSV, dan kompatibilitas data lokal lama. Laporkan temuan dengan file+baris, skenario nyata, tingkat dampak, dan perbaikan konkret. Jangan menyetujui jika command retry bisa menggandakan mutasi atau akun cabang dapat membaca/menulis cabang lain.
```
