# Changelog Cuciin Android

Format: versi di `laundry-ops/android/app/build.gradle.kts` (`versionName` / `versionCode`) **harus sama** dengan entri di `VersionHistory.kt`. Layar **Riwayat versi** di app membaca `VersionHistory`.

## 1.10.25 — 18 Sep 2026 (versionCode 44)

### Antrean sinkronisasi macet permanen karena satu perubahan bermasalah

Ditemukan saat menguji alur tulis end-to-end di emulator: mencatat biaya operasional
berhasil tersimpan di perangkat, tetapi **tidak pernah sampai ke server**. Log perangkat
menampilkan `Sinkronisasi ditolak server (422)` berulang, dan antrean berisi 11 perintah
tidak berkurang sama sekali.

Tiga sebabnya bertumpuk, semuanya di `cloudflare/src/command-sync.ts`:

1. **`payment.delete` tidak ada di `KNOWN_COMMANDS`.** Perangkat membentuk command
   `delete` untuk setiap entitas yang hilang dari snapshot (`SyncProjection`), termasuk
   `payment` ketika sebuah Service dihapus. Worker hanya mengenal `payment.upsert`, jadi
   setiap penghapusan pembayaran ditolak `422 Tipe command tidak didukung`.
2. **Satu command yang gagal di-parse membatalkan SELURUH batch.** `pushCommands`
   memakai `raw.commands.map(parseCommand)` di dalam satu `try`; satu command rusak
   membuat seluruh request dijawab 422 **tanpa `results`**. Sisi perangkat hanya bisa
   memindahkan command ke daftar `rejected` kalau `results` ada, sehingga tidak ada satu
   pun command yang bisa dibuang dan antreannya macet selamanya.
3. **Command yang ditolak permanen menahan command sesudahnya.** Setelah satu command
   gagal, sisa batch diberi status `retryable` supaya urutan terjaga. Untuk penolakan
   permanen (4xx) ini salah: command berikutnya ikut `retryable` selamanya.

Perbaikan:

- `payment.delete` ditambahkan ke `KNOWN_COMMANDS` beserta `planPayment` untuk operasi
  hapus. Pembayaran yang sudah tidak ada dianggap selesai (idempoten), bukan ditolak,
  karena command bisa terkirim ulang setelah barisnya hilang.
- `order.delete` juga dibuat idempoten: menghapus Service yang belum pernah sampai ke
  server (dibuat lalu dihapus saat offline) sekarang dianggap selesai, bukan dijawab
  `404 Service tidak ditemukan`. Command yang ditolak 404 akan disimpan perangkat dan
  tidak pernah berhasil. Aturan "Service yang sudah menerima pembayaran tidak dapat
  dihapus" **tetap** berlaku dan dikunci test.
- `pushCommands` mem-parse command satu per satu. Command yang sah tetap dijalankan;
  yang rusak dilaporkan `rejected` dengan `commandId`-nya supaya perangkat bisa
  membuangnya dari antrean.
- Rantai hanya dihentikan oleh gangguan sementara (`>= 500` atau galat non-CommandError),
  bukan oleh penolakan permanen.

Bukti di emulator: antrean 11 perintah yang macet menjadi `pending 0, rejected 0`;
revisi perangkat naik 670 ke 674; biaya `cost-5caba443-d84f` (Rp 15.000) muncul di D1
debug; audit `Menghapus pembayaran` tercatat di server.

Bukti alur uang: nota `SHL-2609-0001-A34F8` dilunasi lewat UI (sisa Rp 45.000, Tunai).
Perangkat `paid` 30.000 ke 75.000; D1 `payments` menerima `pay-fa4ead29` Rp 45.000,
`orders.paid` 75.000, dan audit `SHL-2609-0001-A34F8 menerima Rp 45.000 · Tunai`.

Dikunci oleh `cloudflare/tests/queue-stall.test.mjs` (6 test) dan
`cloudflare/tests/wire-contract.test.mjs` (3 test). Kesembilannya **terbukti gagal** saat
perilaku lama dikembalikan satu per satu. Gate Worker naik 44 menjadi 53 test.

## 1.10.23 — 18 Sep 2026 (versionCode 42)

### Perbaikan izin: dua menu Laporan memakai modul izin yang salah

Ditemukan saat sapuan regresi menyeluruh setelah 1.10.22 masuk `main`.

`AccessCatalog` memuat 12 modul izin, tetapi hanya 10 yang pernah diperiksa. Dua modul,
`analytics` dan `audit`, terdaftar di katalog dan bisa dicentang di layar Kontrol Akses Role,
tetapi **tidak pernah diperiksa** saat menu dibuka. Dua akibatnya:

1. Mencentang atau mengosongkan modul Laporan di Kontrol Akses Role tidak mengubah apa pun.
2. Role bawaan Supervisor sudah memuat modul `analytics` beserta fungsi `analytics.view`, tetapi
   menu "Laporan transaksi", "Laporan analitik", dan "Riwayat aktivitas" tetap terkunci untuknya
   karena menu memeriksa modul `owner`. Izin yang diberikan katalog tidak pernah berlaku.

