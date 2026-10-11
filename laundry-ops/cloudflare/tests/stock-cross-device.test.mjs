import assert from "node:assert/strict";
import test from "node:test";
import { pullChanges, pushCommands } from "../src/command-sync.ts";
import { applyJournalToSnapshot } from "../src/index.ts";
import { commandRequest, fakeD1, identities, rows, seedBaseline } from "./support/d1-harness.mjs";

test("Owner Update 10→25→0 ditarik Kasir cabang tujuan, snapshot sama dengan D1, replay tidak menggandakan", async () => {
  const env = fakeD1();
  seedBaseline(env);
  env.db.exec("INSERT INTO products(id,organization_id,name,updated_at) VALUES('soap','cuciin','Soap',1)");
  let cursor = 0;
  let snapshot = {};
  for (const [index, stock] of [10, 25, 0].entries()) {
    const command = { commandId: `stock-update-device-${index}`, entityType: "stockMove", entityId: `stock-update-${index}`, operation: "upsert", branchId: "melati", payload: { branchId: "melati", product: "Soap", kind: "Update", qty: stock, balanceAfter: stock, atMs: index + 1 } };
    const pushed = await (await pushCommands(commandRequest([command]), env, identities.owner)).json();
    assert.equal(pushed.results[0].accepted, true, JSON.stringify(pushed));
    const countBefore = rows(env, "SELECT count(*) AS n FROM sync_changes")[0].n;
    const replay = await (await pushCommands(commandRequest([command]), env, identities.owner)).json();
    assert.equal(replay.results[0].accepted, true);
    assert.equal(rows(env, "SELECT count(*) AS n FROM sync_changes")[0].n, countBefore);
    assert.equal(rows(env, "SELECT count(*) AS n FROM stock_moves")[0].n, index + 1);
    const url = `https://cuciin.example/v1/sync/changes?after=${cursor}`;
    const pulled = await (await pullChanges(new Request(url), env, identities.kasir)).json();
    const balances = pulled.changes.filter(change => change.entityType === "branchStock");
    assert.deepEqual(balances.map(change => change.payload), [{ branchId: "melati", productKey: "soap", stock }]);
    const other = await (await pullChanges(new Request(url), env, identities.kasirLain)).json();
    assert.equal(other.changes.filter(change => change.entityType === "branchStock" || change.entityType === "stockMove").length, 0);
    snapshot = applyJournalToSnapshot(snapshot, pulled.changes.map(change => ({ entity_type: change.entityType, entity_id: change.entityId, operation: change.operation, payload_json: JSON.stringify(change.payload), updated_at: change.updatedAt })), pulled.nextRevision);
    assert.deepEqual(snapshot.branchStocks, [{ branchId: "melati", productKey: "soap", stock: rows(env, "SELECT quantity FROM branch_stocks WHERE branch_id='melati' AND product_id='soap'")[0].quantity }]);
    assert.equal(snapshot.stockMoves.at(-1).balanceAfter, stock);
    cursor = pulled.nextRevision;
  }
});

test("Mutasi bernota tanpa baris saldo tidak menjurnal branchStock stock:null", async () => {
  const env = fakeD1();
  seedBaseline(env);
  env.db.exec(`INSERT INTO products(id,organization_id,name,updated_at) VALUES('parfum','cuciin','Parfum',1);
    INSERT INTO orders(id,organization_id,branch_id,cashier_name,customer_name,total,paid,payment_status,payment_method,work_status,created_at,payload_json,updated_at) VALUES('MLT-1','cuciin','melati','Kasir','Uji',1,1,'Lunas','Tunai','Masuk',1,'{}',1)`);
  const command = { commandId: "batal-nota-1", entityType: "stockMove", entityId: "move-batal-1", operation: "upsert", branchId: "melati", payload: { branchId: "melati", product: "Parfum", kind: "Tambah", qty: 1, notaId: "MLT-1", atMs: 1 } };
  const pushed = await (await pushCommands(commandRequest([command]), env, identities.owner)).json();
  assert.equal(pushed.results[0].accepted, true, JSON.stringify(pushed));
  assert.equal(rows(env, "SELECT count(*) AS n FROM sync_changes WHERE entity_type='branchStock'")[0].n, 0);
  assert.equal(rows(env, "SELECT count(*) AS n FROM sync_changes WHERE entity_type='stockMove'")[0].n, 1);
});

test("Materializer membuang saldo stock:null dari cache maupun jurnal", () => {
  const base = { branchStocks: [{ branchId: "melati", productKey: "rusak", stock: null }, { branchId: "melati", productKey: "soap", stock: 3 }] };
  const snapshot = applyJournalToSnapshot(base, [{ entity_type: "branchStock", entity_id: "melati:x", operation: "upsert", payload_json: JSON.stringify({ branchId: "melati", productKey: "x", stock: null }), updated_at: 1 }], 1);
  assert.deepEqual(snapshot.branchStocks, [{ branchId: "melati", productKey: "soap", stock: 3 }]);
});
