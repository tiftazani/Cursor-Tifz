# Cuciin 1.9.3 — kesiapan rilis

Status: kandidat rilis operasional yang sudah lulus pemeriksaan kode, build, migrasi produksi, dan uji integrasi API pada 15 September 2026. Owner tetap harus menyelesaikan validasi perangkat, rotasi akun, saldo awal, backup terjadwal pertama, dan keputusan go-live. APK bertanda tangan tidak menjamin hilangnya peringatan Play Protect pada distribusi di luar store.

## Bukti verifikasi kandidat

- Android: 47 unit test debug dan 47 unit test rilis lulus, lint debug/rilis tanpa error, APK debug/rilis dan AAB rilis berhasil dibuat dengan JDK 17.
- APK rilis: non-debuggable, application ID `com.tiftazani.laundryops`, versionCode `18`, versionName `1.9.3`, target API 36, signature v2 valid, dan kompatibel dengan page size 16 KB.
- SHA-256 sertifikat rilis cocok dengan fingerprint yang dicatat: `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.
- Cloudflare: migrasi `0003_command_sync.sql` dan `0004_operational_links.sql` sudah diterapkan ke D1 produksi, dan Worker versi `71310107-4ec5-48f8-aedb-481be9107649` aktif.
- Health produksi mengembalikan database `ready`. Uji command pelanggan membuktikan retry command yang sama tidak menggandakan mutasi; penghapusan dan delta revision juga berhasil.
- Backup sebelum migrasi sudah diuji dengan `PRAGMA integrity_check = ok`. Penyimpanan backup produksi terjadwal ke tujuan privat belum ditetapkan oleh Owner; workflow repository publik tidak menyimpan artifact database.
- Checksum APK/AAB kandidat dicatat pada `laundry-ops/releases/1.9.3-candidate/SHA256SUMS`.

## Yang disiapkan

- Application ID rilis `com.tiftazani.laundryops`, versi `1.9.3`, versionCode `18`, target Android 16/API 36.
- APK non-debuggable dan AAB dengan kunci rilis terpisah. Build rilis berhenti bila konfigurasi penandatanganan tidak tersedia.
- Kunci privat dan kata sandi berada di luar repo, pada folder `signing-private` di sebelah folder repo; izin folder 700 dan berkas rahasia 600. Cadangkan keduanya ke penyimpanan privat yang aman sebelum dipakai untuk distribusi. Jangan mengganti kunci sembarangan setelah aplikasi terpasang.
- Rilis menolak akun tanpa kata sandi dan tidak menampilkan masuk cepat. Sesuai konfigurasi operasional saat ini, akun awal memakai `test1234` dan wajib diubah dari Profil sebelum dipakai untuk data nyata.
- Kegagalan Firebase tidak melewati autentikasi melalui fallback lokal pada rilis. Pendaftaran gagal tidak ditampilkan sebagai berhasil.
- HTTPS wajib, backup Android dinonaktifkan, FileProvider tidak diekspor dan hanya membagikan direktori bukti/ekspor. Tidak meminta izin SMS, aksesibilitas, kontak, atau instal aplikasi.
- Path dan berkas foto bukti dikeluarkan dari snapshot cloud; sinkronisasi mempertahankan foto lokal yang ada pada masing-masing HP.
- Pemulihan kata sandi: halaman reset Firebase memakai domain `cuciin-ops-tiftazani.web.app` dan berbahasa Indonesia. Dialog di aplikasi menjelaskan cara membuka tautan bila alamatnya terpotong aplikasi email atau pemindai tautan. Isi template email masih bawaan Firebase karena perubahan isi ditolak API (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`); rinciannya di `firebase/README.md`.
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

Resource produksi aktif: Worker `cuciin-api` versi `71310107-4ec5-48f8-aedb-481be9107649`, D1 `cuciin-db` di APAC, dan proyek Firebase `cuciin-ops-tiftazani`. Health check produksi lulus pada 15 September 2026 dengan revision 40; endpoint snapshot tanpa autentikasi mengembalikan 401. Petunjuk migrasi, deploy, pemulihan, dan build ada di `laundry-ops/cloudflare/README.md`.

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
