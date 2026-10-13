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
4. Memecah `INSERT` yang terlalu panjang menjadi beberapa `INSERT`/`UPDATE` kecil
   (lihat di bawah).
5. Membuktikan hasilnya bisa dijalankan: seluruh pernyataan diputar ulang ke basis
   data SQLite di memori dengan `foreign_keys=ON`, satu pernyataan per transaksi
   (paling ketat, sama seperti D1), tanpa mengandalkan pragma penunda. Kalau ada
   satu saja yang gagal, skrip keluar dengan kode 1 dan database cadangan tidak
   pernah disentuh.

BATAS PANJANG PERNYATAAN (ditambahkan 13 Okt 2026)
--------------------------------------------------
D1 menolak pernyataan yang lebih panjang dari 100.000 byte dengan
`statement too long: SQLITE_TOOBIG`. Batas itu tidak terlihat di SQLite lokal,
jadi uji putar ulang di langkah 5 tetap meloloskannya dan mirror baru gagal di D1 —
setelah tabel cadangan keburu dibuang.

Kasus yang memicunya: `sync_snapshots.payload_json` menyimpan seluruh state
organisasi dalam SATU baris. Pada 10 Okt 2026 baris itu mencapai 3,4 MB, dan
`wrangler d1 export` menuliskannya sebagai satu literal dalam satu pernyataan
`INSERT` — jauh di atas batas, sehingga impor berhenti di pernyataan ke-16.014
dan cadangan kembali kosong. Baris serupa di database debug sudah 101.092 byte,
jadi masalah ini bukan kejadian sekali.

Solusinya memecah pernyataan panjang TANPA menambah tabel penanda seperti
`sqlite_sequence`: pernyataan pertama memuat potongan pertama, sisanya menyambung
lewat `UPDATE ... SET kolom = kolom || potongan`. Kunci baris untuk `WHERE` diambil
dari kolom PRIMARY KEY tabel, dibaca dari `CREATE TABLE` — `wrangler d1 export`
tidak menulis `WHERE` apa pun pada INSERT-nya. D1 menerima baris jauh di atas batas
pernyataan sepanjang tiap pernyataannya sendiri di bawah batas (diuji langsung:
baris 5 MB berhasil dibentuk lewat 63 `UPDATE` 80 KB).

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

# Batas pernyataan D1 adalah 100.000 byte. Sisakan ruang untuk penyambungan
# `UPDATE ... || '…'` dan variasi penamaan, dan jangan mendekati batas itu.
# Semua perbandingan di bawah memakai byte UTF-8, bukan jumlah karakter: D1
# menghitung byte, dan satu karakter non-ASCII bisa 2-4 byte.
STATEMENT_BUDGET = 90_000
# Panjang potongan literal dalam satu pernyataan. Lebih kecil dari anggaran agar
# bagian tetap (nama tabel, daftar kolom, WHERE, kutip, titik koma) ikut terhitung.
CHUNK_BYTES = 80_000

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
    # `wrangler d1 export` menutup berkas dengan `DELETE FROM sqlite_sequence;`
    # lalu menulis ulang nilai penghitungnya. Urutan itu wajib dipertahankan:
    # DELETE harus setelah tabel AUTOINCREMENT dibuat (kalau tidak, tabel
    # `sqlite_sequence` belum ada dan impor gagal "no such table"), dan sebelum
    # INSERT sqlite_sequence (kalau tidak, nilainya baru ditulis lalu terhapus,
    # dan `sync_changes` memulai lagi dari 1). Karena itu `others` diletakkan
    # tepat sebelum baris sqlite_sequence, bukan di awal atau di akhir berkas.
    result.extend(others)
    for name in sorted(loose):
        result.extend(inserts[name])
    result.extend(trailing)
    return result


# ---------------------------------------------------------------------------
# Pemecah pernyataan panjang (batas 100 KB per pernyataan di D1)
# ---------------------------------------------------------------------------

def _quote_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _byte_len(text: str) -> int:
    """Panjang teks dalam byte UTF-8.

    Batas 100.000 byte D1 dihitung per byte, sedangkan `len()` Python menghitung
    karakter. Satu karakter non-ASCII bisa 2-4 byte, jadi teks berisi aksen atau
    emoji akan jauh lebih panjang dari yang terlihat dan bisa melewati batas
    walaupun `len()` masih kecil.
    """
    return len(text.encode("utf-8"))


def _split_by_bytes(text: str, limit: int) -> list[str]:
    """Pecah teks jadi potongan yang, setelah kutip tunggal digandakan, muat `limit` byte.

    Kutip dihitung dua byte karena di dalam literal SQLite satu kutip ditulis
    ganda. Tanpa itu, teks yang padat kutip bisa menghasilkan potongan yang
    melewati batas setelah di-escape.
    """
    chunks: list[str] = []
    buffer: list[str] = []
    size = 0
    for char in text:
        piece = 2 if char == "'" else len(char.encode("utf-8"))
        if buffer and size + piece > limit:
            chunks.append("".join(buffer))
            buffer = []
            size = 0
        buffer.append(char)
        size += piece
    if buffer:
        chunks.append("".join(buffer))
    return chunks


