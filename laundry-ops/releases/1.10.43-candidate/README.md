# Cuciin 1.10.43 (versionCode 62) — kandidat rilis

Dibangun 1 Okt 2026 dari commit `49f9f32` di branch `main`.

## Isi kandidat

| Berkas | Ukuran | SHA-256 |
| --- | --- | --- |
| `cuciin-1.10.43-release.apk` | 6.090.879 B | `64b4feb1e5445aaaabb79a0b49af955d0aafa1f7fcf471518a41b7fb9ecc590f` |
| `cuciin-1.10.43-debug.apk` | 23.059.958 B | `091042032deb3f86bcc24ae58701ad038c19c11be53c94f9d4231ae7a517da69` |
| `cuciin-1.10.43-release.aab` | 9.277.878 B | `2cbe7d958136b72e2b43f8328a77bdc84c2109786306146c718b475b8342bbed` |

APK rilis lolos `verify_release.py`: tanda tangan v2, non-debuggable, target SDK 36, izin minimum, ZIP/ELF selaras 16 KB. Sertifikat SHA-256 `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.

## Apa yang berubah di versi ini

### Tutup kas: rincian penjualan produk dan sisa stok

Layar Tutup Kas kini mencatat per cabang: produk apa saja yang terjual beserta nilainya, dan sisa stok saat kas ditutup. Pemisahan Tunai / QRIS / Transfer / Piutang tetap seperti sebelumnya.

Angka rincian dihitung sekali di `CuciinStore.closeCashPreview()` dan dipakai ulang oleh `closeCash()`, jadi angka di layar tidak mungkin berbeda dari yang tersimpan. Model: `CashCloseProduct`, `CashCloseStock` (`Models.kt`).

### Pembatalan nota berbayar (Owner saja)

Nota berbayar tidak bisa dihapus (baris `payments` ber-FK `ON DELETE RESTRICT`), jadi pembatalannya adalah operasi baru: perintah `order.cancel` di Worker dan `cancelNota` di store. Izinnya fungsi katalog baru `service.cancel` (Owner-only, `AccessCatalog.VERSION=3`, 42 fungsi), terpisah dari `service.delete`.

Aturan uangnya Opsi B, keputusan Owner:

| Aspek | Perilaku |
| --- | --- |
| Nota | Ditandai batal, TIDAK dihapus |
| Jurnal `payments` | Dibiarkan, tidak disentuh |
| Uang kembali | Pengeluaran `PengembalianDana` bertanggal hari pembatalan |
| Laporan tanggal lampau | Tidak berubah (`reportNotas()` tetap memuat nota batal) |
| Piutang | Nota batal tidak dihitung |
| Stok retail | Dikembalikan ke cabang |
| Antrean kerja | Nota batal dibuang |

### Penjaga nota batal

Dua sisi:

**Worker** — `order.put` ditolak `409` pada nota batal. `order.status`, `order.payment`, `order.handover` juga ditolak `409`. Payload kanonik `order.put` memakai penanda batal dari baris tersimpan, dan `canceledAtMs` dari payload perangkat diabaikan.

**Android** — `updateNotaLines`, `markWaSent`, `advanceLaundry`, `markLunas`, `markPickedUp` menolak nota batal. Layar detail menampilkan banner pembatalan berisi waktu, pelaku, dan alasan; tombol yang pasti gagal tidak ditampilkan.

## Kelas bug yang ditutup di versi ini

Dua bug uang ditemukan saat menguji jalur pembatalan, keduanya ditulis sebagai tes merah-dulu lebih dulu:

1. **`order.put` bisa menghapus penanda batal.** Perangkat yang belum menerima pembatalan mengirim salinan lamanya, dan server menimpa penanda itu. Akibatnya nota hidup lagi di semua perangkat sementara pengembalian dananya sudah tercatat: uang keluar dua kali.
2. **`order.put` bisa menulis penanda batal.** Kasir pemegang `service.correct` bisa membatalkan nota berbayar lewat jalur koreksi biasa, tanpa pemeriksaan Owner dan tanpa pengembalian dana.

## Hasil gate

| Pemeriksaan | Hasil |
| --- | --- |
| `testDebugUnitTest` | 369 tes, 0 gagal |
| `testReleaseUnitTest` | 369 tes, 0 gagal |
| `lintDebug` | 0 error, 20 warning |
| `lintRelease` | 0 error, 20 warning |
| Worker `npm test` | 97 tes, 0 gagal |
| Worker `npm run check` (tsc) | bersih |

Tes baru: `CancelNotaTest` (13 tes) dan 3 tes Worker (`order.put` arah hidupkan ulang, `order.put` arah sisipkan batal, `order.payment`/`order.status`/`order.handover`).

Bukti merah-dulu: (1) dua tes `order.put` gagal sebelum penjaga dipasang; (2) satu tes `order.payment`/`order.status`/`order.handover` gagal sebelum penjaga dipasang; (3) `setiapFungsiUbahNotaMenolakNotaYangSudahDibatalkan` gagal sebelum penjaga store dipasang; (4) `AccessFunctionEnforcementTest` gagal saat `service.cancel` belum terdaftar.

## Yang BELUM dibuktikan

- **Uji di emulator untuk alur pembatalan baru belum dijalankan pada versi ini.** Semua bukti di atas berasal dari tes unit dan lint, bukan dari menjalankan APK 1.10.43 di perangkat.
- **Pembatalan nota belum pernah dijalankan di D1 produksi.** Handler diuji dengan D1 palsu di atas SQLite asli.
- **Perilaku Worker produksi tidak dapat diverifikasi dari CLI** (hanya `/health` dan `/v1/registration` yang terbuka; `/v1/registration` membuat akun jadi tidak boleh disentuh). Verifikasi perilaku menunggu perangkat dengan login Firebase.
- **Skenario banyak perangkat**: satu perangkat membatalkan sementara perangkat lain masih memegang salinan lama. Penjaganya sudah ada dan diuji di tingkat perintah, tetapi belum diuji dengan dua perangkat sungguhan.

## Sudah dibuktikan sesudah README ini ditulis (1 Okt 2026)

- **Worker produksi dan debug sudah di-deploy.** Produksi `674f8b91-784d-4427-97db-6a17d68d0a3b` (100%), debug `a1eacd10-1c38-4fea-8cf3-5906cd9f77e3` (100%). Bundle `--dry-run` deterministik `75f7dac3…` (114,36 KiB) memuat penanda `order.cancel` (5 kemunculan), `service.cancel`, penolakan "tidak dapat diubah", `Pengembalian`, dan pola `refund-`.
- **Deploy tidak menyentuh data produksi.** Hitungan tabel identik sebelum dan sesudah: total 9.300 baris (orders 213, payments 210, staff 12, branches 5, access_roles 3, sync_changes 2893). `/health` produksi `revision 3417`, debug `revision 1104`. Probe jalur tulis `POST /v1/registration` menjawab `401` (jalur tulis hidup). Tidak ada migrasi baru (9/9 tercatat).
- **APK rilis 1.10.43 terpasang di emulator-5554** dan layar Riwayat versi menampilkan `v1.10.43 · build 62` beserta lima catatan rilisnya.
- **Commit `49f9f32` dan `a6ce246` sudah di-push ke `origin/main`**; CI hijau (run `36750318689` Android APK, `36750318734` Cloudflare validation).
