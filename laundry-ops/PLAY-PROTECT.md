# Play Protect: apa yang bisa dan tidak bisa dibuktikan

Dokumen ini mencatat hasil pemeriksaan atas pertanyaan "kenapa Play Protect muncul saat memasang
APK Cuciin". Ditulis supaya tidak ada klaim tanpa bukti.

## Yang diperiksa dan hasilnya

### APK-nya sendiri bersih

```text
package        com.cuciin.laundryops  versionCode 43  versionName 1.10.24
application-label  Cuciin
targetSdkVersion   36
debuggable     TIDAK ADA atribut debuggable (benar untuk rilis)
izin           INTERNET, ACCESS_NETWORK_STATE, READ_GSERVICES  (minimum)
tanda tangan   v2 dan v3 valid, v1 tidak dipakai (normal untuk minSdk 26+)
```

Tidak ada tanda bahaya: bukan debuggable, izin minimum, ditandatangani skema modern, label benar.

### Nama pribadi di dalam APK

Hanya dua kemunculan, keduanya sudah disepakati tidak dapat diubah:

1. `tiftazani.khara@gmail.com` — identitas akun Firebase. Mengubahnya memutus login semua perangkat.
2. `cuciin-api.tiftazani-cuciin.workers.dev` — URL Worker. Mengubahnya memutus APK yang sudah beredar.

Keduanya **bukan teks yang tampil di layar**. Aturan "nama pribadi hilang dari tampilan" tetap
terpenuhi.

### Sertifikat penandatangan

```text
CN=Tiftazani Khara, OU=Cuciin
SHA-256: 3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee
```

Sertifikat masih memuat nama pribadi. **Ini tidak dapat diperbaiki tanpa konsekuensi serius:**
mengganti sertifikat berarti Android menganggap APK baru sebagai aplikasi berbeda, sehingga
20 cabang harus mencopot dan memasang ulang, dan data lokal (foto absensi, cache, antrean
sinkronisasi) tidak ikut pindah. Sertifikat juga **tidak muncul di antarmuka aplikasi**; ia hanya
terlihat di dialog izin sebagian OEM dan di halaman informasi sertifikat yang tersembunyi.

Keputusan: **dibiarkan**, dengan alasan teknis di atas. Dicatat di sini supaya keputusan itu
disengaja, bukan terlewat.

## Kenapa Play Protect muncul

Yang **tidak** dapat dibuktikan: penyebab pastinya. Play Protect adalah sistem tertutup milik
Google; tidak ada cara memeriksa dari sisi kami mengapa sebuah APK ditandai.

Yang **dapat** disebut sebagai faktor, berdasarkan sifat APK dan cara distribusinya:

1. **APK tidak pernah diunggah ke Play Store.** Ini faktor terbesar. Play Protect memberi reputasi
   lebih rendah pada aplikasi yang tidak dikenal sistemnya. Aplikasi yang dipasang dari Play Store
   sudah melewati pemindaian dan punya jejak reputasi.
2. **Sertifikat penandatangan belum dikenal.** Kunci ini baru dipakai untuk menandatangani APK
   Cuciin; tidak ada aplikasi lain di perangkat yang memakai kunci yang sama, sehingga tidak ada
   reputasi yang bisa diwarisi.
3. **Dipasang lewat sideload** (kirim berkas, bukan dari toko). Setiap sideload dinilai ulang.
4. **Sertifikat belum berumur panjang.** Kunci yang sudah lama beredar dan dipakai banyak
   instalasi lebih dipercaya.

## Yang TIDAK disarankan

Jangan menyarankan pengguna mematikan Play Protect atau mengabaikan peringatannya. Itu melemahkan
perlindungan keamanan perangkat, dan tidak menyelesaikan akar masalahnya.

## Yang benar-benar menyelesaikan

**Unggah ke Google Play, walau hanya ke jalur internal testing.** Begitu aplikasi terdaftar di
Play Console dan ditandatangani lewat Play App Signing, reputasinya terbentuk dan peringatan
sideload hilang untuk pemasangan berikutnya. Ini juga membuka jalur pembaruan otomatis, yang
berguna untuk 20 cabang: sekarang tiap pembaruan harus dikirim dan dipasang manual.

Kalau Play Store belum memungkinkan (mis. karena butuh akun developer berbayar dan proses
verifikasi), cara yang tetap sah:

- Bagikan APK lewat jalur resmi milik sendiri (folder rilis yang sudah dipakai sekarang), dan
  sertakan checksum supaya cabang bisa memverifikasi berkas yang diterima.
- Jelaskan ke cabang bahwa peringatan saat pemasangan pertama itu wajar untuk aplikasi yang belum
  ada di Play Store, dan bukan tanda aplikasi berbahaya.

## Status

Pemeriksaan ini **tidak menyimpulkan penyebab pasti** dan tidak boleh dilaporkan seolah-olah
begitu. Yang bisa dipastikan: APK-nya sendiri bersih, dan faktornya ada di sisi reputasi
distribusi, bukan di isi aplikasi.
