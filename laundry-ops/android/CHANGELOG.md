# Changelog Cuciin Android

Format: versi di `laundry-ops/android/app/build.gradle.kts` (`versionName` / `versionCode`) **harus sama** dengan entri di `VersionHistory.kt`. Layar **Riwayat versi** di app membaca `VersionHistory`.

## 1.9.0 — 14 Sep 2026 (versionCode 15)

- Sinkronisasi snapshot global diganti dengan persistent outbox dan command per entitas. Command baru dihapus setelah acknowledgement server; retry memakai ID yang sama sehingga tidak menggandakan transaksi.
- Perangkat melakukan bootstrap snapshot satu kali, kemudian mengambil delta berurutan dengan pagination revision. Cache lokal dan antrean memiliki salinan cadangan atomik.
- D1 mencatat command yang sudah diproses, jurnal perubahan per cabang, actor, optimistic concurrency Service, dan penjaga stok nonnegatif dalam transaksi atomik.
- Mutasi stok membawa baseline dan delta agar dua HP tidak saling menimpa. Saldo canonical dikirim kembali ke perangkat lain tanpa menerapkan branch stock dan stock move dua kali.
- Nota retail dan pengurangan/pengembalian stok diproses dalam satu transaksi D1; dua penjualan yang memperebutkan stok terakhir tidak dapat sama-sama tersimpan.
- Command permanen yang ditolak dipindahkan ke catatan konflik persisten agar satu konflik tidak memblokir seluruh antrean; alasan konflik terlihat pada status sinkronisasi.
- Nota PDF dengan banyak layanan tidak lagi menumpuk grand total. Token panjang dipecah sesuai lebar sel, filter periode mencakup seluruh menit terakhir, dan riwayat stok lama tersedia melalui pilihan Semua tanggal.
- Build rilis gagal aman jika Firebase tidak terkonfigurasi. Petunjuk kata sandi awal di layar login dihapus.
- CI Android menjalankan unit test, lint, dan build; Worker memiliki check tersendiri. Health check produksi dan pemeriksaan backup D1 terenkripsi beserta restore integrity check ditambahkan tanpa menyimpan database produksi sebagai artifact di repository publik.
- Runbook 20 cabang, kebijakan data, dan konteks siap salin untuk beberapa coding agent ditambahkan.
- Cabang yang sudah mempunyai riwayat Service atau data operasional tidak dapat dihapus agar laporan historis dan foreign key tetap utuh.
- Penerapan delta cloud memakai penanda pemulihan dua fase. Jika aplikasi berhenti setelah data lokal ditulis tetapi sebelum cursor disimpan, restart menyelesaikan delta yang sama tanpa mengirimkannya kembali sebagai edit lokal.
- Perubahan cakupan cabang terdeteksi melalui scope sinkronisasi dan memicu bootstrap ulang, sehingga cabang yang baru ditugaskan tidak kehilangan riwayat lama.
- Versi optimistic concurrency Service selalu naik meskipun dua koreksi terjadi pada milidetik yang sama. Batch berhenti setelah command gagal agar kompensasi stok tidak berjalan bila penghapusan Service ditolak.
- `syncId` riwayat stok dan audit dibuat unik serta divalidasi server. Bootstrap snapshot lama otomatis ditutup setelah journal command aktif.
- Kompensasi stok menunggu seluruh command Service terkait selesai. Penulisan snapshot cloud dipindahkan dari thread tampilan dengan penjaga versi agar data lokal yang lebih baru tidak tertimpa.
- Delta staf dan cabang dibatasi ke penugasan akun; pemindahan staf menghapus data pada perangkat cabang lama. Absensi non-Owner hanya dikirim ke pemiliknya, pemilik baris diverifikasi server, dan Supervisor tidak dapat mengubah pelanggan.
- Backup memakai PBKDF2 600.000 iterasi; workflow publik hanya memverifikasi backup secara manual dan tidak menyimpan hasil database produksi.
- Penghapusan pelanggan dibatasi ke Owner. Komisi pada rincian Service diambil dari katalog server, sedangkan tutup kas bersifat append-only dengan ID unik per cabang.
- Penanda penerapan cloud menyimpan generasi antrean sehingga edit lokal yang sudah terkirim tidak kembali dianggap sebagai perubahan baru. Restore tetap mendukung backup PBKDF2 format lama.

