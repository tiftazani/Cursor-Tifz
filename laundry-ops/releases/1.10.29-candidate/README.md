# Cuciin 1.10.29 (versionCode 48) — kandidat

Menutup Kelas H (enam titik cara menolak dan hasil fungsi yang dibuang) dan menghentikan
penghapusan massal jenis aset yang terjadi saat berpindah akun. Versi ini juga memulihkan
katalog jenis aset yang sempat terhapus di server debug dan produksi.

## Yang diperbaiki

### Kelas H — enam titik cara menolak yang masih salah

1. `markWaSent()` hasilnya dibuang di dua tempat, sehingga penolakan izin tidak terlihat.
2. Gerbang rute `cash` hanya memeriksa MODUL, bukan fungsi `cash.close`.
3. Tutup kas melaporkan "sudah ditutup hari ini" padahal izinnya dicabut; sekarang membaca
   pesan tolak dari store.
4. Tombol "Kelola produk" dikunci nama peran `Role.Owner`, bukan fungsi `owner.manage`.
5. `notaReject` dan `saveNota` menyimpan daftar tolak yang berbeda; sekarang `notaReject`
   menjadi SATU sumber penolakan.
6. "Pelanggan baru" dan "Catat biaya" membuka formulir tanpa memeriksa fungsi.

### Penghapusan massal jenis aset (tiga lapis)

Saat berpindah akun ke peran non-Owner, perangkat menyusun enam perintah `assetType.delete`
dan mengirimnya. `assetType.delete` belum terdaftar Owner-only di Worker, jadi perintah itu
diterima dan seluruh katalog jenis aset terhapus di D1 debug DAN produksi.

- `SyncProtocol.enqueue` tidak lagi menyimpulkan `delete` untuk entitas tanpa cabang
  (`branchId == null`) bila aktor bukan Owner.
- `command-sync.ts` memasukkan `assetType.upsert` dan `assetType.delete` ke `OWNER_ONLY`.
- `SyncProtocol.buangYangTidakBerhak` membuang perintah `delete` tanpa cabang yang masih
  tertahan SEBELUM terkirim, dan mencatatnya ke `rejected`.

### Pemulihan katalog jenis aset

Enam jenis bawaan ditulis kembali ke `asset_types` di kedua database, dan yang lebih penting,
enam entri jurnal `assetType`/`upsert` ditulis ke `sync_changes` (produksi seq 404-409,
debug seq 884-889). Perangkat membaca jenis aset dari JURNAL, bukan dari tabel: mengisi tabel
saja tidak cukup.

Bukti sampai perangkat, lewat bootstrap bersih (`pm clear` + login segar):

| Akun | Peran | Cabang | Jenis aset | Shadow |
|---|---|---|---|---|
| Aida | Supervisor | `laupay-kirab` | 6 | 74 |
| Dea | Kasir | `laupay-dayeuh` | 6 | 61 |

## Hasil test

| Varian | Kasus | Gagal |
|---|---|---|
| Android debug | 221 | 0 |
| Android release | 221 | 0 |
| Worker | 56 | 0 |

Lint bersih. Test pengunci dibuktikan GAGAL saat masing-masing bug dikembalikan, termasuk
test Worker (`tests 56 / pass 53 / fail 3` saat `OWNER_ONLY` dikembalikan).

## Sapu menu per peran

| Peran | Menu terbuka | Crash | Aplikasi hidup |
|---|---|---|---|
| Owner | 11/11 alur uji | 0 | ya |
| Kasir | 11/21 | 0 | ya |
| Supervisor | 8/21 | 0 | ya |

Menu yang tidak tampil untuk Kasir dan Supervisor sesuai izinnya. Kasir memang memiliki
fungsi `service.create`, jadi "Service baru" tampil untuk Kasir dan tidak untuk Supervisor.

## Catatan penting

- `asset_types` di server adalah tabel TULIS-SAJA. Pemulihan yang hanya mengisi tabel tidak
  akan terlihat di perangkat.
- Baris `sync_snapshots` adalah cache malas dan baru dilipat saat ada permintaan baca
  terautentikasi; jangan menyimpulkan kerusakan dari baris itu.
- Membaca `cuciin-data.json` / `cuciin-sync-state.json` perangkat HARUS setelah `am force-stop`.
  Membaca saat aplikasi jalan menghasilkan berkas versi lama (terbukti: `assetTypes: 0` saat
  jalan, `6` setelah dihentikan).
- Menghitung penanda perbaikan di dalam APK harus di SEMUA `classes*.dex`, bukan hanya
  `classes.dex`. APK debug punya 9 dex.

## Berkas

| Berkas | SHA-256 |
|---|---|
| `cuciin-1.10.29-release.apk` | `32d1e1516efe8249b14897f931997ea61a8125d2ec9dd1f36e9d0e7d28629aef` |
| `cuciin-1.10.29-debug-test.apk` | `06c2c591bd4a9e0f1a63cd3a3a76c0d616a5588d1fbc7b096407c8732ef775f0` |

Paket rilis `com.cuciin.laundryops` (label **Cuciin**), paket debug
`com.cuciin.laundryops.debug` (label **Cuciin Debug**). Sertifikat penandatangan
`CN=Tiftazani Khara`, digest `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`
— sengaja dipertahankan supaya APK baru bisa menimpa yang lama tanpa memasang ulang.

## Yang belum

- Tidak ada instrumented test (`androidTest`); seluruh regresi perangkat lewat adb.
- CRUD user dan pendaftaran akun belum pernah diuji dari UI.
- Preset "Biru Cuciin" belum diverifikasi di emulator.
- Identitas Firebase debug dan produksi masih dibagi.
