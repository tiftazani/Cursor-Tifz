# Cuciin 1.10.50 / versionCode 69

Kandidat 10 Oktober 2026. Menggantikan 1.10.49. Tidak commit atau push.

## Perbaikan

- Login dan refresh izin memakai `/v1/me.access`: staff sendiri yang aktif, cabang, assignment role, katalog role dan policy. Snapshot transaksi penuh hanya fallback server lama. Izin tidak sah tidak mengambil cache Owner.
- Laporan Owner tidak mengikuti pilihan cabang layar kerja. Filter Kasir tersembunyi dibersihkan. Kasir tetap dibatasi cabang tugas.
- Jurnal `order` lama dibaca sebagai `nota`. Worker membentuk payload yang berhasil didecode Kotlin.
- Cursor perangkat di depan server memulihkan snapshot lengkap secara durable. Pending lokal tidak dibuang.
- Materialisasi server memakai Map, batas revisi dan paging 4000. Cache best-effort tidak menggagalkan GET ketika penulisannya gagal.

## Bukti lokal

- Clean build debug APK, signed release APK dan release AAB sukses: `cuciin150-build.log`.
- Android: 492 debug + 492 release; failures/errors/skipped 0. Lint masing-masing 0 error, 15 warning.
- Worker `npm run check`: typecheck dan skema 19 tabel lulus; 153/153, gagal/skipped 0: `worker-parent-wire-check.log`.
- Fixture sintetis dibuat oleh helper Worker, diuji ulang Worker dan didecode oleh `ServerLoginDecodeTest.actualWorkerPayloadDecodesWithoutBusinessFallback`.
- Fixture skala 24.050 jurnal / 1.303 nota / 3.278.981 byte: 10 query, CPU Node sekitar 71 ms pada gate parent. Bukan benchmark Cloudflare live.
- verify_release PASS: signature v2, non-debuggable, SDK, izin minimum, ZIP/ELF 16 KB. Sertifikat SHA256 `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.
- APK release berisi endpoint produksi saja; debug berisi endpoint debug saja.
- Upgrade emulator API35 offline memakai `adb install -r` dari release 1.10.49 ke 1.10.50; buka dua kali per varian, 0 FATAL/ANR pada buffer crash. Tidak uninstall atau hapus data. Ini hanya smoke startup, bukan bukti login.

## Deploy

Izin pengguna: deploy kedua server setelah tes lulus, termasuk migrasi hak akses.

- Migrasi `0010_staff_access_role.sql` diterapkan pada produksi dan debug.
- Produksi: `8e1593d4-a17d-441b-9e93-76439ee14b5d`, https://cuciin-api.tiftazani-cuciin.workers.dev
- Debug: `be6526d1-2778-40ca-b82a-d7af170baea4`, https://cuciin-api-debug.tiftazani-cuciin.workers.dev
- Health keduanya HTTP 200. `/v1/me` dan `/v1/snapshot` tanpa token HTTP 401. Health dengan User-Agent Android juga HTTP 200.
- Hitungan sebelum/sesudah langsung: prod staff12/orders1307/payments1308/journal23966; debug staff10/orders21/payments14/journal1249. Sama. Akun pelapor tetap aktif/approved/Owner. Tidak menghapus akun atau transaksi.
- Query awal migrasi debug sempat gagal Cloudflare 7403; retry sukses sebelum deploy. Probe Python User-Agent bawaan terkena edge 1010; curl browser/Android berhasil. Ini tidak membuktikan HP pelapor terkena masalah yang sama.

## Belum terbukti

Login Firebase akun pelapor, runtime snapshot besar Cloudflare dengan token nyata, transaksi Kasir ke Owner pada dua HP, upgrade data asli, tampilan Compose dan interleaving jaringan nyata. Tidak menjanjikan nol bug.

Pasang release APK sebagai pembaruan di atas aplikasi yang ada. Jangan copot aplikasi atau hapus datanya. Uji login Owner, pilih semua cabang dan cocokkan satu nota baru Kasir dengan nomor nota yang sama. Jika gagal, catat pesan dan waktu kejadian; jangan kirim password/token.

Hash artefak tersedia di SHA256SUMS. APK juga disalin ke ~/Downloads/.
