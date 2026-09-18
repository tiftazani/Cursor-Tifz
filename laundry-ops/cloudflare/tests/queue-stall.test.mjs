/**
 * Uji kemacetan antrean perangkat.
 *
 * Antrean perangkat pernah macet permanen karena tiga hal di pushCommands:
 * 1. Satu command dengan tipe tidak dikenal membatalkan SELURUH batch dengan 422
 *    tanpa daftar results, sehingga perangkat tidak tahu mana yang harus dibuang.
 * 2. Command yang ditolak permanen menahan command berikutnya, sehingga sisa
 *    antrean ikut berstatus retryable selamanya.
 * 3. payment.delete ada di wire protocol perangkat tetapi tidak ada di
 *    KNOWN_COMMANDS, jadi setiap penghapusan pembayaran menahan antreannya.
 *
 * Ketiga berkas uji ini harus GAGAL bila perilaku lamanya dikembalikan.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { pushCommands } from "../src/command-sync.ts";
import { commandRequest, fakeD1, identities, rows, seedBaseline } from "./support/d1-harness.mjs";

const orderId = "SLP-2609-0001-AAAA1";

function seedOrder(env) {
  seedBaseline(env);
  // Harness bersama hanya memuat migrasi 0001-0004; tabel payments datang dari 0005.
  env.db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      amount INTEGER NOT NULL CHECK (amount > 0),
      method TEXT NOT NULL CHECK (method IN ('Tunai','Qris','Transfer')),
      received_at INTEGER NOT NULL,
      received_by TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO orders(id,organization_id,branch_id,cashier_email,cashier_name,customer_name,phone,total,paid,payment_status,payment_method,work_status,created_at,estimated_finish,completed_at,picked_up_at,wa_sent,updated_at,payload_json)
      VALUES('${orderId}','cuciin','melati','kasir@cuciin.id','Kasir Melati','Pelanggan','08123',50000,20000,'Belum','Tunai','Menunggu',1,'',NULL,NULL,0,1,'{}');
    INSERT OR IGNORE INTO payments(id,organization_id,order_id,branch_id,amount,method,received_at,received_by,payload_json,updated_at)
      VALUES('pay-uji-0001','cuciin','${orderId}','melati',20000,'Tunai',1,'kasir@cuciin.id','{}',1);
  `);
}

test("command bertipe tidak dikenal tidak menahan batch, sisanya tetap dijalankan", async () => {
  const env = fakeD1();
  seedOrder(env);
  const result = await pushCommands(
    commandRequest([
      {
        commandId: "device-uji-takdikenal-0001",
        entityType: "entahApa",
        entityId: "apa-saja",
        operation: "upsert",
        branchId: "melati",
        occurredAt: 1,
        payload: { id: "apa-saja" },
      },
      {
        commandId: "device-uji-sah-0001",
        entityType: "audit",
        entityId: "audit-uji-0001",
        operation: "upsert",
        branchId: "melati",
        occurredAt: 2,
        payload: { at: "18 Sep 2026, 18.00", atMs: 2, user: "Kasir Melati", branchId: "melati", action: "Uji batch" },
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await result.json();
  assert.equal(result.status, 200);
  const perintahSah = body.results.find((item) => item.commandId === "device-uji-sah-0001");
  assert.equal(perintahSah?.accepted, true);
  assert.match(perintahSah?.status, /applied|duplicate/);
  const ditolak = body.results.find((item) => item.commandId === "device-uji-takdikenal-0001");
  assert.equal(ditolak?.accepted, false);
  assert.equal(ditolak?.status, "rejected");
  assert.equal(ditolak?.code, 422);
});

test("command ditolak permanen tidak menahan command sesudahnya", async () => {
  const env = fakeD1();
  seedOrder(env);
  const result = await pushCommands(
    commandRequest([
      {
        commandId: "device-uji-ditolak-0001",
        entityType: "payment",
        entityId: "pay-tidak-ada",
        operation: "upsert",
        branchId: "melati",
        occurredAt: 1,
        payload: { id: "pay-tidak-ada", notaId: "tidak-ada", branchId: "melati", amount: 1000, method: "Tunai", atMs: 1 },
      },
      {
        commandId: "device-uji-setelahnya-0001",
        entityType: "audit",
        entityId: "audit-uji-0002",
        operation: "upsert",
        branchId: "melati",
        occurredAt: 2,
        payload: { at: "18 Sep 2026, 18.01", atMs: 2, user: "Kasir Melati", branchId: "melati", action: "Setelah penolakan" },
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await result.json();
  const ditolak = body.results.find((item) => item.commandId === "device-uji-ditolak-0001");
  assert.equal(ditolak?.status, "rejected");
  const sesudahnya = body.results.find((item) => item.commandId === "device-uji-setelahnya-0001");
  assert.notEqual(sesudahnya?.status, "retryable");
  assert.equal(sesudahnya?.accepted, true);
});

test("payment.delete dikenal dan menghapus baris pembayaran", async () => {
  const env = fakeD1();
  seedOrder(env);
  const result = await pushCommands(
    commandRequest([
      {
        commandId: "device-uji-paymentdelete-0001",
        entityType: "payment",
        entityId: "pay-uji-0001",
        operation: "delete",
        branchId: "melati",
        occurredAt: 3,
        payload: null,
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.results[0].accepted, true);
  assert.equal(rows(env, "SELECT COUNT(*) AS n FROM payments WHERE id='pay-uji-0001'")[0].n, 0);
});

test("payment.delete untuk baris yang sudah hilang dianggap selesai, bukan menahan antrean", async () => {
  const env = fakeD1();
  seedOrder(env);
  const result = await pushCommands(
    commandRequest([
      {
        commandId: "device-uji-paymentdelete-0002",
        entityType: "payment",
        entityId: "pay-tidak-pernah-ada",
        operation: "delete",
        branchId: "melati",
        occurredAt: 4,
        payload: null,
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.results[0].accepted, true);
});