Perbaikan: pemetaan rute ke modul izin dipindah ke `ui/RouteAccess.kt` supaya dapat diuji tanpa
Android dan tidak lagi hidup di dalam layar. `RouteAccessTest` mengunci agar setiap modul di
katalog benar-benar diperiksa di suatu tempat.

### Perbaikan: Riwayat aktivitas memakai cabang yang sudah tidak ada

Dua tempat di `CuciinStore` memakai cabang tetap `"melati"` yang sudah tidak ada di katalog
cabang. Entri audit dengan cabang itu tidak pernah lolos filter per-cabang di `pullChanges`
Worker (`branch_id IN (cabang pengguna)`), sehingga catatannya tidak sampai ke perangkat mana pun
dan Riwayat aktivitas tampak kosong untuk kejadian itu. Sekarang cabangnya diambil dari data
nyata.

### Perbaikan: aplikasi menutup sendiri saat katalog cabang belum tersedia

`CuciinStore.branch()` memakai `first()` dan `first { }` yang melempar `NoSuchElementException`.
Katalog cabang bisa kosong sesaat (basis data baru, impor belum jalan) atau memuat id yang belum
tersinkron. Ada 29 pemanggil di seluruh kode utama, jadi satu keadaan itu cukup untuk menutup
aplikasi. Sekarang selalu mengembalikan nilai, dengan cabang pengganti bernama "Cabang belum
tersedia".

Tiga tempat lain dengan pola sama ikut diperbaiki: `MasterScreens` (dua tempat, formulir user)
dan `nextNotaId` (pembuatan nota baru).

### Perbaikan: uang yang diterima sebelum jurnal ada hilang dari laporan kas

Ditemukan saat mengaudit tally pembayaran, setelah Owner bertanya apakah aplikasi sudah
benar-benar bebas bug.

`paymentRecords()` membuang SELURUH `paid` sebuah nota begitu nota itu punya SATU entri jurnal.
Nota yang dibayar sebagian SEBELUM jurnal pembayaran ada, lalu dilunasi setelahnya, kehilangan
bagian lamanya. Contoh: nota dengan `paid` 30.000 dilunasi 45.000; jurnal memuat 45.000, tetapi
penerimaan yang dilaporkan hanya 45.000 padahal uang yang diterima 75.000. Selisih 30.000 hilang
dari laporan kas dan tutup kas.

Ada nota produksi yang sedang dalam kondisi ini (`LPD-2609-0001-E4AF2`: paid 35.000 dengan satu
entri jurnal), jadi kerugiannya bukan hanya teoretis: begitu nota itu dilunasi, 35.000 akan hilang
dari laporan.

Perbaikan: penerimaan lama dihitung sebagai SELISIH antara `paid` nota dan jumlah jurnalnya.
Aturannya dipindah ke `data/PaymentTally.kt` supaya dapat diuji tanpa Android, dan dikunci
`PaymentLedgerTallyTest`.

Catatan cara uji: versi pertama test ini menyalin ulang logikanya di dalam test, sehingga test itu
tetap LULUS walaupun bug-nya dikembalikan; artinya tidak mengunci apa pun. Setelah aturannya
dipindah ke fungsi murni, test yang sama GAGAL saat bug dikembalikan (2 test) dan lulus setelah
diperbaiki.

### Pengerasan: laporan analitik tidak lagi bergantung pada pola yang melempar

Pemetaan label periode di layar analitik memakai `first { }` yang melempar
`NoSuchElementException` bila nilainya tidak ada di daftar. Setelah ditelusuri, nilai itu adalah
state lokal layar yang hanya bisa diisi dari daftar yang sama, jadi **tidak ada jalur nyata yang
memicunya**. Perubahan ke `firstOrNull` dengan cadangan tetap dilakukan sebagai pengerasan supaya
menambah pilihan periode baru tidak bisa mematikan layar, dan `ReportPeriodTest` mengunci polanya.

Catatan jujur: ini bukan bug yang pernah terjadi, dan tidak boleh dilaporkan seolah-olah begitu.

### Pengunci

Empat test baru: `RouteAccessTest`, `AuditBranchTest`, `ReportPeriodTest`, dan penambahan pada
`MenuRouteTest`. Setiap test dibuktikan gagal saat bug-nya dikembalikan, lalu lulus setelah
diperbaiki.

Gate: 169 test debug dan 169 test release (0 gagal), lint debug dan release, APK serta AAB
bertanda tangan.

## 1.10.22 — 18 Sep 2026 (versionCode 41)

### Perbaikan: aplikasi keluar saat menu Antrian atau Service diklik

Dilaporkan Owner: mengklik "Antrian laundry" atau "Service baru" di layar Modul membuat
aplikasi langsung keluar, untuk peran apa pun.

Penyebabnya dari logcat:

```
java.lang.IllegalArgumentException: Navigation destination that matches route queue
cannot be found in the navigation graph
    at MoreScreens.kt:120
```

Katalog menu memakai nama menunya sendiri sebagai rute (`queue` dan `service`), sedangkan graf
navigasi memakai `home` untuk Antrian dan `nota` untuk Service baru, karena kedua rute itu
dipakai bersama tab bawah. `nav.navigate("queue")` karena itu melempar pengecualian, dan
pengecualian itu tidak tertangkap sehingga aplikasi ditutup.

