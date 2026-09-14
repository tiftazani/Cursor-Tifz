# Verifikasi kandidat rilis 1.5.1

10 September 2026.

- `assembleRelease`, `bundleRelease`, `assembleDebug`, `testReleaseUnitTest`, dan `lintRelease`: berhasil.
- Pengujian JVM: aturan login rilis diuji untuk kombinasi akun disetujui/tidak, cabang ada/tidak, hash kata sandi ada/tidak, pemulihan sesi, dan kecocokan kata sandi. Akun tanpa kata sandi ditolak pada rilis. Kompatibilitas akun awal debug ikut diperiksa.
- Lint: 0 error, 11 peringatan (ketersediaan versi dependency, konfigurasi ikon, dan saran KTX). Tidak ada peringatan backup setelah aturan ekstraksi ditambahkan. Peringatan lint bukan peringatan Play Protect.
- `verifyReleaseSigning` tanpa konfigurasi keystore: gagal sebagaimana diharapkan, tanpa fallback sertifikat debug.
- APK: sertifikat SHA-256 cocok dengan identitas yang disimpan, signature v2 valid, non-debuggable, target SDK 36, izin sesuai daftar minimum, tidak membawa UI MASUK CEPAT.
- `zipalign -c -P 16 -v 4`: lulus; seluruh segmen LOAD ELF 64-bit memiliki alignment minimal 16384. Ini pemeriksaan struktur, bukan uji perangkat 16 KB.
- AAB: `jarsigner -verify` berhasil; struktur divalidasi dengan bundletool resmi Google 1.18.3. Peringatan sertifikat self-signed/tanpa timestamp dari jarsigner tidak menyatakan hasil Play Protect.
- Emulator API 35 tanpa jaringan: instal APK rilis berhasil, aplikasi terbuka, masuk cepat tidak ada, login kosong ditolak. Update APK dengan kunci rilis yang sama berhasil.
- `git diff --check`: bersih. Kunci API dan URL API tidak diganti. Kunci privat dan google-services.json tidak dimasukkan ke repo.

Belum diuji: review/pemindaian Google Play, login dengan akun produksi, keamanan server langsung, sinkronisasi multiperangkat, migrasi data debug ke rilis, atau matriks perangkat Android 16. Kandidat ini belum dinyatakan siap produksi; lihat RELEASE_READINESS.md.
