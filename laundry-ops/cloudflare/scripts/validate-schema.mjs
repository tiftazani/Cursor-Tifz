import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");
const required = ["branches", "staff", "staff_branches", "services", "orders", "order_lines", "attendance", "products", "branch_stocks", "inventory_items", "expenses", "audit_logs", "sync_changes", "processed_commands"];
for (const table of required) {
  if (!new RegExp(`CREATE TABLE ${table}\\b`).test(sql)) throw new Error(`Tabel wajib belum ada: ${table}`);
}
if (/password|secret|api_key/i.test(sql)) throw new Error("Skema tidak boleh menyimpan kata sandi atau secret aplikasi.");
console.log(`Skema valid: ${required.length} tabel inti ditemukan.`);
