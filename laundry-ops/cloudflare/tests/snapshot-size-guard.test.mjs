import assert from "node:assert/strict";
import test from "node:test";
import worker, { materializedSnapshot, snapshotSizeLevel, warnSnapshotSize } from "../src/index.ts";
import { fakeD1, seedBaseline } from "./support/d1-harness.mjs";

/**
 * Penjaga ukuran snapshot.
 *
 * `sync_snapshots.payload_json` menyimpan seluruh state organisasi dalam satu baris
 * dan sudah mencapai 3,4 MB pada 10 Okt 2026. Ukuran itu tidak melanggar batas apa
 * pun di jalur GET, tetapi ia menekan batas 4 MB milik `MAX_BODY_BYTES`, mendekatkan
 * waktu baca 12 detik di perangkat, dan memecah diri jadi puluhan pernyataan saat
 * di-mirror ke D1 cadangan. Penjaga di bawah hanya MELAPORKAN — GET tidak boleh
 * pernah diubah olehnya.
 *
 * Ambangnya 2 MB (peringatan) dan 3,2 MB (kritis), 50% dan 80% dari MAX_BODY_BYTES.
 */

const SNAPSHOT_WARN_BYTES = 2_000_000;
const SNAPSHOT_CRITICAL_BYTES = 3_200_000;

/** D1 palsu dengan basis data siap pakai, sama seperti tes lain. */
function setup() {
  const env = fakeD1();
  seedBaseline(env);
  env.SYNC_SECRET = "synthetic-fixture-only";
  return env;
}

/** GET /v1/snapshot dengan identitas bootstrap Owner (tembus tanpa saringan). */
function getSnapshot(env) {
  return worker.fetch(new Request("https://synthetic.test/v1/snapshot", {
    headers: { "x-cuciin-key": env.SYNC_SECRET },
  }), env);
}

/** GET /health, tidak terautentikasi, berdiri sendiri sebelum authorize(). */
function getHealth(env) {
  return worker.fetch(new Request("https://synthetic.test/health"), env);
}

/** Simpan `payload_json` langsung ke cache, tanpa lewat journal. */
function seedSnapshotRow(env, payload) {
  env.db.prepare(
    "INSERT INTO sync_snapshots(organization_id,revision,payload_json,updated_at) VALUES('cuciin',?,?,?)",
  ).run(1, payload, 1);
}

