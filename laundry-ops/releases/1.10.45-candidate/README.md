# Cuciin 1.10.45 / build 64

Status: APK debug/rilis dan AAB sudah dibangun. Gate lokal dan pemasangan APK rilis di emulator lulus. Push dan deploy mendapat izin Owner; hasil deploy menyusul.

## Sasaran

- Stok awal produk sampai ke kasir cabang melalui jurnal `stockMove`.
- Penyuntingan nota tidak mengganti kasir pembuat dan petugas layanan lama dengan pengguna pengedit.
- Keranjang dan antrean transaksi tidak terbawa sebagai pengguna lain saat berganti akun.
- Identitas server tidak mengambil baris staff dengan UID yang menunjuk email berbeda.

## Bukti laporan

Query produksi read-only pada 9 Oktober 2026 menemukan 14 nota unik dengan jurnal berkasir Widad, lalu jurnal berikutnya berkasir Aida. Ini mendukung penyebab penimpaan identitas pada `order.put`. Tidak ada catatan operasional lama yang diubah.

Jalur stok awal produk terbukti mengirim saldo `branchStock` tanpa `stockMove`; server mengakui saldo sebagai proyeksi tanpa menulis saldo itu. Jalur stok biasa membuat jurnal saldo cabang. Belum terbukti jalur mana yang dipakai dalam setiap kejadian stok yang dilaporkan.

## Pemeriksaan

Worker: `npm run check` dijalankan parent dan lulus 120 tes, 0 gagal. Typecheck dan validasi skema lulus. Tes khusus atribusi dan stok lintas cabang: 8/8 lulus. Asal kasir selalu aktor login untuk nota baru dan tetap pembuat untuk nota lama. Petugas rincian Kasir dipertahankan; Owner tetap boleh menugaskan petugas untuk rincian baru atau koreksi. Tes penugasan Owner merah sebelum izin penugasan dipulihkan, lalu 8/8 hijau.

Android: 409 debug + 409 release lulus, 0 gagal/error/skipped. Lint 0 error/20 warning per varian. Stock/session regression 14/14 lulus di kedua varian setelah fixture password disesuaikan dengan LoginPolicy release; main Handler lazy agar tes JVM tidak membutuhkan runtime Android.

Build resmi debug/rilis/AAB sukses. Endpoint kedua APK diperiksa di dex. verify_release.py PASS: build 64/1.10.45, non-debuggable, signature v2, target 36 dan ZIP/ELF 16 KB. Sertifikat tetap 3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee. SHA-256 tercatat di SHA256SUMS; salinan akar dan Downloads identik.

Emulator API 35 fresh, wifi/data dimatikan: APK rilis terpasang dan terbuka; layar masuk menampilkan Versi 1.10.45, hash APK terpasang cocok, crash Cuciin 0. Bukti di bukti/. Sapu menu per peran dan Riwayat versi setelah login belum diulang. Tidak ada tulis data produksi dari uji ini.

## Batas

- HP cabang dan HP pelapor belum diuji.
- Data historis tidak diperbaiki otomatis.
- Jangan mencopot aplikasi lama. APK baru harus memakai paket dan sertifikat yang sama agar data perangkat tetap tersimpan.
