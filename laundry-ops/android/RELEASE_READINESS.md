# Cuciin 1.10.30 — kesiapan rilis

Status: kandidat rilis operasional yang menjalani ulang pemeriksaan kode, build, dan verifikasi cloud pada 20 September 2026. Owner tetap harus menyelesaikan validasi perangkat, rotasi akun, saldo awal, backup terjadwal pertama, dan keputusan go-live. APK bertanda tangan tidak menjamin hilangnya peringatan Play Protect pada distribusi di luar store.

Dokumen ini terakhir diselaraskan saat rilis **1.10.30 (versionCode 49)**; sebelumnya masih menyebut 1.10.1 dan tertinggal 29 versi. Bagian perpindahan identitas aplikasi di bawah tetap berlaku sebagai catatan sejarah, tetapi angka versi di dalamnya sudah tidak dipakai.

## Perpindahan identitas aplikasi (16 September 2026)

Paket aplikasi berpindah dari `com.tiftazani.laundryops` ke `com.cuciin.laundryops`, dan Firebase Authentication berpindah dari project `cuciin-ops-tiftazani` ke `cuciin-ops`.

Konsekuensi yang perlu diketahui sebelum distribusi:

- Android menganggap paket baru sebagai **aplikasi berbeda**. Versi lama tetap terpasang di HP dan tidak otomatis tergantikan; keduanya harus dicopot manual setelah versi baru dipasang. Data lokal lama (foto absensi, cache, outbox) tidak berpindah.
- Data operasional di D1 **tidak terpengaruh**. Seluruh transaksi, stok, pelanggan, dan audit tetap utuh.
- Selama masa peralihan, Worker menerima ID token dari **kedua** project Firebase (`FIREBASE_PROJECT_IDS`), sehingga HP yang belum diperbarui tetap bekerja. Hapus project lama dari daftar itu hanya setelah seluruh perangkat berpindah.
- Seluruh akun operasional dibuat ulang di project baru. Kata sandi awal `test1234` dan wajib diubah dari Profil sebelum data nyata dipakai.
- Alamat email Owner tidak diubah; hanya nama tampilan yang menjadi `Cuciin`.

## Bukti verifikasi kandidat (1.10.30)

- Android: **267 unit test debug dan 267 unit test rilis lulus**, lint tanpa error (19 warning lama: 12 `UseKtx`, 4 `GradleDependency`, 1 `AndroidGradlePluginVersion`, 1 `ObsoleteSdkInt`), APK debug/rilis dan AAB rilis berhasil dibuat dengan JDK 17.
- APK rilis: non-debuggable, application ID `com.cuciin.laundryops`, versionCode `49`, versionName `1.10.30`, target API 36, signature v2 valid, dan kompatibel dengan page size 16 KB. `verify_release.py` PASS.
- SHA-256 sertifikat rilis cocok dengan fingerprint yang dicatat: `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`. Sertifikat **tidak berubah** sejak 1.10.1, jadi APK baru dapat menimpa pemasangan lama.
- Worker: **60 test lulus** (`npm run check`), termasuk pemetaan fungsi izin per command, penjagaan revisi reproject, dan penerimaan dua project Firebase.
- Sapu menu per peran di perangkat (emulator 1080x2400, APK 1.10.30-debug): Owner **21/21**, Kasir **11/21**, Supervisor **8/21**, tanpa satu pun `FATAL EXCEPTION` dari paket `com.cuciin.laundryops`. Kasir dan Supervisor sama dengan baseline 1.10.29, jadi tidak ada pelebaran hak.
- Kompatibilitas mundur terbukti di perangkat: role Supervisor disimpan lewat 1.10.30 (cermin `attendance.write` tertulis di `cuciin-data.json`), lalu APK 1.10.29 dipasang di atasnya dengan `adb install -r -d`; Supervisor di 1.10.29 tetap membuka 8/21 menu, 0 crash.
- Preset peran terbukti di perangkat: role uji dibuat lewat UI, preset "Hanya lihat" diterapkan (8 modul / 9 fungsi), tersimpan utuh sesudah aplikasi dihentikan paksa dan dibuka ulang.
- Firebase: akun operasional login berhasil di project `cuciin-ops`; kedua app Android terdaftar dengan sidik jari SHA-1 dan SHA-256.
- Data D1 produksi: seluruh nama pribadi diganti; yang tersisa hanya alamat email Owner yang memang dipertahankan.

## Yang disiapkan

