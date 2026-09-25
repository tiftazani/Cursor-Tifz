# Cuciin 1.10.39 (versionCode 58) — kandidat rilis

Tanggal build: 25 September 2026

## Isi rilis

Perbaikan darurat dari operasi: **beberapa akun tidak bisa login** dengan pesan
`Email atau kata sandi tidak sesuai.`, padahal kata sandinya belum pernah diganti.

## Akar masalah

Bukan soal kata sandi. Login aplikasi diverifikasi **Firebase Auth**, sedangkan daftar pengguna
hanya baris data di server D1. Dua hal itu terpisah:

- Layar **Daftar** (pendaftaran mandiri) membuat akun login Firebase **dan** baris data.
- Layar **Daftar User → Tambah user** (dipakai Owner) hanya menulis baris data ke server.

Jadi kasir yang ditambahkan Owner lewat layar itu tidak pernah punya akun login. Barisnya rapi
muncul di daftar user, perannya benar, cabangnya benar, tetapi Firebase tidak mengenal email itu,
sehingga setiap percobaan masuk ditolak dengan pesan yang menyesatkan: "kata sandi tidak sesuai".

### Bukti di data produksi

Lima kasir ada di tabel `staff` dengan `firebase_uid` kosong:

| Kasir | Ditambahkan | Cabang penugasan |
| --- | --- | --- |
| alfin (`alfinhumendru@gmail.com`) | 24 Sep 13:22 WIB | bunayya, laupay-dayeuh, laupay-kirab |
| febri (`febriansyah.atmaja98@gmail.com`) | 24 Sep 13:58 WIB | laupay-kirab, shelly |
| ihsan (`ihsanibnuabdurrauf@gmail.com`) | 24 Sep 13:24 WIB | bunayya, laupay-dayeuh, laupay-kirab, shelly |
| Bu rohma (`rochnatillah22@gmail.com`) | 24 Sep 13:21 WIB | shelly |
| Nabila (`tsanaulaila78@gmail.com`) | 25 Sep 09:38 WIB | shelly |

Semuanya ditambahkan oleh Owner (`us.archuleta1207@gmail.com`) lewat layar Tambah user.
Enam kasir lain yang dibuat lewat layar Daftar tidak terpengaruh.

Akun yang dilaporkan di tangkapan layar (`ihsanibnuabdurrauf@gmail.com`) termasuk di dalamnya.

## Perubahan

Aplikasi:

- `LoginProvision` (baru): aturan pembuatan akun login yang bisa diuji. Sandi kosong berarti
  sandi awal aplikasi (`test1234`); sandi di bawah 6 karakter ditolak **sebelum** baris pengguna
  disimpan.
- `FirebaseCloud.provisionLoginAccount()` (baru): membuat akun login lewat **instance Firebase
  kedua**, supaya sesi Owner yang sedang membuka layar tidak ikut keluar. Ada batas waktu 20 detik
  karena rantai Task Firebase tidak selalu memanggil listener-nya.
- `UsersScreen`: setelah baris pengguna tersimpan, akun loginnya dibuat sekalian. Pesan hasilnya
  menyebut apa adanya: dibuat, sudah ada, atau gagal beserta sebabnya.

## Perbaikan data produksi

Akun login untuk lima kasir di atas sudah dibuatkan dan diverifikasi. Seluruh **12 akun staf**
kini bisa masuk dan diterima server dengan peran dan cabang yang benar:

| Akun | Peran | Cabang |
| --- | --- | --- |
| `us.archuleta1207@gmail.com` | Owner | 4 |
| `aidanurita25@gmail.com` | Kasir | 2 |
| `alfinhumendru@gmail.com` | Kasir | 3 |
| `deccintaaulia180@gmail.com` | Kasir | 1 |
| `febriansyah.atmaja98@gmail.com` | Kasir | 2 |
| `fiasvia2301@gmail.com` | Kasir | 1 |
| `ihsanibnuabdurrauf@gmail.com` | Kasir | 4 |
| `rochnatillah22@gmail.com` | Kasir | 1 |
| `salsabilayumna2006@gmail.com` | Kasir | 1 |
| `titahdamaiteratera243@gmail.com` | Kasir | 1 |
| `tsanaulaila78@gmail.com` | Kasir | 1 |
| `widadalhusaini10@gmail.com` | Kasir | 1 |

Verifikasi dilakukan dengan masuk sungguhan lewat endpoint Firebase, lalu memanggil `/v1/me`
memakai token hasil masuk itu. Hasilnya `200` untuk seluruh 12 akun.

Skrip yang dipakai ada di repo:

- `cloudflare/scripts/cek_akun_vs_firebase.py` — membandingkan daftar staf D1 dengan akun Firebase.
- `cloudflare/scripts/fix_akun_firebase.py` — membuat akun login yang hilang.
- `cloudflare/scripts/verifikasi_akun.py` — memeriksa seluruh staf bisa masuk.

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Tes unit Android (debug) | 320 lulus, 0 gagal |
| Tes unit Android (release) | 320 lulus, 0 gagal |
| lint | 0 error, 18 warning (saran gaya) |
| Tanda tangan rilis | PASS: v2, non-debuggable, target SDK 36, ZIP/ELF 16 KB |
| APK release memuat `LoginProvision` | ya (`classes.dex`) |
| Akun login 12 staf | 12 bisa masuk, 0 gagal |

Tes penjaga `LoginProvisionTest` (7 tes) dibuktikan **merah lebih dulu**: dengan layar
dikembalikan ke perilaku lama, tes `layarDaftarUserMemanggilPembuatanAkunLogin` gagal.

## Isi berkas

| Berkas | Ukuran | SHA-256 (awal) |
| --- | --- | --- |
| `cuciin-1.10.39-release.apk` | 6.061.655 B | `3edd9ad4f7986205…` |
| `cuciin-1.10.39-debug.apk` | 23.010.806 B | `e4ea3c38a4720781…` |
| `cuciin-1.10.39-release.aab` | 9.236.608 B | `ebaf761ba84e088e…` |

Hash lengkap ada di `SHA256SUMS`.

## Belum terbukti

- Perbaikan di layar **Tambah user** belum diuji lewat sentuhan di emulator dengan akun Owner.
  Yang terbukti adalah: tes penjaga merah sebelum perbaikan dan hijau sesudahnya, dan alur
  pembuatan akun yang sama sudah diuji sungguhan lewat skrip terhadap Firebase produksi.
- Akun login lima kasir dibuat lewat skrip, bukan lewat layar aplikasi. Efeknya sama bagi pemakai,
  tetapi jalur layarnya sendiri belum dijalankan sekali pun di perangkat.