## 1.8.2 — 14 Sep 2026 (versionCode 14)

- Teks panjang pada kolom laporan transaksi kini membungkus ke baris berikutnya dan tidak dipotong menjadi elipsis.
- Petugas layanan otomatis memakai identitas akun aktif. Hanya Owner yang dapat menggantinya; validasi yang sama berlaku di lapisan penyimpanan untuk Service baru maupun koreksi.
- Pencatatan stok massal memperbarui beberapa produk sekaligus dengan jenis perubahan dan waktu kejadian yang sama.
- Laporan perubahan stok memiliki interval tanggal/jam, filter satu atau beberapa cabang, filter akun pelaksana, saldo setelah perubahan, serta ekspor PDF/CSV.
- Nota WhatsApp ditata ulang menjadi bagian informasi, rincian layanan bernomor, subtotal, dan grand total.
- Nota PDF memakai header nama cabang, informasi kasir/pelanggan/waktu, tabel No.–Service–Harga, serta grand total.
- PDF laporan transaksi memakai pembungkusan teks di dalam sel, baris yang lebih lega, header konsisten, ringkasan, dan footer halaman.
- Pemulihan sesi dari data lokal lama tidak lagi mencoba memproses kata sandi kosong, sehingga pembaruan aplikasi dapat dibuka tanpa crash PBKDF2.
- Kunci endpoint Vercel lama dihapus dari source; endpoint menolak penulisan bila secret environment belum dikonfigurasi.

## 1.8.1 — 13 Sep 2026 (versionCode 13)

- Cloudflare Workers + D1 produksi aktif di region APAC dan menerima sinkronisasi Android melalui HTTPS.
- Firebase Email/Password aktif untuk Owner serta akun operasional. Reset kata sandi memakai email Firebase dan Worker memverifikasi ID token Google.
- Secret bootstrap hanya tersimpan di Cloudflare dan berkas privat lokal; APK tidak membawa secret server.
- Identitas staf di D1 diikat ke Firebase UID sehingga perubahan email tidak mencabut akses akun yang sama.
- Proyeksi D1 mencakup pelanggan, layanan, transaksi dan rinciannya, petugas, komisi, absensi, stok per cabang, inventory, biaya, kas, dan audit.
- Kasir/SPV hanya menerima snapshot operasional cabang yang diberikan kepadanya. Perubahan perangkat cabang digabung per entitas dan penghapusan Service dibawa sebagai tombstone agar tidak muncul kembali.
- Package produksi dan debug memiliki konfigurasi Firebase masing-masing; `google-services.json` tetap diabaikan Git.

## 1.8.0 — 12 Sep 2026 (versionCode 12)

- Modul **Absensi karyawan** mencatat absen masuk, absen pulang, cabang, waktu, durasi shift, catatan, dan riwayat per karyawan; Owner dapat melihat per cabang dan mengekspor CSV.
- Setiap layanan di dalam Service memiliki petugas penanganan sendiri. Petugas dapat dipilih saat pemeriksaan sebelum bayar dan saat mengoreksi Service tersimpan.
- Owner dapat mengatur komisi per satuan untuk setiap layanan. Nilai komisi disalin ke baris transaksi agar laporan historis tidak berubah saat tarif katalog diperbarui.
- Laporan transaksi menampilkan filter petugas, layanan yang ditangani, omzet, dan komisi per kasir per cabang. CSV memakai satu baris per layanan; PDF juga membawa petugas dan komisi.
- Ditambahkan backend `laundry-ops/cloudflare`: Cloudflare Workers + D1, skema relasional terindeks untuk cabang, karyawan, transaksi, detail layanan, komisi, absensi, stok, inventory, biaya, audit, dan jurnal sinkronisasi.
- Worker mendukung verifikasi Firebase ID token, secret bootstrap di Cloudflare, query terparameter, batas payload, serta laporan layanan per petugas.
- Endpoint cloud Android kini dikonfigurasi melalui `CUCIIN_CLOUD_URL` dan `CUCIIN_CLOUD_KEY` saat build. URL dan kunci server lama telah dihapus dari source/build debug.
- Data tetap ditulis lebih dulu ke HP dan dicadangkan lokal ketika koneksi cloud gagal.

