# Cuciin 1.10.51 / versionCode 70

Kandidat 10 Oktober 2026. Menggantikan 1.10.50. Belum commit dan belum push.

## Kenapa kandidat ini ada

APK 1.10.50 dibangun 10 Okt 13:40. Tiga berkas Android berubah sesudah itu
(`SyncProtocol.kt` 18:13, `CuciinStore.kt` 18:41, `CloudSync.kt` 19:17), jadi
penerimaan konfirmasi server, pengikat akun pada antrean, urutan pembayaran,
dan pemulihan snapshot di 1.10.50 TIDAK memuat perbaikan itu. Kandidat ini
membawa kode Android terkini.

## Perbaikan

- Konfirmasi (ACK) disimpan lengkap, bukan hanya sebagian. Sebelumnya nota yang
  sudah diterima server dikirim ulang saat pelanggan diubah.
- Antrean (outbox) terikat akun pembuatnya. Di HP bersama, transaksi tidak
  terkirim atas nama akun lain setelah ganti sesi.
- Pembayaran menunggu seluruh nota yang masih tertunda terkirim lebih dulu.
- 503 `snapshot_recovery_required` tidak lagi ditelan; perangkat memulihkan
  snapshot penuh, bukan melanjutkan delta dan cursor.
- Kombinasi dengan Worker yang sudah aktif (prod `167ef785`, debug `3f4e86e1`):
  hapus produk/cabang tidak menahan antrean, saldo stok aktif tidak terhapus,
  pengembalian dana nota batal tidak dapat dihapus, stockMove memilih produk
  dengan benar.

## Bukti lokal

- Build bersih: `clean assembleDebug assembleRelease bundleRelease`, BUILD
  SUCCESSFUL, log `cuciin151-build.log`.
- Android: 508 debug + 508 release, gagal/error 0. Lint masing-masing 0 error,
  15 peringatan. Log `cuciin151-gate.log`.
- `verify_release.py` PASS: tanda tangan v2, non-debuggable, target SDK 36,
  izin minimum, ZIP/ELF 16 KB. Sertifikat SHA256
  `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.
- Endpoint di dalam dex: release hanya `cuciin-api.tiftazani-cuciin.workers.dev`,
  debug hanya `cuciin-api-debug.tiftazani-cuciin.workers.dev`.
- Worker `npm run check` 213/213, skema 19 tabel (sebelum deploy).

## Berkas

| Berkas | SHA-256 |
|---|---|
| cuciin-1.10.51-debug.apk | 3c6a976cf64f2a605a324b8ef16b8e02982bada4b086528edf91ca4bf69c8ecb |
| cuciin-1.10.51-release.apk | df976c3d746285b674780b5ce067a4af2cac46b679ed784252ae50196bb950be |
| cuciin-1.10.51-release.aab | 37021217faa86386590758ba6c4fccb1c26d0037fbe23d9f6dd0e536eafc39a6 |

## BELUM dibuktikan

- Uji dua HP nyata dengan akun sama, termasuk HP satu offline saat nota dibuat.
- Login dan logout bergantian di perangkat yang sama.
- Pemasangan di atas 1.10.50 tanpa mencopot aplikasi atau menghapus data.
- Upgrade dari data operasional asli di emulator.
- Uji dua puluh detik, mati listrik, atau ANR.
