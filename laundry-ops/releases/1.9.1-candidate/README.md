# Cuciin 1.9.1 candidate

Build kandidat ini dibuat 15 September 2026 (versionCode 16) sebelum aturan "setiap kandidat wajib
punya README" diberlakukan, jadi catatannya baru ditulis belakangan dari `android/CHANGELOG.md`.
Angka test di bawah **tidak dicatat saat itu** dan tidak direkonstruksi; yang tersimpan hanya APK dan
AAB-nya.

- `cuciin-1.9.1-release.apk`: APK bertanda tangan untuk perangkat operasional.
- `cuciin-1.9.1-release.aab`: Android App Bundle bertanda tangan untuk distribusi terkelola bila diperlukan.

Tidak ada APK debug di folder ini; kandidat ini hanya menyimpan rilis dan AAB.

## Isi rilis (dari `CHANGELOG.md`)

- Layanan retail memakai relasi ID produk stok, sehingga penjualan, koreksi, dan penghapusan Service
  selalu memutakhirkan saldo produk di cabang yang benar.
- Produk stok menyatukan barang jual serta bahan habis pakai; stok awal dan pencatatan massal dapat
  dipilih untuk lebih dari satu cabang, sementara mesin dan aset operasional pindah ke menu Aset &
  mesin cabang.
- Riwayat inventory lama untuk barang jual/bahan habis pakai otomatis dipindahkan ke katalog Produk
  stok ketika aplikasi dibuka.
- Profil menampilkan cabang penugasan pengguna yang sebenarnya, termasuk saat Owner melihat cabang lain.
- Sesudah WhatsApp dibuka untuk pelanggan, hanya Owner yang dapat mengoreksi atau menghapus Service;
  batas ini diperiksa di aplikasi dan server.
- Absen masuk/pulang memakai foto kamera bercap waktu, disimpan privat di perangkat; path foto tidak
  pernah disinkronkan ke server.
- Owner dapat mengatur modul/fungsi per pengguna dan template WhatsApp (pembuka, pengantar, penutup);
  Worker menyimpan serta menerapkan kebijakan akses itu.

## Daftar SHA-256

Lihat `SHA256SUMS.txt` di folder ini.

## Yang belum dibuktikan

- Angka test, hasil lint, dan status Worker saat kandidat ini dibuat tidak tercatat.
- Tidak ada APK debug untuk kandidat ini.
- Kandidat ini sudah tidak dipakai di lapangan; versi yang berlaku sekarang ada di folder kandidat
  terbaru. Gunakan dokumen ini hanya untuk menelusuri asal APK.