def _skip_string(text: str, index: int) -> int:
    """Lewati satu literal ber-kutip tunggal; kembalikan indeks setelahnya."""
    index += 1
    length = len(text)
    while index < length:
        if text[index] == "'":
            if index + 1 < length and text[index + 1] == "'":
                index += 2
                continue
            return index + 1
        index += 1
    return index


def _create_body(statement: str) -> str | None:
    """Isi tanda kurung utama sebuah `CREATE TABLE`."""
    start = statement.find("(")
    if start < 0:
        return None
    depth = 0
    index = start
    length = len(statement)
    while index < length:
        char = statement[index]
        if char == "'":
            index = _skip_string(statement, index)
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return statement[start + 1 : index]
        index += 1
    return None


def _top_level_parts(text: str) -> list[str]:
    """Pecah teks pada koma level teratas, abaikan koma di dalam kurung/string."""
    parts: list[str] = []
    depth = 0
    start = 0
    index = 0
    length = len(text)
    while index < length:
        char = text[index]
        if char == "'":
            index = _skip_string(text, index)
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif char == "," and depth == 0:
            parts.append(text[start:index])
            start = index + 1
        index += 1
    parts.append(text[start:])
    return [p.strip() for p in parts if p.strip()]


def _unquote(identifier: str) -> str:
    return identifier.strip().strip('"`[]')


def primary_key_columns(create_statement: str) -> list[str] | None:
    """Kolom primary key sebuah `CREATE TABLE`, dari bentuk tabel maupun inline."""
    body = _create_body(create_statement)
    if body is None:
        return None
    for part in _top_level_parts(body):
        match = re.match(r"PRIMARY\s+KEY\s*\((?P<cols>.*)\)\s*$", part, re.IGNORECASE | re.DOTALL)
        if match:
            columns = [_unquote(c) for c in match.group("cols").split(",")]
            columns = [c for c in columns if c]
            return columns or None
    for part in _top_level_parts(body):
        if re.search(r"\bPRIMARY\s+KEY\b", part, re.IGNORECASE):
            token = re.match(r'\s*([A-Za-z_][A-Za-z_0-9]*|"[^"]+"|`[^`]+`|\[[^\]]+\])', part)
            if token:
                return [_unquote(token.group(1))]
    return None


def build_primary_key_map(statements: list[str]) -> dict[str, list[str]]:
    """Peta nama tabel -> kolom primary key, dipakai untuk menyusun klausa WHERE."""
    result: dict[str, list[str]] = {}
    for statement in statements:
        if classify(statement) != "table":
            continue
        match = _TABLE_NAME.match(statement)
        if not match:
            continue
        columns = primary_key_columns(statement)
        if columns:
            result[match.group(1)] = columns
    return result


