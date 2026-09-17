# Cuciin 1.10.10 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.10-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.10-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.10-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.10

### Menu Theme Aplikasi

Pengaturan tema dipindahkan dari Akun & Profil ke menu tersendiri bernama **Theme Aplikasi** di bagian Aplikasi. Akun & Profil kini hanya menyediakan pintasan ke menu itu.

Tiga mode tersedia:

| Mode | Tampilan |
|---|---|
| Light | Latar terang dengan aksen pink dan header navy (tema bawaan) |
| Dark | Latar hitam dengan tulisan terang |
| Custom | Enam warna yang diatur sendiri |

### Warna Custom

Enam warna dapat diubah, masing-masing dengan slider R, G, B bernilai 0 sampai 255, kode hex, dan pratinjau:

1. Warna utama: aksen, ikon terpilih, dan garis sorot.
2. Warna tombol: tombol aksi utama seperti Service baru.
3. Warna latar: latar halaman di belakang kartu.
4. Warna kartu: permukaan kartu dan kolom isian.
5. Warna teks: tulisan utama dan angka.
6. Warna header: panel judul dan header nota.

Setiap perubahan langsung berlaku di seluruh aplikasi, jadi pengguna melihat hasilnya tanpa menekan simpan. Tersedia juga tombol "Kembalikan warna awal".

Warna teks di atas tombol dan header tidak dipilih manual: nilainya dihitung dari terang gelapnya warna tersebut, sehingga tulisan tetap terbaca berapa pun warna yang dipilih.

### Urutan menu Modul

Susunan menu dirapikan dan dipindah ke `ui/MenuOrder.kt` supaya urutannya dapat diperiksa unit test. Bagian yang tampil berurutan:

| Urutan | Bagian | Isi |
|---|---|---|
| 1 | Pekerjaan harian | Antrian laundry, Service baru, Absensi karyawan, Daftar Aset Cabang |
| 2 | Keuangan | Biaya operasional, Tutup kas |
| 3 | Pelanggan | Pelanggan, WA menunggu, Arsip WA |
| 4 | Laporan | Laporan transaksi, Laporan analitik, Riwayat aktivitas |
| 5 | Master data | Cabang, Daftar User, Layanan & harga, Produk stok, Kontrol Akses Role, Pengaturan Owner |
| 6 | Aplikasi | Akun & profil, Theme Aplikasi, Riwayat versi |

Dua perbaikan penempatan:

- **Theme Aplikasi** keluar dari bagian laporan karena ia mengatur tampilan HP, bukan laporan operasional.
- **Riwayat versi** kini berada di urutan paling bawah, tepat di atas tombol ekspor dan keluar.

### Pengisian data awal lewat Excel

Data awal (cabang, karyawan, layanan, produk, stok, aset, pelanggan) diisi lewat berkas Excel, lalu dikonversi menjadi SQL dan dijalankan ke database. Rinciannya di `PANDUAN-IMPOR-EXCEL.md`.

Alat pendukungnya ada di `scripts/`:

| Berkas | Kegunaan |
|---|---|
| `fetch_d1_reference.py` | Membaca daftar entitas yang sudah ada di database sebagai acuan. |
| `import_template_to_d1.py` | Mengubah Excel menjadi SQL beserta jurnal `sync_changes`. |

Impor bersifat idempoten: berkas yang sama dijalankan dua kali tidak menggandakan data. Jurnal `sync_changes` ditulis supaya perangkat yang sudah terpasang menerima datanya lewat sinkronisasi biasa, tanpa perlu update aplikasi.

### Perbaikan menyertai

- **ID baris baru memakai UUID.** Sebelumnya memakai milidetik, sehingga penambahan puluhan baris dalam satu milidetik menghasilkan ID kembar dan baris saling menimpa.
- **Catatan audit aman saat katalog cabang kosong.** Sebelumnya `branches.first()` dipanggil tanpa cadangan dan bisa menghentikan aplikasi.

### Perbaikan server yang ditemukan saat pengujian

Perintah aset (`assetType`) ditolak server dengan kode 422 karena alias `assetType` tidak ada di pemetaan entityType pada `parseCommand`. Akibatnya 23 perintah tertahan di perangkat debug dan tidak pernah terkirim.

Perbaikan: alias `assetType` ditambahkan, plus test yang memastikan setiap entityType yang dikirim Android punya alias command. Setelah deploy, seluruh 23 perintah terkirim dan antrean perangkat kembali kosong.

Worker produksi sudah dideploy ulang dengan perbaikan ini (version `a8f7f1f2-89ec-4266-b00e-f8653da9fc6f`).

## Verifikasi

- VersionName `1.10.10`, versionCode `29`.
- Unit test debug dan release lulus: 85 test per varian, 0 gagal (naik dari 72 karena test urutan menu baru).
- Lint debug dan release lulus.
- APK debug, APK release, dan AAB berhasil dibangun.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Uji emulator: slider R mengubah warna utama dari `#C1358F` menjadi `#A2358F` dan pratinjau ikut berubah; mode Dark menampilkan latar hitam; tema Custom tetap berlaku setelah aplikasi ditutup dan dibuka ulang.
- Uji emulator layar Modul: urutan tampil Pekerjaan harian, Keuangan, Pelanggan, Laporan, Master data, lalu Aplikasi; Theme Aplikasi dan Riwayat versi berada di bagian Aplikasi dan Riwayat versi paling bawah.
- `npm run check` Worker lulus dengan 41 test.
- Alur Excel diuji di database uji: 8 baris masuk (cabang, jenis aset, produk, karyawan, layanan, stok, aset, pelanggan) dan 8 entri jurnal tercatat. Dijalankan dua kali, jumlah baris tetap sama dan stok tidak berganda.

## Read back produksi

| Pemeriksaan | Hasil |
|---|---|
| Migrasi | `0001` sampai `0007` |
| `asset_types` | 6 baris |
| `access_roles` | 4 baris |
| Data operasional | 6 orders, 4 cabang, 8 staff |
| `/health` | ok, database ready |

Tidak ada kredensial, token, atau material signing di folder ini.
