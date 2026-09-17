# Cuciin 1.10.19 candidate

## Isi

| Berkas | Kegunaan |
|---|---|
| `cuciin-1.10.19-release.apk` | APK operasional bertanda tangan untuk data produksi. |
| `cuciin-1.10.19-release.aab` | Bundle bertanda tangan untuk distribusi Play. |
| `cuciin-1.10.19-debug-test.apk` | APK debug untuk Worker dan D1 uji. |
| `SHA256SUMS` | Checksum SHA-256 ketiga artefak. |
| `template-data-cuciin.xlsx` | Template Excel untuk mengisi data awal. |
| `PANDUAN-IMPOR-EXCEL.md` | Cara mengisi template dan cara datanya masuk ke database. |

## Endpoint data

| Varian | Worker | Database |
|---|---|---|
| Release | `cuciin-api` | D1 `cuciin-db` produksi |
| Debug | `cuciin-api-debug` | D1 `cuciin-debug-db` uji |

## Isi versi 1.10.19

### Nama pemilik tidak lagi memakai nama pribadi

Nama yang tampil di aplikasi sekarang memakai nama usaha. Aplikasi ini dijual ke banyak pemilik
laundry, jadi nama di layar harus netral. Alamat email sengaja tidak diubah karena itu identitas
akun Firebase: menggantinya akan memutus login semua perangkat yang sudah terpasang.

### Perubahan nama di server lewat jurnal, bukan hanya tabel

Snapshot yang dibaca perangkat dibentuk dari snapshot tersimpan ditambah jurnal `sync_changes`.
Kalau hanya tabel `staff` yang diubah, perangkat yang sudah memegang salinan akan tetap
menampilkan nama lama. Karena itu migrasi `0008_owner_name_neutral.sql` menulis keduanya:
tabel dan jurnal.

Migrasi idempoten, dibuktikan di D1 uji:

| Percobaan | `rows_written` | Entri jurnal |
|---|---|---|
| Pertama | 5 | 1 |
| Kedua | 0 | tetap 1 |

### Bukti tidak ada nama pribadi di dalam APK

Isi `classes*.dex` pada APK debug dipindai dengan `strings`. Hanya tersisa dua kemunculan, dan
keduanya memang tidak bisa diubah:

```text
@https://cuciin-api-debug.tiftazani-cuciin.workers.dev/api/cuciin   (URL Worker, subdomain Cloudflare)
tiftazani.khara@gmail.com                                           (email akun Firebase)
```

Tidak ada lagi nama tampilan di layar mana pun.

## Verifikasi

- VersionName `1.10.19`, versionCode `38`.
- Unit test debug dan release lulus: 130 test per varian, 0 gagal.
- Test Worker lulus: 43 test, 0 gagal.
- Lint debug dan release lulus.
- APK release bertanda tangan dan lolos `verify_release.py`.
- Migrasi `0008` diuji di D1 uji: idempoten, jurnal tetap satu entri.
- Uji emulator: layar pembuka, halaman masuk, dan layar pendaftaran diperiksa dengan
  `uiautomator`; tidak ada nama pribadi yang tampil.

## Catatan

- Migrasi `0008` **belum** diterapkan ke produksi. Menunggu perintah Owner.
- Pengaturan urutan menu belum bisa menyembunyikan menu, hanya mengurutkan dan memindahkannya.

Tidak ada kredensial, token, atau material signing di folder ini.
