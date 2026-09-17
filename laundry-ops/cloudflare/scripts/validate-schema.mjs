import { readFileSync, readdirSync } from "node:fs";

const migrations = new URL("../migrations/", import.meta.url);
const sql = readdirSync(migrations).filter(name => name.endsWith(".sql")).sort()
  .map(name => readFileSync(new URL(name, migrations), "utf8")).join("\n");
const commandSql = readFileSync(new URL("../migrations/0003_command_sync.sql", import.meta.url), "utf8");
const required = ["branches", "staff", "staff_branches", "services", "orders", "order_lines", "payments", "attendance", "products", "branch_stocks", "inventory_items", "asset_types", "access_roles", "expenses", "audit_logs", "sync_changes", "processed_commands", "access_policies", "whatsapp_templates"];
for (const table of required) {
  if (!new RegExp(`CREATE TABLE ${table}\\b`).test(sql)) throw new Error(`Tabel wajib belum ada: ${table}`);
}
if (/password|secret|api_key/i.test(sql)) throw new Error("Skema tidak boleh menyimpan kata sandi atau secret aplikasi.");
for (const required of ["request_hash","execution_token","result_json","branch_id","sync_command_guards","branch_stocks_nonnegative_update"]) {
  if (!new RegExp(`\\b${required}\\b`).test(commandSql)) throw new Error(`Migrasi command sync belum lengkap: ${required}`);
}
console.log(`Skema valid: ${required.length} tabel inti ditemukan.`);
