# Runbook operasional Cuciin untuk 20 cabang

## Arsitektur produksi

D1 menjadi sumber data pusat untuk transaksi, stok, inventory, biaya, absensi, komisi, kas, dan audit. Setiap perangkat menyimpan salinan lokal serta antrean perubahan persisten. Worker menerima command dengan ID unik sehingga pengiriman ulang tidak menggandakan transaksi, lalu perangkat mengambil perubahan berurutan berdasarkan revision.

Firebase hanya menangani identitas pengguna. Hak role dan cabang tetap diambil dari data staff server. Foto bukti tetap berada di perangkat yang mengambil foto.

## Sebelum big-bang

1. Jalankan migrasi D1 dan deploy Worker dari commit rilis yang sama.
2. Siapkan tujuan backup privat di luar repository source publik. Jalankan `cloudflare/scripts/backup-d1.sh`, simpan berkas terenkripsi serta checksum ke tujuan itu, lalu uji dengan `verify-backup.sh`. Workflow GitHub publik hanya boleh dipakai untuk verifikasi manual dan tidak menyimpan artifact database.
3. Aktifkan notifikasi kegagalan untuk health check dan proses backup privat yang dipilih.
4. Simpan keystore, signing properties, backup passphrase, dan recovery Firebase/Cloudflare di dua media terenkripsi terpisah.
5. Buat 20 cabang, tetapkan setiap akun ke cabang yang benar, lalu ganti seluruh password awal.
6. Rekonsiliasi saldo stok awal, mesin, barang jual, biaya rutin, harga layanan, dan komisi. Owner menandatangani hasil per cabang.
7. Uji dua perangkat pada cabang yang sama serta dua cabang berbeda: buat/edit/hapus Service, pembayaran, stok massal, retry offline, absensi, laporan, PDF, dan WhatsApp.
8. Latih kasir dan SPV memakai data latihan, kemudian kosongkan data latihan sebelum saldo awal dimasukkan.

## Urutan rilis

1. Ambil backup terenkripsi sebelum migrasi.
2. Terapkan migrasi: `cd laundry-ops/cloudflare && npm ci && npx wrangler d1 migrations apply cuciin-db --remote`.
3. Deploy Worker: `npm run check && npx wrangler deploy`.
4. Pastikan `/health` mengembalikan `ok: true`.
5. Bangun APK bertanda tangan dari tag rilis dan verifikasi certificate SHA-256 sama dengan `android/release-certificate-sha256.txt`.
6. Instal pada dua perangkat pilot, sinkronkan, dan rekonsiliasi satu transaksi tunai serta satu perubahan stok.
7. Sebarkan APK yang sama ke semua perangkat. Jangan membuat build ulang di tengah distribusi.

## Pemantauan harian

- Pastikan workflow health berhasil dan backup privat terbaru dapat diverifikasi.
- Owner memeriksa Service belum selesai, pembayaran belum lunas, stok di bawah minimum, absensi terbuka, dan selisih tutup kas.
- Cocokkan jumlah transaksi dan omzet per cabang dengan kasir yang bertugas.
- Tindak lanjuti outbox yang tertahan atau pesan sinkronisasi gagal sebelum pergantian shift.

## Gangguan koneksi atau server

Perangkat tetap dapat mencatat data ke penyimpanan lokal. Jangan hapus data aplikasi, logout paksa, atau instal ulang. Kurangi penulisan transaksi yang sama dari beberapa perangkat bila Worker tidak tersedia. Setelah koneksi pulih, biarkan outbox selesai, lalu bandingkan transaksi, stok, kas, dan audit per cabang.

Jika migrasi atau deploy Worker gagal, jangan meneruskan distribusi APK. Pulihkan versi Worker sebelumnya dan verifikasi data D1. Restore backup hanya dilakukan ke database baru terlebih dahulu; hitung dan bandingkan jumlah baris sebelum mengalihkan produksi.

## Tindakan yang hanya dapat dilakukan pemilik

- Mengubah password awal, email, penerima reset, dan mengaktifkan MFA untuk Owner.
- Menentukan kebijakan akses pelanggan lintas cabang dan persetujuan privasi pelanggan.
- Menyimpan salinan keystore serta passphrase backup di lokasi yang hanya pemilik kuasai.
- Menetapkan tujuan backup privat, jadwal, retensi, serta menjalankan uji pemulihan pertama sebelum pilot.
- Menguji WhatsApp ke penerima nyata, haptic, kamera, share lokasi, printer, dan perilaku APK pada setiap tipe HP operasional.
- Menyetujui saldo awal, komisi, biaya, hak akses karyawan, dan keputusan go/no-go.