Perbaikan: katalog menu memetakan rutenya ke rute graf lewat `MenuOrder.destinationOf`. Menu
yang rutenya sudah sama tidak diubah.

### Perbaikan: menu yang tidak boleh dipakai peran tertentu disembunyikan

Layar Antrian dan tab bawah sudah menyembunyikan "Service baru" untuk SPV, tetapi menu Modul
tetap menampilkannya. Server pun menolak pembuatan Service oleh SPV, jadi pesanannya akan gagal
tersinkron tanpa penjelasan. Sekarang aturan tampil menu dibaca dari `NavTabs`, sumber yang sama
dengan bar navigasi.

### Pengunci

`MenuRouteTest` membandingkan setiap rute menu dengan daftar `composable(...)` di `CuciinNav.kt`,
jadi menu baru yang rutenya belum terdaftar akan gagal di test, bukan di tangan pengguna.
Diperiksa juga seluruh pemanggilan `nav.navigate("...")` di kode: tidak ada rute lain yang
menunjuk ke tujuan yang tidak ada.

## 1.10.21 — 18 Sep 2026 (versionCode 40)

### Nuansa biru Cuciin

- Palet Light dan Dark diganti mengikuti warna logo dan gambar layar pembuka: biru `#0048B4`
  dan biru langit `#D8E4F0`. Tema Light memakai latar biru langit sangat muda dengan aksen biru;
  tema Dark memakai navy tua `#0A1220` dengan aksen biru langit `#7FB4FF`.
- Kuning `#F7CA3A` dipertahankan sebagai aksen menu aktif, karena di logo pun kuning hadir
  (gantungan baju) dan tanpa warna itu menu aktif tidak menonjol di antara semua biru.
- Semua pasangan warna diuji WCAG AA: 28 dari 28 lulus di kedua tema.
- Warna navy lama yang masih dipaku di `GlassCard` dan `OnboardingScreen` ikut disesuaikan.
- Deskripsi tema di layar Theme Aplikasi diperbarui supaya tidak lagi menyebut pink dan hitam.

### Preset tema Custom

- Tema Custom kini punya tiga preset siap pakai: Biru Cuciin, Biru Cuciin Gelap, dan Magenta Jemur.
  Tiap preset menampilkan rangkaian warnanya sebagai titik, jadi pengguna melihat kombinasinya
  sebelum memilih.
- Nilai bawaan tema Custom berubah menjadi Biru Cuciin, sejalan dengan tema Light.

### Harga Service hanya untuk Owner

- Fungsi baru `service.price` di katalog akses, ditandai bawaan khusus Owner.
- Role bawaan Kasir dan Supervisor tidak memuat fungsi itu.
- Ditegakkan berlapis: tombolnya disembunyikan, dan store menolak perubahannya. Jalur koreksi
  Service juga dijaga, supaya kasir tidak bisa mengubah harga lewat koreksi nota.
- Owner tetap boleh memberikan fungsi ini ke role lain lewat Kontrol Akses Role.
- `ensureAccessRoles` sekarang menambal role bawaan yang tersimpan dengan fungsi bawaan baru,
  karena isinya dibekukan saat pertama dibuat.

## 1.10.20 — 18 Sep 2026 (versionCode 39)

- Perbaikan: warna dialog pemilih tanggal dan jam kini mengikuti palet aplikasi.
- Penyebab: `ui/DateTimeFields.kt` memakai `android.R.style.Theme_Material_Light_Dialog_Alert`
  yang dipaku mati. Tema bawaan itu membawa aksen teal, sehingga tombol "Pilih" dan "Batal"
  berwarna teal sementara tombol aplikasi berwarna magenta. Dua warna itu bertabrakan.
