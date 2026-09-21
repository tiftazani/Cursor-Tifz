#!/usr/bin/env bash
# Mirror database D1 produksi (cuciin-db) ke database cadangan (cuciin-backup-db)
# Menggunakan export remote lalu restore ke target DB.
set -euo pipefail

PROD_DB="cuciin-db"
BACKUP_DB="cuciin-backup-db"
TMP_SQL="/tmp/cuciin-mirror-$$.sql"
trap 'rm -f "$TMP_SQL"' EXIT

echo "=== 1. Export database produksi ($PROD_DB) ==="
npx wrangler d1 export "$PROD_DB" --remote --output="$TMP_SQL" --yes

if [ ! -s "$TMP_SQL" ]; then
  echo "GALAT: berkas export kosong atau tidak terbentuk" >&2
  exit 1
fi
echo "  berkas export: $(wc -c < "$TMP_SQL") byte"

echo "=== 2. Impor ke database cadangan ($BACKUP_DB) ==="
npx wrangler d1 execute "$BACKUP_DB" --remote --file="$TMP_SQL" --yes

echo "=== 3. Verifikasi integritas database cadangan ==="
RESULT=$(npx wrangler d1 execute "$BACKUP_DB" --remote --json --command="SELECT count(*) AS total_staff FROM staff;")
echo "$RESULT" | grep -q '"total_staff"' || {
  echo "GALAT: verifikasi staff di $BACKUP_DB gagal" >&2
  exit 1
}

echo "=== Mirror selesai dan terverifikasi ==="
