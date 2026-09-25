#!/usr/bin/env python3
"""Rapikan dan uji berkas export D1 sebelum diimpor ke database cadangan.

KENAPA BERKAS INI ADA
---------------------
`wrangler d1 export` menulis pernyataan mengikuti urutan tabel di `sqlite_master`,
bukan urutan ketergantungan. Dua akibatnya:

1. `CREATE TABLE products` bisa muncul SETELAH `INSERT INTO services ... product_id`,
   sehingga impor berhenti dengan `no such table: main.products`.
2. Baris induk bisa ditulis SETELAH baris anak yang merujuknya, sehingga impor
   berhenti dengan `FOREIGN KEY constraint failed`.

Berkas export membuka dengan `PRAGMA defer_foreign_keys=TRUE`, tetapi D1 tidak
menjalankan pragma itu untuk impor berkas, jadi pemeriksaan foreign key tetap
berjalan per pernyataan.

Impor yang berhenti di tengah berbahaya karena skrip mirror sudah lebih dulu
membuang seluruh tabel di database cadangan. Hasilnya bukan cuma gagal menyalin,
tetapi cadangan yang tadinya berisi menjadi kosong.

APA YANG DILAKUKAN
------------------
1. Memecah berkas menjadi pernyataan utuh memakai `sqlite3.complete_statement`,
   jadi titik koma di dalam string tidak salah dianggap pemisah.
2. Membaca ketergantungan foreign key dari setiap `CREATE TABLE`, lalu menyusun
   tabel secara topologis: tabel induk lebih dulu, tabel anak menyusul.
3. Menulis ulang berkas dalam urutan yang aman: PRAGMA, seluruh CREATE TABLE,
   INSERT per tabel mengikuti urutan ketergantungan, lalu CREATE INDEX dan
   CREATE TRIGGER di akhir supaya trigger tidak ikut menyala saat data dimuat.
4. Membuktikan hasilnya bisa dijalankan: seluruh pernyataan diputar ulang ke basis
   data SQLite di memori dengan `foreign_keys=ON`, satu pernyataan per transaksi
   (paling ketat, sama seperti D1), tanpa mengandalkan pragma penunda. Kalau ada
   satu saja yang gagal, skrip keluar dengan kode 1 dan database cadangan tidak
   pernah disentuh.

Dipakai oleh `mirror-d1.sh`, dan dijalankan SEBELUM tabel cadangan dibuang. Bisa
juga dipakai manual:

    python3 reorder_d1_export.py hasil-export.sql --out hasil-rapi.sql
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from collections import defaultdict

SCHEMA_TABLE = "CREATE TABLE"
SCHEMA_INDEX = ("CREATE INDEX", "CREATE UNIQUE INDEX")
SCHEMA_TRIGGER = "CREATE TRIGGER"
PRAGMA_PREFIX = "PRAGMA"

_TABLE_NAME = re.compile(
    r'^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`\[]?([A-Za-z_][A-Za-z_0-9]*)["`\]]?',
    re.IGNORECASE,
)
_INSERT_NAME = re.compile(
    r'^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["`\[]?([A-Za-z_][A-Za-z_0-9]*)["`\]]?',
    re.IGNORECASE,
)
_REFERENCES = re.compile(
    r'REFERENCES\s+["`\[]?([A-Za-z_][A-Za-z_0-9]*)["`\]]?',
    re.IGNORECASE,
)


def split_statements(sql: str) -> list[str]:
    """Pecah berkas menjadi pernyataan utuh memakai parser SQLite sendiri."""
    statements: list[str] = []
    buffer = ""
    for line in sql.splitlines(keepends=True):
        buffer += line
        if sqlite3.complete_statement(buffer):
            stripped = buffer.strip()
            if stripped:
                statements.append(stripped)
            buffer = ""
    leftover = buffer.strip()
    if leftover:
        statements.append(leftover)
    return statements


def classify(statement: str) -> str:
    head = statement.lstrip().upper()
    if head.startswith(PRAGMA_PREFIX):
        return "pragma"
    if head.startswith(SCHEMA_TABLE):
        return "table"
    if head.startswith(SCHEMA_INDEX):
        return "index"
    if head.startswith(SCHEMA_TRIGGER):
        return "trigger"
    if _INSERT_NAME.match(statement):
        return "insert"
    return "other"


def table_of_insert(statement: str) -> str | None:
    match = _INSERT_NAME.match(statement)
    return match.group(1) if match else None


def parent_tables(statement: str) -> set[str]:
    """Tabel yang dirujuk foreign key di dalam sebuah CREATE TABLE."""
    return set(_REFERENCES.findall(statement))


def topo_order(tables: list[str], edges: dict[str, set[str]]) -> list[str]:
    """Urutkan tabel: induk sebelum anak.

    Ketergantungan yang membentuk siklus tidak mungkin dipenuhi dengan urutan apa
    pun. Sisa tabel seperti itu dikembalikan di akhir dengan urutan aslinya, dan
    PRAGMA defer_foreign_keys yang tetap ditulis di awal berkas menjadi jaring
    pengaman bila D1 menghormatinya.
    """
    remaining = list(tables)
    ordered: list[str] = []
    placed: set[str] = set()

    while remaining:
        ready = [t for t in remaining if not (edges.get(t, set()) - placed - {t})]
        if not ready:
            ordered.extend(remaining)
            break
        for name in ready:
            ordered.append(name)
            placed.add(name)
            remaining.remove(name)

    return ordered


def reorder(statements: list[str]) -> list[str]:
    pragmas: list[str] = []
    creates: list[str] = []
    inserts: dict[str, list[str]] = defaultdict(list)
    trailing: list[str] = []
    others: list[str] = []

    for statement in statements:
        kind = classify(statement)
        if kind == "pragma":
            pragmas.append(statement)
        elif kind == "table":
            creates.append(statement)
        elif kind == "insert":
            inserts[table_of_insert(statement) or ""].append(statement)
        elif kind in ("index", "trigger"):
            trailing.append(statement)
        else:
            others.append(statement)

    table_names: list[str] = []
    edges: dict[str, set[str]] = {}
    for statement in creates:
        match = _TABLE_NAME.match(statement)
        if not match:
            continue
        name = match.group(1)
        table_names.append(name)
        edges[name] = parent_tables(statement)

    known = set(table_names)
    ordered_tables = topo_order(table_names, edges)

    # Tabel yang tidak punya CREATE TABLE (mis. sqlite_sequence) menyusul di akhir.
    loose = [name for name in inserts if name not in known]

    result: list[str] = []
    result.extend(pragmas)
    result.extend(creates)
    for name in ordered_tables:
        result.extend(inserts.get(name, []))
    for name in sorted(loose):
        result.extend(inserts[name])
    result.extend(others)
    result.extend(trailing)
    return result


def replay_strict(statements: list[str]) -> tuple[bool, int, str]:
    """Jalankan pernyataan satu per satu dalam autocommit, foreign key ditegakkan.

    Ini tiruan paling dekat dengan cara D1 menjalankan berkas impor: setiap
    pernyataan berdiri sendiri, dan `PRAGMA defer_foreign_keys` diabaikan.
    """
    conn = sqlite3.connect(":memory:")
    conn.isolation_level = None
    conn.execute("PRAGMA foreign_keys=ON")
    executed = 0
    for index, statement in enumerate(statements):
        if statement.lstrip().upper().startswith(PRAGMA_PREFIX):
            # D1 tidak menjalankan pragma dari berkas impor; ikut diabaikan di sini.
            executed += 1
            continue
        try:
            conn.execute(statement)
            executed += 1
        except sqlite3.Error as error:
            head = statement.strip().splitlines()[0][:160]
            conn.close()
            return False, executed, f"pernyataan #{index}: {error}\n    {head}"

    violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    conn.close()
    if violations:
        table, rowid, parent = violations[0]
        return (
            False,
            executed,
            f"{len(violations)} baris melanggar foreign key; contoh: "
            f"tabel={table} rowid={rowid} induk={parent}",
        )
    return True, executed, ""


def write_output(statements: list[str], path: str | None) -> None:
    # Tiap pernyataan sudah berakhir dengan ';' dari pemecahan di atas. Titik koma
    # itu dibuang dulu supaya penyambungan tidak menghasilkan ';;' yang ditolak D1
    # dengan "SQL code did not contain a statement".
    cleaned = [s.rstrip().rstrip(";").rstrip() for s in statements]
    output = ";\n".join(cleaned) + ";\n"
    if path:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(output)
    else:
        sys.stdout.write(output)


def main() -> int:
    parser = argparse.ArgumentParser(description="Rapikan berkas export D1 sebelum diimpor")
    parser.add_argument("source", help="berkas SQL hasil `wrangler d1 export`")
    parser.add_argument("--out", help="tulis hasil rapi ke berkas ini, bukan ke stdout")
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="hanya uji, jangan tulis berkas apa pun",
    )
    args = parser.parse_args()

    with open(args.source, encoding="utf-8", errors="replace") as handle:
        sql = handle.read()

    statements = split_statements(sql)
    if not statements:
        print("GALAT: berkas export tidak berisi pernyataan apa pun", file=sys.stderr)
        return 1

    ordered = reorder(statements)

    ok, executed, message = replay_strict(ordered)
    if not ok:
        print("GALAT: hasil export tidak bisa dijalankan ulang.", file=sys.stderr)
        print(f"  {message}", file=sys.stderr)
        print(
            "  Database cadangan TIDAK boleh disentuh. Periksa database produksi "
            "atau versi wrangler yang dipakai.",
            file=sys.stderr,
        )
        return 1

    tables = sum(1 for s in ordered if classify(s) == "table")
    inserts = sum(1 for s in ordered if classify(s) == "insert")
    print(
        f"  export lolos uji: {executed} pernyataan "
        f"({tables} tabel, {inserts} baris data, {executed - tables - inserts} lainnya)"
    )

    if args.check_only:
        return 0

    write_output(ordered, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
