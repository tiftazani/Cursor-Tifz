/**
 * Harness uji untuk command sync Cuciin.
 *
 * Menyediakan D1 palsu di atas SQLite asli (node:sqlite) sehingga pernyataan SQL dari
 * src/command-sync.ts benar-benar dieksekusi, bukan hanya dicocokkan sebagai teks.
 * Ini penting untuk memeriksa hal yang hanya terlihat saat runtime: efek ON CONFLICT,
 * penjaga idempotensi, dan otorisasi akses per pengguna.
 */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = ["0001_initial.sql", "0002_firebase_identity.sql", "0003_command_sync.sql", "0004_operational_links.sql"];

export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  for (const file of MIGRATIONS) db.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), "utf8"));

  const executed = [];
  const pending = new Map(); // statement -> { sql, bound }

  const api = {
    DB: null, // diisi di bawah: command-sync memanggil env.DB.prepare(...)
    db,
    executed,
    prepare(sql) {
      const entry = { sql, bound: [] };
      const statement = {
        bind(...values) {
          entry.bound = values;
          return statement;
        },
        first: async () => db.prepare(sql).get(...entry.bound),
        all: async () => ({ results: db.prepare(sql).all(...entry.bound) }),
        run: async () => ({ success: true }),
      };
      pending.set(statement, entry);
      return statement;
    },
    /** D1 menjalankan batch dalam satu transaksi; kegagalan membatalkan seluruh batch. */
    async batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements) {
          const entry = pending.get(statement);
          if (!entry) continue;
          db.prepare(entry.sql).run(...entry.bound);
          executed.push(entry.sql);
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return statements.map(() => ({ success: true }));
    },
  };
  api.DB = api;
  return api;
}

export const identities = {
  owner: { email: "tiftazani.khara@gmail.com", name: "Tiftazani Khara", role: "Owner", branchIds: [], bootstrap: false },
  kasir: { email: "kasir@cuciin.id", name: "Kasir Melati", role: "Kasir", branchIds: ["melati"], bootstrap: false },
  kasirLain: { email: "rekan@cuciin.id", name: "Kasir Kenanga", role: "Kasir", branchIds: ["kenanga"], bootstrap: false },
  spv: { email: "spv@cuciin.id", name: "SPV Melati", role: "Supervisor", branchIds: ["melati"], bootstrap: false },
};

export function commandRequest(commands) {
  return new Request("https://cuciin.example/v1/sync/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
}

export function rows(env, sql, ...params) {
  return env.db.prepare(sql).all(...params);
}

export function seedBaseline(env) {
  env.db.exec(`
    INSERT OR IGNORE INTO organizations(id,name,owner_email,created_at,updated_at)
      VALUES('cuciin','Cuciin','tiftazani.khara@gmail.com',1,1);
    INSERT OR IGNORE INTO branches(id,organization_id,code,name,address,maps_query,updated_at)
      VALUES('melati','cuciin','MEL','Cuciin Melati','Jl. Melati 12','-6.9,107.6',1);
    INSERT OR IGNORE INTO branches(id,organization_id,code,name,address,maps_query,updated_at)
      VALUES('kenanga','cuciin','KEN','Cuciin Kenanga','Jl. Kenanga 3','-6.8,107.7',1);
    INSERT OR IGNORE INTO staff(email,organization_id,name,role,approved,active,updated_at)
      VALUES('kasir@cuciin.id','cuciin','Kasir Melati','Kasir',1,1,1);
    INSERT OR IGNORE INTO staff(email,organization_id,name,role,approved,active,updated_at)
      VALUES('rekan@cuciin.id','cuciin','Kasir Kenanga','Kasir',1,1,1);
    INSERT OR IGNORE INTO staff_branches(staff_email,branch_id) VALUES('kasir@cuciin.id','melati');
    INSERT OR IGNORE INTO staff_branches(staff_email,branch_id) VALUES('rekan@cuciin.id','kenanga');
  `);
}
