# Cuciin 1.10.28 (versionCode 47) — kandidat

Menutup seluruh kelas bug cara MENOLAK izin, ditemukan setelah 1.10.27 menegakkan 17 fungsi
Kontrol Akses Role. Menambah penjaga izin belum cukup: cara menolaknya punya pola kegagalan
sendiri, dan seluruhnya sudah diperbaiki serta dibuktikan di perangkat.

## Yang diperbaiki

### Kelas A — penolakan mematikan aplikasi

`saveNota` dan `addInventory` memakai `require(boleh(...))` yang melempar
`IllegalArgumentException`. Supervisor memiliki MODUL `service` sehingga menu "Service baru"
tampil, tetapi tidak memiliki fungsi `service.create`: menekan Simpan langsung menutup aplikasi.

Penolakan izin adalah kejadian NORMAL, bukan kesalahan program. Sekarang `saveNota` memakai
`check` dan dicegat lebih dulu oleh `canCreateService()` di UI; `addInventory` mengembalikan `null`
dan UI menampilkan pesan.

**Terbukti di perangkat.** Dengan role yang memiliki modul `service` tanpa fungsi `service.create`,
1.10.27 menghasilkan:

```
FATAL EXCEPTION: main
java.lang.IllegalArgumentException: Akses Buat Service dicabut untuk role akun ini
    at com.cuciin.laundryops.data.CuciinStore.saveNota(CuciinStore.kt:1288)
    at com.cuciin.laundryops.ui.OpsScreensKt.BayarScreen$save(OpsScreens.kt:694)
```

Pada 1.10.28 alur yang sama menampilkan pesan tolak dan aplikasi tetap hidup.

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

### Kelas C — gerbang rute lebih longgar daripada penjaganya

Rute `service` ("Service baru") hanya memeriksa MODUL, sedangkan `saveNota` memeriksa FUNGSI
`service.create`. Role yang punya modul itu tanpa fungsinya melihat menunya, lalu aplikasi mati
saat menyimpan. Gerbang rute kini memakai ukuran yang sama dengan penjaganya. Terbukti di
perangkat: menu tampil di 1.10.27, tertutup di 1.10.28, dan pada build yang hanya menutup rutenya
(penjaga lama dikembalikan) aplikasi tetap mati.

### Kelas D — pintu alur tulis dikunci NAMA peran, bukan fungsi

Enam tombol yang membuka alur TULIS memakai `s.role != Role.Supervisor` sehingga role kustom
selalu tertutup walau izinnya lengkap: "Service baru" di beranda, "Catat perubahan stok",
"Catat pelunasan", "Tambah foto dari galeri", "Daftar aset", "Kelola jenis aset". Semuanya kini
memakai fungsi (`canCreateService`, `canWriteStock`, `canTakePayment`, `canManageAssetTypes`).

### Kelas E — pintu masuk alur tulis belum diperiksa sama sekali

Setelah Kelas D, tersisa pintu yang memang belum punya pemeriksaan: baris daftar aset menuju
formulir ubah, "Tambah jenis aset baru", dan "Kelola jenis aset" di sheet filter. Ketiganya
sekarang diperiksa.

### Kelas F — `saveNota` masih bisa mematikan aplikasi lewat penolakan lain

Selain izin, `saveNota` memakai `require`/`check` untuk cabang, jumlah, stok, dan batas bayar.
Semua itu juga melempar. Ditambah `notaReject()` sebagai satu pemeriksa yang mengembalikan pesan
penolakan pertama, dipakai layar Pembayaran sebelum menyimpan. Penolakan izin diperiksa lebih dulu
supaya pesannya yang muncul, bukan pesan stok.

### Kelas G — layar ber-gerbang fungsi masih dikunci nama peran

`UsersScreen` dan `OwnerSettingsScreen` dijaga gerbang rute lewat fungsi `owner.manage`, tetapi
layarnya lalu menolak semua yang bukan Owner (`session.role != Role.Owner`). Role kustom pemegang
`owner.manage` masuk lewat gerbang rute lalu langsung terlempar keluar. Kedua layar kini memakai
fungsi yang sama dengan gerbangnya.

## Test pengunci baru

Semuanya membaca kode sumber dan sudah dibuktikan GAGAL saat bug dikembalikan:

- `penolakanIzinTidakMemakaiRequireYangMelempar` — menolak `require(boleh(...))` di store.
- `penolakanIzinSelaluMembawaPesan` — menolak `if (!boleh(...)) return` telanjang.
- `uiMemakaiPesanPenolakanDariStore` — setiap pemanggil di UI harus memakai pesan penolakan,
  `?.let`, atau pemeriksa izin.
