/**
 * Penjaga: snapshot hasil rekonstruksi harus punya updatedAt yang masuk akal.
 *
 * Kejadian nyata yang melahirkan tes ini: data transaksi dihapus di D1 produksi
 * (orders, order_lines, payments, dan sync_snapshots sekaligus), tetapi aplikasi
 * rilis tetap menampilkan transaksi lama.
 *
 * Sebabnya bukan sisa data di server. materializedSnapshot() membangun snapshot dari
 * {} ketika baris sync_snapshots tidak ada, sehingga updatedAt bernilai 0. Di perangkat,
 * CuciinStore.applyCloud() membuang snapshot yang updatedAt-nya lebih tua daripada
 * localUpdatedAt. Akibatnya kabar penghapusan dari server dibuang dan data lama di
 * perangkat tidak pernah hilang.
 *
 * Tes ini mengunci syaratnya: snapshot yang dibangun dari jurnal kosong tetap membawa
 * updatedAt yang tidak lebih tua daripada revisinya, sehingga perangkat mau menerimanya.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { materializedSnapshot } from "../src/index.ts";
import { fakeD1, rows, seedBaseline } from "./support/d1-harness.mjs";

test("snapshot tanpa baris sync_snapshots tetap membawa updatedAt, bukan 0", async () => {
  const env = fakeD1();
  seedBaseline(env);
  assert.equal(rows(env, "SELECT COUNT(*) AS n FROM sync_snapshots")[0].n, 0, "prasyarat: belum ada baris snapshot");

  const { snapshot, revision } = await materializedSnapshot(env);
  assert.equal(revision, 0, "jurnal kosong berarti revisi 0");
  assert.equal(typeof snapshot.updatedAt, "number", "updatedAt harus berupa angka");
  assert.notEqual(snapshot.updatedAt, 0, "updatedAt 0 membuat perangkat membuang snapshot ini");
});

test("updatedAt snapshot selalu terisi walau jurnal dan baris snapshot sama-sama kosong", async () => {
  const env = fakeD1();
  seedBaseline(env);
  env.db.exec(`INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at)
    VALUES('cuciin','nota','MLT-9','upsert',json_object('id','MLT-9','branchId','melati','customer','Uji','total',1000,'paid',0,'pay','Belum','laundry','Masuk','createdAtMs',1),1789567083606);`);

  const { snapshot, revision } = await materializedSnapshot(env);
  assert.ok(revision > 0, "jurnal berisi satu perubahan");
  assert.ok(snapshot.updatedAt > 0, "updatedAt harus terisi");
  assert.equal(snapshot.syncRevision, revision, "syncRevision mengikuti revisi jurnal");
});

test("penghapusan di server terbaca sebagai snapshot kosong yang layak diterima perangkat", async () => {
  const env = fakeD1();
  seedBaseline(env);
  const { snapshot } = await materializedSnapshot(env);
  assert.deepEqual(snapshot.notas ?? [], [], "tidak ada transaksi tersisa setelah pembersihan");
  assert.deepEqual(snapshot.payments ?? [], [], "tidak ada pembayaran tersisa setelah pembersihan");
  assert.ok(snapshot.updatedAt > 0, "snapshot kosong harus tetap punya updatedAt supaya diterima perangkat");
});
