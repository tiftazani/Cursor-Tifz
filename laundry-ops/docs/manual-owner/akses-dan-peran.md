# Akses dan Peran

Siapa boleh melakukan apa, dan bagaimana mengubahnya dengan aman.

> Ringkasan: akses ditentukan oleh centang fungsi pada role, bukan oleh nama pengguna. Satu perubahan role langsung berlaku untuk semua orang yang memakainya.

## Dampak bisnis

Hak akses adalah pengaman utama data usaha Anda. Memberi centang terlalu longgar membuat transaksi dan harga bisa diubah orang yang tidak seharusnya. Menarik centang terlalu ketat membuat pekerjaan harian terhenti karena menu tidak muncul. Bagian ini menjelaskan akibat setiap pilihan sebelum Anda menekan simpan.

## Siapa yang terdampak

| Peran | Dampak perubahan role | Tindakan lanjutan |
|---|---|---|
| Pengguna dengan role yang diubah | Menu dan tombolnya berubah seketika | Beri tahu mereka untuk membuka ulang aplikasi |
| Owner | Tidak terdampak; Owner selalu memiliki seluruh akses | Tidak ada |
| Supervisor dan Kasir | Terdampak bila role-nya diubah | Periksa ulang panduan perannya |
| Pelanggan | Tidak terdampak langsung | Tidak ada |

## Struktur akun, cabang, dan peran

Tiga hal ini terpisah dan sering dikira satu hal yang sama.

| Hal | Artinya | Diatur di |
|---|---|---|
| Akun | Satu orang dengan email dan kata sandi | **Daftar User** |
| Cabang | Tempat orang itu bekerja; menentukan data yang terlihat | **Cabang** dan **Daftar User** |
| Role | Kumpulan centang modul dan fungsi | **Kontrol Akses Role** |

Satu role dapat dipakai banyak akun. Satu akun memiliki tepat satu role dan satu atau lebih cabang.

## Peran bawaan

| Role | Modul | Fungsi | Sifat |
|---|---:|---:|---|
| Owner | 15 | 41 | Seluruh akses, tanpa terkecuali |
| Supervisor | 6 | 10 | Kerja harian cabang, tanpa transaksi dan keuangan |
| Kasir | 8 | 16 | Melayani pelanggan, mencatat transaksi, menutup kas |

Modul yang dimiliki masing-masing role bawaan:

| Modul | Owner | Supervisor | Kasir |
|---|:---:|:---:|:---:|
| Antrian | Ya | Ya | Ya |
| Service | Ya | Ya | Ya |
| Pelanggan | Ya | Tidak | Ya |
| Produk & stok | Ya | Ya | Ya |
| Daftar Aset Cabang | Ya | Ya | Tidak |
| Absensi | Ya | Ya | Ya |
| WhatsApp | Ya | Tidak | Ya |
| Biaya operasional | Ya | Tidak | Ya |
| Kas | Ya | Tidak | Ya |
| Laporan | Ya | Ya | Tidak |
| Riwayat aktivitas | Ya | Tidak | Tidak |
| Cabang | Ya | Tidak | Tidak |
| Daftar User | Ya | Tidak | Tidak |
| Layanan & harga | Ya | Tidak | Tidak |
| Kontrol Akses | Ya | Tidak | Tidak |

![Layar Kontrol Akses Role dengan daftar role dan cakupan modulnya](aset/gambar/17-kontrol-akses-role.png)

> **INFORMASI**
> Tabel ini menggambarkan role **bawaan**. Setelah Anda mengubah centangnya, isinya mengikuti perubahan Anda.

## Fungsi yang hanya dapat diberikan Owner

Lima belas fungsi berikut melekat pada Owner. Centangnya tetap dapat Anda berikan kepada role lain bila memang diperlukan, tetapi daftar ini adalah nilai bawaan yang paling aman dibiarkan hanya pada Owner.

| Kelompok | Fungsi |
|---|---|
| Cabang | Kelola cabang, hapus cabang |
| Pengguna | Kelola user, setujui pendaftar, hapus user |
| Layanan | Kelola layanan, hapus layanan |
| Produk | Kelola produk, hapus produk |
| Jenis aset | Kelola jenis aset |
| Service | Hapus Service |
| Pelanggan | Hapus pelanggan |
| Absensi | Koreksi absensi karyawan |
| Akses | Atur role, tetapkan role user |
| WhatsApp | Ubah template WhatsApp |

