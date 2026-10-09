import assert from "node:assert/strict";
import test from "node:test";
import { pushCommands } from "../src/command-sync.ts";
import { commandRequest, fakeD1, identities, rows, seedBaseline } from "./support/d1-harness.mjs";

function fixture() {
  const env = fakeD1();
  seedBaseline(env);
  env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,active,updated_at) VALUES('wash','cuciin','Wash','kg',10000,1000,1,1),('iron','cuciin','Iron','kg',10000,2000,1,1)");
  return env;
}

function nota(lines = [line("wash")]) {
  return { id: "ATTR-1", branchId: "melati", customer: "Pelanggan", phone: "", paid: 0, pay: "Belum", payMethod: "Tunai", laundry: "Antrian", createdAtMs: 1, lines };
}

function line(serviceId, name = "Forged") {
  return { serviceId, name: serviceId, qty: 1, unit: "kg", unitPrice: 10000, handledByEmail: "forged@example.com", handledByName: name };
}

async function put(env, actor, commandId, payload) {
  const result = await (await pushCommands(commandRequest([{ commandId, entityType: "nota", entityId: payload.id, operation: "upsert", branchId: "melati", payload }]), env, actor)).json();
  assert.equal(result.results[0].accepted, true, JSON.stringify(result));
  return JSON.parse(rows(env, "SELECT payload_json FROM orders WHERE id=?", payload.id)[0].payload_json);
}

function assertOrigin(env, payload, cashier, handlers) {
  const order = rows(env, "SELECT cashier_email,cashier_name FROM orders WHERE id='ATTR-1'")[0];
  assert.equal(order.cashier_email, cashier.email);
  assert.equal(order.cashier_name, cashier.name);
  assert.equal(payload.kasirEmail, cashier.email);
  assert.equal(payload.kasir, cashier.name);
  const stored = rows(env, "SELECT handler_email,handler_name FROM order_lines WHERE order_id='ATTR-1' ORDER BY line_no");
  assert.deepEqual(stored.map(row => [row.handler_email, row.handler_name]), handlers.map(actor => [actor.email, actor.name]));
  assert.deepEqual(payload.lines.map(row => [row.handledByEmail, row.handledByName]), handlers.map(actor => [actor.email, actor.name]));
  const journal = JSON.parse(rows(env, "SELECT payload_json FROM sync_changes WHERE entity_type='nota' ORDER BY sequence DESC LIMIT 1")[0].payload_json);
  assert.deepEqual(journal, payload);
}

test("Kasir lain mengoreksi rincian tanpa mengambil asal kasir dan petugas, rincian baru milik pengirim", async () => {
  const env = fixture();
  await put(env, identities.kasir, "attribution-create-01", nota());
  const other = { ...identities.kasir, email: "rekan@cuciin.id", name: "Rekan Melati" };
  const payload = await put(env, other, "attribution-edit-0001", { ...nota([line("iron"), { ...line("wash"), qty: 2 }]), kasirEmail: other.email, kasir: other.name });
  assertOrigin(env, payload, identities.kasir, [other, identities.kasir]);
});

test("Owner dapat menugaskan petugas baru tetapi kasir pembuat tetap aktor login", async () => {
  const env = fixture();
  const assigned = { email: "assigned@example.com", name: "Assigned" };
  const payload = await put(env, identities.owner, "attribution-owner-new", { ...nota([{ ...line("wash"), handledByEmail: assigned.email, handledByName: assigned.name }]), kasirEmail: "forged@example.com", kasir: "Forged" });
  assertOrigin(env, payload, identities.owner, [assigned]);
});

test("Owner boleh menugaskan petugas pada koreksi tetapi asal kasir tetap", async () => {
  const env = fixture();
  await put(env, identities.kasir, "attribution-owner-01", nota());
  const assigned = { email: "assigned@example.com", name: "Assigned" };
  const payload = await put(env, identities.owner, "attribution-owner-02", { ...nota([{ ...line("wash"), handledByEmail: assigned.email, handledByName: assigned.name }, line("iron")]), kasirEmail: "forged@example.com", kasir: "Forged" });
  assertOrigin(env, payload, identities.kasir, [assigned, { email: "forged@example.com", name: "Forged" }]);
});

test("duplikat layanan mempertahankan petugas per kemunculan dan duplikat tambahan dicap pengirim", async () => {
  const env = fixture();
  await put(env, identities.kasir, "attribution-duplicate1", nota([line("wash"), line("wash")]));
  const second = { email: "second@example.com", name: "Second" };
  env.db.prepare("UPDATE order_lines SET handler_email=?,handler_name=? WHERE order_id='ATTR-1' AND line_no=1").run(second.email, second.name);
  const other = { ...identities.kasir, email: "rekan@cuciin.id", name: "Rekan Melati" };
  const payload = await put(env, other, "attribution-duplicate2", nota([line("iron"), line("wash"), line("wash"), line("wash")]));
  assertOrigin(env, payload, identities.kasir, [other, identities.kasir, second, other]);
});

test("Owner mengoreksi tanpa field petugas tetap mempertahankan petugas lama", async () => {
  const env = fixture();
  await put(env, identities.kasir, "attribution-omit-01", nota());
  const { handledByEmail, handledByName, ...withoutHandler } = line("wash");
  const payload = await put(env, identities.owner, "attribution-omit-02", nota([withoutHandler]));
  assertOrigin(env, payload, identities.kasir, [identities.kasir]);
});

test("nota tidak menyimpan alias asal palsu dalam payload atau jurnal", async () => {
  const env = fixture();
  const payload = await put(env, identities.kasir, "attribution-alias-01", { ...nota(), cashierEmail: "forged@example.com", cashierName: "Forged" });
  assert.equal(payload.cashierEmail, undefined);
  assert.equal(payload.cashierName, undefined);
  assertOrigin(env, payload, identities.kasir, [identities.kasir]);
});

test("pembuatan langsung order.create juga membuang asal palsu", async () => {
  const env = fixture();
  const payload = { id: "ATTR-1", branchId: "melati", customerName: "Pelanggan", paid: 0, paymentStatus: "Belum", paymentMethod: "Tunai", workStatus: "Antrian", createdAt: 1, cashierEmail: "forged@example.com", cashierName: "Forged", lines: [{ serviceId: "wash", serviceName: "Wash", quantity: 1, unit: "kg", unitPrice: 10000, handlerEmail: "forged@example.com", handlerName: "Forged" }] };
  const result = await (await pushCommands(commandRequest([{ commandId: "attribution-direct-01", type: "order.create", entityId: payload.id, branchId: "melati", payload }]), env, identities.owner)).json();
  assert.equal(result.results[0].accepted, true);
  const stored = JSON.parse(rows(env, "SELECT payload_json FROM orders WHERE id='ATTR-1'")[0].payload_json);
  assert.equal(stored.cashierEmail, identities.owner.email);
  assert.equal(stored.cashierName, identities.owner.name);
  assert.equal(stored.lines[0].handlerEmail, "forged@example.com");
  assert.equal(stored.lines[0].handlerName, "Forged");
});
