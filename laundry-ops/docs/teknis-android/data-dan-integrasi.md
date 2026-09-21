# Data dan Integrasi

Bagaimana Cuciin menyimpan data di perangkat dan menyinkronkannya ke server.

> Ringkasan: perangkat adalah tempat kerja yang menyimpan datanya sendiri, dan server adalah titik temu antarcabang. Perubahan dikirim sebagai perintah bernomor, bukan sebagai salinan seluruh data.

## Tujuan

Menyinkronkan salinan utuh seluruh data akan menghapus pekerjaan satu cabang ketika cabang lain menyimpan perubahan yang lebih baru. Cuciin menghindari itu dengan mengirim perintah: setiap perubahan punya nomor unik, dikirim sekali, dan dicatat server sebagai sudah dikerjakan. Perintah yang sama tidak dijalankan dua kali.

## Letak dalam sistem

```text
Layar                 CuciinStore              CloudSync              Worker
  |                        |                       |                     |
  |-- tekan Simpan ------->|                       |                     |
  |                        |-- periksa izin        |                     |
  |                        |-- ubah keadaan        |                     |
  |                        |-- catat jurnal        |                     |
  |                        |-- masukkan ke antrean->|                    |
  |<-- tampilan berubah ---|                       |                     |
  |                                                |-- kirim batch ------>|
  |                                                |<-- diterima/ditolak--|
```

## Cara kerja

### Penyimpanan lokal

Data disimpan sebagai satu berkas JSON di penyimpanan internal aplikasi dengan nama `cuciin-data.json`. Berkas ini memuat seluruh keadaan: cabang, karyawan, pelanggan, layanan, produk, pesanan, absensi, kas, audit, serta role dan kebijakan akses.

Isi berkas itu memuat `sessionEmail`, yaitu akun yang sedang memakai perangkat. Karena itu berkas ini hanya boleh dibaca setelah aplikasi dihentikan paksa:

```bash
adb shell am force-stop com.cuciin.laundryops.debug
adb shell run-as com.cuciin.laundryops.debug cat files/cuciin-data.json
```

> **PERHATIAN**
> Membaca berkas itu saat aplikasi masih berjalan memberi keadaan setengah tersimpan dan mudah disalahartikan. Hentikan aplikasi lebih dulu. Jangan mengubah berkas ini secara langsung untuk memperbaiki data; perubahan langsung tidak tercatat di jurnal audit dan tidak akan sampai ke server.

### Antrean perubahan

Setiap perubahan masuk ke antrean sebagai perintah. Setiap perintah memiliki:

| Elemen | Fungsi |
|---|---|
| Nomor perintah | Membedakan satu perintah dari yang lain, sehingga tidak dikerjakan dua kali |
| Jenis perintah | Menentukan tindakan, misalnya membuat pesanan atau mencatat pembayaran |
| Entitas | Data yang berubah |
| Waktu kejadian | Urutan perubahan |
| Cabang asal | Batas wewenang saat perintah itu dibuat |

Antrean ini bertahan di perangkat. Bila aplikasi ditutup atau perangkat dinyalakan ulang, perintah yang belum terkirim tetap menunggu.

### Pengiriman ke server

Server menerima kumpulan perintah dalam satu permintaan, lalu mengembalikan hasil per perintah:

| Hasil | Arti |
|---|---|
| Diterima | Perintah sudah tercatat, perangkat boleh membuangnya dari antrean |
| Ditolak | Perintah melanggar aturan, misalnya hak akses sudah dicabut atau cabang tidak sesuai |
| Revision | Nomor revisi data server, dipakai menentukan keadaan terbaru |

Untuk membaca keadaan terbaru, perangkat mengirim revisi yang dimilikinya. Bila server sudah lebih baru, server mengirim selisihnya. Inilah sebabnya jumlah data yang berpindah tetap kecil walaupun data bertambah terus.

### Foto dan berkas besar

Foto bukti hanya disimpan di perangkat dan **tidak** ikut ke server. Saat keadaan dikirim ke server, jalur foto dikosongkan lebih dulu, lalu dipasang kembali dari salinan lokal ketika data server diterapkan. Aturan ini berlaku untuk foto pesanan, absensi, dan aset.

### Autentikasi

Masuk akun memakai Firebase Authentication. Setelah kata sandi benar, aplikasi meminta server memverifikasi identitas dan mengambil peran pengguna. Bila server menolak, sesi dibatalkan.

Saat aplikasi dibuka kembali, sesi dipulihkan dari `sessionEmail` tanpa meminta kata sandi lagi.

### Otorisasi

Otorisasi berjalan dua lapis dan keduanya harus lulus.

**Lapis pertama, gerbang rute.** `ui/RouteAccess.kt` menentukan rute mana yang boleh dibuka.

**Lapis kedua, fungsi katalog.** `AccessPolicy.can` menentukan boleh atau tidak untuk satu tindakan. Owner selalu mendapat seluruh modul dan fungsi. Peran lain mendapat hak dari role yang dipasang, lalu dipersempit oleh kebijakan pengguna bila ada.

Kebijakan pengguna hanya dapat mengurangi, tidak pernah menambah, hak yang sudah dimiliki role.

## Kontrak dan dependensi

| Elemen | Tipe | Keterangan |
|---|---|---|
| `cuciin-data.json` | berkas | Keadaan lengkap di perangkat |
| `SyncCommand` | data | Satu perintah perubahan dengan nomor unik |
| `SyncCommandBatch` | data | Kumpulan perintah dalam satu pengiriman |
| `SyncCommandResult` | data | Hasil per perintah dari server, termasuk alasan penolakan |
| Revisi | angka | Nomor keadaan server untuk mengambil selisih |
| `CUCIIN_CLOUD_URL` | konfigurasi build | Alamat layanan server |

## Verifikasi

| Yang diperiksa | Caranya |
|---|---|
| Antrean benar-benar kosong setelah sinkronisasi | Periksa jumlah perintah menunggu dan tertolak di layar status sinkronisasi |
| Server tidak mengerjakan perintah dua kali | Kirim perintah yang sama dua kali, keadaan akhir harus sama |
| Foto tidak ikut ke server | Periksa balasan server: jalur foto harus kosong |
| Revisi bertambah setelah perubahan | Bandingkan nomor revisi sebelum dan sesudah menyimpan |

## Risiko dan batasan

- **Jangan menghidupkan kembali penyimpanan salinan utuh.** Pola itu pernah dipakai dan digantikan oleh perintah bernomor. Menghidupkannya kembali akan menimpa perubahan antar cabang.
- **Perangkat `1.10.29` masih menulis format lama.** Server harus menerima kunci lama sampai seluruh cabang berpindah.
- **Antrean yang menumpuk berarti masalah jaringan atau penolakan berulang.** Perintah yang ditolak harus diperiksa alasannya, bukan dihapus diam-diam.
- **Membaca berkas lokal saat aplikasi berjalan menyesatkan.** Selalu hentikan paksa lebih dulu.
