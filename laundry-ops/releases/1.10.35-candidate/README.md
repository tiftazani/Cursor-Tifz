# Cuciin 1.10.35 (versionCode 54) — kandidat

Paket rilis: `com.cuciin.laundryops` — label **Cuciin**
Paket debug: `com.cuciin.laundryops.debug` — label **Cuciin Debug**

## Kelas bug yang ditutup

**Kegagalan masuk tidak lagi diam.** Menekan **Masuk** dengan sandi salah membuat tombol kembali
seperti semula tanpa penjelasan apa pun. Perangkat membuktikan aplikasi memang menerima penolakan
dari server identitas (log `RecaptchaCallWrapper: Initial task failed ... The supplied auth
credential is incorrect`), tetapi pesannya hilang sebelum sampai ke mata pengguna. Dua sebab yang
ditemukan dan diperbaiki bersamaan:

1. **Pesan dikirim lewat jalur yang tidak dirender di layar pra-login.** `toast()` memakai
   `SnackbarHost` yang berada di dalam `Scaffold` ber-sesi; layar Masuk dirender di luar
   `Scaffold` itu. Bukti: `uiautomator dump` tidak pernah memuat satu pun elemen `Snackbar`.
   Sekarang pesan tampil sebagai banner di layar Masuk dan layar Daftar.
2. **Jawaban datang di thread yang salah.** Seluruh listener Firebase dipanggil di thread internal
   Firebase, dan pembaruan state Compose dari thread itu tidak tergambar. Jawaban sekarang diantar
   ke main thread lewat `ui { }`.

Ditambah dua penjaga supaya tombol tidak pernah berhenti tanpa jawaban:

- Batas waktu 20 detik: bila rantai Firebase tidak menjawab, proses berhenti dengan pesan jelas dan
  tombol Masuk bisa ditekan lagi. `addOnCanceledListener` juga menjawab, karena kegagalan
  reCAPTCHA membatalkan Task, bukan memanggil listener gagal biasa.
- Pesan mentah Firebase berbahasa Inggris diganti pesan berbahasa pengguna
  (`friendlyAuthMessage`).

## Hasil test

Gate dijalankan dari `clean`, `BUILD SUCCESSFUL`, `gradle_exit=0`:

| Varian | Test | Gagal | Error |
| --- | --- | --- | --- |
| `testDebugUnitTest` | 285 | 0 | 0 |
| `testReleaseUnitTest` | 285 | 0 | 0 |

`lintDebug` + `lintRelease`: **0 error**.

### Bukti tes penjaga bisa MERAH

Dua tes baru di `LoginTimeoutTest.kt` dibuktikan bisa gagal saat bug dikembalikan:

| Bug dikembalikan | Tes yang merah |
| --- | --- |
| `ui { onDone(...) }` dikembalikan jadi `onDone(...)` langsung | `jawabanDiantarKeMainThread` |
| pesan dikembalikan lewat `toast(msg)` (termasuk signature `toast` di `LoginScreen`) | `gagalMasukDitampilkanDiLayarBukanLewatPesanSingkat` |

Catatan: mengembalikan hanya pemakaian `toast(msg)` tanpa mengembalikan parameternya gagal
**kompilasi** (`Unresolved reference 'toast'`), bukan merah di tes. Jadi penghapusan parameter itu
sendiri sudah menjadi penjaga tingkat kompilator.

## Bukti perangkat

Emulator `MindChampions_API35` / `emulator-5554` (1080x2400).

| Uji | Paket | Hasil |
| --- | --- | --- |
| Sandi salah | debug 1.10.35 | Pesan **Email atau kata sandi tidak sesuai.** tampil di layar |
| Sandi salah | **release 1.10.35** | Pesan **Email atau kata sandi tidak sesuai.** tampil di layar |
| Sandi benar (Aida, Kasir, `test1234`) | **release 1.10.35** | Masuk ke **Antrian laundry**, cabang **Laupay Kirab** |

APK rilis menimpa pemasangan 1.10.33 di perangkat **tanpa uninstall**, karena sertifikat
penandatangan tidak berubah: `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.
Memperbarui APK tidak menghapus data lokal.

## Verifikasi artefak

`verify_release.py`: **PASS** (tanda tangan rilis v2, non-debuggable, target SDK, izin minimum,
ZIP/ELF 16 KB). Penanda perbaikan ditemukan di dalam `classes.dex` APK rilis.

```
f8df633894e5e9fff74eaf5361c357c89b63d278dddaf2826e58fa41d4803ce0  cuciin-1.10.35-debug.apk
4bf114c0c1175f09d0724f6c8393eecd1f4846c32ace46cdeeae8cb324103f82  cuciin-1.10.35-release.apk
7af876c600552fd74e785496faa9790aa682456b049f6b01af8383adb7a25c52  cuciin-1.10.35-release.aab
```

Salinan di akar `releases/` sudah disamakan dengan kandidat ini (`releases/cuciin-release.apk`,
`releases/cuciin-debug.apk`, hash identik).

## Yang BELUM dibuktikan

- Perbaikan diuji pada **satu perangkat emulator**, bukan HP cabang sungguhan.
- Belum ada `androidTest`; bukti perangkat berasal dari `uiautomator dump` dan `logcat`.
- Sapu menu per peran pada versi ini belum dijalankan ulang; sapu peran terakhir dilakukan pada
  1.10.30.
- Batas waktu 20 detik belum pernah benar-benar berbunyi di perangkat: pada emulator ini rantai
  Firebase selalu berakhir di `addOnCanceledListener` dalam ~1,3 detik, jadi jalur batas waktu itu
  masih hanya terbukti lewat pembacaan kode, belum lewat pengujian.
- Tombol Simpan pada dialog Ubah kata sandi belum diuji ulang setelah perubahan ini.
- Akun Owner `tiftazani.khara@gmail.com` masih memakai sandi yang tidak diketahui pemiliknya
  (akibat insiden uji sebelumnya); jalur sukses diuji memakai akun Kasir `aidanurita25@gmail.com`.
