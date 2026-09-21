# Layanan, Harga, dan Stok

Mengatur tarif, produk, bahan, dan aset cabang.

> Ringkasan: daftar layanan dan harga menentukan nilai setiap transaksi baru. Perubahan harga tidak mengubah transaksi yang sudah tercatat.

## Dampak bisnis

Harga adalah sumber penghasilan langsung. Perubahan harga berdampak pada setiap nota baru di seluruh cabang, sehingga waktu perubahan perlu dipilih dengan sadar.

## Siapa yang terdampak

| Peran | Dampak | Tindakan lanjutan |
|---|---|---|
| Kasir | Melihat harga baru pada Service berikutnya | Tidak ada; harga diambil otomatis |
| Supervisor | Melihat harga pada laporan | Periksa laporan periode sesudah perubahan |
| Pelanggan | Membayar sesuai harga baru | Sampaikan lebih dulu bila kenaikannya besar |
| Owner | Pemutus perubahan | Periksa dampaknya ke laporan |

## Jenis layanan yang tersedia

| Jenis | Satuan | Dijual satuan | Bisa diantar |
|---|---|---|---|
| Cuci | kg | Tidak | Tidak |
| Cuci kering (Curing) | kg | Tidak | Tidak |
| Layanan lain sesuai daftar Anda | sesuai kebutuhan | sesuai pengaturan | sesuai pengaturan |

## Mengubah harga layanan

**Hasil akhir:** Nota baru memakai harga yang baru, dan nota lama tetap utuh nilainya.

**Sebelum mulai:**

- Harga baru yang disepakati
- Waktu berlaku yang dipilih, mis. awal bulan

## Langkah

1. Buka **Modul** → **Layanan & harga**.
2. Cari layanan yang akan diubah.
3. Ketuk layanan itu untuk membukanya.
4. Ubah harga atau satuannya.
5. Periksa kembali, lalu simpan.

![Layar Layanan & harga dengan daftar layanan dan tombol tambah](aset/gambar/15-layanan-harga.png)

> **PERHATIAN**
> Perubahan harga hanya berlaku untuk transaksi baru. Transaksi yang sudah tercatat tetap memakai harga saat transaksi itu dibuat, sehingga laporan periode lama tidak berubah. Bila Anda ingin laporan lama tidak terpengaruh sama sekali, ubah harga di awal periode baru.

## Cara memverifikasi

| Yang diperiksa | Caranya |
|---|---|
| Harga baru muncul di transaksi | Buat satu Service uji, periksa nilainya |
| Laporan lama tidak berubah | Buka **Laporan transaksi** periode sebelum perubahan |
| Nominal sesuai kesepakatan | Periksa di **Layanan & harga** dan pada nota uji |

## Cara memulihkan

Kembalikan angka harga ke nilai sebelumnya di layar yang sama. Transaksi yang sudah terlanjur dibuat dengan harga keliru perlu dikoreksi satu per satu pada pesanannya.

## Produk dan bahan

Aplikasi membedakan dua jenis produk.

| Jenis | Label di aplikasi | Contoh |
|---|---|---|
| Barang dijual | Barang dijual | Deterjen kemasan, pewangi |
| Bahan habis pakai | Bahan habis pakai | Deterjen curah, pelicin |

### Cara menambah produk

1. Buka **Modul** → **Produk stok**.
2. Tekan tombol produk baru.
3. Isi nama, jenis, dan harga.
4. Tentukan cabang yang menyimpan produk itu.
5. Simpan.

![Layar Produk stok dengan daftar bahan dan barang per cabang](aset/gambar/16-produk-stok.png)

### Cara mencatat pemakaian bahan

| Jenis pencatatan | Label di aplikasi | Kapan dipakai |
|---|---|---|
| Tambah | Tambah | Barang datang dari pemasok |
| Kurang | Kurang | Barang terpakai tanpa penjualan |
| Set stok akhir | Set stok akhir | Setelah menghitung fisik di gudang |
| Jual | Jual | Barang terjual ke pelanggan |

