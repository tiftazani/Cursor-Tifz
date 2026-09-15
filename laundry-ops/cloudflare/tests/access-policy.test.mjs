/**
 * Uji command accessPolicy dan whatsappTemplate.
 *
 * Dua command ini mengatur akses pengguna dan pesan WhatsApp. Yang diperiksa di sini:
 * otorisasi Owner-only, idempotensi saat retry, penolakan non-Owner, dan efek
 * ON CONFLICT saat policy diperbarui dua kali.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { pushCommands } from "../src/command-sync.ts";
import { commandRequest, fakeD1, identities, rows, seedBaseline } from "./support/d1-harness.mjs";

function envWithDb() {
  const env = fakeD1();
  seedBaseline(env);
  return env;
}

function accessPolicyCommand(commandId, email, modules, functions) {
  return {
    commandId,
    entityType: "accessPolicy",
    entityId: email,
    operation: "upsert",
    payload: { email, modules, functions },
  };
}

function templateCommand(commandId, opening = "Halo {pelanggan},", content = "Rincian Service Anda.", closing = "Terima kasih.") {
  return {
    commandId,
    entityType: "whatsappTemplate",
    entityId: "business",
    operation: "upsert",
    payload: { id: "business", opening, content, closing },
  };
}

test("Owner dapat menyimpan kebijakan akses dan isinya tersimpan di tabel", async () => {
  const env = envWithDb();
  const response = await pushCommands(
    commandRequest([accessPolicyCommand("policy-0001", "kasir@cuciin.id", ["service", "stock"], ["service.create"])]),
    env,
    identities.owner,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.acknowledgedCommandIds, ["policy-0001"]);

  const stored = rows(env, "SELECT email, payload_json FROM access_policies");
  assert.equal(stored.length, 1);
  assert.equal(stored[0].email, "kasir@cuciin.id");
  const payload = JSON.parse(stored[0].payload_json);
  assert.deepEqual(payload.modules, ["service", "stock"]);
  assert.deepEqual(payload.functions, ["service.create"]);
});

test("non-Owner ditolak saat mengubah kebijakan akses maupun template", async () => {
  const env = envWithDb();
  const response = await pushCommands(
    commandRequest([
      accessPolicyCommand("policy-0002", "kasir@cuciin.id", ["service"], []),
      templateCommand("template-0002"),
    ]),
    env,
    identities.kasir,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.acknowledgedCommandIds, []);
  assert.equal(body.results[0].status, "rejected");
  assert.equal(body.results[0].code, 403);
  assert.equal(rows(env, "SELECT count(*) AS n FROM access_policies")[0].n, 0);
  assert.equal(rows(env, "SELECT count(*) AS n FROM whatsapp_templates")[0].n, 0);
});

test("retry dengan commandId sama tidak menggandakan baris", async () => {
  const env = envWithDb();
  const command = templateCommand("template-0003", "Pembuka", "Isi", "Penutup");
  const first = await (await pushCommands(commandRequest([command]), env, identities.owner)).json();
  assert.equal(first.results[0].accepted, true);
  assert.equal(first.results[0].replayed, false);

  const replay = await (await pushCommands(commandRequest([command]), env, identities.owner)).json();
  assert.equal(replay.results[0].accepted, true);
  assert.equal(replay.results[0].replayed, true, "replay harus dikenali, bukan ditulis ulang");
  assert.equal(rows(env, "SELECT count(*) AS n FROM whatsapp_templates")[0].n, 1);
  assert.equal(rows(env, "SELECT count(*) AS n FROM sync_changes WHERE entity_type='whatsappTemplate'")[0].n, 1);
});

test("memakai commandId lama dengan isi berbeda ditolak 409", async () => {
  const env = envWithDb();
  await pushCommands(commandRequest([templateCommand("template-0004", "A", "B", "C")]), env, identities.owner);
  const response = await pushCommands(
    commandRequest([templateCommand("template-0004", "X", "Y", "Z")]),
    env,
    identities.owner,
  );
  const body = await response.json();
  assert.equal(body.results[0].status, "rejected");
  assert.equal(body.results[0].code, 409);
  const stored = JSON.parse(rows(env, "SELECT payload_json FROM whatsapp_templates")[0].payload_json);
  assert.equal(stored.opening, "A", "isi lama harus tetap utuh");
});

test("pembaruan kebijakan akses kedua menimpa baris yang sama, bukan menambah baris", async () => {
  const env = envWithDb();
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0005", "kasir@cuciin.id", ["service"], ["service.create"])]),
    env,
    identities.owner,
  );
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0006", "kasir@cuciin.id", ["service", "customer"], ["service.create", "service.correct"])]),
    env,
    identities.owner,
  );
  const stored = rows(env, "SELECT payload_json FROM access_policies");
  assert.equal(stored.length, 1, "satu email hanya boleh punya satu baris kebijakan");
  const payload = JSON.parse(stored[0].payload_json);
  assert.deepEqual(payload.modules, ["service", "customer"]);
  assert.deepEqual(payload.functions, ["service.create", "service.correct"]);
});

test("kebijakan akses yang tersimpan langsung mengikat command berikutnya", async () => {
  const env = envWithDb();
  // Owner mencabut modul customer dari Kasir, lalu Kasir mencoba menambah pelanggan.
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0007", "kasir@cuciin.id", ["service", "stock"], ["service.create"])]),
    env,
    identities.owner,
  );
  const response = await pushCommands(
    commandRequest([
      {
        commandId: "customer-0007",
        entityType: "customer",
        entityId: "pelanggan-1",
        operation: "upsert",
        branchId: "melati",
        payload: { id: "pelanggan-1", name: "Pelanggan Uji" },
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await response.json();
  assert.equal(body.results[0].status, "rejected");
  assert.equal(body.results[0].code, 403);
  assert.match(body.results[0].error, /dibatasi oleh Owner/);
  assert.equal(rows(env, "SELECT count(*) AS n FROM customers")[0].n, 0);
});

test("kebijakan yang mengizinkan modul tidak menghalangi command yang sah", async () => {
  const env = envWithDb();
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0008", "kasir@cuciin.id", ["service", "customer"], ["service.create"])]),
    env,
    identities.owner,
  );
  const response = await pushCommands(
    commandRequest([
      {
        commandId: "customer-0008",
        entityType: "customer",
        entityId: "pelanggan-2",
        operation: "upsert",
        branchId: "melati",
        payload: { id: "pelanggan-2", name: "Pelanggan Kedua" },
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await response.json();
  assert.equal(body.results[0].accepted, true);
  assert.equal(rows(env, "SELECT count(*) AS n FROM customers")[0].n, 1);
});

test("Owner selalu lolos walau ada kebijakan yang mencabut modul", async () => {
  const env = envWithDb();
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0009", "tiftazani.khara@gmail.com", [], [])]),
    env,
    identities.owner,
  );
  const response = await pushCommands(
    commandRequest([
      {
        commandId: "customer-0009",
        entityType: "customer",
        entityId: "pelanggan-3",
        operation: "upsert",
        branchId: "melati",
        payload: { id: "pelanggan-3", name: "Pelanggan Ketiga" },
      },
    ]),
    env,
    identities.owner,
  );
  const body = await response.json();
  assert.equal(body.results[0].accepted, true);
});

test("template WhatsApp tersimpan dengan id yang tetap dan perubahan tercatat di journal", async () => {
  const env = envWithDb();
  await pushCommands(commandRequest([templateCommand("template-0010", "Halo {pelanggan},", "Nota {nota} dari {cabang}.", "Sampai jumpa.")]), env, identities.owner);
  const stored = JSON.parse(rows(env, "SELECT payload_json FROM whatsapp_templates")[0].payload_json);
  assert.equal(stored.id, "business");
  assert.equal(stored.content, "Nota {nota} dari {cabang}.");
  const journal = rows(env, "SELECT entity_type, operation FROM sync_changes WHERE entity_type='whatsappTemplate'");
  assert.equal(journal.length, 1);
  assert.equal(journal[0].operation, "upsert");
});