## Cara mengubah akses sebuah role

**Hasil akhir:** Role memiliki centang yang sesuai kebutuhan, dan pengguna role itu melihat menu yang benar.

**Sebelum mulai:**

- Tentukan role mana yang akan diubah
- Tentukan fungsi mana yang ditambah atau dikurangi beserta alasannya

## Langkah

1. Buka **Modul** → **Kontrol Akses Role**.
2. Pilih role yang akan diubah.
3. Periksa daftar **Modul yang dapat diakses**.
4. Nyalakan atau matikan centang modul. Mematikan modul otomatis menutup seluruh fungsi di dalamnya.
5. Periksa daftar fungsi, nyalakan yang memang dibutuhkan.
6. Periksa kembali sebelum menyimpan.
7. Simpan.

![Layar Role Owner dengan preset peran dan daftar modul yang dapat diakses](aset/gambar/23-detail-role-owner.png)

## Menggunakan preset sebagai titik awal

Layar role menyediakan **Preset peran**. Preset mengisi centang sekaligus, lalu Anda dapat mengubahnya satu per satu. Preset adalah titik awal saat menyiapkan role baru, bukan sumber hak yang berlaku otomatis.

> **PERHATIAN**
> Menyimpan perubahan role berlaku untuk **semua pengguna** yang memakai role itu, bukan hanya akun yang sedang Anda pikirkan. Bila satu orang memerlukan tambahan akses sementara, pertimbangkan membuat role terpisah agar yang lain tidak ikut terbuka.

## Menambah pengguna

**Hasil akhir:** Pengguna baru dapat masuk dan langsung memiliki akses sesuai role-nya.

**Sebelum mulai:**

- Nama, email, dan peran pengguna
- Cabang tempat ia bekerja

## Langkah

1. Buka **Modul** → **Daftar User**.
2. Tekan **Tambah user**.
3. Isi nama, email, dan pilih role serta cabang.
4. Simpan.
5. Berikan kata sandi awal kepada pengguna, dan minta ia segera menggantinya.

![Layar Daftar User dengan pencarian, penyaring peran, dan tombol tambah](aset/gambar/14-daftar-user.png)

## Menyetujui pendaftar

Pengguna yang mendaftar sendiri dari aplikasi masuk dalam keadaan menunggu persetujuan. Selama belum disetujui, ia tidak dapat memakai aplikasi.

## Langkah

1. Buka **Modul** → **Daftar User**.
2. Cari akun yang berstatus menunggu.
3. Pilih tindakan menyetujui.
4. Tetapkan role dan cabangnya.
5. Simpan.

## Cara memverifikasi

| Yang diperiksa | Caranya |
|---|---|
| Peran yang terlihat pengguna | Minta ia membuka **Modul**; judul akun harus menyebut perannya |
| Menu yang seharusnya muncul | Bandingkan dengan matriks modul di atas |
| Perubahan role berlaku untuk semua | Masuk dengan dua akun berbeda yang memakai role yang sama |

## Cara memulihkan

Perubahan role dapat dibatalkan dengan mengembalikan centangnya. Bila terjadi kekeliruan dan Anda tidak ingat susunan sebelumnya:

1. Buat role baru dengan preset yang sesuai, mis. **Kasir**.
2. Pindahkan pengguna yang terdampak ke role baru itu.
3. Perbaiki role lama sebelum dipakai lagi.

> **BAHAYA**
> Menghapus role yang sedang dipakai pengguna akan membuat pengguna itu kehilangan akses. Pindahkan penggunanya lebih dulu.

## Kesalahan umum

| Kesalahan | Akibat | Cara menghindari |
|---|---|---|
| Menyalakan centang hanya untuk satu orang | Semua pengguna role itu ikut terbuka | Buat role terpisah untuk kebutuhan khusus |
| Mematikan modul padahal fungsi diinginkan | Fungsi otomatis tertutup | Periksa modul sebelum fungsi |
| Mengira nama role menentukan akses | Harapan tidak sesuai kenyataan | Selalu periksa centangnya |
| Mengganti role pengguna tanpa memberi tahu | Pengguna bingung karena menunya berubah | Beri tahu sebelum perubahan |
