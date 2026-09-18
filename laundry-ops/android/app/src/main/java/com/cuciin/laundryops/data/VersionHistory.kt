package com.cuciin.laundryops.data

/**
 * Sumber versi di app. Selaras dengan `versionName` / `versionCode` di Gradle.
 * Tambah entri di sini setiap bump APK, lalu layar Riwayat versi membacanya.
 */
data class AppRelease(
    val name: String,
    val code: Int,
    val date: String,
    val notes: List<String>,
)

object VersionHistory {
    val currentName: String = "1.10.23"
    val currentCode: Int = 42

    val releases: List<AppRelease> = listOf(
        AppRelease(
            name = "1.10.23", code = 42, date = "18 Sep 2026",
            notes = listOf(
                "Perbaikan izin: dua menu Laporan memakai izin yang salah sehingga SPV yang berhak tetap terkunci, sementara mencentang modul Laporan di Kontrol Akses Role tidak berpengaruh apa pun.",
                "Perbaikan: Riwayat aktivitas tidak lagi memakai cabang lama yang sudah tidak ada, sehingga catatannya ikut tersinkron ke perangkat.",
                "Perbaikan: aplikasi tidak lagi menutup sendiri saat katalog cabang belum tersedia, misalnya pada basis data baru atau saat impor belum dijalankan.",
                "Pengerasan: pemetaan label periode di laporan analitik tidak lagi memakai pola yang melempar pengecualian, sehingga menambah pilihan periode baru tidak bisa mematikan layar.",
            ),
        ),
        AppRelease(
            name = "1.10.22", code = 41, date = "18 Sep 2026",
            notes = listOf(
                "Perbaikan penting: menu Antrian laundry dan Service baru di layar Modul tidak lagi menutup aplikasi saat diklik.",
                "Menu yang hanya untuk peran tertentu kini disembunyikan dari layar Modul, sejalan dengan tab di bawah.",
            ),
        ),
        AppRelease(
            name = "1.10.21", code = 40, date = "18 Sep 2026",
            notes = listOf(
                "Tampilan memakai nuansa biru Cuciin, senada dengan logo dan layar pembuka.",
                "Tema Light memakai biru dan biru langit; tema Dark memakai navy tua dengan aksen biru langit.",
                "Tema Custom kini punya preset siap pakai: Biru Cuciin, Biru Cuciin Gelap, dan Magenta Jemur.",
                "Perbaikan: hanya Owner yang dapat mengubah harga Service. Kasir dan SPV tidak melihat tombolnya, dan sistem menolak perubahannya.",
                "Fungsi Ubah harga Service dapat diatur di Kontrol Akses Role, bawaannya hanya Owner.",
            ),
        ),
        AppRelease(
            name = "1.10.20", code = 39, date = "18 Sep 2026",
            notes = listOf(
                "Perbaikan: warna dialog pemilih tanggal dan jam kini mengikuti warna aplikasi.",
                "Sebelumnya tombol Pilih dan Batal berwarna teal bawaan Android sehingga terlihat tidak cocok dengan tombol aplikasi yang berwarna magenta.",
                "Berlaku di semua tempat yang memilih tanggal: filter periode, estimasi selesai Service, tanggal kejadian stok, tanggal beli aset, dan laporan.",
            ),
        ),
        AppRelease(
            name = "1.10.19", code = 38, date = "18 Sep 2026",
            notes = listOf(
                "Nama pemilik di aplikasi tidak lagi memakai nama pribadi, tetapi nama usaha.",
                "Nama pada data server ikut diperbarui sehingga semua perangkat menerima perubahan yang sama.",
            ),
        ),
        AppRelease(
            name = "1.10.18", code = 37, date = "18 Sep 2026",
            notes = listOf(
                "Perbaikan: di halaman terakhir layar pembuka tidak ada lagi tombol kedua yang tulisannya tidak sesuai.",
                "Tombol kedua hanya muncul selama masih ada halaman yang bisa dilewati.",
            ),
        ),
        AppRelease(
            name = "1.10.17", code = 36, date = "18 Sep 2026",
            notes = listOf(
                "Perbaikan: judul dan tombol di layar pembuka tidak lagi saling menimpa.",
                "Tata letak layar pembuka disusun satu kolom supaya judul selalu duduk di atas tombol berapa pun tinggi layar.",
                "Judul panjang kini terbungkus dua baris dengan jarak yang cukup, bukan terpotong.",
            ),
        ),
        AppRelease(
            name = "1.10.16", code = 35, date = "18 Sep 2026",
            notes = listOf(
                "Layar pembuka baru berisi tiga halaman: semua cabang dalam satu aplikasi, tetap jalan tanpa internet, dan akses sesuai peran.",
                "Layar pembuka muncul sekali setelah aplikasi dipasang, dan bisa dibuka lagi lewat tautan Tentang aplikasi di halaman masuk.",
                "Halaman login memakai kartu kaca tembus pandang, jadi wallpaper terlihat di belakangnya.",
                "Perbaikan: bar putih di bawah halaman login hilang; wallpaper kini mencapai tepi paling bawah layar.",
                "Tombol Daftar akun baru, Lupa kata sandi, dan Tentang aplikasi ditata ulang di halaman masuk.",
            ),
        ),
        AppRelease(
            name = "1.10.15", code = 34, date = "17 Sep 2026",
            notes = listOf(
                "Aplikasi versi debug kini bernama Cuciin Debug di layar HP, jadi tidak tertukar dengan versi asli.",
                "Nama aplikasi versi rilis tetap Cuciin.",
            ),
        ),
        AppRelease(
            name = "1.10.14", code = 33, date = "17 Sep 2026",
            notes = listOf(
                "Perbaikan: setelah membuka Service baru dari layar Antrian, tab Antrian dan tab lain tidak lagi macet.",
                "Perpindahan tab kini memakai satu cara yang seragam untuk semua tab, jadi tidak ada lagi tab yang diam sendiri.",
                "Menekan tab yang sedang aktif tidak lagi menambah tumpukan layar.",
            ),
        ),
        AppRelease(
            name = "1.10.13", code = 32, date = "17 Sep 2026",
            notes = listOf(
                "Perbaikan: layar login tidak lagi terpotong saat keyboard terbuka; tulisan Lupa kata sandi dan tombol Daftar akun kini selalu terjangkau.",
                "Saat keyboard muncul, isi login dipadatkan dan layar otomatis menggulir secukupnya ke kartu isian.",
                "Saat keyboard tertutup, layar login tetap satu layar penuh tanpa gulir seperti sebelumnya.",
            ),
        ),
        AppRelease(
            name = "1.10.12", code = 31, date = "17 Sep 2026",
            notes = listOf(
                "Perbaikan: bar navigasi bawah kini tampil di layar Service seperti di tab lain; sebelumnya hilang hanya di sana.",
                "Perpindahan antar layar memakai animasi geser dan pudar yang halus, bukan muncul seketika.",
                "Tombol dan kartu mengecil sedikit saat ditekan sebagai balasan sentuhan.",
                "Baris daftar muncul mengalir satu per satu, dibatasi beberapa baris pertama saja.",
                "Angka pada kartu status menghitung naik saat berubah, jadi perubahan jumlah terlihat.",
                "Semua animasi mengikuti pengaturan animasi Android: bila pengguna mematikannya, gerak ikut mati.",
            ),
        ),
        AppRelease(
            name = "1.10.11", code = 30, date = "17 Sep 2026",
            notes = listOf(
                "Menu Modul disusun ulang: Pekerjaan harian, Keuangan, Pelanggan, Laporan, Master data, lalu Aplikasi paling bawah.",
                "Theme Aplikasi dan Riwayat versi pindah ke bagian Aplikasi; Riwayat versi kini di urutan paling bawah.",
                "Menu baru Atur urutan menu untuk memindahkan urutan menu sendiri, baik dalam satu bagian maupun antar bagian.",
                "Tiap menu punya panah naik, panah turun, dan tombol pindah bagian; tiap judul bagian punya panah untuk memindahkan seluruh bagian.",
                "Tersedia tombol Kembalikan urutan awal untuk kembali ke susunan bawaan.",
                "Susunan menu disimpan di HP ini saja, tidak ikut tersinkron dan tidak mengubah pengaturan HP lain.",
            ),
        ),
        AppRelease(
            name = "1.10.10", code = 29, date = "17 Sep 2026",
            notes = listOf(
                "Menu baru Theme Aplikasi berisi tiga pilihan: Light, Dark, dan Custom.",
                "Light memakai latar terang dengan aksen pink, Dark memakai latar hitam dengan tulisan terang.",
                "Custom membebaskan enam warna: warna utama, warna tombol, warna latar, warna kartu, warna teks, dan warna header.",
                "Setiap warna diatur lewat slider R, G, B dengan nilai 0 sampai 255, kode hex, dan pratinjau yang berubah langsung.",
                "Warna teks di atas tombol dan header dihitung otomatis dari terang gelapnya warna pilihan, jadi tulisan tetap terbaca.",
                "Pengaturan tema pindah dari Akun & Profil ke menu Theme Aplikasi; Akun & Profil hanya menyediakan pintasan ke sana.",
                "Pengaturan tema tidak ikut tersinkron; setiap HP menyimpan pilihannya sendiri.",
                "Perbaikan server: entityType assetType kini dikenali saat parsing command, sehingga perintah aset tidak lagi ditolak 422 dan tertahan di perangkat.",
                "Perbaikan: ID baris baru selalu unik, sehingga penambahan banyak data sekaligus tidak saling menimpa.",
                "Perbaikan: catatan aktivitas tetap aman meski daftar cabang belum terisi.",
                "Urutan menu Modul disusun ulang: Pekerjaan harian, Keuangan, Pelanggan, Laporan, Master data, lalu Aplikasi paling bawah.",
                "Theme Aplikasi dan Riwayat versi pindah ke bagian Aplikasi; Riwayat versi kini di urutan paling bawah.",
            ),
        ),
        AppRelease(
            name = "1.10.9", code = 28, date = "17 Sep 2026",
            notes = listOf(
                "Filter periode di layar utama kini menyediakan pilihan dua tanggal tertentu, bukan hanya periode cepat.",
                "Laporan transaksi, laporan analitik, dan nota pelanggan dicetak ulang mengikuti desain terbaru.",
                "Laporan transaksi: header periode dan nomor halaman, filter aktif dalam bahasa pengguna, empat kartu metrik, rekonsiliasi berdampingan dengan tabel per cabang, lalu tabel rincian dengan sepuluh kolom.",
                "Laporan transaksi hanya mencetak bagian yang dipilih; tabel kosong tidak lagi dipertahankan demi tata letak.",
                "Laporan analitik: kartu metrik, tren bulanan, donut omzet per cabang dan penerimaan per metode dengan total di tengah, lalu tabel pendukung.",
                "Persentase donut memakai satu angka desimal dan legendanya memuat swatch, nama, nominal, dan persen.",
                "Nota pelanggan: header cabang, kapsul status terpisah, tabel layanan, ringkasan pembayaran dengan total menonjol, dan status pengerjaan.",
                "Seluruh tabel memakai baris yang membungkus dan tinggi menyesuaikan, jadi tidak ada teks yang dipotong dengan elipsis.",
                "Kepala tabel diulang pada halaman baru dan satu transaksi tidak pernah terpotong antarhalaman.",
            ),
        ),
        AppRelease(
            name = "1.10.8", code = 27, date = "17 Sep 2026",
            notes = listOf(
                "Lembar pilihan modul kini memakai kotak centang yang jelas: terisi penuh saat dipilih, kosong bergaris saat tidak.",
                "Setiap baris menampilkan label Dipilih atau Tidak dipilih di sisi kanan, jadi status pilihan tidak lagi bergantung pada warna saja.",
                "Baris terpilih diberi latar berbeda supaya mudah dikenali sekilas.",
                "Lembar pilihan modul menampilkan hitungan seperti 1 dari 12 modul dipilih, plus tombol Pilih semua dan Kosongkan.",
                "Tombol Selesai pada lembar pilihan selalu terlihat penuh; daftar yang panjang dapat digulir tanpa menutupi tombol.",
                "Lembar pilihan tunggal memakai radio, sedangkan pilihan banyak memakai kotak centang, sehingga jenis pilihan langsung terbaca.",
            ),
        ),
        AppRelease(
            name = "1.10.7", code = 26, date = "17 Sep 2026",
            notes = listOf(
                "Tampilan utama memakai dua filter sebaris: periode (bawaan hari ini) dan cabang.",
                "Di bawah filter ada tiga kartu status yang dapat diketuk: Sedang dikerjakan, Cucian telat, dan Selesai.",
                "Cucian telat adalah pesanan yang estimasi selesainya sudah lewat tetapi pengerjaannya belum selesai.",
                "Menu baru Kontrol Akses Role: satu pengguna melekat ke satu role, dan role menentukan modul serta fungsi yang dapat diakses.",
                "Setiap modul menampilkan daftar fungsi dengan kotak centang yang jelas, plus hitungan seperti 2/2 dan 0/1 serta ringkasan pilihan.",
                "Role baru dapat dibuat dari aplikasi; role bawaan hanya dapat diubah hak aksesnya, tidak dapat dihapus.",
                "Kontrol akses pengguna dipindahkan dari Pengaturan Owner ke menu Kontrol Akses Role supaya hak akses diatur sekali per role.",
            ),
        ),
        AppRelease(
            name = "1.10.6", code = 25, date = "17 Sep 2026",
            notes = listOf(
                "Menu Aset & mesin cabang berganti nama menjadi Daftar Aset Cabang dan memakai filter cabang serta jenis aset dalam bentuk dropdown, bukan kartu.",
                "Registrasi aset berpindah ke layar terpisah dengan tombol kembali, bukan formulir yang menempel di bawah daftar.",
                "Aset ID dibuat otomatis dari kode cabang, kode jenis aset, lalu nomor urut tiga digit pada cabang itu. Contoh BNY-MC-001.",
                "Registrasi aset memuat merek, nomor seri, jumlah, satuan, kondisi, tanggal beli, catatan, dan foto aset.",
                "Kondisi aset dipilih lewat tiga kartu Normal, Perlu perbaikan, dan Rusak.",
                "Katalog jenis aset dapat ditambah dari aplikasi; jenis yang sudah dipakai aset tidak dapat dihapus supaya kode aset lama tetap terbaca.",
                "Foto aset disimpan privat di perangkat masing-masing dan tidak dikirim ke server, jadi metadata aset tetap ringan saat disinkronkan.",
            ),
        ),
        AppRelease(
            name = "1.10.5", code = 24, date = "17 Sep 2026",
            notes = listOf(
                "Sistem layout Android diseragamkan: margin layar compact 16dp, jarak dalam kelompok 8dp, dan jarak antarbagian 16dp.",
                "Menu Modul kini berupa daftar berkelompok dengan baris yang ringkas, bukan grid kartu besar.",
                "Antrian memakai dua filter per baris untuk Owner dan daftar Service berbentuk baris lazy agar tetap cepat dipindai saat data bertambah.",
                "Pengaturan Owner memakai bottom sheet multi-select untuk modul dan fungsi, dengan tombol Selesai yang selalu terlihat.",
                "Diagram donat aplikasi dan PDF memakai warna kategorikal yang berbeda, legenda konsisten, serta label persen pada bagian yang cukup besar.",
                "Grafik tren dengan hanya satu periode ditampilkan sebagai batang horizontal berlabel, tanpa bidang kosong besar.",
            ),
        ),
        AppRelease(
            name = "1.10.4", code = 23, date = "17 Sep 2026",
            notes = listOf(
                "PDF dan CSV laporan transaksi kini benar-benar memuat seluruh bagian yang dipilih di filter Tampilan laporan, bukan hanya rincian.",
                "Bagian yang panjang pindah ke halaman berikutnya dengan kepala tabel yang diulang, jadi tidak ada baris yang terpotong.",
                "PDF laporan analitik memuat diagram batang tren bulanan dan diagram donat omzet per cabang serta penerimaan per metode.",
                "PDF laporan analitik mencetak seluruh Service pada filter, dengan halaman lanjutan bila lebih dari satu halaman.",
                "Tombol Excel di laporan analitik mengekspor semua tabel yang tampil di layar: ringkasan, tren, per cabang, per metode, peringkat kasir, dan rincian Service.",
                "Bilah filter dibuat lebih ringkas sehingga dua filter muat dalam satu baris layar.",
            ),
        ),
        AppRelease(
            name = "1.10.3", code = 22, date = "17 Sep 2026",
            notes = listOf(
                "Laporan transaksi dan laporan analitik dipisah menjadi dua menu. Laporan transaksi memuat rincian dan rekap; laporan analitik memuat tren, komposisi, dan peringkat.",
                "Laporan analitik menangkap seluruh data yang terlihat akun, dengan filter periode, cabang, kasir, dan jenis data yang semuanya bisa dipilih lebih dari satu.",
                "Laporan analitik menyediakan diagram batang tren omzet bulanan dan diagram donat untuk komposisi omzet per cabang serta penerimaan per metode.",
                "Nama kasir dan petugas pada seluruh laporan, PDF, dan CSV kini mengikuti nama terkini di Daftar User, bukan nama saat transaksi dibuat.",
                "Laporan transaksi memakai box daftar yang bisa digulir sendiri, jadi ribuan transaksi tidak memanjangkan layar.",
            ),
        ),
        AppRelease(
            name = "1.10.2", code = 21, date = "17 Sep 2026",
            notes = listOf(
                "Penerimaan pembayaran kini dicatat sebagai jurnal terpisah per waktu dan metode, sehingga pembayaran bertahap tidak dipindahkan ke tanggal Service dibuat.",
                "Kas harian memakai jurnal pembayaran, tutup kas hanya dapat dibuat sekali per cabang per hari, dan koreksi maupun hapus Service tidak dapat mengurangi uang yang sudah diterima tanpa proses pengembalian dana.",
                "Urutan kerja Service jelas: Menunggu dikerjakan, Sedang dikerjakan, lalu Selesai.",
                "Pendaftaran Owner, Kasir, dan SPV dikirim ke server sebagai permohonan yang tetap harus disetujui Owner aktif.",
                "Beranda memakai filter ringkas untuk status antrean dan pembayaran; daftar role, cabang, dan user tetap dipilih lewat daftar filter, bukan kartu.",
            ),
        ),
        AppRelease(
            name = "1.10.1", code = 20, date = "16 Sep 2026",
            notes = listOf(
                "Halaman masuk disederhanakan menjadi satu layar tanpa gulir: logo Cuciin berada di tengah atas, tanpa kotak slogan maupun masuk cepat berdasarkan peran.",
                "Masuk selalu memakai email dan kata sandi akun masing-masing. Peran serta cabang ditentukan server setelah autentikasi.",
                "Pemilih cabang dan pengguna pada layar operasional memakai bilah filter dan daftar pilihan, bukan deretan chip atau kartu, sehingga tetap skalabel saat cabang bertambah.",
                "Rincian laporan transaksi memakai daftar lazy per Service dan dapat membuka detail transaksi tanpa merender seluruh data sekaligus.",
                "PDF laporan transaksi, stok, dan nota menggunakan header biru Cuciin, label Bahasa Indonesia, serta tabel yang mengulang kepala halaman.",
                "Proyeksi ulang snapshot cloud memakai versi jurnal terbaru agar optimistic concurrency perangkat tidak mundur setelah pemulihan server.",
            ),
        ),
        AppRelease(
            name = "1.10.0", code = 19, date = "16 Sep 2026",
            notes = listOf(
                "Tampilan seluruh aplikasi memakai sistem desain Jemur: struktur navy, aksi utama pink, aksen kuning pada navigasi, permukaan putih, dan sudut membulat 14 sampai 26 piksel.",
                "Pemilih periode laporan menjadi satu bilah ringkas berisi periode aktif dan jumlah cabang, dengan lembar pilihan. Deretan kartu periode dihapus.",
                "Header laporan menyebut data yang diambil: rentang tanggal, jumlah cabang, dan jumlah Service, jadi angka di bawahnya jelas asalnya.",
                "Ringkasan per cabang dan per kasir menjadi daftar baris, bukan tumpukan kartu, sehingga puluhan cabang tetap terbaca.",
                "Daftar cabang memakai baris ringkas dengan kolom pencarian nama, kode, atau alamat, plus keterangan jumlah kasir dan SPV tiap cabang.",
                "Daftar User menampilkan Owner, Kasir, dan SPV sekaligus, dengan pencarian nama atau email dan penyaring peran.",
                "Layar masuk memakai latar ilustrasi laundry dengan panel navy, dan ikon tiap jenis layanan kini mewakili pekerjaannya.",
                "Logo Cuciin tampil tanpa plat latar, jadi terlihat menyatu dengan halaman di semua tema.",
                "Data awal berisi empat cabang nyata (Bunayya, Laupay Kirab, Laupay Dayeuh, Shelly) beserta enam akun kasir dan dua Owner.",
                "Ikon aplikasi baru: mesin cuci dengan tumpukan lipatan laundry, tiga lapis yang mengecil ke atas.",
                "Identitas aplikasi berpindah ke paket com.cuciin.laundryops. Aplikasi lama tetap ada di HP dan harus dicopot manual setelah versi ini dipasang, karena Android menganggap keduanya aplikasi berbeda.",
                "Firebase Authentication berpindah ke project cuciin-ops. Seluruh akun operasional dibuat ulang di project itu dengan kata sandi awal yang sama seperti data awal aplikasi.",
                "Server menerima token dari project lama dan project baru selama masa peralihan, jadi HP yang belum diperbarui tetap dapat bekerja seperti biasa.",
                "Halaman reset kata sandi memakai domain cuciin-ops.web.app dan berbahasa Indonesia.",
            ),
        ),
        AppRelease(
            name = "1.9.3", code = 18, date = "15 Sep 2026",
            notes = listOf(
                "Pesan setelah meminta tautan reset kata sandi kini menjelaskan cara membuka tautannya, termasuk langkah bila tautan terpotong oleh aplikasi email atau pemindai tautan.",
                "Halaman reset kata sandi Firebase memakai domain web.app dan bahasa Indonesia; email reset juga berbahasa Indonesia mengikuti locale project.",
            ),
        ),
        AppRelease(
            name = "1.9.2", code = 17, date = "15 Sep 2026",
            notes = listOf(
                "Tema tampilan dapat dipilih di Akun & profil: Ikut sistem, Terang, Gelap, atau Warna-warni. Pilihan berlaku per akun di HP masing-masing dan tidak ikut tersinkron.",
                "Setiap tema memakai palet sendiri. Teks memenuhi kontras WCAG AA 4.5:1 dan batas kontrol memenuhi 3:1, dihitung dengan rumus kontras, bukan perkiraan.",
                "Tema gelap memakai tombol biru terang dengan teks gelap, mengikuti pola Material 3 dark, karena teks putih di atas biru terang gagal kontras.",
                "Garis batas kontrol dipisahkan dari garis pemisah dekoratif supaya chip dan kolom isian tetap terlihat di semua tema.",
                "Status bar dan navigation bar mengikuti tema; ikonnya menyesuaikan gelap atau terang.",
            ),
        ),
        AppRelease(
            name = "1.9.1", code = 16, date = "15 Sep 2026",
            notes = listOf(
                "Layanan retail kini memilih produk stok secara eksplisit, sehingga penjualan dan koreksi Service selalu mengubah item serta saldo cabang yang tepat.",
                "Produk stok menampung barang dijual dan bahan habis pakai; stok awal serta pencatatan massal dapat diterapkan ke beberapa cabang sekaligus.",
                "Aset dan mesin dipisahkan dari katalog stok agar tidak terjadi data ganda; inventory barang jual lama dimigrasikan ke Produk stok saat aplikasi dibuka.",
                "Cabang penugasan di profil mengikuti data pengguna, bukan cabang tampilan Owner.",
                "Kasir dan SPV tidak dapat mengoreksi atau menghapus Service yang sudah dikirim melalui WhatsApp; Owner tetap dapat melakukan koreksi tercatat.",
                "Absensi wajib memakai foto kamera masuk dan pulang. Foto diberi cap waktu, tersimpan privat di HP, terlihat di riwayat lokal, dan tidak terkirim ke cloud.",
                "Owner dapat membatasi modul/fungsi tiap pengguna dan menyusun pesan WhatsApp pembuka, pengantar, serta penutup. Aturan akses juga diperiksa oleh Worker.",
            ),
        ),
        AppRelease(
            name = "1.9.0", code = 15, date = "14 Sep 2026",
            notes = listOf(
                "Sinkronisasi multi-perangkat memakai antrean command persisten, acknowledgement, retry idempoten, dan delta berurutan per revision.",
                "Perubahan stok membawa baseline dan delta agar pembaruan beberapa HP tidak saling menimpa; saldo negatif ditolak secara atomik oleh server.",
                "Service retail dan stok diproses atomik; konflik permanen disimpan untuk ditinjau tanpa memblokir antrean perubahan lain.",
                "Instalasi baru maupun upgrade mengambil snapshot server satu kali sebelum melanjutkan sinkronisasi delta.",
                "Nota dan entitas yang berubah dikirim per baris; perubahan Service memakai optimistic concurrency untuk mencegah koreksi diam-diam tertimpa.",
                "Nota PDF multi-halaman, teks panjang, batas akhir periode, dan pembacaan riwayat stok lama telah diperbaiki.",
                "Build rilis gagal aman bila Firebase tidak tersedia dan layar login tidak lagi menampilkan kata sandi awal.",
                "CI memeriksa Android dan Worker; health check serta verifikasi backup D1 terenkripsi disiapkan tanpa menyimpan database pada repository publik.",
                "Cabang yang memiliki riwayat operasional dilindungi dari penghapusan agar laporan lama tetap utuh.",
                "Pemulihan sinkronisasi dua fase mencegah delta cloud terkirim balik sebagai edit lokal setelah aplikasi berhenti mendadak.",
                "Perubahan akses cabang memicu bootstrap ulang; versi Service selalu naik dan kompensasi stok menunggu penghapusan berhasil.",
                "Snapshot cloud disimpan di luar thread tampilan; kompensasi stok menunggu semua perubahan Service terkait selesai.",
                "Akses staf, cabang, pelanggan, dan absensi diperketat; pemindahan staf menghapus data lama dan absensi hanya terkirim kepada pemiliknya.",
                "Komisi transaksi diverifikasi dari katalog server dengan dukungan layanan historis, tutup kas dibuat append-only, dan penghapusan pelanggan dibatasi ke Owner.",
                "Generasi penerapan cloud mencegah edit yang sudah terkirim diproses ulang; restore backup lama tetap didukung.",
            ),
        ),
        AppRelease(
            name = "1.8.2", code = 14, date = "14 Sep 2026",
            notes = listOf(
                "Kolom laporan transaksi membungkus teks panjang agar rincian tetap terbaca tanpa terpotong.",
                "Petugas layanan otomatis mengikuti akun aktif; hanya Owner yang dapat mengganti petugas, dan aturan ini ditegakkan saat data disimpan.",
                "Perubahan stok dapat dicatat untuk beberapa produk sekaligus dengan satu waktu kejadian.",
                "Laporan perubahan stok mendukung periode, multi-cabang, filter akun pelaksana, saldo setelah mutasi, serta ekspor PDF dan CSV.",
                "Nota WhatsApp dan PDF memakai identitas cabang, informasi kasir dan pelanggan, waktu layanan, tabel rincian bernomor, dan grand total.",
                "PDF laporan transaksi memakai baris lebih tinggi dan pembungkusan teks supaya kolom panjang tetap rapi.",
                "Pemulihan sesi lokal lama diperkeras agar kata sandi kosong tidak menyebabkan aplikasi berhenti saat upgrade.",
                "Kunci endpoint Vercel lama tidak lagi disimpan di source dan endpoint gagal secara aman bila secret server belum tersedia.",
            ),
        ),
        AppRelease(
            name = "1.8.1", code = 13, date = "13 Sep 2026",
            notes = listOf(
                "Database Cloudflare Workers + D1 produksi sudah aktif dan aplikasi memakai Firebase ID token tanpa secret server di APK.",
                "Firebase Email/Password aktif untuk Owner dan akun operasional; reset kata sandi kini dikirim oleh Firebase.",
                "Akun server diikat ke Firebase UID agar perubahan email tidak memutus hak akses karyawan.",
                "D1 menyimpan proyeksi relasional pelanggan, stok cabang, inventory, biaya, transaksi, komisi, absensi, kas, dan audit untuk pelaporan.",
                "Data operasional Kasir dan SPV dibatasi ke cabang yang ditugaskan; Service yang dihapus tidak muncul kembali setelah sinkronisasi.",
                "Varian produksi dan debug mempunyai registrasi Firebase terpisah serta tetap menggunakan salinan data lokal saat koneksi terganggu.",
            ),
        ),
        AppRelease(
            name = "1.8.0", code = 12, date = "12 Sep 2026",
            notes = listOf(
                "Absensi masuk dan pulang tersedia untuk setiap karyawan, tercatat per cabang, memiliki durasi shift, riwayat, dan ekspor CSV.",
                "Setiap baris layanan dapat ditetapkan ke petugas yang benar sebelum pembayaran maupun saat koreksi Service.",
                "Owner dapat mengatur komisi per satuan layanan; nilai komisi disimpan pada transaksi agar laporan lama tetap konsisten.",
                "Laporan transaksi merinci layanan, petugas, omzet, dan komisi per kasir di setiap cabang pada layar, CSV, dan PDF.",
                "Fondasi Cloudflare Workers + D1 disiapkan dengan skema relasional, indeks laporan, verifikasi Firebase ID token, dan konfigurasi cloud tanpa secret di repository.",
                "URL server lama dan kunci bersama tidak lagi tertanam pada build debug; endpoint cloud kini dipasang melalui environment saat build.",
            ),
        ),
        AppRelease(
            name = "1.7.1", code = 11, date = "11 Sep 2026",
            notes = listOf(
                "Harga, jumlah, dan item Service dapat dikoreksi dengan tombol yang jelas sebelum pembayaran.",
                "Service tersimpan dapat diedit atau dihapus; perubahan harga, jumlah, total, dan stok cabang tercatat di audit trail.",
                "Pratinjau Service ditambahkan sebelum pembayaran agar nota dapat diperiksa dan dikoreksi.",
                "Nota dan ekspor menampilkan Status Pengerjaan tanpa Waktu Pengambilan; penutupan Service tetap dicatat internal.",
                "Laporan transaksi memakai tabel bernomor per cabang dan kasir, termasuk tabel profesional pada PDF dan CSV rinci.",
                "Dialog reset kata sandi menampilkan hasil pengiriman atau alasan kegagalan secara langsung.",
                "Build rilis tanpa Firebase berjalan dalam mode lokal aman dan tidak membawa kunci sinkronisasi server lama.",
                "Database bekerja local-first, memiliki salinan cadangan di HP, dan mencoba ulang sinkronisasi Firebase tanpa membiarkan data server lama menimpa data HP yang lebih baru.",
                "Kata sandi lokal memakai PBKDF2 bersalt, hash lama dimigrasikan saat login, dan hash tidak dikirim ke snapshot server.",
            ),
        ),
        AppRelease(
            name = "1.7.0", code = 10, date = "11 Sep 2026",
            notes = listOf(
                "Service self-service memakai satuan Load; jumlah dan harga setiap layanan dapat diubah per transaksi serta masuk audit trail.",
                "ID Service per cabang tetap unik saat transaksi dibuat dari beberapa HP.",
                "Nota dan ekspor memakai Waktu Masuk, Estimasi Waktu Keluar, dan Waktu Pengambilan aktual.",
                "Analisis mendukung multi-cabang, interval tanggal khusus, rincian per cabang dan kasir, biaya, hasil kas, serta ekspor PDF/CSV.",
                "Inventory mesin, alat, bahan, dan barang jual serta biaya operasional dicatat dan diekspor per cabang.",
                "Semua data usaha dapat diekspor sebagai JSON; audit trail punya ekspor CSV terpisah.",
                "Semua peran dapat mengubah email dan kata sandi; reset lewat email tersedia saat Firebase Auth dikonfigurasi.",
                "Foto bukti tetap lokal di tiap HP dan tidak dibawa dalam sinkronisasi server.",
            ),
        ),
        AppRelease(
            name = "1.6.1", code = 9, date = "11 Sep 2026",
            notes = listOf(
                "Nota Owner memakai cabang transaksi yang dipilih; WhatsApp menampilkan cabang serta tanggal layanan masuk dan keluar.",
                "Share lokasi Google Maps kembali ke cabang yang sedang diedit dan langsung menyimpan tautannya.",
                "Saldo, batas minimum, mutasi, dan potongan retail dipisahkan per cabang.",
                "Analytics memiliki grafik omzet dan kas masuk, KPI, metode pembayaran, dan kondisi operasional.",
                "Antrian memprioritaskan keterlambatan dan pesanan siap diambil.",
                "Serah terima pelanggan dicatat setelah pengerjaan selesai dan pembayaran lunas.",
            ),
        ),
        AppRelease(
            name = "1.6.0", code = 8, date = "11 Sep 2026",
            notes = listOf(
                "Tampilan biru baru, logo mesin cuci, navigasi dan tombol lebih jelas.",
                "Tambah layanan memberi getaran sesuai pengaturan perangkat dan informasi jumlah.",
                "Status laundry: Sedang Dikerjakan dan Selesai, terpisah dari pembayaran.",
                "Tanggal dan jam dipilih melalui kalender dan jam perangkat.",
                "Riwayat stok menampilkan hari, tanggal, jam, serta perubahan jumlah.",
                "Lokasi cabang dipilih di aplikasi peta lalu dibagikan ke Cuciin.",
                "Pengaturan kata sandi akun lokal tersedia di Profil.",
            ),
        ),
        AppRelease(
            name = "1.5.1", code = 7, date = "10 Sep 2026",
            notes = listOf(
                "Persiapan rilis bertanda tangan dan target Android 16.",
                "Rilis tidak menyediakan masuk cepat atau akun tanpa kata sandi.",
                "Pendaftaran gagal tidak lagi ditampilkan sebagai berhasil.",
                "Pesan diagnostik rilis tidak memuat respons data server.",
            ),
        ),
        AppRelease(
            name = "1.5.0",
            code = 6,
            date = "10 Sep 2026",
            notes = listOf(
                "Identitas Cuciin baru: hijau daun, latar hangat, dan ikon laundry.",
                "Antrian lebih jelas: pelanggan, jadwal, status, dan total dipisahkan.",
                "Login, modul, keranjang nota, dan kondisi kosong dirapikan.",
                "Jumlah keranjang dan status antrian langsung diperbarui setelah perubahan.",
                "Target sentuh diperbesar, transisi halus, dan konten tablet dibatasi agar nyaman dibaca.",
            ),
        ),
        AppRelease(
            name = "1.4.0",
            code = 5,
            date = "10 Sep 2026",
            notes = listOf(
                "UI baru: teal, kartu, hero, bukan form Material polos.",
                "User, pelanggan, kasir/SPV, cabang, layanan, produk: tambah · ubah · hapus.",
                "Layout menyesuaikan HP sempit, tablet, dan landscape (bottom bar / rail).",
            ),
        ),
        AppRelease(
            name = "1.3.0",
            code = 4,
            date = "10 Sep 2026",
            notes = listOf(
                "Database di server: HP kasir/owner nge-share lewat API cuciin-api (Cloudflare Worker).",
                "Poll 8 detik. Nota/stok/pelanggan/audit ikut ke server, cache tetap di HP.",
                "Firebase Firestore (ops/cuciin) nyala otomatis kalau google-services.json ada.",
            ),
        ),
        AppRelease(
            name = "1.2.0",
            code = 3,
            date = "10 Sep 2026",
            notes = listOf(
                "Bukan demo: data tersimpan di HP (JSON). Tutup app, nota/stok/audit tetap ada.",
                "Waktu nota, ID per cabang, analytics, tutup kas dihitung dari transaksi nyata.",
                "Pelanggan & cabang bisa ditambah. Foto disalin ke folder app. PDF/CSV file beneran.",
                "Antrian awal kosong. Isi stok & pelanggan, lalu buat nota.",
            ),
        ),
        AppRelease(
            name = "1.1.0",
            code = 2,
            date = "10 Sep 2026",
            notes = listOf(
                "Firebase Auth + Firestore: nyala otomatis kalau google-services.json ada.",
                "Tanpa file itu, app tetap jalan full fitur pakai data lokal di HP.",
                "Nota, WA terkirim, lunas, stok, approve user, audit ikut ke-push ke cloud.",
                "APK debug bisa diunduh dari halaman Cuciin di web.",
            ),
        ),
        AppRelease(
            name = "1.0.0",
            code = 1,
            date = "10 Sep 2026",
            notes = listOf(
                "Rilis pertama Android Cuciin (Kotlin + Jetpack Compose).",
                "Owner: Cuciin. Multi cabang: nama, lokasi, titik Google Maps.",
                "Satu laundry bisa banyak kasir dan SPV. Data cabang = gabungan kasir.",
                "Antrian menggantung sampai laundry selesai DAN bayar lunas.",
                "Status laundry: Masuk / In Progress / Selesai. Bayar: Belum lunas / Lunas.",
                "List WA pending sampai dikirim, lalu pindah ke archive (tetap bisa dibuka).",
                "Nota: teks, Excel, PDF; ID unik per cabang; waktu lengkap; pelaku; pickup.",
                "Stok: mutasi per tanggal, auto potong retail, edit manual kasir.",
                "Analytics Owner harian–tahunan, pecah per cabang dan kasir. Audit trail.",
                "Bukti foto/dokumen disimpan di HP, bukan cloud. Modul terpisah + tombol back.",
            ),
        ),
    )
}
