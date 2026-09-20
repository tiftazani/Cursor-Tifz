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
    // Daftar fungsi adalah daftar putih: begitu tidak kosong, setiap modul yang diberikan tetap
    // perlu fungsi yang cocok. Sebelumnya command pelanggan hanya memeriksa modul, sehingga
    // kebijakan yang tidak memberi `customer.write` tetap bisa menulis pelanggan.
    commandRequest([
      accessPolicyCommand("policy-0008", "kasir@cuciin.id", ["service", "customer"], ["service.create", "customer.write"]),
    ]),
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

// ---------------------------------------------------------------------------------------------
// Pemetaan command ke fungsi katalog (1.10.30)
//
// Pemeriksaan ini hanya berjalan untuk akun yang punya kebijakan akses per pengguna. Sebelumnya
// pemetaannya memakai modul lama dan menyamakan pembayaran dengan koreksi Service, sehingga akun
// yang diberi `service.payment` tanpa `service.correct` ditolak saat mencatat pembayaran.
// ---------------------------------------------------------------------------------------------

test("kebijakan dengan service.payment saja cukup untuk mencatat pembayaran", async () => {
  const env = envWithDb();
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0010", "kasir@cuciin.id", ["service"], ["service.create", "service.payment"])]),
    env,
    identities.owner,
  );
  const envNota = env.db;
  envNota.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  await pushCommands(
    commandRequest([
      {
        commandId: "nota-0010",
        type: "order.create",
        entityId: "MLT-BAYAR-1",
        branchId: "melati",
        payload: { id: "MLT-BAYAR-1", branchId: "melati", customerName: "Pelanggan Uji", phone: "0812", total: 50000, paid: 0, paymentStatus: "Belum lunas", paymentMethod: "Tunai", workStatus: "Masuk antrian", createdAt: 1, lines: [{ serviceId: "cuci-kiloan", serviceName: "Cuci kiloan", quantity: 5, unit: "kg", unitPrice: 10000 }] },
      },
    ]),
    env,
    identities.kasir,
  );
  const response = await pushCommands(
    commandRequest([
      {
        commandId: "order-payment-0010",
        type: "order.payment",
        entityId: "MLT-BAYAR-1",
        branchId: "melati",
        payload: { paid: 50000, paymentStatus: "Lunas", paymentMethod: "Tunai" },
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await response.json();
  assert.equal(
    body.results[0].accepted,
    true,
    `Pembayaran tidak boleh menuntut service.correct: ${JSON.stringify(body.results[0])}`,
  );
});

test("kebijakan tanpa service.payment tetap menolak pembayaran", async () => {
  const env = envWithDb();
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0011", "kasir@cuciin.id", ["service"], ["service.create", "service.correct"])]),
    env,
    identities.owner,
  );
  await pushCommands(
    commandRequest([
      {
        commandId: "nota-0011",
        type: "order.create",
        entityId: "MLT-BAYAR-2",
        branchId: "melati",
        payload: { id: "MLT-BAYAR-2", branchId: "melati", customerName: "Pelanggan Uji", phone: "0812", total: 50000, paid: 0, paymentStatus: "Belum lunas", paymentMethod: "Tunai", workStatus: "Masuk antrian", createdAt: 1, lines: [{ serviceId: "cuci-kiloan", serviceName: "Cuci kiloan", quantity: 5, unit: "kg", unitPrice: 10000 }] },
      },
    ]),
    env,
    identities.kasir,
  );
  const response = await pushCommands(
    commandRequest([
      {
        commandId: "order-payment-0011",
        type: "order.payment",
        entityId: "MLT-BAYAR-2",
        branchId: "melati",
        payload: { paid: 50000, paymentStatus: "Lunas", paymentMethod: "Tunai" },
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await response.json();
  assert.equal(body.results[0].accepted, false);
  assert.equal(body.results[0].code, 403);
});

test("absensi sendiri cukup dengan attendance.self tanpa attendance.view", async () => {
  const env = envWithDb();
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0012", "kasir@cuciin.id", ["attendance"], ["attendance.self"])]),
    env,
    identities.owner,
  );
  const response = await pushCommands(
    commandRequest([
      {
        commandId: "attendance-0012",
        type: "attendance.upsert",
        entityId: "absen-1",
        branchId: "melati",
        payload: { id: "absen-1", staffEmail: "kasir@cuciin.id", staffName: "Kasir Uji", workDate: "2026-09-20", checkInAtMs: 1, branchId: "melati" },
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await response.json();
  assert.equal(
    body.results[0].accepted,
    true,
    `Absen sendiri tidak boleh menuntut attendance.view: ${JSON.stringify(body.results[0])}`,
  );
});

test("jenis aset memakai inventory.type, bukan inventory.write", async () => {
  const env = envWithDb();
  await pushCommands(
    commandRequest([accessPolicyCommand("policy-0013", "kasir@cuciin.id", ["inventory"], ["inventory.write"])]),
    env,
    identities.owner,
  );
  const response = await pushCommands(
    commandRequest([
      {
        commandId: "assettype-0013",
        type: "assetType.upsert",
        entityId: "at-1",
        payload: { id: "at-1", name: "Mesin Cuci" },
      },
    ]),
    env,
    identities.kasir,
  );
  const body = await response.json();
  // Ditolak karena assetType.upsert ada di OWNER_ONLY, jadi yang diuji di sini adalah bahwa
  // penolakannya beralasan owner, bukan karena fungsi katalog yang salah dipetakan.
  assert.equal(body.results[0].accepted, false);
  assert.match(String(body.results[0].error ?? ""), /Owner/);
});