> **INFORMASI**
> **Set stok akhir** dipakai setelah hitung fisik. Gunakan ini bila catatan sistem sudah tidak cocok dengan kenyataan, karena jenis pencatatan lain akan menambah atau mengurangi dari angka yang mungkin sudah salah.

## Aset cabang

**Dampak bisnis:** Catatan aset menentukan kapan peralatan perlu diperbaiki, sehingga mesin bermasalah tidak menghambat produksi.

### Kategori dan kondisi aset yang tersedia

| Kategori | Label di aplikasi |
|---|---|
| Mesin cuci | Mesin cuci |
| Mesin pengering | Mesin pengering |
| Setrika | Setrika |
| Timbangan | Timbangan |
| Peralatan | Peralatan |
| Barang dijual | Barang dijual |
| Bahan habis pakai | Bahan habis pakai |
| Lainnya | Lainnya |

| Kondisi | Label di aplikasi |
|---|---|
| Normal | Normal |
| Perlu perbaikan | Perlu perbaikan |
| Rusak | Rusak |

### Cara memperbarui kondisi aset

1. Buka **Modul** → **Daftar Aset Cabang**.
2. Pilih cabang.
3. Ketuk aset yang berubah kondisinya.
4. Ubah kondisi dan tuliskan catatan bila perlu.
5. Simpan.

![Layar Daftar Aset Cabang dengan peralatan per cabang](aset/gambar/04-daftar-aset-cabang.png)

> **PERHATIAN**
> Foto aset hanya tersimpan di perangkat tempat foto itu diambil dan tidak diunggah ke server. Aset yang sama pada perangkat lain tidak akan menampilkan foto tersebut.

## Biaya operasional

Kategori pengeluaran yang tersedia:

| Kategori | Label di aplikasi |
|---|---|
| Gaji pegawai | Gaji pegawai |
| Sewa laundry | Sewa laundry |
| Listrik & air | Listrik & air |
| Perbaikan mesin | Perbaikan mesin |
| Bahan laundry | Bahan laundry |
| Transportasi | Transportasi |
| Pemasaran | Pemasaran |
| Lainnya | Lainnya |

## Cara memverifikasi

| Yang diperiksa | Caranya |
|---|---|
| Pengeluaran tercatat di cabang yang benar | Buka **Biaya operasional**, periksa kolom cabang |
| Pengeluaran masuk ke laporan | Buka **Laporan transaksi** periode yang sama |
| Aset yang perlu perbaikan terlihat | Saring **Daftar Aset Cabang** pada cabang terkait |

## Cara memulihkan

| Tindakan | Dapat dipulihkan? | Caranya |
|---|---|---|
| Ubah harga | Ya | Kembalikan nilainya di layar yang sama |
| Ubah jumlah stok | Ya | Catat **Set stok akhir** sesuai hitungan fisik |
| Ubah kondisi aset | Ya | Perbarui kembali kondisinya |
| Hapus produk | Tidak dari aplikasi | Anggap permanen |
| Hapus aset | Tidak dari aplikasi | Anggap permanen |

## Bila hasilnya berbeda

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| Harga baru tidak muncul di transaksi | Layanan yang dipakai berbeda, atau transaksi dibuat sebelum perubahan | Periksa layanan pada nota, periksa waktu perubahan |
| Stok tidak cocok walau sudah dicatat | Pencatatan dilakukan dua kali, atau jenis pencatatan salah | Hitung fisik, lalu pakai **Set stok akhir** |
| Aset tidak muncul di cabang | Aset dimiliki cabang lain | Buka **Daftar Aset Cabang**, ganti penyaring cabang |
| Foto aset tidak muncul di perangkat lain | Foto hanya tersimpan di perangkat asalnya | Foto ulang di perangkat yang bersangkutan |
