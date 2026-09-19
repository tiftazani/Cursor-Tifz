# Cuciin 1.10.28 (versionCode 47) — kandidat

Perbaikan dua kelas bug cara MENOLAK izin, ditemukan setelah 1.10.27 menutup seluruh 17 fungsi
Kontrol Akses Role. Menutup pemeriksaannya belum cukup: cara menolaknya masih salah di 12 titik.

## Yang diperbaiki

### Kelas A — penolakan mematikan aplikasi

`saveNota` dan `addInventory` memakai `require(boleh(...))` yang melempar
`IllegalArgumentException`. Supervisor memiliki MODUL `service` sehingga menu "Service baru"
tampil, tetapi tidak memiliki fungsi `service.create`: menekan Simpan langsung menutup aplikasi.

Penolakan izin adalah kejadian NORMAL, bukan kesalahan program. Sekarang `saveNota` memakai
`check` dan dicegat lebih dulu oleh `canCreateService()` di UI; `addInventory` mengembalikan `null`
dan UI menampilkan pesan.

### Kelas B — penolakan dilaporkan sebagai sukses

Sepuluh fungsi memakai `if (!boleh(...)) return` sehingga store tidak menulis apa pun, tetapi UI
tetap menampilkan "Cabang tersimpan", "Layanan tersimpan", "Perubahan aset tersimpan". Itu laporan
palsu: pengguna mengira datanya tersimpan, dan bug tersembunyi karena layar tampak bekerja.

Titik yang kini mengembalikan pesan penolakan:

| Fungsi | Sebelum | Sekarang |
| --- | --- | --- |
| `updateBranch` | `return` diam | `String?` pesan |
| `updateBranchMap` | `return` diam | `String?` pesan |
| `updateCustomer` | `return` diam | `String?` pesan |
| `updateService` | `return` diam | `String?` pesan |
| `updateProduct` | `return` diam | `String?` pesan |
| `updateAssetType` | `return` diam | `String?` pesan |
| `updateInventory` | `return` diam | `String?` pesan |
| `markWaSent` | `return` diam | `String?` pesan |
| `editStock` | `return` diam | `String?` pesan |
| `editStocks` | `return 0` | `CuciinStore.TOLAK_STOK` (-1) |
| `addService` | tanpa penjaga | `ServiceItem?` + `owner.manage` |
| `addProduct` | tanpa penjaga | `Product?` + `owner.manage` |

`addService` dan `addProduct` ternyata tidak punya penjaga izin sama sekali, jadi menemukan kelas
bug ini ikut menutup lubang yang belum terlihat sebelumnya.

`editStocks` mengembalikan jumlah perubahan, jadi memakai penanda `TOLAK_STOK` = -1; jumlah sah
selalu >= 0 sehingga UI dapat membedakan "ditolak" dari "tidak ada yang berubah" tanpa melempar
pengecualian.

Pemeriksa izin baru di UI supaya jalur penolakan tidak pernah dipanggil: `canCreateService()`,
`canSendWa()`.

## Test pengunci baru

Ketiganya membaca kode sumber dan sudah dibuktikan GAGAL saat bug dikembalikan:

- `penolakanIzinTidakMemakaiRequireYangMelempar` — menolak `require(boleh(...))` di store.
- `penolakanIzinSelaluMembawaPesan` — menolak `if (!boleh(...)) return` telanjang.
- `uiMemakaiPesanPenolakanDariStore` — setiap pemanggil di UI harus memakai pesan penolakan,
  `?.let`, atau pemeriksa izin.

Test ketiga menemukan satu call site nyata yang mengabaikan hasilnya (`markWaSent` di layar nota)
saat pertama dijalankan.

## Hasil gate

| Pemeriksaan | Hasil |
| --- | --- |
| Test Android debug | 205 lulus, 0 gagal |
| Test Android release | 205 lulus, 0 gagal |
| Lint | lulus |
| Test Worker | 53 lulus, 0 gagal |
| `owner.manage` titik jaga | 15 -> 17 |

## Verifikasi APK

| Pemeriksaan | Hasil |
| --- | --- |
| `versionCode` / `versionName` | `47` / `1.10.28` |
| Label release | `Cuciin` |
| Label debug | `Cuciin Debug` (`1.10.28-debug`) |
| Tanda tangan | V3.0 valid, `CN=Tiftazani Khara, OU=Cuciin` |
| SHA-256 sertifikat | `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee` |

Sertifikat sengaja tetap memuat nama pribadi demi menjaga jalur pembaruan: menggantinya membuat
Android menganggap APK baru sebagai aplikasi berbeda sehingga 20 cabang harus memasang ulang dan
data lokal tidak ikut pindah. Nama itu tidak muncul di antarmuka aplikasi.

## Berkas

| Berkas | Ukuran | SHA-256 |
| --- | --- | --- |
| `cuciin-1.10.28-release.apk` | 6.045.279 B | `d22cca52317a6424b76bb21912d04ed927489ee36691b48de205b8cec9e7ab17` |
| `cuciin-1.10.28-debug-test.apk` | 22.961.694 B | `6fe659e899a72e18155d0bd2d3527b0576bb05e6f9a899d8c249d3166b80b935` |

## Yang belum terbukti

- Uji perangkat untuk skenario Supervisor membuka "Service baru" lalu menekan Simpan: perangkat
  uji memakai akun Owner. Yang terbukti baru sampai test unit dan pemeriksaan kode.
- Uji perangkat untuk jalur penolakan `update*` (pesan muncul, bukan "tersimpan").
- Perilaku perbaikan A/B/C/D Worker produksi masih belum terbukti lewat perangkat.
- CRUD user/registrasi dari UI belum diuji; `androidTest` masih nol.
