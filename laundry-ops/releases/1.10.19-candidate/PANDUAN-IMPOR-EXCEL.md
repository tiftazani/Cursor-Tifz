# Cara mengisi data Cuciin dari Excel

Alur: **Anda isi Excel → kirim ke saya → saya konversi ke SQL → saya tembak ke database produksi.**

## 1. Isi berkas Excel

Berkas: `template-data-cuciin.xlsx`

Isi sembilan sheet berikut. Baris contoh berwarna abu-abu boleh dihapus. Kolom bertanda bintang (`*`) wajib diisi.

| Sheet | Isi | Rujukan antar-sheet |
|---|---|---|
| Cabang | kode, nama, lokasi, peta | kode dipakai sheet lain |
| JenisAset | kode, nama | dipakai kolom `jenisAset` di Aset |
| RoleAkses | nama, modul, fungsi | dipakai kolom `roleAkses` di Karyawan |
| Karyawan | nama, email, peran, cabang, role akses, kata sandi | cabang memakai kode Cabang |
| Layanan | nama, satuan, harga, retail, dropOut, selfService, komisi, produk | produk memakai kode Produk |
| Produk | kode, nama, jenis, satuan, minimum | |
| StokAwal | produk, cabang, jumlah | produk + cabang |
| Aset | cabang, jenis aset, nama, merk, nomor seri, jumlah, satuan, kondisi, tanggal beli, catatan, dijual | cabang + jenis aset |
| Pelanggan | nama, telepon, alamat | |

Urutan pengisian yang disarankan: **Cabang → JenisAset → Produk → RoleAkses → sisanya**.

Catatan penting:

- Kode cabang dipakai untuk membentuk Aset ID, misalnya `BNY-MC-001`. Pakai 3 sampai 6 huruf/angka tanpa spasi.
- Stok dicatat per cabang. Satu baris berarti satu produk di satu cabang.
- Aset ID tidak diisi manual; sistem yang membuat.
- Email karyawan harus unik. Peran akun: Owner, Supervisor, atau Kasir.
- Kata sandi karyawan minimal 8 karakter. Kalau dikosongkan, kata sandi diatur lewat aplikasi.
- Data yang sudah ada tidak perlu ditulis ulang. Cabang, produk, jenis aset, role, dan layanan yang sudah terdaftar akan dilewati, bukan diduplikasi.

## 2. Kirim berkasnya

Kirim berkas Excel yang sudah diisi. Saya akan:

1. Membaca acuan dari database supaya data lama tidak tertimpa atau terduplikasi.
2. Mengubah isian menjadi SQL, sekaligus menuliskan jurnal `sync_changes` supaya perangkat yang sudah terpasang menerima datanya.
3. Menembakkan SQL ke database.
4. Membaca balik hasilnya dan melaporkan jumlah baris per bagian serta baris yang dilewati.

## 3. Yang perlu Anda tahu

- Impor bersifat **idempoten**: menjalankan berkas yang sama dua kali tidak menggandakan data.
- Baris yang salah tidak membatalkan seluruh impor. Baris itu dilaporkan agar bisa diperbaiki lalu dikirim ulang.
- Data contoh bawaan aplikasi masih ada. Hapus lewat menu masing-masing sebelum aplikasi dipakai untuk transaksi nyata.

## Berkas pendukung

| Berkas | Kegunaan |
|---|---|
| `scripts/fetch_d1_reference.py` | Membaca daftar cabang, produk, jenis aset, role, karyawan, dan layanan yang sudah ada di database |
| `scripts/import_template_to_d1.py` | Mengubah Excel menjadi SQL beserta jurnal sinkronisasi |

Contoh pemakaian:

```bash
# 1. Ambil acuan dari database
python3 scripts/fetch_d1_reference.py --out /tmp/known.json \
  --database cuciin-db

# 2. Ubah Excel menjadi SQL
python3 scripts/import_template_to_d1.py template-data-cuciin.xlsx --out /tmp/impor.sql

# 3. Jalankan ke database
cd cloudflare
npx --no-install wrangler d1 execute cuciin-db --remote --file /tmp/impor.sql
```

Untuk uji coba, ganti `cuciin-db` menjadi `cuciin-debug-db` dan tambahkan `--config wrangler.debug.toml`.