/** Tangkap console.warn / console.error, kembalikan pemulihnya. */
function captureConsole() {
  const originalWarn = console.warn;
  const originalError = console.error;
  const warns = [];
  const errors = [];
  console.warn = (...args) => warns.push(args);
  console.error = (...args) => errors.push(args);
  return {
    warns,
    errors,
    restore() {
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}

// ---------------------------------------------------------------------------
// Ambang
// ---------------------------------------------------------------------------

test("snapshotSizeLevel membagi ambang peringatan dan kritis", () => {
  assert.equal(snapshotSizeLevel(0), "ok");
  assert.equal(snapshotSizeLevel(1_999_999), "ok");
  assert.equal(snapshotSizeLevel(SNAPSHOT_WARN_BYTES), "warn");
  assert.equal(snapshotSizeLevel(3_199_999), "warn");
  assert.equal(snapshotSizeLevel(SNAPSHOT_CRITICAL_BYTES), "critical");
  assert.equal(snapshotSizeLevel(4_000_000), "critical");
});

test("penjaga ukuran tidak bersuara di bawah ambang", () => {
  const capture = captureConsole();
  try {
    assert.equal(warnSnapshotSize(1_000), "ok");
    assert.deepEqual(capture.warns, []);
    assert.deepEqual(capture.errors, []);
  } finally {
    capture.restore();
  }
});

test("peringatan memakai console.warn, keadaan kritis memakai console.error", () => {
  const capture = captureConsole();
  try {
    assert.equal(warnSnapshotSize(2_500_000), "warn");
    assert.equal(capture.warns.length, 1);
    assert.equal(capture.errors.length, 0);
    assert.match(String(capture.warns[0][0]), /snapshot_size_warn/);
    assert.match(String(capture.warns[0][0]), /bytes=2500000/);

    assert.equal(warnSnapshotSize(3_500_000), "critical");
    assert.equal(capture.warns.length, 1, "keadaan kritis tidak ikut memakai console.warn");
    assert.equal(capture.errors.length, 1);
    assert.match(String(capture.errors[0][0]), /snapshot_size_critical/);
    assert.match(String(capture.errors[0][0]), /bytes=3500000/);
  } finally {
    capture.restore();
  }
});

// ---------------------------------------------------------------------------
// GET snapshot tidak boleh diubah oleh penjaga
// ---------------------------------------------------------------------------

test("penjaga yang melempar tidak boleh menggagalkan GET snapshot", async () => {
  const env = setup();
  const originalWarn = console.warn;
  try {
    // Ukuran di bawah ambang tidak memanggil console.warn sama sekali, jadi paksa
    // lewat ambang kritis supaya jalur peringatannya benar-benar tersentuh.
    seedSnapshotRow(env, JSON.stringify({
      syncRevision: 0,
      updatedAt: 1,
      audit: [{ id: "a", note: "x".repeat(SNAPSHOT_CRITICAL_BYTES) }],
    }));
    console.warn = () => {
      throw new Error("SIMULASI_PENJAGA_RUSAK");
    };
    const response = await getSnapshot(env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.audit), "badan GET tetap terbaca meski penjaga melempar");
  } finally {
    console.warn = originalWarn;
    env.db.close();
  }
});

test("GET snapshot tetap utuh saat ukuran melewati ambang kritis", async () => {
  const env = setup();
  const capture = captureConsole();
  try {
    const big = {
      syncRevision: 0,
      updatedAt: 1,
      audit: [{ id: "a", note: "x".repeat(SNAPSHOT_CRITICAL_BYTES) }],
    };
    seedSnapshotRow(env, JSON.stringify(big));
    const response = await getSnapshot(env);
    assert.equal(response.status, 200);
    assert.equal(capture.errors.length, 1);
    assert.match(String(capture.errors[0][0]), /snapshot_size_critical/);

    const body = await response.json();
    const snapshot = (await materializedSnapshot(env)).snapshot;
    assert.deepEqual(Object.keys(body).sort(), Object.keys(snapshot).sort());
  } finally {
    capture.restore();
    env.db.close();
  }
});

test("GET snapshot tidak menambah field apa pun ke bentuk JSON", async () => {
  const env = setup();
  try {
    seedSnapshotRow(env, JSON.stringify({
      syncRevision: 0,
      updatedAt: 1,
      branches: [{ id: "melati" }],
      staff: [{ email: "kasir@cuciin.id", name: "Kasir" }],
    }));
    const response = await getSnapshot(env);
    assert.equal(response.status, 200);
    const body = await response.json();

    // snapshotBytes milik /health, bukan milik snapshot. Kalau kunci ini sampai
    // bocor ke badan snapshot, klien Android menerimanya sebagai data bisnis.
    assert.ok(!("snapshotBytes" in body), "snapshotBytes tidak boleh masuk snapshot");
    assert.ok(!("snapshotBytesLevel" in body), "snapshotBytesLevel tidak boleh masuk snapshot");

    const snapshot = (await materializedSnapshot(env)).snapshot;
    assert.deepEqual(Object.keys(body).sort(), Object.keys(snapshot).sort());
  } finally {
    env.db.close();
  }
});

// ---------------------------------------------------------------------------
// /health
// ---------------------------------------------------------------------------

test("health melaporkan snapshotBytes dalam byte UTF-8, bukan jumlah karakter", async () => {
  const env = setup();
  try {
    // Karakter non-ASCII: `é` satu karakter tapi dua byte. Kalau /health memakai
    // `length(payload_json)`, angkanya akan lebih kecil dari ukuran sebenarnya —
    // kelas bug yang sama dengan yang pernah menimpa skrip mirror D1.
    const payload = JSON.stringify({ syncRevision: 0, updatedAt: 1, note: "é".repeat(50) });
    seedSnapshotRow(env, payload);

    const response = await getHealth(env);
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.equal(body.snapshotBytes, Buffer.byteLength(payload, "utf8"));
    assert.notEqual(body.snapshotBytes, payload.length);
  } finally {
    env.db.close();
  }
});

test("health tetap ok:true dan mempertahankan field lama", async () => {
  const env = setup();
  try {
    env.db.prepare(
      "INSERT INTO sync_changes(organization_id,sequence,entity_type,entity_id,operation,payload_json,updated_at) VALUES('cuciin',7,'nota','order-a','upsert','{}',1)",
    ).run();
    const response = await getHealth(env);
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.equal(body.ok, true);
    assert.equal(body.service, "cuciin-api");
    assert.equal(body.database, "ready");
    assert.equal(body.revision, 7);
    assert.equal(typeof body.snapshotBytes, "number");
    assert.equal(typeof body.snapshotBytesLevel, "string");
  } finally {
    env.db.close();
  }
});

test("health tanpa baris sync_snapshots melaporkan 0", async () => {
  const env = setup();
  try {
    const response = await getHealth(env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.snapshotBytes, 0);
    assert.equal(body.snapshotBytesLevel, "ok");
  } finally {
    env.db.close();
  }
});

test("health menandai tingkat sama seperti penjaga Worker", async () => {
  const env = setup();
  try {
    const payload = JSON.stringify({ syncRevision: 0, updatedAt: 1, note: "é".repeat(50) });
    seedSnapshotRow(env, payload);
    const body = await (await getHealth(env)).json();
    assert.equal(body.snapshotBytesLevel, snapshotSizeLevel(body.snapshotBytes));
    assert.equal(body.snapshotBytesLevel, "ok");
  } finally {
    env.db.close();
  }
});
