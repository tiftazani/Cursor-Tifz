# Cuciin 1.10.42 (versionCode 61) — kandidat rilis

Tanggal build: 30 September 2026

## Isi rilis

Permintaan pemilik (30 Sep): **berbagi nota laundry selain Teks, Excel, dan PDF juga menyediakan JPEG.**

Baris "Bagikan nota" di layar detail Service kini punya empat tombol: **Teks, Excel, PDF, JPEG**.

| Aspek | Keputusan | Alasan |
| --- | --- | --- |
| Sumber gambar | `ReportJpeg.nota` mencetak dulu berkas PDF yang sama (`ReportPdf.nota`), lalu merendernya dengan `PdfRenderer` | Tata letak nota hanya hidup di `ReportPdf.renderNota`; gambar dan JPEG tidak mungkin berbeda isi dari PDF |
| Banyak halaman | Seluruh halaman digabung tegak jadi satu berkas `.jpg` | Pelanggan menerima satu gambar utuh, bukan beberapa lampiran |
| Skala render | 2x (setara 144 dpi), turun otomatis bila halaman bertambah (`NotaJpeg.skalaEfektif`) | Tulisan kecil tetap tajam, tetapi tinggi gambar gabungan tidak pernah melewati 8.000 px |
| Mutu JPEG | 92 | Teks nota tetap terbaca tanpa berkas membengkak |
| Berkas | `cacheDir/share/<id nota>.jpg` lewat FileProvider yang sudah mengizinkan `cache-path share/` | Sama seperti PDF, tidak perlu izin berkas baru |

## Dua bug yang ditemukan saat uji dan ikut diperbaiki

**1. Pratinjau berkas di lembar berbagi gagal dibuka.**

Logcat: `Permission Denial: opening provider androidx.core.content.FileProvider`. Sebabnya
`Intent.createChooser` hanya memindahkan izin baca berkas ke lembar berbagi lewat `clipData`,
sementara kode lama hanya mengisi `EXTRA_STREAM`. Akibatnya kotak pratinjau di lembar berbagi kosong
meskipun berkasnya sendiri utuh. Perbaikan di `FileExports.shareFile` dengan `ClipData.newUri` —
berlaku untuk Teks, Excel, PDF, dan JPEG sekaligus. Terbukti di emulator: pratinjau muncul,
`Permission Denial` = 0.

**2. Ringkasan nota menimpa footer pada nota banyak layanan.**

Pada nota dengan **6 layanan ke atas**, kotak TOTAL dan kotak status pengerjaan menimpa garis footer,
ucapan terima kasih, dan kode nota. Ini **bug lama `ReportPdf`**, terbukti juga pada PDF aslinya,
bukan akibat JPEG. Perbaikan: bila sisa ruang di atas garis footer tidak cukup, blok ringkasan pindah
ke halaman baru lengkap dengan pita kepala dan nomor halaman. Batasnya hidup di
`PdfTextLayout.ringkasanButuhHalamanBaru` supaya bisa diuji tanpa Android.

Dampak ke data produksi: maksimum layanan per nota di D1 produksi saat ini = **5** (distribusi:
1 layanan 51 nota, 2 layanan 50, 3 layanan 46, 4 layanan 27, 5 layanan 18), jadi bug ini belum pernah
muncul di nota nyata. Perbaikan tetap dilakukan karena JPEG memakai tata letak yang sama.

## Bukti emulator (emulator-5554, 30 Sep, data fixture, jaringan dimatikan lebih dulu)

| Nota uji | Hasil | Dimensi JPEG |
| --- | --- | --- |
| 2 layanan (biasa) | 1 halaman, nota utuh, teks jelas | 1190 x 1684 |
| 12 layanan | 2 halaman digabung tegak, keduanya utuh | 1190 x 3368 |
| 40 layanan | 5 halaman (4 rincian + 1 ringkasan), tanpa OOM | 1130 x 8000 (skala turun otomatis) |

Pemeriksaan isi gambar: nama cabang, nomor nota, nama pelanggan, daftar layanan, total, dan status
terbaca jelas; tidak ada halaman kosong atau terpotong. Lembar berbagi menampilkan pratinjau gambar
dengan judul "Sharing image". PDF untuk nota yang sama juga diuji: 6 layanan kini 2 halaman, dan
halaman ringkasannya bersih.

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Tes unit Android (debug) | 356 lulus, 0 gagal (naik dari 351) |
| Tes unit Android (release) | 356 lulus, 0 gagal |
| Tes Worker (`npm run check`) | 88 lulus, 0 gagal |
| lint | lulus, 0 error |
| Tanda tangan rilis | PASS: v2, non-debuggable, target SDK 36, ZIP/ELF 16 KB |
| Sertifikat | `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee` (sama sejak 1.10.1) |

Tes baru: `NotaJpegTest` (4 tes aturan ukuran), `NotaJpegContractTest` (5 tes kontrak tombol +
sambungan), `NotaRingkasanTest` (4 tes batas ringkasan).

Tes penjaga yang dibuktikan **merah lebih dulu** (gagal saat tambalan dilepas):

- Tombol JPEG + `shareJpeg` + matriks skala dilepas → 4 tes kontrak gagal.
- `clipData` dilepas → tes `berkasDibagikanDenganIzinBacaLewatClipData` gagal.
- Penjaga ringkasan dilepas dari `ReportPdf` → tes `renderNotaMemakaiPenjagaRingkasan` gagal.

## Isi berkas

| Berkas | Ukuran | SHA-256 |
| --- | --- | --- |
| `cuciin-1.10.42-release.apk` | 6.090.883 B | `b5e1e6a14e4d9c54082a68d093cf032f046f92cbdb60d806d60d4baa632eecff` |
| `cuciin-1.10.42-debug.apk` | 23.401.366 B | `cef2a84bc2550af6093d28ee3d43fcac0a5c01073442d7d97c4a2a5eaf4b8249` |
| `cuciin-1.10.42-release.aab` | 9.250.603 B | `6ea08f753c9235938f2c3c8a22be12294d2679811d9bf9771dc61087ca521c45` |

Hash lengkap ada di `SHA256SUMS`. APK dan AAB **tidak dilacak Git**; yang di-commit hanya README
ini dan `SHA256SUMS`.

## Belum terbukti

- **APK 1.10.42 belum dipasang di HP cabang mana pun.** Seluruh bukti perangkat diambil di
  `emulator-5554` dengan APK debug; APK rilis diverifikasi tanda tangannya, belum dijalankan.
- **JPEG dibuka di aplikasi penerima nyata (WhatsApp) belum dicoba.** Yang terbukti baru pratinjau
  di lembar berbagi Android.
- **Nota dengan lebih dari 40 layanan belum diuji**; batas tinggi 8.000 px sudah diuji sampai 40
  layanan (5 halaman) tanpa kehabisan memori.
- **Absen nyata pagi + sore dengan kamera HP asli belum pernah dicoba** (warisan catatan 1.10.41).
- **Baris teks `check_out_at` 27 Sep di D1 produksi** (`salsabilayumna2006@gmail.com`) belum
  dibersihkan; menyentuh data produksi sehingga menunggu keputusan Owner.
