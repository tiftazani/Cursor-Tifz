import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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
 *
 * Sejak 13 Okt 2026 ada satu batas lagi yang tidak terlihat di SQLite lokal: D1 menolak
 * pernyataan di atas 100.000 byte (`statement too long: SQLITE_TOOBIG`). `sync_snapshots.payload_json`
 * menyimpan seluruh state organisasi dalam satu baris, dan pada 10 Okt 2026 baris itu 3,4 MB.
 * Perapi karena itu juga memecah `INSERT` panjang; tes di bawah mengunci hasil pecahannya.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "..", "scripts", "reorder_d1_export.py");
const messy = path.join(here, "support", "export-messy-order.sql");

/** Batas pernyataan D1 adalah 100.000 byte; perapi memakai anggaran yang lebih ketat. */
const STATEMENT_BUDGET = 90_000;

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

// ---------------------------------------------------------------------------
// Batas panjang pernyataan D1 (100.000 byte)
// ---------------------------------------------------------------------------

const longStatement = path.join(here, "support", "export-long-statement.sql");

/** Jalankan perapi ke berkas sementara dan kembalikan isinya. */
function reorderToFile(source) {
  const dir = mkdtempSync(path.join(tmpdir(), "cuciin-reorder-"));
  const out = path.join(dir, "rapi.sql");
  try {
    const result = runReorder([source, "--out", out]);
    assert.equal(result.status, 0, result.stderr);
    return readFileSync(out, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Pecah berkas jadi pernyataan, sadar kutip tunggal dan komentar. Sama seperti
 * `split_statements` di perapi: titik koma di dalam string atau di dalam komentar
 * `--`/`/* *​/` bukan pemisah.
 */
function splitStatements(sql) {
  const statements = [];
  let buffer = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (inLineComment) {
      buffer += char;
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      buffer += char;
      if (char === "*" && sql[i + 1] === "/") {
        buffer += sql[i + 1];
        i += 1;
        inBlockComment = false;
      }
      continue;
    }
    if (inString) {
      buffer += char;
      if (char !== "'") continue;
      if (sql[i + 1] === "'") {
        buffer += sql[i + 1];
        i += 1;
        continue;
      }
      inString = false;
      continue;
    }
    if (char === "-" && sql[i + 1] === "-") {
      buffer += char + sql[i + 1];
      i += 1;
      inLineComment = true;
      continue;
    }
    if (char === "/" && sql[i + 1] === "*") {
      buffer += char + sql[i + 1];
      i += 1;
      inBlockComment = true;
      continue;
    }
    buffer += char;
    if (char === "'") {
      inString = true;
    } else if (char === ";") {
      const statement = buffer.trim();
      if (statement && statement !== ";") statements.push(statement);
      buffer = "";
    }
  }
  const tail = buffer.trim();
  if (tail) statements.push(tail);
  return statements;
}

/**
 * Jalankan berkas ke SQLite di memori, satu pernyataan per giliran, foreign key aktif —
 * tiruan terdekat cara D1 menjalankan impor. PRAGMA dari berkas diabaikan karena D1
 * juga mengabaikannya.
 */
function replay(sql) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  let executed = 0;
  for (const statement of splitStatements(sql)) {
    if (statement.trimStart().toUpperCase().startsWith("PRAGMA")) continue;
    db.exec(statement);
    executed += 1;
  }
  return { db, executed };
}

/** Seluruh tabel beserta barisnya, untuk membandingkan dua basis data. */
function snapshot(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map(row => row.name);
  return Object.fromEntries(
    tables.map(name => {
      const rows = db.prepare(`SELECT * FROM "${name}"`).all();
      return [name, rows.map(row => JSON.stringify(row))];
    }),
  );
}

test("pernyataan di atas batas D1 dipecah, tidak diteruskan apa adanya", () => {
  const result = runReorder([longStatement, "--check-only"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /pernyataan panjang dipecah/);
});

test("tidak ada pernyataan hasil perapian yang melewati batas D1", () => {
  const sql = reorderToFile(longStatement);
  const sizes = splitStatements(sql).map(statement => Buffer.byteLength(statement, "utf8"));
  assert.ok(sizes.length > 1, "pernyataan panjang seharusnya menghasilkan banyak pernyataan");
  const longest = Math.max(...sizes);
  assert.ok(
    longest <= 100_000,
    `masih ada pernyataan ${longest} byte; D1 menolaknya dengan SQLITE_TOOBIG`,
  );
});

test("batas dihitung per byte, bukan per karakter", () => {
  // Fixture memuat karakter non-ASCII. Kalau perapi memecah berdasarkan jumlah
  // karakter, potongannya akan tetap di atas batas dalam byte dan gagal di D1
  // walaupun terlihat aman dari sisi Python.
  const sql = reorderToFile(longStatement);
  const longest = Math.max(...splitStatements(sql).map(s => Buffer.byteLength(s, "utf8")));
  const characters = Math.max(
    ...splitStatements(sql).map(s => s.length),
  );
  assert.ok(
    longest <= STATEMENT_BUDGET,
    `pernyataan terpanjang ${longest} byte, di atas anggaran ${STATEMENT_BUDGET} byte`,
  );
  assert.notEqual(
    longest,
    characters,
    "jumlah byte sama dengan jumlah karakter; fixture seharusnya memuat teks non-ASCII",
  );
});

test("isi baris panjang utuh setelah dipecah dan dijalankan ulang", () => {
  // Perbandingan langsung: berkas asli dijalankan apa adanya ke satu basis data,
  // hasil perapian ke basis data lain, lalu seluruh tabel dibandingkan baris per
  // baris. Ini membuktikan potongan-potongan `UPDATE ... || …` menyusun kembali
  // kolom teks dengan panjang dan isi yang sama.
  const original = replay(readFileSync(longStatement, "utf8"));
  const reordered = replay(reorderToFile(longStatement));

  assert.deepEqual(snapshot(reordered.db), snapshot(original.db));

  const payload = reordered.db
    .prepare("SELECT payload_json AS v FROM sync_snapshots")
    .get().v;
  assert.equal(payload.length, 70_100, "panjang isi kolom teks berubah");
});

test("nilai sqlite_sequence tidak terhapus oleh DELETE di akhir berkas export", () => {
  // `wrangler d1 export` menutup berkas dengan `DELETE FROM sqlite_sequence;` lalu
  // menulis ulang nilai penghitungnya. Kalau perapi memindahkan DELETE itu ke akhir
  // berkas, ia menghapus nilai yang baru saja dimuat dan kolom AUTOINCREMENT
  // (`sync_changes.id`) memulai lagi dari 1 pada database cadangan.
  const sql = reorderToFile(longStatement);
  const deleteAt = sql.indexOf("DELETE FROM sqlite_sequence");
  const insertAt = sql.indexOf('INSERT INTO "sqlite_sequence"');
  assert.notEqual(deleteAt, -1, "DELETE FROM sqlite_sequence hilang dari hasil");
  assert.notEqual(insertAt, -1, "INSERT INTO sqlite_sequence hilang dari hasil");
  assert.ok(
    deleteAt < insertAt,
    "DELETE FROM sqlite_sequence masih muncul setelah nilai penghitungnya ditulis",
  );

  const { db } = replay(sql);
  const sequence = db
    .prepare("SELECT seq FROM sqlite_sequence WHERE name = 'sync_changes'")
    .get();
  assert.equal(sequence?.seq, 2, "nilai sqlite_sequence tidak bertahan");
});

// ---------------------------------------------------------------------------
// Laporan pertumbuhan nilai kolom (13 Okt 2026)
// ---------------------------------------------------------------------------

/**
 * Baca ukuran byte dan jumlah potongan sebuah kolom dari keluaran perapi.
 * Bentuk barisnya: `    sync_snapshots.payload_json  130100 byte  ->  2 potongan @80000 byte`.
 */
function parseColumnLine(stdout, column) {
  const escaped = column.replace(".", "\.");
  const match = stdout.match(
    new RegExp(`${escaped}\\s+(\\d+) byte\\s+->\\s+(\\d+) potongan`),
  );
  assert.ok(match, `baris ${column} tidak ditemukan:\n${stdout}`);
  return { bytes: Number(match[1]), chunks: Number(match[2]) };
}

test("perapi melaporkan nilai kolom terbesar dan proyeksi potongannya", () => {
  const result = runReorder([longStatement, "--check-only"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /nilai kolom terbesar/);
  assert.match(result.stdout, /sync_snapshots\.payload_json/);
  assert.match(result.stdout, /potongan/);
  assert.match(result.stdout, /proyeksi: nilai terbesar/);
});

test("angka potongan dihitung dari CHUNK_BYTES, bukan dari jumlah karakter", () => {
  // Fixture memuat karakter non-ASCII: 70.100 karakter tapi 130.100 byte.
  // Kalau perapi menghitung karakter, `ceil(70100/80000)` = 1 potongan — angka
  // yang menenangkan padahal aslinya butuh 2. Ukuran nyata yang diterima D1
  // adalah byte, dan `CHUNK_BYTES` juga berbasis byte.
  const result = runReorder([longStatement, "--check-only"]);
  assert.equal(result.status, 0, result.stderr);
  const { bytes, chunks } = parseColumnLine(result.stdout, "sync_snapshots.payload_json");

  assert.equal(bytes, 130_100, "ukuran byte nilai kolom berubah");
  assert.equal(chunks, Math.ceil(bytes / 80_000), "jumlah potongan bukan ceil(byte / CHUNK_BYTES)");
  assert.equal(chunks, 2, "130.100 byte seharusnya jadi 2 potongan @80.000 byte");
  assert.ok(bytes > 70_100, "fixture seharusnya memuat teks non-ASCII sehingga byte > karakter");
});

/** Tulis export sintetis dengan satu kolom seukuran `bytes` ke berkas sementara. */
function writeBigColumnFixture(bytes) {
  const dir = mkdtempSync(path.join(tmpdir(), "cuciin-growth-"));
  const out = path.join(dir, "besar.sql");
  const sql = [
    "PRAGMA defer_foreign_keys=TRUE;",
    "CREATE TABLE organizations (",
    "  id TEXT PRIMARY KEY,",
    "  name TEXT NOT NULL",
    ");",
    `INSERT INTO "organizations" ("id","name") VALUES('cuciin','${"x".repeat(bytes)}');`,
  ].join("\n");
  writeFileSync(out, sql, "utf8");
  return { dir, out };
}

test("laporan pertumbuhan tidak menggagalkan mirror", () => {
  // Ambang PERINGATAN 1 MB. Ia harus berbunyi, tetapi kode keluar tetap 0:
  // kalau sekadar membesar saja sudah mematikan mirror, kegagalan 13 Okt 2026
  // tinggal berpindah tempat. Hanya penjaga STATEMENT_BUDGET yang boleh balik 1.
  const { dir, out } = writeBigColumnFixture(1_200_000);
  try {
    const result = runReorder([out, "--check-only"]);
    assert.equal(result.status, 0, `pertumbuhan kolom menggagalkan mirror:\n${result.stderr}`);
    assert.match(result.stdout, /PERINGATAN/);
    assert.match(result.stdout, /organizations\.name/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("nilai kolom besar memunculkan peringatan tanpa menaikkan kode keluar", () => {
  const { dir, out } = writeBigColumnFixture(1_200_000);
  try {
    const result = runReorder([out, "--check-only"]);
    assert.equal(result.status, 0);
    // Baris peringatan menyebut ambangnya, supaya bisa dicari di log Actions.
    assert.match(result.stdout, /PERINGATAN: organizations\.name 1200000 byte melewati ambang waspada 1000000 byte/);
    assert.doesNotMatch(result.stdout, /BAHAYA/);
    // Ukuran kolom diukur sebelum dipecah, jadi angkanya 1,2 juta byte — bukan
    // 80.000 byte seperti yang terlihat dari panjang pernyataan hasil pecahan.
    const { bytes, chunks } = parseColumnLine(result.stdout, "organizations.name");
    assert.equal(bytes, 1_200_000);
    assert.equal(chunks, 15);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

