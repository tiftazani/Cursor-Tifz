"""Hitung baris semua tabel cuciin-db produksi.

Catatan yang memakan waktu:
- Nama tabel WAJIB dikutip backtick: `asset_types` bertabrakan dengan kata kunci SQL.
- `wrangler d1 execute --file` pada mode `--remote` hanya melaporkan ringkasan
  ("Total queries executed"), HASIL SELECT-nya hilang. Jadi pakai `--command`.
- D1 menolak `UNION ALL` berisi banyak term ("too many terms in compound SELECT"),
  jadi tabel dihitung satu per satu.
"""
import json
import subprocess
import sys
from pathlib import Path

CF = Path("/Users/tiftazani/Documents/ChatGPT/Laundry/Cursor-Tifz/laundry-ops/cloudflare")
TABEL = [
    "access_policies", "access_roles", "asset_types", "attendance", "audit_logs",
    "branch_stocks", "branches", "cash_closes", "customers", "expenses",
    "inventory_items", "order_lines", "orders", "organizations", "payments",
    "processed_commands", "products", "services", "staff", "staff_branches",
    "stock_moves", "sync_changes", "sync_command_guards", "sync_snapshots",
    "whatsapp_templates",
]


def kueri(sql: str, db: str = "cuciin-db", remote: bool = True) -> list:
    """Kembalikan list baris hasil SELECT, atau lempar bila D1 menolak."""
    cmd = ["npx", "--no-install", "wrangler", "d1", "execute", db, "--json", "--command", sql]
    if remote:
        cmd.insert(5, "--remote")
    out = subprocess.run(cmd, cwd=CF, capture_output=True, text=True, timeout=180).stdout
    awal = out.find("[")
    if awal < 0:
        raise SystemExit(f"D1 gagal: {out[:300]}")
    d = json.loads(out[awal:])
    return d[0]["results"]


def hitung(db: str = "cuciin-db", remote: bool = True) -> dict:
    hasil = {}
    for t in TABEL:
        rows = kueri(f"SELECT COUNT(*) AS n FROM `{t}`;", db, remote)
        nilai = list(rows[0].values())[0]
        hasil[t] = int(nilai)
    return hasil


if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else "cuciin-db"
    hasil = hitung(db)
    print(f"  {'TABEL':<24}{'BARIS':>8}")
    for t, n in sorted(hasil.items(), key=lambda x: -x[1]):
        print(f"  {t:<24}{n:>8}")
    print(f"\n  TOTAL baris: {sum(hasil.values())}")