- Application ID rilis `com.cuciin.laundryops`, versi `1.10.30`, versionCode `49`, target Android 16/API 36.
- APK non-debuggable dan AAB dengan kunci rilis terpisah. Build rilis berhenti bila konfigurasi penandatanganan tidak tersedia.
- Kunci privat dan kata sandi berada di luar repo, pada folder `signing-private` di sebelah folder repo; izin folder 700 dan berkas rahasia 600. Cadangkan keduanya ke penyimpanan privat yang aman sebelum dipakai untuk distribusi. Jangan mengganti kunci sembarangan setelah aplikasi terpasang.
- Rilis menolak akun tanpa kata sandi dan tidak menampilkan masuk cepat. Sesuai konfigurasi operasional saat ini, akun awal memakai `test1234` dan wajib diubah dari Profil sebelum dipakai untuk data nyata.
- Kegagalan Firebase tidak melewati autentikasi melalui fallback lokal pada rilis. Pendaftaran gagal tidak ditampilkan sebagai berhasil.
- HTTPS wajib, backup Android dinonaktifkan, FileProvider tidak diekspor dan hanya membagikan direktori bukti/ekspor. Tidak meminta izin SMS, aksesibilitas, kontak, atau instal aplikasi.
- Path dan berkas foto bukti dikeluarkan dari snapshot cloud; sinkronisasi mempertahankan foto lokal yang ada pada masing-masing HP.
- Pemulihan kata sandi: halaman reset Firebase memakai domain `cuciin-ops.web.app` dan berbahasa Indonesia. Dialog di aplikasi menjelaskan cara membuka tautan bila alamatnya terpotong aplikasi email atau pemindai tautan. Isi template email masih bawaan Firebase karena perubahan isi ditolak API (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`); rinciannya di `firebase/README.md`.
- Tema tampilan dapat dipilih setiap pengguna di Akun & profil: Ikut sistem, Terang, Gelap, dan Warna-warni. Pilihan disimpan di preferensi HP itu saja, terpisah dari data operasional dan sinkronisasi, sehingga tiap perangkat bebas berbeda.
- Kontras teks setiap tema dijaga minimal 4.5:1 dan batas kontrol minimal 3:1 memakai perhitungan rumus WCAG. Status bar dan navigation bar mengikuti tema aktif.
- Penyimpanan bersifat local-first: perubahan ditulis ke file lokal atomik dan persistent outbox sebelum dikirim. Command baru dihapus setelah acknowledgement, retry mempertahankan ID yang sama, dan perangkat mengambil delta berurutan dengan pagination revision.
- Delta cloud diterapkan dengan pending-remote marker persisten. Restart di tengah penerapan akan menyelesaikan snapshot dan cursor yang sama, bukan mengirim delta server kembali sebagai perubahan HP.
- Server mengirim scope role+cabang. Perubahan penugasan cabang memaksa bootstrap ulang; Service memakai versi monoton dan kompensasi stok menunggu tombstone penghapusan.
- Server mengambil tarif komisi dari katalog yang dikelola Owner dan mempertahankan komisi historis saat nota lama dikoreksi. Aplikasi dan server membatasi hapus pelanggan ke Owner, serta menolak penimpaan tutup kas dengan ID yang sudah dipakai.
- Sinkronisasi Firebase dimulai setelah autentikasi berhasil dan listener dihentikan saat pengguna logout.
- Kata sandi lokal memakai PBKDF2-HMAC-SHA256 dengan salt acak. Hash lama dimigrasikan setelah login valid; snapshot server dan ekspor tidak memuat hash kata sandi.

## Tindakan tersisa yang memerlukan Owner

1. Ubah kata sandi awal semua akun, pastikan alamat email karyawan benar, aktifkan MFA Owner, sesuaikan template reset Firebase, dan uji penerima nyata.
2. Pilih tujuan backup privat, atur jadwal dan retensi, jalankan backup serta restore test pertama, lalu simpan passphrase dan keystore pada dua media terenkripsi yang dikuasai Owner.
3. Setujui kebijakan master pelanggan bersama lintas cabang pada `DATA_GOVERNANCE.md` atau minta perubahan aturan sebelum data pelanggan nyata dimasukkan.
4. Rekonsiliasi saldo awal, daftar mesin/inventory, harga, komisi, biaya rutin, hak role, dan penugasan cabang.
5. Jalankan UAT fisik pada tipe HP operasional untuk offline/retry, haptic, kamera/bukti, Google Maps share, WhatsApp, PDF, printer bila dipakai, upgrade tanpa menghapus data, serta keempat pilihan tema termasuk kontras di bawah sinar matahari langsung.
6. Tentukan go/no-go setelah pilot dua perangkat. Ikuti `OPERATIONS_RUNBOOK.md`; jangan big-bang jika ada outbox tertahan atau selisih laporan.
7. Jika kelak memakai Google Play, Owner masih perlu Play Console, verifikasi developer, Data safety, kebijakan privasi terbit, testing, dan review Google.

## Fondasi cloud yang sudah disiapkan

Cloudflare Workers + D1 dapat dimulai dari paket gratis dan dinaikkan ke paket berbayar tanpa mengganti engine database. Skema relasional sudah memisahkan organisasi, cabang, staf, layanan, transaksi, rincian layanan, petugas, komisi, absensi, stok, inventory, biaya, kas, audit, dan jurnal sinkronisasi. Indeks tersedia untuk laporan cabang, kasir, petugas, absensi, dan periode.

Worker memverifikasi Firebase ID token menggunakan kunci publik Google, mendukung secret bootstrap melalui Cloudflare Secrets, memakai query terparameter, dan tidak menyimpan kata sandi. Command per entitas dicatat idempoten, delta dibatasi cabang, koreksi Service memakai optimistic concurrency, dan stok dijaga nonnegatif secara atomik. Foto bukti tetap disimpan di perangkat. QRIS tetap pencatatan metode pembayaran.

Resource produksi aktif: Worker `cuciin-api` (health `ok`, D1 `ready`, revision **409** pada 20 September 2026), D1 `cuciin-db` di APAC, dan proyek Firebase `cuciin-ops` (project lama `cuciin-ops-tiftazani` masih diterima selama masa peralihan). Endpoint snapshot tanpa autentikasi mengembalikan 401. Petunjuk migrasi, deploy, pemulihan, dan build ada di `laundry-ops/cloudflare/README.md`.

**Catatan penting sebelum deploy Worker dari pekerjaan 1.10.30:** perintah sinkronisasi **tidak membawa versi aplikasi**, jadi penjaga izin sisi server yang baru akan ikut menolak APK lama yang belum punya pemetaan fungsi terkini. Jangan deploy Worker ini ke produksi sebelum seluruh perangkat 20 cabang memakai versionCode ≥ 40 (penjaga harga sejak 1.10.21). Worker debug sudah dideploy (`717ddfa4`); Worker produksi belum, dan itu menunggu keputusan Owner.

## Build ulang

Atur `JAVA_HOME` ke JDK 17, `ANDROID_HOME` ke SDK Android, dan `CUCIIN_SIGNING_PROPERTIES` ke berkas privat. Berkas itu memuat `storeFile`, `storePassword`, `keyAlias`, dan `keyPassword`; jangan masukkan nilainya ke chat atau repo.

```sh
./gradlew assembleRelease bundleRelease testReleaseUnitTest lintRelease
python3 scripts/verify_release.py app/build/outputs/apk/release/app-release.apk --build-tools "$ANDROID_HOME/build-tools/35.0.0"
```

APK debug lama mempunyai ID `com.tiftazani.laundryops.debug`. APK rilis dipasang sebagai aplikasi berbeda dan tidak otomatis mewarisi data lokal atau foto buktinya. Jangan hapus aplikasi lama sebelum migrasi data dan bukti lokal selesai.

## Distribusi melalui Google Play

Buat dan verifikasi akun Play Console milik Owner, daftarkan paket, aktifkan Play App Signing, dan unggah AAB setelah penghambat keamanan diselesaikan. Lengkapi akses peninjau, Data safety, kebijakan privasi, proses penghapusan akun bila berlaku, konten rating, dan persyaratan testing yang ditampilkan Console. Ikuti review dan rilis yang disetujui Google. Akses tester bukan persetujuan produksi.

Jangan meminta pengguna mematikan Play Protect atau melewati peringatan. Jika APK dinilai keliru sebagai berbahaya, gunakan proses banding resmi dengan artefak dan sertifikat yang benar. Jika aplikasi hanya belum dikenal, ikuti proses pemindaian Google; tanda tangan sendiri bukan sertifikat bebas peringatan.

Referensi diperiksa 13 September 2026:
- [Panduan peringatan Play Protect](https://developers.google.com/android/play-protect/warning-dev-guidance)
- [Penandatanganan aplikasi](https://developer.android.com/studio/publish/app-signing)
- [Persyaratan target API Google Play](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Verifikasi developer Android](https://developer.android.com/developer-verification)
