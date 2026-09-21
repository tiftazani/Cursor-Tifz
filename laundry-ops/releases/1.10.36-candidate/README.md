# Cuciin 1.10.36 (versionCode 55)

Kandidat rilis 21 Sep 2026. APK dan AAB **tidak** dilacak Git (aturan `releases/`); hanya
`README.md` dan `SHA256SUMS.txt` di folder ini yang masuk repo. Berkas binary-nya dibagikan
di luar Git.

## Isi rilis ini

Perbaikan utamanya **ada di sisi server (Cloudflare Worker), bukan di aplikasi**. Nomor versi
aplikasi dinaikkan supaya perangkat yang masih memegang versionCode 54 bisa menimpa dengan
bersih, dan supaya pemasangan baru terlihat jelas di layar Riwayat versi.

### 1. Login akun baru tidak lagi ditolak (perbaikan Worker)

Saat sebuah akun masuk untuk pertama kali, Worker menyimpan penanda identitas
(`firebase_uid`) ke baris `staff`. Bila penyimpanan itu ditolak karena kuota tulis D1 harian
habis, kegagalannya menjalar ke atas dan **seluruh** proses masuk gagal `500 code 1101`
dengan pesan "Server identitas belum tersedia", padahal email dan sandinya benar. Akun yang
sudah pernah masuk tidak terpengaruh karena tidak butuh tulis, sehingga gejalanya tampak
seperti "akun rusak" padahal servernya yang menutup pintu.

Sekarang penyimpanan penanda itu tidak lagi menjadi syarat masuk: identitas diverifikasi dari
bacaan, dan penanda diisi ulang pada kesempatan berikutnya. Akun yang tidak terdaftar tetap
ditolak.

Bukti langsung ke REST sesudah deploy:

```
Owner kedua (us.archuleta1207@gmail.com, firebase_uid NULL)
  /v1/me  ->  HTTP 200  {"role":"Owner","branchIds":["bunayya","laupay-dayeuh","laupay-kirab","shelly"]}
             sebelumnya: HTTP 500 code 1101
Token palsu          ->  HTTP 401  (tetap ditolak)
/health              ->  HTTP 200
```

Worker produksi: `5ec0843c-714a-4ca1-bbe3-1294f774df21`. Empat akun ber-`firebase_uid` NULL
(Owner kedua + 3 Kasir) semuanya kini lolos `/v1/me` 200.

### 2. Isian papan ketik (sudah ikut di 1.10.35)

- Kolom isian berpindah dengan tombol **Berikutnya**; tombol **Selesai** menutup papan ketik.
- Sebelumnya fokus tidak berpindah, sehingga ketikan berikutnya masuk ke kolom yang sama.
- Satu perbaikan di komponen bersama (`GlassField`) menutup sekitar 30 kolom, termasuk
  formulir buat akun kasir.

### 3. Sinkronisasi latar belakang (sudah ikut di 1.10.35)

- Pemeriksaan perubahan cabang lain: 60 detik, sebelumnya 12 detik.
- Pengiriman transaksi dari perangkat tetap seketika; yang berkurang hanya pemeriksaan latar
  belakang, jadi baterai dan paket data lebih hemat di 20 cabang.

## Hasil test

Gate dijalankan dari `clean`, `BUILD SUCCESSFUL`:

| Varian | Test | Gagal | Error |
| --- | --- | --- | --- |
| `testDebugUnitTest` | 288 | 0 | 0 |
| `testReleaseUnitTest` | 288 | 0 | 0 |

`lintDebug`: **0 error**. Gate Worker: **69 tes, 0 gagal**, `tsc --noEmit` bersih.

Tes penjaga baru `FieldKeyboardActionTest.kt` (Android) dan `login-quota.test.mjs` (Worker)
terbukti **merah saat perbaikannya dikembalikan**, lalu hijau saat dipulihkan:

```
FieldKeyboardActionTest   perbaikan aktif -> 3 lulus 0 gagal
                          dibug-kan       -> 2 gagal          <- MERAH
login-quota               perbaikan aktif -> 5 lulus 0 gagal
                          dibug-kan       -> 3 gagal          <- MERAH
```

## Verifikasi artefak

`verify_release.py`: **PASS** (tanda tangan rilis v2, non-debuggable, target SDK, izin minimum,
ZIP/ELF 16 KB). Sertifikat penandatangan **tidak berubah**:
`3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`. APK rilis menimpa
pemasangan 1.10.35 di perangkat **tanpa uninstall**, dan memperbarui APK tidak menghapus data lokal.

```
e5ada6826d4dc4a34fdf4bf3ddb275312cf1c13a31c88f6695695ae9a0acb96a  cuciin-1.10.36-debug.apk
ce7373679916610fc268666c61d04b6e91997c83a1b8dfd40a82fabe1bb2c678  cuciin-1.10.36-release.apk
3b52a438b3263f32ecbfa5e8c3c7ecd7eaa96691b0baec01d6687169251c2d0c  cuciin-1.10.36-release.aab
```

Label paket: rilis `Cuciin` / `com.cuciin.laundryops`, debug `Cuciin Debug` /
`com.cuciin.laundryops.debug`, keduanya versionCode 55.

Salinan di akar `releases/` sudah disamakan dengan kandidat ini (`releases/cuciin-release.apk`,
`releases/cuciin-debug.apk`, hash identik, `shasum -c` OK).

## Yang BELUM dibuktikan

- Perbaikan login diuji lewat REST langsung dan lewat `uiautomator`/`logcat` pada **satu
  emulator**, bukan HP cabang sungguhan.
- Belum ada `androidTest`; bukti perangkat berasal dari `uiautomator dump` dan `logcat`.
- Isi aplikasi 1.10.36 **sama dengan 1.10.35** (hanya nomor versi naik), jadi perbaikan papan
  ketik dan sinkronisasi sudah beredar sejak 1.10.35.
- Sapu menu per peran pada versi ini belum dijalankan ulang; sapu peran terakhir pada 1.10.30.
- Kuota tulis D1 free tier (100.000 baris/hari, **per akun**) masih bisa habis karena pekerjaan
  agen sendiri. Perbaikan ini membuat login tetap jalan saat kuota habis, tetapi **transaksi
  kasir tetap gagal tersimpan saat kuota habis**. Data perangkat tidak hilang karena antrean
  lokal, dan terkirim saat kuota pulih (07:00 WIB).
- Akun Owner `tiftazani.khara@gmail.com` masih memakai sandi yang tidak diketahui pemiliknya
  (akibat insiden uji sebelumnya); jalur sukses diuji memakai akun lain.
- Server baru mengenal **4 cabang**, bukan 20.
