# Kontrak sinkronisasi command dan delta

Kontrak ini dipakai Android setelah pengguna memperoleh Firebase ID token. Semua request memakai `Authorization: Bearer <id-token>`, `Content-Type: application/json`, dan URL dasar Worker tanpa `/api/cuciin`.

## Mengirim perubahan

`POST /v1/sync/commands` menerima maksimal 100 command dan 512 KB per request.

```json
{
  "commands": [
    {
      "commandId": "01947e1c-ec1e-7c46-a981-121f89c8f179",
      "entityType": "nota",
      "entityId": "MLT-260914-0001",
      "operation": "upsert",
      "branchId": "melati",
      "occurredAt": 1789376400000,
      "expectedUpdatedAt": 1789376300000,
      "payload": { "id": "MLT-260914-0001", "branchId": "melati", "...": "field Nota lengkap" }
    }
  ]
}
```

`commandId` harus dibuat sekali di perangkat dan disimpan bersama outbox. Retry harus memakai ID dan payload yang sama. Replay menghasilkan status `duplicate`; memakai ID lama untuk payload berbeda menghasilkan konflik dan tidak diakui.

```json
{
  "revision": 1842,
  "acknowledgedCommandIds": ["01947e1c-ec1e-7c46-a981-121f89c8f179"],
  "results": [
    { "commandId": "01947e1c-ec1e-7c46-a981-121f89c8f179", "accepted": true, "status": "applied" }
  ]
}
```

Batch dapat berhasil sebagian. Android hanya boleh menghapus command yang ada di `acknowledgedCommandIds`. Result yang ditolak memuat `status` HTTP semantik dan `error`, lalu tetap berada di outbox untuk diselesaikan atau ditandai perlu tindakan pengguna.

Entity yang diterima adalah `branch`, `staff`, `customer`, `service`, `product`, `branchStock`, `inventory`, `expense`, `nota`, `stockMove`, `audit`, `cashClose`, dan `attendance`, dengan operasi `upsert` atau `delete`. Payload memakai nama field Kotlin secara persis. Data `passwordHash` dibuang oleh server dan tidak dimasukkan ke journal.

`branchStock` absolut diperlakukan sebagai proyeksi dan diakui tanpa menimpa saldo server. `stockMove` adalah sumber mutasi stok:

- `Tambah`: server menambah `abs(qty)`.
- `Kurang` dan `Jual`: server mengurangi `abs(qty)`.
- `Update`: server memakai `balanceAfter`, atau `qty` bila field itu tidak tersedia.
- saldo negatif membatalkan command dengan konflik 409.
- server mengirim delta `stockMove` dan `branchStock` kanonis agar semua HP menuju saldo yang sama.

Untuk integrasi baru yang tidak berasal dari proyeksi Snapshot, endpoint yang sama juga menerima domain command `type`: `order.create`, `order.update`, `order.delete`, `order.status`, `order.payment`, `order.handover`, dan `stock.batch`. Domain command mengunci harga, kasir, handler, komisi, pembayaran, dan saldo di transaksi D1.

## Menarik perubahan

`GET /v1/sync/changes?after=1842&limit=200` menerima limit 1–500. Ambil halaman berikutnya selama `hasMore=true`.

```json
{
  "revision": 1844,
  "nextRevision": 1844,
  "latestRevision": 1844,
  "hasMore": false,
  "changes": [
    {
      "revision": 1843,
      "entityType": "branchStock",
      "entityId": "melati:detergen",
      "operation": "upsert",
      "branchId": "melati",
      "payload": { "branchId": "melati", "productKey": "detergen", "stock": 27 }
    }
  ]
}
```

Simpan `revision` hanya setelah seluruh perubahan pada halaman berhasil diterapkan ke database lokal. Owner menerima semua cabang. Role lain hanya menerima data global dan cabang yang tercantum di `staff_branches`.

## Otorisasi server

- Owner dapat mengubah seluruh entity dan cabang.
- Kasir dapat membuat/mengubah Service, pembayaran, serah terima, pelanggan, stok, biaya, inventory, tutup kas, dan absensinya pada cabang yang ditugaskan.
- Supervisor dapat mengubah status pengerjaan, stok, inventory, dan absensinya pada cabang yang ditugaskan; tidak dapat membuat Service, membayar, menyerahkan, atau mengubah biaya/kas.
- Penghapusan Service, master, audit, riwayat stok, dan tutup kas dibatasi ke Owner.
- Pada Nota milik non-Owner, server memaksa kasir dan handler dari Firebase session sehingga payload perangkat tidak dapat menyamar sebagai akun lain.

## Kompatibilitas dan rollout

`GET/PUT /api/cuciin` dan `/v1/snapshot` tetap tersedia selama migrasi. APK multi-writer harus memakai command/delta; snapshot PUT tidak boleh dijadikan jalur tulis utama setelah rollout. Urutan deploy: migrasi `0003_command_sync.sql`, Worker, lalu APK. Uji staging dengan dua HP sebelum produksi.
