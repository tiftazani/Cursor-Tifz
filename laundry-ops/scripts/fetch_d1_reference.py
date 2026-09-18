#!/usr/bin/env python3
"""Mengambil daftar entitas yang sudah ada di D1 untuk acuan konversi template.

Hasilnya dipakai `import_template_to_d1.py` supaya kode atau nama yang sudah terdaftar
tidak dibuat ulang, dan supaya role bawaan bisa dirujuk dari Excel.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

WRANGLER = ["npx", "--no-install", "wrangler"]


def query(config: str | None, database: str, sql: str) -> list[dict]:
    command = WRANGLER + ["d1", "execute", database, "--remote", "--command", sql, "--json"]
    if config:
        command += ["--config", config]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"gagal membaca {database}: {result.stderr.strip()[:400]}")
    payload = json.loads(result.stdout)
    return payload[0]["results"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Ambil acuan entitas dari D1")
    parser.add_argument("--out", required=True, help="Berkas .known.json")
    parser.add_argument("--database", default="cuciin-debug-db")
    parser.add_argument("--config", default=None, help="wrangler config, misalnya wrangler.debug.toml")
    args = parser.parse_args()

    branches = query(args.config, args.database, "SELECT id, code, name FROM branches;")
    products = query(args.config, args.database, "SELECT id, name FROM products;")
    asset_types = query(args.config, args.database, "SELECT id, code FROM asset_types;")
    roles = query(args.config, args.database, "SELECT id, name FROM access_roles;")
    staff = query(args.config, args.database, "SELECT email FROM staff;")
    services = query(args.config, args.database, "SELECT name FROM services;")

    branch_map: dict[str, str] = {}
    for row in branches:
        branch_map[str(row["code"]).upper()] = row["id"]
        branch_map[str(row["id"]).upper()] = row["id"]

    product_map: dict[str, str] = {}
    for row in products:
        product_map[str(row["name"]).upper()] = row["id"]
        product_map[str(row["id"]).upper()] = row["id"]

    type_map = {str(row["code"]).upper(): row["id"] for row in asset_types}
    role_map = {str(row["name"]).lower(): row["id"] for row in roles}

    payload = {
        "branches": branch_map,
        "products": product_map,
        "assetTypes": type_map,
        "roles": role_map,
        "staff": [row["email"] for row in staff],
        "services": [row["name"] for row in services],
    }
    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # Berkas layanan dipakai terpisah supaya konverter tetap sederhana.
    services_path = Path(args.out).with_suffix(".services.json")
    services_path.write_text(json.dumps(payload["services"], ensure_ascii=False), encoding="utf-8")

    print(json.dumps({
        "out": args.out,
        "cabang": len(branches),
        "produk": len(products),
        "jenisAset": len(asset_types),
        "role": len(roles),
        "karyawan": len(staff),
        "layanan": len(services),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
