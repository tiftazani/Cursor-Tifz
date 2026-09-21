# Siklus Transaksi

Perjalanan satu cucian, dari pelanggan datang sampai notanya terkirim.

> Ringkasan: satu pesanan melewati tiga status pengerjaan dan dua status pembayaran. Memahami urutannya membuat Anda dapat membaca laporan dan mencari masalah dengan cepat.

## Dampak bisnis

Setiap pesanan yang berhenti di tengah siklus adalah uang dan pelanggan yang menunggu. Bagian ini menunjukkan di mana pesanan bisa tersangkut, dan angka mana yang menunjukkannya.

## Alur lengkap

```text
Pelanggan datang
      |
      v
Pelanggan terdaftar?  --- tidak --->  buat pelanggan baru
      | ya
      v
Buat Service baru  --->  status: Menunggu dikerjakan
      |
      v
Cucian dikerjakan  --->  status: Sedang dikerjakan
      |
      +--> pembayaran dicatat  --->  Belum lunas atau Lunas
      |
      v
Cucian selesai  --->  status: Selesai
      |
      v
Nota dikirim lewat WhatsApp
      |
      v
Serah terima ke pelanggan  --->  pesanan tertutup
```

## Status yang benar-benar dipakai aplikasi

### Status pengerjaan

| Status | Label di aplikasi | Artinya |
|---|---|---|
| Masuk | Menunggu dikerjakan | Nota sudah dibuat, cucian belum mulai dikerjakan |
| Progress | Sedang dikerjakan | Cucian sedang diproses |
| Selesai | Selesai | Cucian siap diambil atau diserahkan |

### Status pembayaran

| Status | Label di aplikasi | Artinya |
|---|---|---|
| Belum | Belum lunas | Masih ada tagihan yang belum dibayar |
| Lunas | Lunas | Seluruh tagihan sudah dibayar |

### Metode pembayaran

| Metode | Label di aplikasi |
|---|---|
| Tunai | Tunai |
| QRIS | QRIS |
| Transfer | Transfer |

> **INFORMASI**
> Status pengerjaan dan status pembayaran berjalan terpisah. Sebuah pesanan dapat berstatus **Selesai** sementara pembayarannya masih **Belum lunas**.

## Siapa yang terdampak di setiap tahap

| Tahap | Peran yang mengerjakan | Dampak bila terlewat |
|---|---|---|
| Pendaftaran pelanggan | Kasir | Nama pelanggan ganda, riwayat sulit dilacak |
| Pembuatan Service | Kasir | Penghasilan tidak tercatat |
| Perubahan status | Kasir, Supervisor | Pelanggan menerima informasi yang salah |
| Pencatatan pembayaran | Kasir | Kas tidak cocok saat ditutup |
| Pengiriman nota | Kasir | Pelanggan tidak menerima rincian |
| Serah terima | Supervisor, Kasir | Cucian tertahan di antrian walaupun sudah diambil |

## Menerima pesanan

Langkah lengkapnya ada di [Manual Kasir](../manual-peran/kasir/index.md#menerima-pesanan-baru).

![Layar Service baru dengan pilihan pelanggan, layanan, dan ringkasan transaksi](aset/gambar/02-service-baru.png)

## Mengoreksi pesanan yang keliru

**Dampak bisnis:** Koreksi menjaga angka laporan tetap benar. Setiap koreksi tercatat di **Riwayat aktivitas** bersama nama pelakunya.

**Siapa yang terdampak:**

| Peran | Dampak | Tindakan lanjutan |
|---|---|---|
| Kasir | Dapat mengoreksi pesanan di cabangnya | Periksa ulang rincian sebelum menyimpan |
| Supervisor | Tidak dapat mengoreksi | Meneruskan ke Owner atau Kasir |
| Owner | Dapat mengoreksi termasuk pesanan yang sudah dikirim | Periksa dampaknya ke laporan periode terkait |

## Cara mengubah

1. Buka **Antrian laundry**.
2. Buka pesanan yang akan dikoreksi.
3. Perbaiki bagian yang keliru, mis. berat, jenis layanan, atau pembayaran.
4. Periksa ringkasan.
5. Simpan.

> **PERHATIAN**
> Mengoreksi berat atau jenis layanan mengubah nilai tagihan. Bila pelanggan sudah membayar, periksa kembali status pembayarannya setelah koreksi agar tidak menjadi **Belum lunas** tanpa disadari.

## Cara memverifikasi

| Yang diperiksa | Caranya |
|---|---|
| Koreksi tercatat | Buka **Riwayat aktivitas**, cari waktu kejadiannya |
| Nilai laporan ikut berubah | Buka **Laporan transaksi** untuk periode yang sama |
| Status pembayaran konsisten | Buka pesanannya, periksa sisa tagihannya |

## Cara memulihkan

Koreksi dapat dikoreksi kembali selama pesanan belum dihapus. Pesanan yang sudah dihapus tidak dapat dikembalikan dari dalam aplikasi.

## Pembatalan pesanan

Pembatalan berbeda dari koreksi. Pesanan yang dibatalkan akan hilang dari antrian.

**Siapa yang boleh:** Hanya pemegang fungsi hapus Service. Bawaannya hanya Owner.

## Langkah

1. Pastikan pesanan ini memang harus dibatalkan, bukan sekadar dikoreksi.
2. Buka pesanan di **Antrian laundry**.
3. Pilih tindakan hapus.
4. Pastikan kembali pilihan Anda.

> **BAHAYA**
> Menghapus Service tidak dapat dibatalkan dari dalam aplikasi. Foto bukti dan riwayat pembayarannya ikut hilang dari daftar aktif. Bila pelanggan sudah membayar, selesaikan urusan pengembalian dana lebih dulu.

## Cara memverifikasi

| Yang diperiksa | Caranya |
|---|---|
| Pesanan hilang dari antrian | Cari nomor nota di **Antrian laundry** dan **Laporan transaksi** |
| Penghapusan tercatat | Buka **Riwayat aktivitas** |

## Cara memulihkan

Pemulihan hanya mungkin bila data server belum melewati masa simpan, dan memerlukan bantuan teknis. Anggap penghapusan sebagai tindakan permanen.

## Bila hasilnya berbeda

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| Pesanan tidak muncul di antrian | Penyaring **Periode** atau **Cabang** tidak sesuai | Ganti ke Hari ini dan cabang yang benar |
| Nota tidak masuk daftar WA menunggu | Nota sudah pernah dikirim | Periksa **Arsip WA** |
| Cucian telat bertambah padahal sudah diserahkan | Status belum diperbarui | Buka pesanannya dan perbarui statusnya |
| Angka antrian berbeda antar perangkat | Sinkronisasi belum selesai | Pastikan perangkat terhubung, tunggu sinkronisasi |
