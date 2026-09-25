import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

/**
 * `wrangler d1 export` menulis pernyataan mengikuti urutan tabel di `sqlite_master`, bukan
 * urutan ketergantungan. Dua akibatnya, keduanya pernah mematikan mirror D1 pada 25 Sep 2026:
 *
 *   1. `CREATE TABLE products` muncul setelah `INSERT INTO services ... product_id`
 *      -> impor berhenti dengan "no such table: main.products".
 *   2. Baris induk ditulis setelah baris anak yang merujuknya
 *      -> impor berhenti dengan "FOREIGN KEY constraint failed".
 *
 * Karena skrip mirror membuang tabel cadangan sebelum mengimpor, impor yang gagal di tengah
 * meninggalkan cadangan KOSONG. Tes ini mengunci dua hal: perapian urutan, dan penolakan
 * berkas yang tidak bisa dijalankan ulang.
 *
 * Fixture `tests/support/export-messy-order.sql` sengaja ditulis dalam urutan yang merusak.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "..", "scripts", "reorder_d1_export.py");
const messy = path.join(here, "support", "export-messy-order.sql");

/** Jalankan perapi, kembalikan { status, stdout, stderr }. */
function runReorder(args) {
  try {
    const stdout = execFileSync("python3", [script, ...args], { encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    };
  }
}

test("export dengan urutan tabel kacau tetap lolos uji setelah dirapikan", () => {
  const result = runReorder([messy, "--check-only"]);
  assert.equal(result.status, 0, `perapi menolak export yang sah:\n${result.stderr}`);
  assert.match(result.stdout, /lolos uji/);
});

test("CREATE TABLE ditulis sebelum INSERT yang merujuknya", () => {
  const result = runReorder([messy]);
  assert.equal(result.status, 0, result.stderr);

  const sql = result.stdout;
  const createProducts = sql.indexOf('CREATE TABLE products');
  const insertServices = sql.indexOf('INSERT INTO "services"');
  assert.notEqual(createProducts, -1, "CREATE TABLE products hilang dari hasil");
  assert.notEqual(insertServices, -1, "INSERT INTO services hilang dari hasil");
  assert.ok(
    createProducts < insertServices,
    "CREATE TABLE products masih muncul setelah INSERT INTO services",
  );
});

test("baris induk ditulis sebelum baris anak yang merujuknya", () => {
  const result = runReorder([messy]);
  assert.equal(result.status, 0, result.stderr);
  const sql = result.stdout;

  // products -> services (services.product_id)
  const insertProducts = sql.indexOf('INSERT INTO "products"');
  const insertServices = sql.indexOf('INSERT INTO "services"');
  assert.ok(
    insertProducts < insertServices,
    "baris products masih ditulis setelah baris services yang merujuknya",
  );

  // branches -> orders (orders.branch_id)
  const insertBranches = sql.indexOf('INSERT INTO "branches"');
  const insertOrders = sql.indexOf('INSERT INTO "orders"');
  assert.ok(
    insertBranches < insertOrders,
    "baris branches masih ditulis setelah baris orders yang merujuknya",
  );
});

test("trigger tidak menyala saat data dimuat", () => {
  const result = runReorder([messy]);
  assert.equal(result.status, 0, result.stderr);
  const sql = result.stdout;

  // Trigger menjaga nilai, bukan mengubah data. Kalau ia dibuat sebelum baris
  // dimuat, baris lama yang belum tervalidasi bisa menggagalkan impor.
  const createTrigger = sql.indexOf("CREATE TRIGGER");
  const lastInsert = sql.lastIndexOf("INSERT INTO");
  assert.ok(
    createTrigger > lastInsert,
    "CREATE TRIGGER masih muncul sebelum baris data terakhir",
  );
});

test("berkas yang tidak bisa dijalankan ulang ditolak, bukan diteruskan", () => {
  // `INSERT` ke tabel yang tidak pernah dibuat: keadaan yang tidak bisa
  // diselamatkan dengan pengurutan apa pun.
  const broken = path.join(here, "support", "export-broken.sql");
  const result = runReorder([broken, "--check-only"]);
  assert.notEqual(result.status, 0, "berkas rusak seharusnya ditolak");
  assert.match(result.stderr, /tidak bisa dijalankan ulang/);
});
