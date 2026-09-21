#!/usr/bin/env bash
# Mirror database D1 produksi (cuciin-db) ke database cadangan (cuciin-backup-db).
#
# Export bersifat menggantikan seluruh isi, bukan menambah. Karena itu tabel di
# database cadangan dibuang lebih dulu; tanpa langkah itu, jalankan kedua gagal
# dengan "table already exists" dan INSERT bentrok primary key.
set -euo pipefail

PROD_DB="${PROD_DB:-cuciin-db}"
BACKUP_DB="${BACKUP_DB:-cuciin-backup-db}"
TMP_SQL="$(mktemp -t cuciin-mirror-XXXXXX).sql"
TMP_DROP="$(mktemp -t cuciin-drop-XXXXXX).sql"
trap 'rm -f "$TMP_SQL" "$TMP_DROP"' EXIT

echo "=== 1. Export database produksi ($PROD_DB) ==="
npx wrangler d1 export "$PROD_DB" --remote --output="$TMP_SQL" --skip-confirmation

if [ ! -s "$TMP_SQL" ]; then
  echo "GALAT: berkas export kosong atau tidak terbentuk" >&2
  exit 1
fi
echo "  ukuran export: $(wc -c < "$TMP_SQL") byte"

echo "=== 2. Daftar tabel di database cadangan ($BACKUP_DB) ==="
# grep keluar dengan kode 1 saat tidak ada hasil. Dengan set -o pipefail itu
# menghentikan seluruh skrip, padahal "tidak ada tabel" adalah keadaan sah
# untuk database cadangan yang baru dibuat. Karena itu kegagalannya ditelan.
TABLES="$(npx wrangler d1 execute "$BACKUP_DB" --remote --json \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';" \
  2>/dev/null | grep -oE '"name": *"[^"]+"' | sed 's/.*: *"//; s/"$//' | sort -u || true)"

if [ -z "$TABLES" ]; then
  echo "  database cadangan masih kosong, tidak ada yang perlu dibuang"
  : > "$TMP_DROP"
else
  echo "  tabel yang akan dibuang: $(echo "$TABLES" | wc -l | tr -d ' ')"
  # foreign_keys harus dimatikan: tanpa itu, DROP TABLE pada tabel yang masih
  # dirujuk foreign key gagal dengan "no such table: main.staff" dan seluruh
  # berkas dibatalkan. PRAGMA ini berlaku per koneksi, jadi ia ditulis di
  # berkas yang sama dengan pernyataan DROP-nya.
  {
    echo "PRAGMA foreign_keys=OFF;"
    echo "$TABLES" | while IFS= read -r t; do
      [ -n "$t" ] && printf 'DROP TABLE IF EXISTS "%s";\n' "$t"
    done
    echo "PRAGMA foreign_keys=ON;"
  } > "$TMP_DROP"
  npx wrangler d1 execute "$BACKUP_DB" --remote --file="$TMP_DROP" >/dev/null 2>&1
fi

echo "=== 3. Impor isi produksi ke database cadangan ==="
npx wrangler d1 execute "$BACKUP_DB" --remote --file="$TMP_SQL" >/dev/null 2>&1

echo "=== 4. Verifikasi database cadangan ==="
PROD_STAFF="$(npx wrangler d1 execute "$PROD_DB" --remote --json --command="SELECT count(*) AS n FROM staff;" 2>/dev/null | grep -oE '"n": *[0-9]+' | grep -oE '[0-9]+' || true)"
BACKUP_STAFF="$(npx wrangler d1 execute "$BACKUP_DB" --remote --json --command="SELECT count(*) AS n FROM staff;" 2>/dev/null | grep -oE '"n": *[0-9]+' | grep -oE '[0-9]+' || true)"

echo "  staff produksi : ${PROD_STAFF:-?}"
echo "  staff cadangan : ${BACKUP_STAFF:-?}"

if [ -z "$BACKUP_STAFF" ] || [ "$BACKUP_STAFF" != "$PROD_STAFF" ]; then
  echo "GALAT: jumlah staff tidak cocok antara produksi dan cadangan" >&2
  exit 1
fi

echo "=== Mirror selesai dan terverifikasi ==="