## 1.7.1 — 11 Sep 2026 (versionCode 11)

- Item Service yang dipilih selalu terlihat dan memiliki tombol jelas untuk mengubah harga, mengubah jumlah, atau menghapus item.
- Alur baru **Periksa Service** memungkinkan koreksi rincian sebelum masuk ke pembayaran.
- Service yang sudah tersimpan dapat dikoreksi atau dihapus. Selisih harga, jumlah, total, dan stok barang jual per cabang masuk audit trail.
- Nota WhatsApp, PDF, dan CSV menampilkan **Status Pengerjaan** dengan nilai **Masuk Antrian, dan akan dikerjakan** atau **Selesai**. Informasi **Waktu Pengambilan** tidak lagi dicetak.
- Penutupan Service saat pelanggan mengambil cucian tetap tersimpan internal tanpa tampil pada nota.
- Laporan transaksi memakai tabel bernomor dengan cabang, kasir, pelanggan, omzet, kas masuk, biaya, dan status. PDF diubah menjadi laporan tabel profesional berformat lanskap.
- Reset kata sandi kini menampilkan status berhasil atau alasan kegagalan di dalam dialog sehingga tombol tidak terlihat diam.
- Build rilis tanpa Firebase memakai penyimpanan lokal aman serta tidak menyertakan URL atau kunci sinkronisasi lama. Build debug tetap dapat menguji server lama.
- Setiap perubahan ditulis lebih dulu ke database lokal. File cadangan dapat memulihkan salinan utama yang rusak, kegagalan Firebase masuk antrean coba ulang, dan sinkronisasi memakai waktu versi agar data server lama tidak menimpa data HP yang lebih baru.
- Listener Firebase baru aktif setelah autentikasi berhasil dan dihentikan saat logout agar sinkronisasi mengikuti sesi pengguna.
- Hash kata sandi lokal memakai PBKDF2-HMAC-SHA256 dengan salt acak. Hash SHA-256 lama dimigrasikan setelah login yang valid dan seluruh hash dikeluarkan dari snapshot server.

## 1.7.0 — 11 Sep 2026 (versionCode 10)

- Menu transaksi menjadi **Service**. Katalog membedakan full service, self-service per **Load**, dan produk retail melalui filter dropdown.
- ID Service memakai kode cabang, periode, urutan, dan suffix acak pendek agar tetap unik saat beberapa HP membuat transaksi hampir bersamaan.
- Harga tiap satuan, kilogram, Load, atau satuan lain dapat diubah khusus untuk satu Service. Total, pembayaran, nota, WhatsApp, CSV/PDF memakai harga tersebut dan selisih dari harga katalog masuk audit trail.
- Nota dan hasil ekspor memakai label **Waktu Masuk**, **Estimasi Waktu Keluar**, dan **Waktu Pengambilan**. Serah terima tetap mencatat Service selesai walau nota tidak dikirim ulang.
- Laporan transaksi mendukung hari, minggu, bulan, tahun, serta interval tanggal/jam khusus; tersedia grafik, rincian transaksi, ringkasan per cabang dan kasir, penerimaan, biaya, hasil kas, serta ekspor PDF multipage dan CSV.
- Filter laporan cabang dapat memilih satu, beberapa, atau semua cabang.
- Inventory per cabang mencakup mesin cuci, pengering, setrika, timbangan, alat operasional, barang jual, bahan habis pakai, merek, nomor seri, kondisi, jumlah, tanggal beli, dan catatan; tersedia ekspor CSV.
- Biaya gaji, sewa, listrik/air, perbaikan mesin, bahan, transportasi, pemasaran, dan biaya lain dicatat per cabang serta otomatis masuk laporan keuangan.
- Owner dapat mengekspor snapshot seluruh data usaha dalam JSON tanpa hash kata sandi. Laporan keuangan, inventory, biaya, dan audit trail memiliki ekspor khusus.
- Akun awal Owner `tiftazani.khara@gmail.com` dan akun peran lain memakai kata sandi `test1234`, lalu dapat diubah. Semua peran dapat mengubah email dan kata sandi; link reset email memakai Firebase Auth ketika konfigurasi produksi tersedia.
- Path foto bukti tidak lagi ikut sinkronisasi; bukti tetap tersimpan lokal pada HP yang mengambilnya.

