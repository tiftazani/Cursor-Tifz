#!/usr/bin/env bash
set -euo pipefail

: "${CUCIIN_BACKUP_PASSPHRASE:?CUCIIN_BACKUP_PASSPHRASE belum tersedia}"
encrypted_file="${1:?Berikan path file .sql.enc}"
checksum_file="${encrypted_file}.sha256"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

(cd "$(dirname "$encrypted_file")" && shasum -a 256 -c "$(basename "$checksum_file")")
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "$encrypted_file" \
  -out "$work_dir/restore.sql" \
  -pass env:CUCIIN_BACKUP_PASSPHRASE
sqlite3 "$work_dir/restore.sqlite" < "$work_dir/restore.sql"
result="$(sqlite3 "$work_dir/restore.sqlite" 'PRAGMA integrity_check;')"
test "$result" = "ok"
echo "Backup dapat didekripsi dan lulus integrity_check SQLite."