def _split_insert_columns(statement: str) -> tuple[str, str] | None:
    """Ambil bagian tabel dan daftar kolom dari `INSERT INTO tabel (kolom) ...`."""
    match = re.match(
        r'^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(?P<table>[^\s(]+)\s*\((?P<columns>[^)]*)\)',
        statement,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    table = _unquote(match.group("table"))
    columns = [_unquote(c) for c in match.group("columns").split(",")]
    if not columns or any(not c for c in columns):
        return None
    return table, columns


def _single_value_tuple(
    statement: str, values_start: int
) -> tuple[list[str], int] | None:
    """Baca satu tuple `(a, b, ...)` tepat setelah `VALUES`, kembalikan item dan akhirnya.

    Hanya menerima satu baris nilai; `INSERT` multi-baris dibiarkan apa adanya karena
    pemecahannya jauh lebih rumit dan `wrangler d1 export` tidak menghasilkannya.
    """
    i = values_start
    length = len(statement)
    while i < length and statement[i].isspace():
        i += 1
    if i >= length or statement[i] != "(":
        return None
    i += 1
    items: list[str] = []
    item_start = i
    depth = 0
    while i < length:
        char = statement[i]
        if char == "'":
            i += 1
            while i < length:
                if statement[i] == "'":
                    if i + 1 < length and statement[i + 1] == "'":
                        i += 2
                        continue
                    break
                i += 1
            i += 1
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            if depth == 0:
                items.append(statement[item_start:i].strip())
                return items, i + 1
            depth -= 1
        elif char == "," and depth == 0:
            items.append(statement[item_start:i].strip())
            item_start = i + 1
        i += 1
    return None


def _after_values(statement: str) -> int | None:
    """Indeks setelah kata `VALUES` di level teratas."""
    depth = 0
    i = 0
    length = len(statement)
    while i < length:
        char = statement[i]
        if char == "'":
            i += 1
            while i < length:
                if statement[i] == "'":
                    if i + 1 < length and statement[i + 1] == "'":
                        i += 2
                        continue
                    break
                i += 1
            i += 1
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and char in "vV":
            match = re.match(r"VALUES\b", statement[i:], re.IGNORECASE)
            if match:
                return i + match.end()
        i += 1
    return None


def split_long_statement(
    statement: str, primary_keys: dict[str, list[str]]
) -> list[str] | None:
    """Pecah satu `INSERT` panjang jadi beberapa pernyataan di bawah batas D1.

    Mengembalikan None bila pernyataan tidak perlu dipecah atau tidak bisa dipecah
    dengan aman; pemanggil membiarkannya lewat apa adanya.
    """
    if _byte_len(statement) <= STATEMENT_BUDGET:
        return None
    if classify(statement) != "insert":
        return None

    parsed = _split_insert_columns(statement)
    if not parsed:
        return None
    table, columns = parsed

    after_values = _after_values(statement)
    if after_values is None:
        return None

    tuple_parsed = _single_value_tuple(statement, after_values)
    if not tuple_parsed:
        return None
    values, tuple_end = tuple_parsed
    if len(values) != len(columns):
        return None

    # Sisa setelah tuple nilai. `wrangler d1 export` tidak menulis apa pun di sini
    # selain `;`. Klausa lain (mis. `ON CONFLICT ... DO UPDATE SET` yang bisa
    # menimpa kolom teks dengan potongan pertama saja) ditolak: pernyataannya
    # dibiarkan panjang, lalu penjaga batas di `main` yang menghentikannya.
    suffix = statement[tuple_end:].strip().rstrip().rstrip(";").rstrip()
    if suffix:
        return None

    # Cari kolom teks tunggal yang menampung seluruh isi baris (mis. payload_json).
    text_indices = [
        index
        for index, value in enumerate(values)
        if value.startswith("'") and _byte_len(value) > CHUNK_BYTES
    ]
    if len(text_indices) != 1:
        return None
    text_index = text_indices[0]

    # Kunci baris diambil dari primary key tabel, bukan dari `WHERE` pernyataan
    # asli: `wrangler d1 export` tidak pernah menulisnya.
    key_columns = primary_keys.get(table)
    if not key_columns:
        return None
    key_items: list[str] = []
    for column in key_columns:
        if column not in columns:
            return None
        key_items.append(
            f"{column} = {values[columns.index(column)]}"
        )
    where_clause = "WHERE " + " AND ".join(key_items)

    literal = values[text_index]
    inner = literal[1:-1].replace("''", "'")
    prefix_items = values[:text_index]
    suffix_items = values[text_index + 1 :]

    head = f"INSERT INTO {table} ({', '.join(columns)}) VALUES("

    statements: list[str] = []
    for index, chunk in enumerate(_split_by_bytes(inner, CHUNK_BYTES)):
        if index == 0:
            items = prefix_items + [_quote_literal(chunk)] + suffix_items
            statements.append(head + ", ".join(items) + ")")
        else:
            statements.append(
                f"UPDATE {table} SET {columns[text_index]} = "
                f"{columns[text_index]} || {_quote_literal(chunk)} {where_clause}"
            )

    if not statements:
        return None
    if any(_byte_len(s) > STATEMENT_BUDGET for s in statements):
        # Seharusnya tidak terjadi; menolak lebih baik daripada menulis pernyataan
        # yang akan ditolak D1 dan meninggalkan cadangan setengah jadi.
        return None
    return statements


def split_long_statements(statements: list[str]) -> list[str]:
    """Terapkan pemecah ke seluruh pernyataan, jaga urutannya."""
    primary_keys = build_primary_key_map(statements)
    result: list[str] = []
    for statement in statements:
        pieces = split_long_statement(statement, primary_keys)
        result.extend(pieces if pieces else [statement])
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

    # Setelah urutan dibereskan, pecah pernyataan yang melewati batas 100 KB D1.
    before = len(ordered)
    ordered = split_long_statements(ordered)
    split_count = len(ordered) - before

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

    # Jaring pengaman terakhir: D1 tetap bisa menolak walaupun SQLite lokal menerima.
    # Lebih baik berhenti di sini, sebelum cadangan dibuang, daripada gagal di tengah impor.
    longest = max((_byte_len(s) for s in ordered), default=0)
    if longest > STATEMENT_BUDGET:
        head = next(s for s in ordered if _byte_len(s) == longest)
        print(
            f"GALAT: ada pernyataan sepanjang {longest} byte, di atas batas "
            f"{STATEMENT_BUDGET} byte yang aman untuk D1.",
            file=sys.stderr,
        )
        print(f"  {head.strip().splitlines()[0][:160]}", file=sys.stderr)
        print(
            "  Pernyataan itu tidak bisa dipecah otomatis (mis. INSERT multi-baris "
            "atau tanpa WHERE). Database cadangan TIDAK disentuh.",
            file=sys.stderr,
        )
        return 1

    tables = sum(1 for s in ordered if classify(s) == "table")
    inserts = sum(1 for s in ordered if classify(s) == "insert")
    print(
        f"  export lolos uji: {executed} pernyataan "
        f"({tables} tabel, {inserts} baris data, {executed - tables - inserts} lainnya)"
    )
    if split_count:
        longest = max(_byte_len(s) for s in ordered)
        print(
            f"  {split_count} pernyataan panjang dipecah; "
            f"pernyataan terpanjang sekarang {longest} byte"
        )

    if args.check_only:
        return 0

    write_output(ordered, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
