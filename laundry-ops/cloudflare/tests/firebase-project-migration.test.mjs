/**
 * Uji penerimaan token Firebase selama masa peralihan identitas aplikasi.
 *
 * Selama rename paket, APK lama (project Firebase lama) dan APK baru (project
 * Firebase baru) harus sama-sama bisa memakai Worker yang sama. Yang diperiksa
 * di sini: daftar project dibaca dari konfigurasi, format lama tetap jalan, dan
 * token dari project yang tidak terdaftar tidak pernah diterima.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { firebaseProjectIds } from "../src/index.ts";

test("daftar project menerima format lama satu project", () => {
  assert.deepEqual(firebaseProjectIds({ FIREBASE_PROJECT_ID: "cuciin-ops" }), ["cuciin-ops"]);
});

test("daftar project memuat beberapa project saat masa peralihan", () => {
  assert.deepEqual(firebaseProjectIds({ FIREBASE_PROJECT_IDS: "cuciin-ops,cuciin-ops-tiftazani" }), [
    "cuciin-ops",
    "cuciin-ops-tiftazani",
  ]);
});

test("spasi dan koma berlebih tidak menghasilkan project kosong", () => {
  assert.deepEqual(firebaseProjectIds({ FIREBASE_PROJECT_IDS: " cuciin-ops , , cuciin-ops-tiftazani ," }), [
    "cuciin-ops",
    "cuciin-ops-tiftazani",
  ]);
});

test("FIREBASE_PROJECT_IDS diutamakan saat keduanya terisi", () => {
  assert.deepEqual(
    firebaseProjectIds({ FIREBASE_PROJECT_ID: "lama", FIREBASE_PROJECT_IDS: "baru,lama" }),
    ["baru", "lama"],
  );
});

test("tanpa konfigurasi tidak ada project yang diterima", () => {
  assert.deepEqual(firebaseProjectIds({}), []);
});

test("wrangler.toml memuat project baru dan lama selama peralihan", async () => {
  const { readFileSync } = await import("node:fs");
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(toml, /FIREBASE_PROJECT_IDS\s*=\s*"[^"]*\bcuciin-ops\b/);
  assert.match(toml, /FIREBASE_PROJECT_IDS\s*=\s*"[^"]*\bcuciin-ops-tiftazani\b/);
});
