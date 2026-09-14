# QA Cuciin 1.6.0 (8)

Diuji pada emulator Android API 35 dengan jaringan dimatikan, menggunakan data uji lokal. Tidak mengirim data uji ke server produksi.

## Lolos
- testDebugUnitTest: 5 tes, 0 gagal (kebijakan login, tanggal/waktu, status dan pembayaran, validasi tautan peta).
- assembleDebug, assembleRelease, bundleRelease; lint vital rilis dalam build.
- Verifikasi sertifikat rilis yang diharapkan, non-debuggable, target 36, izin terbatas, ZIP dan ELF 64-bit 16 KB; bundletool validate.
- Tambah pelanggan, kembali ke nota; tambah/kurangi layanan dan pesan jumlah; total keranjang langsung berubah.
- Pilih kalender tanggal 12 September dan jam 17.00, simpan nota Rp21.000; tandai selesai melalui konfirmasi. Status belum lunas tetap terpisah.
- Stok Sabun +10 melalui pemilih waktu, tersimpan dan muncul pada riwayat hari/tanggal/jam serta pencatat.
- Draf cabang membuka aplikasi peta; intent berbagi lokasi kembali ke Cuciin mempertahankan nama/kode/alamat; simpan cabang berhasil.
- Rotasi setelah tautan diterima dan draf dibatalkan tidak memproses ulang tautan atau membuka draf baru.
- Tampilan HP 320dp, HP 400dp, tablet sekitar 1067dp dan landscape 640x320dp; nota memakai ringkasan mendatar pada layar pendek.

## Batas pengujian
Getaran fisik perlu dirasakan pada perangkat nyata; pemanggilan haptic mengikuti pengaturan sistem. Pencarian peta online tidak diuji karena emulator offline; peluncuran aplikasi dan penerimaan tautan diuji. Sinkronisasi live, WA ke penerima, dan pembayaran nyata tidak dijalankan. Foto bukti tetap lokal, API/key tidak diganti. Penghambat produksi tetap tercatat di RELEASE_READINESS.md.

Screenshot mewakili pengujian selama iterasi UI 1.6.0. build.log dan verify-release.txt berasal dari build akhir.
