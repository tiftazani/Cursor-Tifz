# Kebijakan data operasional Cuciin

## Batas akses

Satu instalasi Cuciin mewakili satu usaha dan memiliki master pelanggan bersama. Pelanggan dapat berpindah cabang tanpa dibuat ulang, sehingga nama, nomor telepon, dan alamat tersedia bagi akun operasional yang sudah disetujui. Transaksi, stok, inventory, biaya, absensi, kas, komisi, dan audit selalu membawa cabang. Kasir dan SPV hanya boleh menerima atau mengubah data operasional cabang yang ditugaskan; Owner dapat melihat gabungan cabang.

Foto bukti tidak masuk D1, laporan cloud, backup D1, atau sinkronisasi. File tersebut hanya berada pada HP asal. Ekspor PDF, CSV, dan JSON dibuat lokal serta dibagikan hanya atas tindakan pengguna.

## Retensi dan koreksi

Service dan mutasi keuangan yang sudah menjadi catatan operasional tidak dihapus diam-diam. Koreksi harga, jumlah, petugas, pembayaran, status, stok, dan penghapusan Service harus menghasilkan audit trail dengan akun, cabang, dan waktu. ID command sinkronisasi mencegah retry menghasilkan mutasi ganda.

Backup produksi dibuat lewat workflow `cuciin-backup` (`.github/workflows/cuciin-backup.yml`), yang saat ini hanya berjalan saat dijalankan manual (`workflow_dispatch`, belum ada jadwal harian). Prosesnya mengekspor D1 lalu mengenkripsinya dengan passphrase sebelum diunggah, dan setiap backup wajib lolos pemeriksaan restore sebelum dianggap sah. Hasil unggahan disimpan 7 hari. Pemilik menyimpan passphrase di luar repository. Restore selalu diuji ke database terpisah sebelum dipakai pada produksi.

## Akun

Firebase menyimpan kredensial; D1 menyimpan UID, email, role, status persetujuan, dan penugasan cabang. Password maupun hash password tidak boleh masuk D1, snapshot cloud, log, ekspor, Git, atau percakapan agen. Akun yang tidak aktif harus dinonaktifkan pada Firebase dan data staff. Semua password awal wajib diganti sebelum transaksi nyata.

## Tanggung jawab pemilik

Pemilik menetapkan siapa yang boleh melihat master pelanggan lintas cabang, memberi tahu pelanggan mengenai penggunaan data, menentukan masa retensi yang sesuai kebutuhan usaha, dan menangani permintaan koreksi atau penghapusan data sesuai kewajiban yang berlaku. Perubahan kebijakan harus diikuti pembaruan aturan aplikasi, prosedur kerja, dan informasi privasi yang diberikan kepada pelanggan.
