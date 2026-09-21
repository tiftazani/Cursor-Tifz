/**
 * Login tidak boleh gagal hanya karena kuota tulis D1 habis.
 *
 * Kejadian nyata 2026-09-21: Owner kedua tidak bisa masuk sama sekali.
 * Token Firebase-nya sah dan sandinya benar, tetapi /v1/me menjawab 500
 * code 1101. Penyebabnya satu UPDATE kecil di authorize(): saat pertama kali
 * login, firebase_uid disambungkan ke baris staff. Cloudflare menolak tulis
 * itu karena kuota harian habis, exception menjalar ke atas, dan seluruh
 * login mati - padahal login kedua dan seterusnya (yang tidak butuh tulis)
 * berhasil, sehingga gejalanya tampak seperti "akun rusak".
 *
 * Tes ini mengunci janji itu: penyambungan firebase_uid adalah percepatan,
 * bukan syarat sahnya login.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { linkFirebaseUid, resolveStaff } from "../src/index.ts";

const MIGRATIONS = ["0001_initial.sql", "0002_firebase_identity.sql", "0003_command_sync.sql", "0004_operational_links.sql"];

/** D1 palsu di atas SQLite asli. `tolakTulis` meniru kuota tulis harian habis. */
function fakeD1({ tolakTulis = false } = {}) {
  const db = new DatabaseSync(":memory:");
  for (const file of MIGRATIONS) db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));

  const api = {
    DB: null,
    db,
    /** Bisa diubah di tengah tes untuk meniru kuota yang pulih tengah malam UTC. */
    tolakTulis,
    prepare(sql) {
      const entry = { sql, bound: [] };
      const statement = {
        bind(...values) {
          entry.bound = values;
          return statement;
        },
        first: async () => db.prepare(sql).get(...entry.bound),
        all: async () => ({ results: db.prepare(sql).all(...entry.bound) }),
        run: async () => {
          if (api.tolakTulis && /^\s*(UPDATE|INSERT|DELETE)/i.test(sql)) {
            const error = new Error("exceeded D1's free tier daily row write limit. wait until tomorrow (midnight UTC)");
            error.code = 7500;
            throw error;
          }
          db.prepare(sql).run(...entry.bound);
          return { success: true };
        },
      };
      return statement;
    },
  };
  api.DB = api;
  return api;
}

function seedStaff(env, { email, name = "Ustutifa", role = "Owner", uid = null }) {
  env.db
    .prepare("INSERT INTO organizations(id,name,owner_email,created_at,updated_at) VALUES(?,?,?,?,?)")
    .run("cuciin", "Cuciin", "tiftazani.khara@gmail.com", 1, 1);
  env.db
    .prepare("INSERT INTO staff(email,organization_id,name,role,approved,active,firebase_uid,updated_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(email, "cuciin", name, role, 1, 1, uid, 1);
}

test("kuota tulis habis: staff tetap ditemukan dan login dilanjutkan", async () => {
  const env = fakeD1({ tolakTulis: true });
  seedStaff(env, { email: "us.archuleta1207@gmail.com" });

  const staff = await resolveStaff(env, { sub: "uid-owner-kedua", email: "us.archuleta1207@gmail.com" });

  assert.ok(staff, "staff harus tetap ditemukan walau UPDATE firebase_uid ditolak kuota");
  assert.equal(staff.email, "us.archuleta1207@gmail.com");
  assert.equal(staff.role, "Owner");
});

test("kuota tulis habis: linkFirebaseUid melaporkan gagal tanpa melempar", async () => {
  const env = fakeD1({ tolakTulis: true });
  seedStaff(env, { email: "us.archuleta1207@gmail.com" });

  const tersambung = await linkFirebaseUid(env, "uid-owner-kedua", "us.archuleta1207@gmail.com");

  assert.equal(tersambung, false, "kegagalan dilaporkan lewat nilai balik, bukan exception");
});

test("kuota tulis normal: firebase_uid benar-benar tersambung", async () => {
  const env = fakeD1();
  seedStaff(env, { email: "us.archuleta1207@gmail.com" });

  const staff = await resolveStaff(env, { sub: "uid-owner-kedua", email: "us.archuleta1207@gmail.com" });

  assert.ok(staff);
  const row = env.db.prepare("SELECT firebase_uid FROM staff WHERE email=?").get("us.archuleta1207@gmail.com");
  assert.equal(row.firebase_uid, "uid-owner-kedua", "jalur normal tetap harus menyambungkan uid");
});

test("kuota tulis pulih: percobaan berikutnya menyambungkan uid", async () => {
  const env = fakeD1({ tolakTulis: true });
  seedStaff(env, { email: "us.archuleta1207@gmail.com" });
  await resolveStaff(env, { sub: "uid-owner-kedua", email: "us.archuleta1207@gmail.com" });

  // Kuota pulih tengah malam UTC.
  env.tolakTulis = false;

  await resolveStaff(env, { sub: "uid-owner-kedua", email: "us.archuleta1207@gmail.com" });
  const row = env.db.prepare("SELECT firebase_uid FROM staff WHERE email=?").get("us.archuleta1207@gmail.com");
  assert.equal(row.firebase_uid, "uid-owner-kedua");
});

test("email tidak dikenal tetap ditolak, bukan diloloskan", async () => {
  const env = fakeD1({ tolakTulis: true });
  seedStaff(env, { email: "us.archuleta1207@gmail.com" });

  const staff = await resolveStaff(env, { sub: "uid-penyusup", email: "penyusup@gmail.com" });

  assert.equal(staff, null, "penyerapan galat tidak boleh meloloskan akun yang tidak terdaftar");
});
