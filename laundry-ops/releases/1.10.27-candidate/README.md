# Kandidat Cuciin 1.10.27 (versionCode 46)

Dibangun 18 Sep 2026 dari branch `codex/cuciin-1-8-1`. Basis versi: 1.10.26 (versionCode 45).

## Isi folder

| Berkas | Ukuran | Untuk |
| --- | --- | --- |
| `cuciin-1.10.27-release.apk` | 6.045.283 bytes | Dibagikan ke cabang |
| `cuciin-1.10.27-debug-test.apk` | 22.961.694 bytes | Uji internal, label "Cuciin Debug" |
| `SHA256SUMS.txt` | 2 baris | Pemeriksa keutuhan berkas |

APK tidak di-commit ke Git (aturan `.gitignore` baris 37-38); hanya berkas ini dan
`SHA256SUMS.txt` yang masuk repo.

## Perbaikan di 1.10.27

### Seluruh 17 fungsi Kontrol Akses Role kini benar-benar diperiksa

Versi 1.10.26 menegakkan 8 dari 17 fungsi katalog. Sembilan sisanya hanya menghiasi layar:
mencabut centangnya tidak mengubah perilaku apa pun, padahal layar Kontrol Akses Role
menjanjikan "Fungsi tanpa centang berarti tidak diizinkan".

Fungsi yang kini ditegakkan, beserta titik jaganya:

| Fungsi | Titik jaga |
| --- | --- |
| `queue.status` | `advanceLaundry` |
| `queue.handover` | `markPickedUp` |
| `service.create` | `saveNota` |
| `service.correct` | `updateNotaLines`, `deleteNota` |
| `service.payment` | `markLunas` |
| `service.price` | `setCartPrice`, `canChangePrice` |
| `customer.write` | `addCustomer`, `updateCustomer`, `deleteCustomer` |
| `stock.write` | `editStock`, `editStocks` |
| `inventory.write` | `addInventory`, `updateInventory`, `deleteInventory` |
| `attendance.write` | `checkIn`, `checkOut` |
| `whatsapp.send` | `markWaSent` |
| `expense.write` | `addExpense`, `deleteExpense` |
| `cash.close` | `closeCash` |
| `owner.manage` | 15 titik: cabang, user, layanan, produk, jenis aset, template WhatsApp |
| `owner.access` | `assignAccessRole` |
| `analytics.view` | gerbang rute `analytics` dan `analyticsReport` |
| `audit.view` | gerbang rute `audit` |

Angka di tabel ini diukur langsung ke kode sumber, bukan dari ingatan. Perintah pengukurnya
menghitung pemanggilan `boleh(`, `tolak(`, dan `canAccess(` per fungsi di `CuciinStore.kt`.

### Dua fungsi laporan diperiksa lewat gerbang rute

`RouteAccess` sebelumnya hanya memetakan rute ke MODUL. Akibatnya mencabut `analytics.view`
tidak menyembunyikan menu Laporan transaksi dan Laporan analitik, dan mencabut `audit.view`
tidak menyembunyikan Riwayat aktivitas. Sekarang pemetaannya memuat modul DAN fungsi.

### Perubahan tanda tangan

`addCustomer` dan `addBranch` kini mengembalikan nilai nullable karena keduanya dapat ditolak
izin. Pemanggil di `MasterScreens.kt` menampilkan pesan penolakan, bukan gagal diam-diam.

## Kenapa ini bukan sekadar menyembunyikan tombol

Menyembunyikan tombol di UI bukan penegakan izin. Pemeriksaannya ada di store, sehingga jalur
mana pun yang memanggil fungsi itu ikut ditolak, termasuk pemanggilan yang tidak lewat tombol.
UI hanya lapisan kedua.

## Test

`AccessFunctionEnforcementTest` versi lama dapat lulus walau tidak ada kode yang memeriksa,
karena membandingkan katalog dengan daftar yang ditulis tangan di test itu sendiri. Sekarang:

1. `tidakAdaFungsiKatalogYangBelumDiperiksa` membaca seluruh sumber kode utama dan gagal bila
   ada fungsi katalog yang belum diperiksa sama sekali.
2. `daftarPemeriksaSesuaiKenyataanKode` mengunci daftar tangan agar tidak menyimpang dari kode.
3. `setiapTitikJagaFungsiMasihAdaDiStore` menghitung titik jaga per fungsi, bukan sekadar
   mencari keberadaan teks, dengan angka yang diukur langsung.
4. `fungsiLaporanDiperiksaLewatGerbangRute` memastikan dua fungsi laporan benar-benar dijaga.

Test terbukti menangkap bug, bukan sekadar lulus:

| Bug dikembalikan | Test yang gagal |
| --- | --- |
| Penjaga `queue.status` dihapus dari `advanceLaundry` | 4 test: `daftarPemeriksaSesuaiKenyataanKode`, `fungsiYangDiklaimDitegakkanBenarBenarDiperiksaDiStore`, `tidakAdaFungsiKatalogYangBelumDiperiksa`, `setiapTitikJagaFungsiMasihAdaDiStore` |
| Penjaga `owner.manage` dihapus dari `addStaff` | 2 test: `setiapTitikJagaFungsiMasihAdaDiStore`, `fungsiYangDiklaimDitegakkanBenarBenarDiperiksaDiStore` |

Gate pada versi ini: **202 test debug + 202 release lulus**, lint lulus, **53 test Worker lulus**.

## Verifikasi APK

| Pemeriksaan | Hasil |
| --- | --- |
| `versionCode` / `versionName` di dalam APK | `46` / `1.10.27` |
| Label aplikasi release | `Cuciin` |
| Tanda tangan | V3.0 valid, `CN=Tiftazani Khara, OU=Cuciin` |

## Yang belum dikerjakan

- Belum ada instrumented test (`androidTest`); verifikasi UI masih titik-sampel lewat adb.
- Perbaikan 1.10.27 belum diuji di perangkat. Uji perangkat terakhir ada di 1.10.26
  (`uji_kaskas4.py` 8/8, `uji_izin5.py` 7/7, `uji_izin5b.py`).
- CRUD user dan registrasi dari UI belum diuji.
- Perilaku perbaikan antrean sinkronisasi (bug A/B/C/D) di Worker produksi belum pernah
  dijalankan dengan token Firebase sungguhan. Worker produksi sudah ter-deploy
  (`0a3735c3-ef1b-4549-a437-dfe4b458177c`), bundle-nya terbukti identik dengan commit.
- `0008_owner_name_neutral.sql` belum tercatat di `d1_migrations` D1 debug (efeknya sudah
  diterapkan manual lewat jurnal 663-667; migrasi idempoten).
