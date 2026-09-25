#!/usr/bin/env bash
# Mirror database D1 produksi (cuciin-db) ke database cadangan (cuciin-backup-db).
#
# URUTAN LANGKAH PENTING. Berkas export dibuktikan bisa dijalankan SEBELUM tabel
# di database cadangan dibuang. Pada 25 Sep 2026 urutannya masih terbalik: tabel
# cadangan dibuang lebih dulu, lalu impor gagal dengan "no such table:
# main.products" karena `wrangler d1 export` menulis CREATE TABLE mengikuti urutan
# `sqlite_master`, bukan urutan ketergantungan. Akibatnya cadangan yang tadinya
# berisi menjadi kosong dan tidak ada satu pun salinan yang tersisa.
#
# Export bersifat menggantikan seluruh isi, bukan menambah. Karena itu tabel di
# database cadangan tetap perlu dibuang lebih dulu; tanpa langkah itu, jalankan
# kedua gagal dengan "table already exists" dan INSERT bentrok primary key.
#
# TIGA LAPIS PENJAGAAN:
#   1. Export diuji jalan ulang di SQLite lokal sebelum apa pun dibuang.
#   2. Isi cadangan lama diselamatkan ke berkas dulu, jadi bisa dipulihkan.
#   3. Bila impor tetap gagal, isi cadangan lama dipasang kembali sebelum keluar.
set -euo pipefail

PROD_DB="${PROD_DB:-cuciin-db}"
BACKUP_DB="${BACKUP_DB:-cuciin-backup-db}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_RAW="$(mktemp -t cuciin-mirror-raw-XXXXXX).sql"
TMP_SQL="$(mktemp -t cuciin-mirror-XXXXXX).sql"
TMP_DROP="$(mktemp -t cuciin-drop-XXXXXX).sql"
TMP_SAFETY="$(mktemp -t cuciin-safety-XXXXXX).sql"
trap 'rm -f "$TMP_RAW" "$TMP_SQL" "$TMP_DROP" "$TMP_SAFETY"' EXIT

echo "=== 1. Export database produksi ($PROD_DB) ==="
npx wrangler d1 export "$PROD_DB" --remote --output="$TMP_RAW" --skip-confirmation

if [ ! -s "$TMP_RAW" ]; then
  echo "GALAT: berkas export kosong atau tidak terbentuk" >&2
  exit 1
fi
echo "  ukuran export: $(wc -c < "$TMP_RAW") byte"

echo "=== 2. Rapikan dan uji export (database cadangan belum disentuh) ==="
# Langkah ini keluar dengan kode 1 bila ada satu pernyataan pun yang gagal
# dijalankan ulang. Selama itu terjadi, cadangan lama tetap utuh.
python3 "$SCRIPT_DIR/reorder_d1_export.py" "$TMP_RAW" --out "$TMP_SQL"

echo "=== 3. Daftar tabel di database cadangan ($BACKUP_DB) ==="
# grep keluar dengan kode 1 saat tidak ada hasil. Dengan set -o pipefail itu
# menghentikan seluruh skrip, padahal "tidak ada tabel" adalah keadaan sah
# untuk database cadangan yang baru dibuat. Karena itu kegagalannya ditelan.
TABLES="$(npx wrangler d1 execute "$BACKUP_DB" --remote --json \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';" \
  2>/dev/null | grep -oE '"name": *"[^"]+"' | sed 's/.*: *"//; s/"$//' | sort -u || true)"

if [ -z "$TABLES" ]; then
  echo "  database cadangan masih kosong, tidak ada yang perlu dibuang"
  : > "$TMP_DROP"
  : > "$TMP_SAFETY"
else
  echo "  tabel yang akan dibuang: $(echo "$TABLES" | wc -l | tr -d ' ')"

  echo "  menyelamatkan isi cadangan lama ke berkas..."
  if npx wrangler d1 export "$BACKUP_DB" --remote --output="$TMP_SAFETY" --skip-confirmation >/dev/null 2>&1; then
    echo "  cadangan lama tersimpan: $(wc -c < "$TMP_SAFETY") byte"
  else
    echo "GALAT: isi cadangan lama tidak bisa diselamatkan, impor dibatalkan" >&2
    echo "  Cadangan dibiarkan apa adanya; periksa izin akses D1 lalu jalankan ulang." >&2
    exit 1
  fi

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

echo "=== 4. Impor isi produksi ke database cadangan ==="
# Galat tidak lagi disembunyikan: bila impor gagal, pesannya harus terlihat di
# log GitHub Actions, bukan hilang di balik /dev/null.
if ! npx wrangler d1 execute "$BACKUP_DB" --remote --file="$TMP_SQL"; then
  echo "GALAT: impor gagal." >&2
  if [ -s "$TMP_SAFETY" ]; then
    echo "  Memasang kembali isi cadangan lama..." >&2
    npx wrangler d1 execute "$BACKUP_DB" --remote --file="$TMP_SAFETY" >/dev/null 2>&1 \
      && echo "  cadangan lama berhasil dipasang kembali" >&2 \
      || echo "  GAGAL memasang kembali; cadangan dalam keadaan tidak lengkap" >&2
  fi
  exit 1
fi

echo "=== 5. Verifikasi database cadangan ==="
# Semua tabel dihitung, bukan hanya staff. Dulu hanya staff yang dibandingkan,
# sehingga perbedaan di tabel lain bisa lewat tanpa ketahuan.
COUNT_SQL="SELECT
  (SELECT COUNT(*) FROM staff)          AS staff,
  (SELECT COUNT(*) FROM branches)       AS branches,
  (SELECT COUNT(*) FROM services)       AS services,
  (SELECT COUNT(*) FROM products)       AS products,
  (SELECT COUNT(*) FROM orders)         AS orders,
  (SELECT COUNT(*) FROM sync_changes)   AS sync_changes,
  (SELECT COUNT(*) FROM attendance)     AS attendance,
  (SELECT COUNT(*) FROM staff_branches) AS staff_branches;"

read_counts() {
  # Dijalankan lewat python3, bukan grep: keluaran wrangler memuat blok meta
  # (`rows_read`, `size_after`, `duration`, ...) yang ikut tertangkap grep dan
  # nilainya berbeda antara produksi dan cadangan, sehingga perbandingan akan
  # selalu gagal walaupun isinya sama.
  npx wrangler d1 execute "$1" --remote --json --command="$COUNT_SQL" 2>/dev/null \
    | python3 -c '
import json, sys
try:
    raw = json.load(sys.stdin)
except Exception:
    sys.exit(1)
rows = raw[0]["results"] if isinstance(raw, list) else raw["results"]
row = rows[0]
for key in sorted(row):
    print(f"{key}={row[key]}")
'
}

PROD_COUNTS="$(read_counts "$PROD_DB")"
BACKUP_COUNTS="$(read_counts "$BACKUP_DB")"

echo "  produksi : $(echo "$PROD_COUNTS" | tr '\n' ' ')"
echo "  cadangan : $(echo "$BACKUP_COUNTS" | tr '\n' ' ')"

if [ -z "$BACKUP_COUNTS" ] || [ "$BACKUP_COUNTS" != "$PROD_COUNTS" ]; then
  echo "GALAT: isi database cadangan tidak sama dengan produksi" >&2
  exit 1
fi

echo "=== Mirror selesai dan terverifikasi ==="