## 1.6.1 — 11 Sep 2026 (versionCode 9)

- Owner memilih cabang transaksi saat membuat nota. ID nota, stok retail, audit, detail, ekspor, dan pesan WhatsApp memakai cabang tersebut.
- Pesan WhatsApp menampilkan nama/alamat/tautan Maps cabang, tanggal layanan masuk, janji selesai, dan tanggal layanan keluar aktual.
- Penerima share `text/*` dari Google Maps membaca teks maupun ClipData. Activity `singleTask` mempertahankan draf; lokasi cabang lama langsung disimpan dan tautan terlihat di formulir.
- Katalog produk tetap bersama, tetapi saldo, minimum, mutasi, riwayat, dan potongan retail disimpan per cabang. Nota retail ditolak bila stok cabangnya kurang.
- Analytics memiliki grafik omzet versus kas masuk untuk periode hari/minggu/bulan/tahun, rata-rata nota, persentase tertagih, penerimaan per metode, dan kondisi operasional.
- Dashboard memunculkan keterlambatan, jatuh tempo, siap diambil, serta tagihan. Antrian memprioritaskan pesanan yang perlu ditangani.
- Serah terima pelanggan dicatat terpisah setelah layanan selesai dan pembayaran lunas, tanpa menambah status pengerjaan baru.
- Data lama dimigrasikan ke stok cabang memakai riwayat mutasi bila tersedia; saldo global tanpa riwayat dipertahankan pada cabang pertama.

## 1.6.0 — 11 Sep 2026 (versionCode 8)

- Rombak login, beranda, nota, pembayaran, detail, stok, master data, modul dan profil dengan identitas biru serta logo mesin cuci.
- Tombol berikon, target sentuh minimum 48dp, konfirmasi tindakan, umpan balik getaran mengikuti pengaturan sistem dan pesan jumlah setelah menambah layanan.
- Ringkasan nota dan tombol lanjut tetap terlihat; jumlah pecahan dapat diedit.
- Status laundry menjadi Sedang Dikerjakan dan Selesai. Nilai enum lama tetap kompatibel, status pembayaran terpisah.
- Kalender dan pemilih jam menggantikan tanggal bebas; stok mencatat waktu kejadian dan mengelompokkan riwayat berdasarkan hari/tanggal.
- Cabang membuka aplikasi peta; Bagikan → Cuciin menerima tautan lokasi tervalidasi dan mempertahankan draf cabang.
- Pengaturan kata sandi akun lokal di Profil; tidak membuat password Owner otomatis.
- CRUD, API/key, QRIS sebagai pencatatan metode, dan bukti lokal dipertahankan.
- Tetap kandidat teknis: hambatan keamanan server dan distribusi Google Play pada RELEASE_READINESS.md belum terselesaikan.

## 1.5.1 — 10 Sep 2026 (versionCode 7)

Kandidat rilis teknis; belum dipublikasikan atau ditinjau Google Play.

- Target/compile SDK 36, AGP 8.10.1 dan Gradle 8.11.1.
- Penandatanganan rilis wajib memakai keystore terpisah melalui konfigurasi lokal; tanpa fallback debug.
- Rilis menolak akun tanpa kata sandi dan masuk cepat. Akun lama perlu memiliki kata sandi sebelum migrasi.
- Kegagalan Firebase tidak melewati autentikasi melalui login lokal pada rilis.
- Gagal daftar tidak lagi membuka layar pendaftaran diterima.
- Log HTTP tidak memuat isi respons; log diagnostik dihapus dari rilis.
- Aturan backup/transfer perangkat Android 12+ mengecualikan seluruh data lokal, termasuk sesi dan bukti.
- Penghambat produksi: autentikasi dan otorisasi server masih memakai mekanisme lama. Lihat `RELEASE_READINESS.md`.

