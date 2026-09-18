# Kandidat Cuciin 1.10.25 (versionCode 44)

Dibangun 18 Sep 2026 dari branch `codex/cuciin-1-8-1`, commit `47d5171`
(setelah rebase di atas `origin/main` `0c84ad6`).

## Isi rilis

Perbaikan kemacetan antrean sinkronisasi. Tiga sebab bertumpuk di
`cloudflare/src/command-sync.ts`:

1. `payment.delete` ada di wire protocol perangkat tetapi tidak ada di
   `KNOWN_COMMANDS`, sehingga setiap penghapusan pembayaran ditolak
   `422 Tipe command tidak didukung` dan menahan seluruh antreannya.
2. Satu command yang gagal di-parse membatalkan SELURUH batch dengan 422
   **tanpa `results`**. Perangkat hanya bisa memindahkan command ke daftar
   `rejected` kalau `results` ada, jadi tidak ada satu pun yang bisa dibuang dan
   antreannya macet permanen.
3. Command yang ditolak permanen (4xx) membuat command sesudahnya berstatus
   `retryable` selamanya.

## Cara menemukannya

Bukan dari membaca kode, tetapi dari menguji alur tulis end-to-end di emulator:
mencatat biaya operasional berhasil tersimpan di perangkat, tetapi log
menampilkan `CuciinCloud: Sinkronisasi ditolak server (422)` berulang dan antrean
berisi 11 perintah tidak berkurang. Perintah yang merusak ditemukan dengan
menjalankan `parseCommand` Worker terhadap 11 perintah nyata dari perangkat.

## Bukti

| Pemeriksaan | Hasil |
| --- | --- |
| Gate Worker | 53 test lulus (naik dari 44) |
| Gate Android | 191 test debug + 191 test release, 0 gagal |
| Lint | debug + release lulus |
| Test pengunci | 9 test, **terbukti gagal** saat perilaku lama dikembalikan satu per satu |
| Antrean perangkat | pending 11 ke 0, rejected 0, revision 670 ke 674 |
| Data sampai server | biaya `cost-5caba443-d84f` (Rp 15.000) muncul di D1 debug |
| Audit server | `Menghapus pembayaran` tercatat di D1 debug |
| Uji ulang 1.10.25 | biaya Rp 7.000 baru langsung tersinkron, pending 0, revision 679 ke 686 |

## Alur yang diuji end-to-end di emulator (1.10.24/1.10.25)

- **Tulis Service lengkap**: pilih layanan, tambah ke keranjang, periksa, pilih
  pelanggan, bayar, simpan. Nota `BNY-2609-0004-DD8A0` tersimpan, payments 3 ke 4,
  audit 111 ke 112, tally `omzet == paid + piutang` cocok.
- **Catat biaya operasional**: tersimpan dan tersinkron ke D1.
- **Stok massal**: Softener 100 ke 103 (tepat +3), stockMoves 29 ke 30.
- **Daftarkan aset**: ID otomatis `BNY-MC-002`, inventory 3 ke 4.
- **Absensi**: layar terbuka; tombol "Absen masuk" sengaja nonaktif sampai foto
  diambil (perilaku benar, bukan bug).
- **Ekspor laporan**: CSV 1.738 byte 22 baris, PDF 1,1 MB, keduanya valid.
- **Sapu 22 menu**: 0 crash.
- **Pelunasan lewat UI**: nota `SHL-2609-0001-A34F8` sisa Rp 45.000 dilunasi (Tunai);
  perangkat `paid` 30.000 ke 75.000; D1 menerima `pay-fa4ead29` Rp 45.000, `orders.paid`
  75.000, dan audit `menerima Rp 45.000 · Tunai`.

## Berkas

- `cuciin-1.10.25-release.apk` — paket `com.cuciin.laundryops`, label "Cuciin"
- `cuciin-1.10.25-debug-test.apk` — paket `com.cuciin.laundryops.debug`, label "Cuciin Debug"
- `SHA256SUMS.txt`

Sertifikat rilis: SHA-256 `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`
(sama dengan rilis sebelumnya, supaya jalur pembaruan di perangkat cabang tidak putus).

## Yang belum diuji

- Alur absensi sampai foto tersimpan (butuh kamera emulator).
- Pembayaran sebagian lewat UI (yang diuji hanya pelunasan penuh; aplikasi hanya
  menyediakan tombol "Catat pelunasan").
- Nol instrumented test (`androidTest`); verifikasi UI bersifat titik-sampel.
- Peran Supervisor sudah diuji di 1.10.25: header `Aida · SPV`, Laporan transaksi &
  analitik TERBUKA, Riwayat aktivitas TIDAK TAMPIL, crash 0.
