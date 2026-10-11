# Cuciin 1.10.53 / versionCode 72

Rilis 11 Oktober 2026. Menggantikan 1.10.52. Android dan Worker berubah; tanpa migrasi D1.

## Bug

- Bootstrap perangkat Owner gagal: mutasi stok bernota tidak menulis `branch_stocks`, tetapi
  Worker tetap menjurnal baris `branchStock` dengan `stock:null`. Klien gagal decode seluruh
  snapshot.
- Pesan "Alamat server tidak cocok" tertimpa pesan penyimpanan umum.
- Tombol Hapus Service tampil untuk nota berbayar (store menolak; jalurnya Batalkan nota).
- Batalkan nota menumpuk dialog "Hapus Service" sebelum dialog pembatalan.

## Perbaikan

- Worker hanya menjurnal saldo bila barisnya ada (`command-sync.ts`); materializer membuang
  baris `stock` bukan integer dari cache/jurnal (`index.ts`); `SyncProjection.apply` melewati
  baris rusak tanpa mematikan sinkronisasi.
- `LocalJson.ServerMismatch` diteruskan ke layar login; banner error memakai ikon error.
- Tombol Hapus disembunyikan untuk nota berbayar; dialog pembatalan langsung terbuka.

## Bukti lokal

- Android `clean testDebugUnitTest testReleaseUnitTest lintDebug lintRelease`: 512 debug +
  512 release, gagal/error/skip 0. Lint 0 error, 20 peringatan per varian. Log
  `/tmp/cuciin153-gate.log`.
- Worker `npm run check`: 215/215. Log `/tmp/cuciin153-worker.log`.
- `scripts/build_cuciin.sh semua`: BUILD SUCCESSFUL, endpoint dex sesuai varian. Log
  `/tmp/cuciin153-build.log`.
- `verify_release.py` PASS; sertifikat SHA-256 sama dengan 1.10.52:
  `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.
- `aapt2 dump badging`: versionCode 72, versionName 1.10.53.

## Deploy produksi (11 Oktober 2026)

- Worker `cuciin-api`: `167ef785` -> `367d7aa5-818c-4010-8a32-e0cb2e9309af`.
  `/health` 200, `environment: production`, `database: ready`.
- `wrangler d1 migrations list cuciin-db --remote`: tidak ada migrasi tertunda.
- Titik pulih: `npx wrangler rollback 167ef785-bf4f-4b24-99db-0cec53d801df`; bookmark D1
  sebelum deploy `0000080b-00000000-00005101-c97e3203138e6c8aabde83b974b6f946`.
- Data D1 tidak diubah. Jurnal produksi masih memuat 28 baris `branchStock` dengan `stock`
  bukan integer; materializer baru membuangnya saat membangun snapshot, jadi tidak perlu
  dihapus.

## Berkas

| Berkas | SHA-256 |
|---|---|
| cuciin-1.10.53-debug.apk | d6b3808fe76db352f1529753f2442644ba674fab1b6712397488140ee40c1c42 |
| cuciin-1.10.53-release.apk | 29daaa602a3848ccea43bf9d1ff6c3d1288b22c5754ce1bc78c63c26cde6d997 |
| cuciin-1.10.53-release.aab | 9d5ba3dee4474d870fe816ee93699e28f39487ae9c3b415d48cedfa7878d810f |

## BELUM dibuktikan

- Bootstrap perangkat Owner dengan akun produksi setelah deploy (hanya `/health` yang dicek).
- HP nyata: dua HP akun sama, login/logout bergantian, pasang di atas 1.10.52 tanpa hapus data.
