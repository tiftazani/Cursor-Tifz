# Cuciin 1.10.20 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.20-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.20-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.20-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.20

### Perbaikan: warna dialog pemilih tanggal dan jam

Dilaporkan Owner: warna di kotak pemilih tanggal terlihat aneh.

Penyebabnya ditemukan di `ui/DateTimeFields.kt`. Dialog memakai tema bawaan Android yang
dipaku mati:

```kotlin
android.R.style.Theme_Material_Light_Dialog_Alert
```

Tema itu membawa aksen teal. Akibatnya tombol "Pilih" dan "Batal" berwarna teal, sementara
seluruh tombol aplikasi berwarna magenta. Dua warna itu bertabrakan, dan dialognya juga selalu
terang walaupun aplikasi memakai tema gelap.

Perbaikan: tema sendiri `Theme.Cuciin.Picker` di `res/values/themes_picker.xml`, memakai aksen
`cuciin_accent` (#C1358F). Warna di `values/colors.xml` disimpan sejalan dengan palet Compose di
`ui/theme/Theme.kt`.

### Bukti sebelum dan sesudah, diukur dari tangkapan layar

Warna mencolok pada dialog dihitung per piksel, bukan dinilai dengan mata:

| | Sebelum | Sesudah |
|---|---|---|
| Warna dominan dialog | teal bawaan Android | `#C1358F` (magenta Cuciin) |
| Jumlah warna teal di layar | ada | **0** |

### Berlaku di semua tempat

Delapan tempat pemakaian lewat satu fungsi, jadi satu perbaikan menutup semuanya:

- Filter periode di Antrian, laporan, dan riwayat aktivitas
- Estimasi waktu selesai Service
- Tanggal kejadian pada perubahan stok
- Tanggal beli aset di Daftar Aset Cabang

Diperiksa juga tidak ada pemilih tanggal lain di luar fungsi itu.

### Catatan locale

Locale Indonesia sekarang diambil dari konfigurasi Compose, bukan dari konteks mentah. Sebelumnya
locale dipasang dengan cara yang bisa hilang saat konfigurasi berubah.

## Verifikasi

- VersionName `1.10.20`, versionCode `39`.
- Unit test debug dan release lulus: 135 test per varian, 0 gagal.
- Lint debug dan release lulus.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Nama aplikasi dibaca balik dari APK: debug `Cuciin Debug`, rilis `Cuciin`.
- Uji emulator: dialog tanggal dan dialog jam dibuka, warnanya diperiksa per piksel.
- Empat test baru `PickerThemeTest` mengunci supaya tema bawaan Android tidak kembali dipakai.

## Catatan

- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.

Tidak ada kredensial, token, atau material signing di folder ini.
