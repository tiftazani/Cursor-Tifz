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

Batch dapat berhasil sebagian. Android hanya boleh menghapus command yang ada di `acknowledgedCommandIds`. Setelah satu command gagal, command berikutnya pada batch dikembalikan sebagai `retryable` agar efek lanjutan tidak mendahului dependensinya. Kesalahan validasi, hak akses, atau konflik data memakai `status: "rejected"` dan dapat dipindahkan ke daftar konflik. Gangguan D1/Worker sementara memakai `status: "retryable"` dengan kode 5xx; command tetap berada di outbox dan dicoba lagi, bukan dipindahkan ke dead-letter.

Entity yang diterima adalah `branch`, `staff`, `customer`, `service`, `product`, `branchStock`, `inventory`, `expense`, `nota`, `stockMove`, `audit`, `cashClose`, dan `attendance`, dengan operasi `upsert` atau `delete`. Payload memakai nama field Kotlin secara persis. Data `passwordHash` dibuang oleh server dan tidak dimasukkan ke journal.

`branchStock` absolut diperlakukan sebagai proyeksi dan diakui tanpa menimpa saldo server. `stockMove` adalah sumber mutasi stok:

- `Tambah`: server menambah `abs(qty)`.
- `Kurang` dan `Jual`: server mengurangi `abs(qty)`.
- `Update`: server memakai `balanceAfter`, atau `qty` bila field itu tidak tersedia.
- saldo negatif membatalkan command dengan konflik 409.
- server mengembalikan `stockMove` dengan `syncId` yang sama dengan `entityId`, actor dari sesi terverifikasi, dan saldo setelah mutasi. Android memakai `syncId` sebagai identitas stabil sehingga canonicalization tidak menduplikasi riwayat. Saldo kanonis juga dikirim melalui delta `branchStock`.
- `stockMove` kompensasi memakai `requiresDeletedNota=true` dan baru diterima bila Nota sudah tidak ada serta tombstone penghapusannya berada pada cabang yang sama; riwayat disimpan tanpa mengubah stok untuk kedua kalinya.

Payload `audit` juga memperoleh `syncId` stabil. Nama actor pada delta berasal dari sesi terverifikasi, dan email actor dicatat pada kolom relasional `audit_logs.actor` serta metadata `sync_changes.actor_email`.

Tombstone penghapusan Nota bersifat permanen. Upsert offline untuk ID yang pernah dihapus ditolak dengan konflik 409 agar data lama tidak menghidupkan Nota dan mengurangi stok kembali. Pemulihan hanya dapat ditambahkan kelak sebagai command Owner yang eksplisit.

Untuk integrasi baru yang tidak berasal dari proyeksi Snapshot, endpoint yang sama juga menerima domain command `type`: `order.create`, `order.update`, `order.delete`, `order.status`, `order.payment`, `order.handover`, dan `stock.batch`. Domain command mengunci harga, kasir, handler, komisi, pembayaran, dan saldo di transaksi D1.

## Menarik perubahan

`GET /v1/sync/changes?after=1842&limit=200` menerima limit 1–500. Ambil halaman berikutnya selama `hasMore=true`.

```json
{
  "revision": 1844,
  "nextRevision": 1844,
  "latestRevision": 1844,
  "hasMore": false,
  "scopeKey": "kasir:melati",
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

Simpan `revision` hanya setelah seluruh perubahan pada halaman berhasil diterapkan ke database lokal. Sebelum menulis snapshot lokal, simpan pending-remote marker; hapus marker setelah snapshot dan cursor selesai. Owner menerima semua cabang. Role lain hanya menerima data global yang diperlukan, cabang yang ditugaskan, serta data staf yang memiliki penugasan pada cabang tersebut; daftar staf dan cabang global tidak ikut bocor melalui delta. Perubahan staf dijurnal per cabang sehingga perangkat lama menerima delete saat staf dipindahkan. Absensi non-Owner hanya memuat catatan email akun sendiri. `scopeKey` memuat role, email, dan cabang pada non-Owner; jika nilainya berubah, kosongkan cursor dan lakukan bootstrap ulang agar data sesi sebelumnya tidak tertinggal.

## Otorisasi server

- Owner dapat mengubah seluruh entity dan cabang.
- Kasir dapat membuat/mengubah Service, pembayaran, serah terima, pelanggan, stok, biaya, inventory, tutup kas, dan absensinya pada cabang yang ditugaskan.
- Supervisor dapat mengubah status pengerjaan, stok, inventory, dan absensinya pada cabang yang ditugaskan; tidak dapat membuat Service, membayar, menyerahkan, mengubah pelanggan, atau mengubah biaya/kas.
- Upsert maupun penghapusan absensi non-Owner memeriksa pemilik baris yang sudah tersimpan, sehingga ID absensi orang lain tidak dapat diambil alih dengan payload baru.
- Penghapusan Service, master, audit, riwayat stok, dan tutup kas dibatasi ke Owner.
- Pada Nota milik non-Owner, server memaksa kasir dan handler dari Firebase session sehingga payload perangkat tidak dapat menyamar sebagai akun lain.

## Kompatibilitas dan rollout

`GET /api/cuciin` dan `GET /v1/snapshot` tetap tersedia untuk bootstrap. Snapshot yang dikembalikan sudah memuat seluruh journal sampai revision pada header `X-Cuciin-Revision`. `PUT` snapshot hanya menerima secret bootstrap privat ketika journal masih kosong; setelah command sync aktif, endpoint menolak bootstrap PUT dengan `409`. Aplikasi lama tanpa secret mendapat `426` dan harus diperbarui agar tidak menimpa command multi-perangkat. Urutan deploy: migrasi `0003_command_sync.sql`, Worker, lalu APK. Uji staging dengan dua HP sebelum produksi.
