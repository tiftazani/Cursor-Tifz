# Dokumentasi Teknis Cuciin

Untuk pengembang yang akan menjalankan, memelihara, menguji, dan merilis aplikasi Cuciin.

| Metadata | Nilai |
|---|---|
| Jenis dokumen | Dokumentasi Teknis |
| Untuk | Pengembang dan pemelihara |
| Versi aplikasi | `1.10.30` (versionCode `49`) |
| Diperbarui | 20 September 2026 |
| Status | Berlaku |

## Tujuan dokumen

Dokumen ini menjelaskan bagaimana aplikasi Cuciin dibangun dan bekerja: dari menyiapkan lingkungan, memahami arsitektur dan aliran data, sampai merilis versi baru dan menangani kegagalan. Setiap angka dan nama berkas di sini diambil dari kode pada versi yang disebut di metadata.

## Daftar isi

| Bagian | Isi |
|---|---|
| [Mulai cepat](mulai.md) | Kebutuhan lingkungan, cara membangun, cara menjalankan di perangkat |
| [Arsitektur aplikasi](arsitektur.md) | Lapisan, modul, dan tanggung jawabnya |
| [Data dan integrasi](data-dan-integrasi.md) | Penyimpanan lokal, sinkronisasi, autentikasi, otorisasi |
| [Pengujian](pengujian.md) | Susunan tes, cara menjalankannya, dan cara memverifikasi di perangkat |
| [Rilis](rilis.md) | Versi, penandatanganan, dan distribusi |

## Ringkasan bentuk sistem

Cuciin terdiri dari dua bagian yang harus dipahami bersamaan.

**Aplikasi Android** adalah tempat kerja sesungguhnya. Aplikasi menyimpan datanya sendiri di perangkat, bekerja tanpa jaringan, lalu mengirim perubahan ke server saat ada koneksi. Karena itu aplikasi tetap dapat dipakai ketika internet cabang putus.

**Server** adalah titik temu antarcabang. Server tidak memutuskan apa pun tentang tampilan; tugasnya menyimpan keadaan resmi, menerima perubahan, dan menolaknya bila perubahan itu melanggar aturan bisnis. Server juga yang memutuskan apakah sebuah akun boleh masuk.

```text
Aplikasi Android (perangkat cabang)
  simpan lokal  ->  antrean perubahan  ->  kirim ke server
                                               |
                                               v
                                    Cloudflare Worker + D1
                                    keadaan resmi lintas cabang
```

## Fakta teknis ringkas

Angka di bawah ini berasal dari berkas konfigurasi dan katalog pada versi `1.10.30`.

| Elemen | Nilai | Sumber |
|---|---|---|
| `applicationId` rilis | `com.cuciin.laundryops` | `android/app/build.gradle.kts` |
| `applicationId` debug | `com.cuciin.laundryops.debug` | `android/app/build.gradle.kts` |
| `versionCode` | `49` | `android/app/build.gradle.kts` |
| `versionName` | `1.10.30` | `android/app/build.gradle.kts` |
| `minSdk` | `26` | `android/app/build.gradle.kts` |
| `targetSdk` | `36` | `android/app/build.gradle.kts` |
| Modul akses | 15 | `data/AccessCatalog.kt` |
| Fungsi akses | 41 | `data/AccessCatalog.kt` |
| Fungsi terkunci Owner | 15 | `data/AccessCatalog.kt` |
| Menu di layar Modul | 21 | `ui/MenuOrder.kt` |
| Tes unit debug | 269 | `app/src/test` |
| Tes unit rilis | 269 | `app/src/test` |

> **PERHATIAN**
> Versi aplikasi `1.10.29` masih dipakai di cabang selama masa migrasi. Server harus tetap menerima token Firebase lama dan baru sampai seluruh perangkat berpindah. Jangan menyederhanakan jalur kompatibilitas tanpa memeriksa dulu perangkat yang masih aktif.
