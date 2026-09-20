# Arsitektur Aplikasi

Bagaimana kode Cuciin disusun dan mengapa pemisahannya seperti itu.

> Ringkasan: aplikasi dipisah menjadi lapisan data yang memutuskan aturan dan lapisan tampilan yang hanya menampilkan. Semua aturan bisnis berada di lapisan data supaya keputusan yang sama berlaku dari layar mana pun.

## Tujuan

Tanpa pemisahan, aturan seperti "siapa yang boleh menghapus Service" harus ditulis ulang di setiap tombol. Cuciin memusatkannya di satu tempat agar pantangan berbahaya tidak bergantung pada ingatan penulis layar.

## Letak dalam sistem

```text
MainActivity / CuciinApp      titik masuk dan kerangka navigasi
        |
        v
ui/                           layar dan komponen tampilan
  CuciinNav.kt                graf rute
  RouteAccess.kt              gerbang rute: rute mana butuh izin apa
  MenuOrder.kt                katalog menu dan susunannya
  MasterScreens, OpsScreens,  layar per kelompok kerja
  MoreScreens, AccessScreens,
  AnalyticsReportScreen, ...
        |
        v
data/                         aturan, penyimpanan, dan jaringan
  CuciinStore.kt              keadaan aplikasi dan seluruh perintah tulis
  AccessCatalog.kt            katalog modul dan fungsi
  AccessPolicy.kt             keputusan boleh atau tidak
  CloudSync.kt                antrean perubahan dan sinkronisasi
  FirebaseCloud.kt            masuk akun
  LocalJson.kt                penyimpanan berkas lokal
        |
        v
Cloudflare Worker + D1        keadaan resmi lintas cabang
```

## Cara kerja

### Lapisan tampilan

Layar Compose tidak menulis data secara langsung. Setiap tindakan tulis memanggil fungsi di `CuciinStore`, dan fungsi itu yang memeriksa izin serta mencatat perubahan.

Gerbang rute berada di `ui/RouteAccess.kt`. Berkas itu memetakan nama rute ke pasangan modul dan fungsi, misalnya rute `customers` memerlukan `customer` dan `customer.view`. Tabel ini adalah kebenaran untuk menentukan rute mana yang boleh dibuka.

> **PERHATIAN**
> Gerbang rute dan pemeriksaan di dalam layar harus memakai nama modul dan fungsi yang sama. Bila keduanya memakai ukuran berbeda, pengguna sah akan terlempar keluar dari layar yang sebenarnya boleh dibuka. Kasus ini pernah terjadi pada rute `ownerSettings` dan menghasilkan gejala "menu tidak bisa diklik".

### Lapisan data

`CuciinStore` menyimpan seluruh keadaan sebagai daftar yang dapat diamati: cabang, karyawan, pelanggan, layanan, produk, pesanan, absensi, kas, dan audit. Karena daftar itu diamati, perubahan langsung tercermin di layar tanpa pengiriman ulang peristiwa.

Setiap fungsi tulis memakai pola yang sama:

1. memeriksa izin lewat `boleh(module, function)`;
2. bila ditolak, mengembalikan pesan penolakan yang bisa ditampilkan;
3. bila diizinkan, mengubah keadaan, mencatat jurnal audit, dan menandai ada perubahan.

### Katalog akses

`AccessCatalog` adalah sumber tunggal untuk daftar modul dan fungsi. Pada versi `1.10.30` katalog memuat 15 modul dan 41 fungsi. Katalog juga memuat peta kunci lama untuk kompatibilitas, karena perangkat `1.10.29` masih menulis format lama.

## Kontrak dan dependensi

| Elemen | Tipe | Keterangan |
|---|---|---|
| `CuciinStore` | `object` | Keadaan aplikasi dan seluruh perintah tulis |
| `AccessCatalog` | `object` | Daftar modul, fungsi, dan preset peran |
| `AccessPolicy.can` | fungsi | Memutuskan boleh atau tidak untuk satu pengguna |
| `RouteAccess.gate` | peta | Rute ke pasangan modul dan fungsi |
| `MenuOrder` | `object` | Katalog menu, urutan, dan bagian |
| `CloudSync` | `object` | Antrean perubahan dan sinkronisasi ke server |

## Verifikasi

| Yang diperiksa | Caranya |
|---|---|
| Setiap kunci izin di layar ada di katalog | `RouteAccessTest` dan tes katalog di `app/src/test` |
| Gerbang rute menolak peran yang tidak berhak | Tes negatif: cabut izin sementara, tes harus gagal |
| Semua menu benar-benar terbuka | `android/scripts/sapu_role.py` pada emulator |

## Risiko dan batasan

- **Gerbang rute menang di atas pemeriksaan layar.** Bila keduanya berbeda, pengguna akan terlempar keluar walaupun tombolnya terlihat. Perubahan pada katalog harus diikuti pemeriksaan `ui/RouteAccess.kt`.
- **Kompatibilitas kunci lama belum boleh dihapus.** Selama ada perangkat `1.10.29`, peta kunci lama di `AccessCatalog` harus tetap ada.
- **Belum ada tes otomatis di perangkat.** Seluruh tes berjalan di JVM. Pemeriksaan tampilan masih dilakukan lewat skrip pada emulator, dan skrip itu sendiri perlu dijaga agar tidak menghasilkan laporan palsu.