## 1.5.0 — 10 Sep 2026 (versionCode 6)

- Identitas hijau daun dan latar hangat, ikon laundry, serta tipografi dan jarak yang lebih jelas.
- Kartu antrian memisahkan pelanggan, janji selesai, status, dan total. Tombol buat nota tersedia sesuai peran.
- Login, daftar modul, kondisi kosong, serta keranjang nota ditata ulang.
- Jumlah keranjang dan status detail antrian langsung mengikuti perubahan state store.
- Tampilan SPV menyembunyikan WA, ekspor nota, dan pengelolaan pelanggan sesuai peran.
- Target sentuh minimum 48dp, judul dan tombol utama dapat membungkus, transisi antarlayar halus.
- Konten tablet dibatasi 960dp; formulir login 480dp. Bottom bar dan rail tetap mengikuti batas 600dp.
- CRUD, sinkronisasi, metode pembayaran, dan penyimpanan bukti lokal tetap menggunakan alur yang sama.

## 1.4.0 — 10 Sep 2026 (versionCode 5)

UI dirombak. Master data lengkap CRUD. Layout aman di banyak ukuran layar.

- Tambah / ubah / hapus: user, pelanggan, kasir, SPV, cabang, layanan, produk
- Tampilan teal + kartu, hero kas, chip yang bisa di-scroll
- HP sempit pakai bottom bar; layar ≥600dp pakai navigation rail

## 1.3.0 — 10 Sep 2026 (versionCode 4)

Database di server. HP kasir/owner nge-share dokumen toko yang sama.

- API `https://cuan-tif.vercel.app/api/cuciin` (key di APK), persist di store JSON server
- Sync pull/push + poll 8 detik; cache JSON tetap di HP (offline)
- Firestore `ops/cuciin` kalau `google-services.json` ada (Firebase)

## 1.2.0 — 10 Sep 2026 (versionCode 3)

App operasional di HP, bukan angka dummy.

- Persist JSON di penyimpanan app; session, nota, stok, pelanggan, cabang, audit, tutup kas
- Timestamp Asia/Jakarta; ID nota `{KODE}-{yyMM}-{urut}`
- Analytics & tutup kas dari nota tersimpan (Tunai/QRIS/Transfer = catat metode)
- Foto disalin ke `files/proofs`; share PDF + CSV file
- Tambah pelanggan & cabang; antrian awal kosong

## 1.1.0 — 10 Sep 2026 (versionCode 2)

Firebase Auth + Firestore, tetap jalan lokal tanpa `google-services.json`.

- Plugin Google Services cuma applied kalau `app/google-services.json` ada
- Login/daftar: coba Firebase dulu, fallback akun demo lokal
- Nota, status laundry/bayar, WA, bukti, stok, approve user, audit di-push ke Firestore
- APK debug di `https://cuan-tif.vercel.app/cuciin/cuciin.apk`

## 1.0.0 — 10 Sep 2026 (versionCode 1)

Rilis pertama APK.

- Kotlin + Jetpack Compose, package `com.tiftazani.laundryops`
- Owner Tiftazani Khara; multi cabang (nama, lokasi, Google Maps)
- 1 laundry ≥1 kasir + SPV; data cabang = gabungan kasir
- Antrian menggantung sampai laundry selesai DAN bayar lunas
- Status laundry Masuk / In Progress / Selesai; bayar Belum lunas / Lunas
- WA pending sampai dikirim, lalu archive
- Nota teks / Excel / share; ID unik per cabang; pickup; bukti di penyimpanan HP
- Stok mutasi tanggal, auto potong retail, edit manual
- Analytics Owner harian–tahunan; audit trail; modul + tombol back
- Layar Riwayat versi di dalam aplikasi