- `rutePunyaFungsiHarusDiperiksa` — rute yang punya fungsi wajib memeriksanya, bukan hanya modul.
- `tombolAlurTulisTidakDikunciNamaPeran` — pintu alur tulis tidak boleh dikunci nama peran.
- `pintuAlurTulisDiperiksaFungsi` — pintu masuk alur tulis wajib memakai pemeriksa fungsi.
- `layarPembayaranMemakaiPemeriksaPenolakanLebihDulu` — layar bayar memakai `notaReject()`.
- `layarBergerbangFungsiTidakMengunciNamaPeran` — layar tidak mengulang kunci nama peran.
- `hasilFungsiYangBisaMenolakTidakDibuang` — hasil fungsi `String?` tidak boleh dibuang.
- `pemeriksaPenolakanSamaDenganPenjaganya` — pesan tolak tidak boleh ditebak layar.
- `penolakanServiceHanyaPunyaSatuSumber` — `saveNota` wajib memakai `notaReject`.
- `pintuMasukAlurTulisDiperiksaDenganFungsi` — termasuk tombol pembuka form di rute ber-gerbang modul.

### Kelas H — sisa cara MENOLAK yang masih salah

Ditemukan saat menelusuri seluruh pemanggilan fungsi `String?` dari UI:

| Kelas | Bug | Perbaikan |
| --- | --- | --- |
| H1 | `markWaSent()` hasilnya dibuang di 2 titik: UI melaporkan WhatsApp terkirim padahal store menolak (nota cabang lain) | pesan tolak dari store ditampilkan |
| H2 | Gerbang rute `cash` hanya memeriksa modul, sedangkan `closeCash` memeriksa `cash.close` | gerbang memeriksa `cash.close` |
| H3 | Tutup kas menampilkan "sudah ditutup hari ini" padahal izinnya dicabut | `closeCashReject()` baru; layar memakainya |
| H4 | Tombol "Kelola produk" dikunci `role == Role.Owner` | dikunci `owner.manage` |
| H5 | `notaReject` dan `saveNota` menyalin daftar penolakan yang sama | satu sumber: `saveNota` memanggil `notaReject` |
| H6 | Tombol "Pelanggan baru" dan "Catat biaya" membuka form tulis tanpa cek fungsi | `customer.write` dan `expense.write` |

Semua test pengunci H terbukti GAGAL saat bug dikembalikan.

Test ketiga menemukan satu call site nyata yang mengabaikan hasilnya (`markWaSent` di layar nota)
saat pertama dijalankan.

## Hasil gate

| Pemeriksaan | Hasil |
| --- | --- |
| Test Android debug | 216 lulus, 0 gagal |
| Test Android release | 216 lulus, 0 gagal |
| Lint | lulus |
| Test Worker | 56 lulus, 0 gagal |
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

| Berkas | SHA-256 |
| --- | --- |
| `cuciin-1.10.28-release.apk` | lihat `SHA256SUMS.txt` |
| `cuciin-1.10.28-debug-test.apk` | lihat `SHA256SUMS.txt` |

## Hasil uji perangkat

APK kandidat (bukan build sementara) dipasang di emulator `MindChampions_API35`, 1080x2400.

| Uji | Hasil |
| --- | --- |
| Owner, 11 kasus (login, 3 menu laporan, alur tulis Service, crash, tally) | 11/11 lulus, 3 kali ulang |
| Sapu seluruh menu sebagai Kasir | 11/21 terbuka (10 tertutup sesuai izin), CRASH 0 |
| Sapu seluruh menu sebagai Supervisor | 8/21 terbuka, CRASH 0 |
| Role modul `service` tanpa fungsi `service.create` | menu tertutup, 0 crash |
| Tally perangkat | omzet 277.000 = paid 221.000 + piutang 56.000 |
| Nota uji dibersihkan lewat aplikasi | notas 9 -> 7, kembali ke keadaan sebelum uji |

## Yang belum terbukti

- Perilaku perbaikan A/B/C/D Worker produksi masih belum terbukti lewat perangkat: rute tanpa auth
  hanya `/health` dan `/v1/registration`, sisanya butuh login Firebase.
- CRUD user/registrasi dari UI belum diuji; `androidTest` masih nol.
- Preset tema "Biru Cuciin" belum diverifikasi di emulator.
- Perubahan versi ini belum di-push ke remote.