- Perbaikan: tema sendiri `Theme.Cuciin.Picker` di `res/values/themes_picker.xml`, dengan aksen
  `cuciin_accent` (#C1358F) dan latar `cuciin_dialog_surface`. Warna di `values/colors.xml`
  disimpan sejalan dengan palet Compose di `ui/theme/Theme.kt`.
- Locale Indonesia sekarang diambil dari konfigurasi Compose, bukan dari konteks mentah,
  sehingga nama hari dan bulan tetap berbahasa Indonesia.
- Berlaku di delapan tempat pemakaian lewat satu fungsi: filter periode (antrian, laporan,
  riwayat aktivitas), estimasi selesai Service, tanggal kejadian stok, dan tanggal beli aset.
- Empat test baru `PickerThemeTest` mengunci: tidak ada pemakaian tema bawaan Android, tema
  dialog ada dan memakai aksen Cuciin, warna aksen sejalan dengan palet Compose, dan tidak ada
  dialog sistem lain yang memakai tema bawaan.

## 1.10.19 — 18 Sep 2026 (versionCode 38)

### Perbaikan sebelum naik ke produksi: jurnal ditulis per cabang

- Entri jurnal `staff` ditulis SATU PER CABANG, bukan satu saja.
- Penyebab: `pullChanges` di `command-sync.ts` menyaring jurnal untuk pengguna non-Owner dengan
  `branch_id IN (cabang pengguna)`, dan entri `staff` hanya lolos bila cabangnya cocok. Versi
  pertama migrasi menulis satu entri untuk satu cabang saja, sehingga kasir dan SPV di cabang
  lain tidak akan pernah menerima nama baru walaupun Owner melihatnya.
- Ditemukan SEBELUM migrasi dijalankan ke produksi, lewat simulasi filter `pullChanges` untuk
  tiap cabang. Setelah diperbaiki, kelima cabang menerima entri.
- Idempotensi juga diperbaiki: `sync_changes` tidak punya indeks unik pada `command_id`, jadi
  `INSERT OR IGNORE` tidak menjamin apa pun. Penjagaan sekarang memakai `NOT EXISTS` yang
  membandingkan `command_id` DAN `branch_id`.
- Perbaikan ini sisi server. APK tidak berubah, jadi versi tetap 1.10.19 dan perangkat yang
  sudah terpasang tidak perlu memasang ulang.

- Nama pemilik yang tampil di aplikasi tidak lagi memakai nama pribadi, tetapi nama usaha.
  Aplikasi ini dijual ke banyak pemilik laundry, jadi nama di layar harus netral.
- Nama pada data server diperbarui lewat migrasi `0008_owner_name_neutral.sql`. Perubahan
  ditulis ke jurnal `sync_changes`, bukan hanya ke tabel, supaya perangkat yang sudah
  memegang snapshot ikut menerima nama baru. Migrasi idempoten: dijalankan dua kali,
  `rows_written` nol dan entri jurnal tetap satu.
- Alamat email sengaja tidak diubah karena itu identitas akun Firebase; menggantinya akan
  memutus login semua perangkat yang sudah terpasang.
- Dua test Android baru menjaga nama pribadi tidak masuk kembali: satu mengunci nilai nama
  bawaan, satu memindai seluruh berkas `src/main`, `src/main/res`, dan `src/debug`.
- Dua test Worker baru mengunci isi migrasi dan cara jurnal staff mengganti baris lama.

## 1.10.18 — 18 Sep 2026 (versionCode 37)

- Perbaikan: tombol kedua di halaman terakhir layar pembuka dihilangkan.
- Sebelumnya tombol itu bertulisan "Lihat panduan singkat" padahal kerjanya hanya menutup layar, jadi tulisannya menjanjikan hal yang tidak dilakukan.
- Sekarang tombol kedua hanya muncul selama masih ada halaman berikutnya, dan isinya selalu "Lewati". Aturannya hidup di `Onboarding.hasSecondButton` / `Onboarding.secondLabel` dan dikunci tiga test baru.

## 1.10.17 — 18 Sep 2026 (versionCode 36)

- Perbaikan: judul halaman dan tombol di layar pembuka tidak lagi saling menimpa.
- Penyebab: judul berada di dalam wadah berisi penuh layar dengan pengisi fleksibel, sementara tombol berada di wadah lain yang juga menempel di dasar layar; keduanya terdorong ke titik yang sama.
- Perbaikan: seluruh isi (logo, judul, baris pendukung, titik halaman, tombol) disusun dalam SATU kolom yang mengalir dari atas ke bawah, dengan satu pengisi fleksibel di antara logo dan judul.
- Judul panjang terbungkus dua baris dengan jarak cukup; diukur di emulator, judul berakhir di y 1825 dan tombol mulai di y 2033 (jarak 208 piksel).

## 1.10.16 — 18 Sep 2026 (versionCode 35)

- Layar pembuka tiga halaman sebelum halaman masuk: "Semua cabang dalam satu aplikasi", "Tetap jalan tanpa internet", "Akses sesuai peran".
- Layar pembuka muncul sekali setelah aplikasi dipasang; bisa dibuka lagi lewat tautan "Tentang aplikasi" di halaman masuk.
- Gambar layar pembuka memakai rasio 9:20 (841x1870) sehingga tidak terpotong di HP modern.
- Halaman login memakai kartu kaca: latar navy 42% dengan isian bening dan garis putih tipis, wallpaper terlihat di belakangnya.
- Perbaikan: bar putih 60px di bawah halaman login hilang. Penyebabnya padding Scaffold memotong area bar sistem sehingga latar Scaffold yang terang terlihat; layar penuh kini mengatur insetnya sendiri.
- Bar sistem (status dan navigasi) dibuat tembus pandang dari tema, bukan diwarnai palet.
- Tombol "Daftar akun baru", "Lupa kata sandi?", dan "Tentang aplikasi" ditata ulang di halaman masuk.

## 1.10.15 — 17 Sep 2026 (versionCode 34)

- Aplikasi versi debug kini bernama **Cuciin Debug** di layar HP, sehingga tidak tertukar dengan versi rilis yang terpasang berdampingan.
- Nama versi rilis tetap **Cuciin**.
- Nama berbeda diambil dari `app/src/debug/res/values/strings.xml`; berkas itu hanya berlaku untuk varian debug.

## 1.10.14 — 17 Sep 2026 (versionCode 33)

- Perbaikan: setelah membuka Service baru lewat tombol di layar Antrian, tab Antrian dan tab lain tidak lagi macet.
- Penyebab: perpindahan tab memakai `popUpTo(saveState)` berpasangan dengan `restoreState`, yang hanya benar untuk graf navigasi bertingkat. Pada graf datar di sini kombinasi itu membuat tab diam tanpa pesan.
- Perbaikan: satu panggilan `navigate` dengan `launchSingleTop` dan `popUpTo("home")` tanpa saveState/restoreState.
- Aturan perpindahan hidup di `ui/NavTransition.kt` dan dikunci `NavTransitionContractTest.kt`.
- Menekan tab yang sedang aktif tidak lagi menambah entri ke stack.

## 1.10.13 — 17 Sep 2026 (versionCode 32)

- Perbaikan: layar login tidak lagi terpotong saat keyboard Android terbuka.
- Saat ruang sempit (keyboard terbuka atau layar pendek) isi dipadatkan dan boleh digulir; sebelumnya layar dirancang tanpa gulir sama sekali sehingga bagian bawah terpotong.
- Saat keyboard muncul, layar menggulir otomatis secukupnya supaya kartu isian terlihat penuh.
- Aturan tata letak hidup di `ui/LoginLayout.kt` dan dikunci `LoginLayoutTest.kt`.
- Saat keyboard tertutup pada layar normal, tampilan tetap satu layar penuh tanpa gulir.

## 1.10.12 — 17 Sep 2026 (versionCode 31)

- Perbaikan: bar navigasi bawah kini tampil di layar Service seperti di tab lain.
- Rute berbar diturunkan dari katalog tab (`ui/NavTabs.kt`), bukan disalin ulang; salinan itu yang dulu tertinggal "nota".
- Animasi perpindahan layar: geser halus disertai pudar, arah mengikuti maju atau mundur.
- Animasi tekan pada tombol dan kartu status, plus angka kartu yang menghitung naik saat berubah.
- Baris daftar muncul mengalir satu per satu (dibatasi beberapa baris pertama agar daftar panjang tetap ringan).
- Bar navigasi bawah muncul dan hilang dengan lembut saat berpindah ke layar tanpa bar.
- Semua durasi memakai token `ui/Motion.kt` dan mengikuti skala animasi sistem; bila animasi dimatikan, tidak ada gerak.

## 1.10.11 — 17 Sep 2026 (versionCode 30)

- Menu Modul disusun ulang: Pekerjaan harian, Keuangan, Pelanggan, Laporan, Master data, lalu Aplikasi paling bawah.
- Theme Aplikasi dan Riwayat versi pindah ke bagian Aplikasi; Riwayat versi kini di urutan paling bawah.
- Menu baru **Atur urutan menu**: panah naik dan turun per menu, tombol pindah bagian, panah per judul bagian, dan tombol Kembalikan urutan awal.
- Susunan menu hidup di `ui/MenuOrder.kt` (katalog murni) dan disimpan per HP lewat `ui/MenuPrefs.kt`; tidak ikut tersinkron.
- Susunan tersimpan dirapikan terhadap katalog, sehingga menu baru dari pembaruan tetap muncul di bagian bawaannya.

## 1.10.10 — 17 Sep 2026 (versionCode 29)

- Menu baru **Theme Aplikasi**: Light, Dark, dan Custom.
- Light memakai latar terang dengan aksen pink; Dark memakai latar hitam dengan tulisan terang.
- Custom mengatur enam warna (utama, tombol, latar, kartu, teks, header) lewat slider R/G/B, kode hex, dan pratinjau langsung.
- Warna teks di atas tombol dan header dihitung otomatis agar selalu kontras.
- Pengaturan tema pindah dari Akun & Profil ke menunya sendiri; tidak ikut tersinkron antarperangkat.
- Perbaikan server: entityType `assetType` dikenali saat parsing command, sehingga perintah aset tidak lagi ditolak 422.
- Perbaikan: ID baris baru selalu unik, sehingga penambahan banyak data sekaligus tidak saling menimpa.
- Perbaikan: catatan aktivitas tetap aman meski daftar cabang belum terisi.
- Urutan menu Modul disusun ulang: Pekerjaan harian, Keuangan, Pelanggan, Laporan, Master data, lalu Aplikasi paling bawah.
- Theme Aplikasi dan Riwayat versi pindah ke bagian Aplikasi; keduanya bukan laporan operasional.
- Susunan menu dipindah ke `ui/MenuOrder.kt` supaya urutannya dapat diperiksa unit test.

## 1.10.9 — 17 Sep 2026 (versionCode 28)

- Filter periode di layar utama menyediakan pilihan dua tanggal tertentu, bukan hanya periode cepat.
- Laporan transaksi, laporan analitik, dan nota pelanggan dicetak ulang mengikuti desain terbaru.
- Laporan transaksi hanya mencetak bagian yang dipilih; tabel kosong tidak dipertahankan demi tata letak.
- Persentase donut memakai satu angka desimal; legenda memuat swatch, nama, nominal, dan persen.
- Seluruh tabel memakai baris membungkus dengan tinggi menyesuaikan, sehingga tidak ada teks terpotong.
- Kepala tabel diulang pada halaman baru; satu transaksi tidak terpotong antarhalaman.
- Tata letak PDF dipusatkan di `data/ReportPdf.kt`; `FileExports` hanya meneruskan ke modul tersebut.

## 1.10.8 — 17 Sep 2026 (versionCode 27)

- Lembar pilihan modul memakai kotak centang: terisi penuh saat dipilih, kosong bergaris saat tidak.
- Setiap baris menampilkan label "Dipilih" atau "Tidak dipilih" sehingga status tidak bergantung pada warna saja.
- Baris terpilih diberi latar berbeda; tersedia hitungan "1 dari 12 modul dipilih" serta tombol Pilih semua dan Kosongkan.
- Tombol Selesai selalu terlihat penuh; daftar panjang digulir di dalam area terbatas.
- Pilihan tunggal memakai radio, pilihan banyak memakai kotak centang.

## 1.10.7 — 17 Sep 2026 (versionCode 26)

- Tampilan utama memakai dua filter sebaris: periode dengan bawaan hari ini, dan cabang.
- Tiga kartu status di bawah filter: Sedang dikerjakan, Cucian telat, dan Selesai; ketuk untuk menyaring daftar.
- Cucian telat berarti estimasi selesai sudah lewat tetapi pengerjaan belum selesai.
- Menu baru Kontrol Akses Role; pengguna melekat ke satu role yang menentukan modul dan fungsinya.
- Checklist modul dan fungsi dengan kotak centang, hitungan seperti 2/2, dan ringkasan pilihan.
- Role baru dapat dibuat; role bawaan hanya dapat diubah hak aksesnya.
- Kontrol akses pengguna dipindahkan dari Pengaturan Owner ke Kontrol Akses Role.

## 1.10.6 — 17 Sep 2026 (versionCode 25)

- Menu Aset & mesin cabang menjadi Daftar Aset Cabang dengan filter cabang dan jenis aset berupa dropdown.
- Registrasi aset berada di layar terpisah, bukan formulir di dalam daftar.
- Aset ID dibuat otomatis dari kode cabang, kode jenis aset, dan nomor urut tiga digit; tidak diisi manual.
- Form aset memuat merek, nomor seri, jumlah, satuan, kondisi, tanggal beli, catatan, dan foto aset.
- Kondisi aset dipilih lewat kartu Normal, Perlu perbaikan, atau Rusak.
- Katalog jenis aset dapat ditambah; jenis yang sudah dipakai tidak dapat dihapus.
- Foto aset hanya tersimpan di perangkat dan tidak dikirim ke server.

## 1.10.5 — 17 Sep 2026 (versionCode 24)

- Sistem ukuran layar Android diseragamkan: margin compact 16dp, jarak internal 8dp, dan jarak antarbagian 16dp.
- Menu Modul berubah dari grid kartu menjadi daftar berkelompok yang lebih cepat dipindai.
- Antrian Owner menampilkan dua filter per baris dan Service sebagai daftar lazy berbentuk baris, bukan kartu transaksi besar.
- Pengaturan Owner memakai filter ringkas serta sheet multi-select untuk modul dan fungsi; tombol Selesai tidak tertutup gesture bar.
- Diagram donat aplikasi dan PDF kini memakai warna kategorikal berbeda, label persen, serta legenda dengan pembulatan yang konsisten.
- Grafik tren yang hanya memiliki satu periode menjadi batang horizontal berlabel sehingga tidak menyisakan panel kosong.

## 1.10.4 — 17 Sep 2026 (versionCode 23)

- PDF dan CSV laporan transaksi memuat seluruh bagian yang dipilih di filter Tampilan laporan: Ringkasan, Per cabang, Per kasir, Komisi petugas, dan Rincian.
- Tabel bagian yang panjang berpindah halaman dengan kepala tabel berulang, jadi tidak ada baris yang hilang atau terpotong.
- PDF laporan analitik menampilkan diagram batang tren omzet bulanan dan dua diagram donat (omzet per cabang dan penerimaan per metode), bukan hanya tabel.
- PDF laporan analitik mencetak seluruh Service pada filter dengan halaman lanjutan; sebelumnya hanya 12 baris pertama.
- Tombol Excel pada laporan analitik mengekspor semua tabel yang tampil di layar.
- Bilah filter diperkecil dan disusun dua per baris sehingga tidak lagi memenuhi layar.

## 1.10.3 — 17 Sep 2026 (versionCode 22)

- Laporan transaksi dan laporan analitik dipisah menjadi dua menu terpisah di Modul.
- Laporan analitik menangkap seluruh data yang terlihat akun, bukan hanya satu periode, dengan filter periode, cabang, kasir, dan jenis data yang semuanya multi-select.
- Jenis data yang dapat disaring: status pembayaran, status pengerjaan, metode pembayaran, dan status pengambilan.
- Diagram batang tren omzet bulanan dengan penanda rata-rata, dan diagram donat untuk omzet per cabang serta penerimaan per metode.
- Peringkat kasir dan rekonsiliasi kas (omzet, kas diterima, piutang, biaya, hasil kas) dalam satu layar.
- PDF laporan analitik baru dengan tabel yang memakai palet dan gaya kepala tabel yang sama dengan laporan transaksi.
- Nama kasir dan petugas di laporan, PDF, dan CSV mengikuti nama terkini dari Daftar User; email tetap menjadi identitas stabil.
- Laporan transaksi memakai box daftar dengan gulir internal sehingga ribuan transaksi tidak memanjangkan layar.

## 1.10.2 — 17 Sep 2026 (versionCode 21)

- Penerimaan pembayaran disimpan sebagai jurnal per waktu dan metode. Pembayaran bertahap kini masuk kas pada waktu sebenarnya, bukan dipindahkan ke tanggal Service dibuat.
- Koreksi atau hapus Service yang sudah menerima pembayaran ditolak hingga ada proses pengembalian dana tercatat. Pembayaran tidak dapat diturunkan diam-diam.
- Tutup kas dibuat per cabang dan hanya sekali per hari. Perhitungan kas memakai jurnal pembayaran.
- Status Service bergerak berurutan: Menunggu dikerjakan, Sedang dikerjakan, lalu Selesai.
- Pendaftaran Owner, Kasir, dan SPV menjadi permohonan server-side yang menunggu persetujuan Owner aktif. Akun Firebase dibatalkan bila permohonan ditolak server.
- Beranda memadatkan penyaring status antrean dan pembayaran ke FilterBar serta bottom sheet daftar, bukan kartu status besar atau chip berderet.

## 1.10.1 — 16 Sep 2026 (versionCode 20)

- Layar masuk kini satu layar tanpa gulir dengan logo Cuciin di tengah atas. Kotak slogan dan masuk cepat berdasarkan peran dihapus.
- Autentikasi hanya menggunakan email dan kata sandi akun. Server menentukan peran dan cakupan cabang setelah login.
- Pemilih cabang dan user di layar operasional memakai FilterBar dan daftar di bottom sheet, bukan deretan chip atau kartu.
- Rincian laporan transaksi memakai `LazyColumn` per Service dan membuka detail transaksi, sehingga laporan besar tidak merender seluruh baris sekaligus.
- PDF laporan transaksi, stok, dan nota diselaraskan dengan palet biru Cuciin dan label Bahasa Indonesia.
- Reproject snapshot Worker memakai versi jurnal terbaru agar versi optimistic concurrency tidak mundur.

## 1.10.0 — 16 Sep 2026 (versionCode 19)

### Tampilan

- Seluruh aplikasi memakai sistem desain baru: kanvas putih bersih, teks near-black (#222222), satu warna aksen merah, tombol utama gelap, dan sudut membulat 8 sampai 20 piksel. Warna aksen tidak lagi dipakai untuk bidang luas.
- Warna aksen disesuaikan agar lolos WCAG AA. Rausch Red (#ff385c) hanya 3.52:1 di atas putih, jadi tema Terang memakai #d92e4a (4.73:1), tema Gelap memakai #ff8098 (6.01:1 di kartu gelap), dan tema Warna-warni tetap memakai plum #c2185b. Seluruh 51 pasangan token diuji dengan rumus kontras, 0 gagal.
- Tombol utama memakai near-black seperti pola Primary Dark, bukan warna merek. Warna aksen hanya untuk satu aksi paling utama per layar.
- Radius mengikuti token bersama `CuciinShape`: tombol dan kolom isian 8, lencana 14, kartu 20, hero 32, pil penuh.
- Tombol kembali menjadi bulat abu di semua layar, mengikuti pola Circular Navigation.
- Tema tetap empat pilihan seperti sebelumnya: Ikut sistem, Terang, Gelap, dan Warna-warni. Semuanya memakai bahasa bentuk baru.

### Laporan transaksi

- Header menyebut data yang benar-benar diambil: rentang tanggal, jumlah cabang, dan jumlah Service. Sebelumnya hanya judul dan nama Owner.
- Pemilih periode berubah dari deretan kartu chip menjadi satu bilah ringkas berisi periode aktif, rentang tanggal, dan jumlah cabang, dengan lembar pilihan. Pilihan cepat menampilkan rentang tanggalnya masing-masing.
- Ringkasan per cabang dan per kasir menjadi daftar baris di dalam satu kartu, bukan tumpukan kartu terpisah.
- Filter petugas tetap memakai chip karena jumlahnya sedikit.

### Daftar cabang

- Kartu per cabang diganti daftar baris: kode cabang, nama, kota, jumlah kasir, dan jumlah SPV. Puluhan cabang kini terbaca tanpa menggulir jauh.
- Ditambahkan kolom pencarian nama, kode, atau alamat, dengan keadaan kosong yang menjelaskan kata kunci yang tidak cocok.
- Cabang yang belum punya SPV ditandai teks, bukan warna atau titik dekoratif.
- Tombol tambah pindah ke bilah atas sebagai ikon lingkaran.

### Ikon

- Ikon aplikasi baru: mesin cuci dengan tumpukan lipatan laundry, tiga lapis yang mengecil ke atas dan tepi atas bergelombang supaya terbaca sebagai kain, bukan alas.
- Ikon digambar dengan garis di atas near-black, bukan bidang biru penuh, dan tetap benar saat Android memakai versi monokrom untuk ikon bertema.
- Tanda di dalam aplikasi memakai bentuk yang sama agar identitasnya konsisten.

### Identitas aplikasi

- Identitas aplikasi berpindah ke paket `com.cuciin.laundryops`. Android menganggap paket ini aplikasi berbeda, jadi versi lama tetap terpasang dan harus dicopot manual setelah versi ini masuk. Data lokal lama (foto absensi, cache, outbox) tidak berpindah; data operasional di server tidak terpengaruh.
- Firebase Authentication berpindah dari project `cuciin-ops-tiftazani` ke `cuciin-ops`. Kedua app Android (`com.cuciin.laundryops` dan `.debug`) terdaftar di project baru, sidik jari sertifikat rilis dan debug sudah ditambahkan.
- Worker menerima ID token dari **kedua** project selama masa peralihan (`FIREBASE_PROJECT_IDS`). HP yang belum diperbarui tetap dapat bekerja seperti biasa, sehingga tidak ada pemutusan serentak di 20 cabang.
- Halaman reset kata sandi memakai domain `cuciin-ops.web.app`, locale project `id`, dan `callbackUri` diarahkan ke domain itu.
- Nama Owner di aplikasi dan di seluruh data server menjadi `Tiftazani`; alamat email Owner tidak diubah. Owner kedua `us.archuleta1207@gmail.com` memakai nama `Ustutifa`.

## 1.9.3 — 15 Sep 2026 (versionCode 18)

- Pesan di dialog reset kata sandi menjelaskan bahwa tautan harus dibuka dari email yang sama, dan memberi langkah bila alamatnya terpotong oleh aplikasi email atau pemindai tautan. Sebelumnya pengguna hanya diberi tahu tautan sudah dikirim.
- Halaman reset kata sandi Firebase kini memakai domain `cuciin-ops-tiftazani.web.app`, bukan `firebaseapp.com`, dan tampil berbahasa Indonesia. Email reset juga berbahasa Indonesia mengikuti locale project.
- Tautan reset wajib membawa `mode`, `oobCode`, `apiKey`, dan `lang`. Bila salah satu hilang, Firebase menampilkan "The selected page mode is invalid." sebelum memproses kode.

## 1.9.2 — 15 Sep 2026 (versionCode 17)

- Tema tampilan bisa dipilih di Akun & profil untuk semua peran: Ikut sistem, Terang, Gelap, dan Warna-warni. Pilihan disimpan per akun di HP itu saja, terpisah dari data operasional dan sinkronisasi.
- Tema Terang memakai palet 1.9.1 yang sama, jadi tampilan lama tidak berubah bagi yang tidak mengganti tema.
- Setiap tema punya palet lengkap sendiri: latar, kartu, garis, teks, warna utama, dan warna status. Teks dijaga di rasio kontras minimal 4.5:1 dan batas kontrol minimal 3:1.
- Tema gelap memakai tombol biru terang dengan teks gelap (pola Material 3 dark). Teks putih di atas biru terang hanya mencapai 3.42:1, di bawah syarat WCAG AA.
- Token garis dipisah: batas kontrol untuk chip dan kolom isian, garis lembut untuk pemisah dekoratif. Sebelumnya satu nilai dipakai untuk keduanya sehingga batas kontrol hanya 1.24:1.
- Teks redup pada tema terang dinaikkan dari #60718D ke #5C6C88 agar lolos 4.5:1 juga di atas latar chip dan banner.
- Status bar dan navigation bar mengikuti tema aktif, termasuk warna ikonnya, sehingga tidak ada bilah putih di atas layar gelap.
- Penambahan test `ThemePaletteTest` untuk aturan pemilihan tema dan palet.

## 1.9.1 — 15 Sep 2026 (versionCode 16)

- Layanan retail kini memakai relasi ID produk stok, sehingga penjualan, koreksi, dan penghapusan Service selalu memutakhirkan saldo produk di cabang yang benar.
- Produk stok menyatukan barang jual serta bahan habis pakai. Stok awal maupun pencatatan massal dapat dipilih untuk lebih dari satu cabang; mesin dan aset operasional berada di menu Aset & mesin cabang.
- Riwayat inventory lama untuk barang jual/bahan habis pakai otomatis dipindahkan ke katalog Produk stok ketika aplikasi dibuka.
- Profil menampilkan cabang penugasan pengguna yang sebenarnya, termasuk ketika Owner sedang melihat cabang lain.
- Sesudah WhatsApp dibuka untuk pelanggan, hanya Owner yang dapat mengoreksi atau menghapus Service. Batas ini diperiksa di aplikasi dan server.
- Absen masuk/pulang memakai foto kamera yang diberi cap waktu, disimpan privat serta ditampilkan di perangkat; path foto tidak pernah disinkronkan ke server.
- Owner dapat mengatur modul/fungsi per pengguna dan template WhatsApp yang terdiri dari pembuka, isi pengantar, dan penutup. Worker menyimpan serta menerapkan kebijakan akses tersebut.

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
- Penghapusan pelanggan dibatasi ke Owner pada aplikasi dan server. Komisi rincian baru diambil dari katalog server; koreksi nota lama mempertahankan komisi historis saat layanan sudah dipensiunkan. Tutup kas bersifat append-only dengan ID unik per cabang.
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
  <br>Catatan: endpoint ini dipensiunkan 15 Sep 2026. Sejak 1.9.0 aplikasi memakai Cloudflare Worker `cuciin-api`.
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
- APK debug dulu diunduh dari halaman web (sejak 15 Sep 2026 berkasnya ada di `laundry-ops/releases/`)

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
