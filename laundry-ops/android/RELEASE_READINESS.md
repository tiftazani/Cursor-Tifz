# Cuciin 1.8.2 — kesiapan rilis

Status: kandidat rilis teknis. **Belum dinyatakan aman untuk data produksi atau disetujui Google Play.** APK bertanda tangan tidak menjamin hilangnya peringatan Play Protect.

## Yang disiapkan

- Application ID rilis `com.tiftazani.laundryops`, versi `1.8.2`, versionCode `14`, target Android 16/API 36.
- APK non-debuggable dan AAB dengan kunci rilis terpisah. Build rilis berhenti bila konfigurasi penandatanganan tidak tersedia.
- Kunci privat dan kata sandi berada di luar repo, pada folder `signing-private` di sebelah folder repo; izin folder 700 dan berkas rahasia 600. Cadangkan keduanya ke penyimpanan privat yang aman sebelum dipakai untuk distribusi. Jangan mengganti kunci sembarangan setelah aplikasi terpasang.
- Rilis menolak akun tanpa kata sandi dan tidak menampilkan masuk cepat. Sesuai konfigurasi operasional saat ini, akun awal memakai `test1234` dan wajib diubah dari Profil sebelum dipakai untuk data nyata.
- Kegagalan Firebase tidak melewati autentikasi melalui fallback lokal pada rilis. Pendaftaran gagal tidak ditampilkan sebagai berhasil.
- HTTPS wajib, backup Android dinonaktifkan, FileProvider tidak diekspor dan hanya membagikan direktori bukti/ekspor. Tidak meminta izin SMS, aksesibilitas, kontak, atau instal aplikasi.
- Path dan berkas foto bukti dikeluarkan dari snapshot cloud; sinkronisasi mempertahankan foto lokal yang ada pada masing-masing HP.
- Penyimpanan bersifat local-first: perubahan ditulis ke file lokal atomik dan salinan cadangan sebelum dikirim ke Firebase. Kegagalan server tidak membatalkan transaksi lokal dan sinkronisasi dicoba ulang selama aplikasi aktif. Snapshot dengan versi lebih lama tidak menimpa data HP yang lebih baru.
- Sinkronisasi Firebase dimulai setelah autentikasi berhasil dan listener dihentikan saat pengguna logout.
- Kata sandi lokal memakai PBKDF2-HMAC-SHA256 dengan salt acak. Hash lama dimigrasikan setelah login valid; snapshot server dan ekspor tidak memuat hash kata sandi.

## Penghambat produksi dari pemeriksaan kode

1. Build tidak lagi membawa URL atau kunci server lama. Build kandidat memasang endpoint HTTPS Cloudflare; secret bootstrap tidak dimasukkan ke APK.
2. Cloudflare D1, Worker, Firebase Auth, dan verifikasi ID token sudah aktif. Endpoint snapshot kompatibilitas masih perlu diganti dengan sinkronisasi mutasi per baris sebelum beberapa HP boleh menulis transaksi secara bersamaan saat big bang 20 cabang.
3. Worker memverifikasi staf aktif dan membatasi snapshot serta laporan Kasir/SPV ke cabang yang diberikan. Pelanggan saat ini merupakan master bersama lintas cabang; tetapkan kebijakan akses pelanggan yang sesuai sebelum memasukkan data pribadi nyata.
4. `SYNC_SECRET` hanya jalur pemulihan/bootstrap dan tersimpan di Cloudflare Secrets serta backup privat lokal.
5. Belum ada Play Console, pendaftaran paket pada identitas developer terverifikasi, review Google Play, deklarasi Data safety, atau kebijakan privasi yang diterbitkan dan sesuai proses operasional yang sebenarnya.
6. Reset kata sandi Firebase sudah aktif. Sebelum operasi nyata, ubah kata sandi awal semua akun, sesuaikan template email Firebase, dan uji pengiriman ke setiap alamat karyawan yang benar.

## Fondasi cloud yang sudah disiapkan

Cloudflare Workers + D1 dapat dimulai dari paket gratis dan dinaikkan ke paket berbayar tanpa mengganti engine database. Skema relasional sudah memisahkan organisasi, cabang, staf, layanan, transaksi, rincian layanan, petugas, komisi, absensi, stok, inventory, biaya, kas, audit, dan jurnal sinkronisasi. Indeks tersedia untuk laporan cabang, kasir, petugas, absensi, dan periode.

Worker memverifikasi Firebase ID token menggunakan kunci publik Google, mendukung secret bootstrap melalui Cloudflare Secrets, memakai query terparameter, dan tidak menyimpan kata sandi. Foto bukti tetap disimpan di perangkat. QRIS tetap pencatatan metode pembayaran.

Resource produksi aktif: Worker `cuciin-api`, D1 `cuciin-db` di APAC, dan proyek Firebase `cuciin-ops-tiftazani`. Petunjuk migrasi, deploy, pemulihan, dan build ada di `laundry-ops/cloudflare/README.md`.

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
