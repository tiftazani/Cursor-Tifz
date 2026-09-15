#!/usr/bin/env bash
set -euo pipefail

: "${CUCIIN_BACKUP_PASSPHRASE:?CUCIIN_BACKUP_PASSPHRASE belum tersedia}"
encrypted_file="${1:?Berikan path file .sql.enc}"
checksum_file="${encrypted_file}.sha256"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

(cd "$(dirname "$encrypted_file")" && shasum -a 256 -c "$(basename "$checksum_file")")
verify_sqlite() {
  rm -f "$work_dir/restore.sql"
  rm -f "$work_dir/restore.sqlite"
  if [[ "$1" == "current" ]]; then
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
      -in "$encrypted_file" \
      -out "$work_dir/restore.sql" \
      -pass env:CUCIIN_BACKUP_PASSPHRASE 2>/dev/null || return 1
  else
    openssl enc -d -aes-256-cbc -pbkdf2 \
      -in "$encrypted_file" \
      -out "$work_dir/restore.sql" \
      -pass env:CUCIIN_BACKUP_PASSPHRASE 2>/dev/null || return 1
  fi
  sqlite3 "$work_dir/restore.sqlite" < "$work_dir/restore.sql" 2>/dev/null || return 1
  [[ "$(sqlite3 "$work_dir/restore.sqlite" 'PRAGMA integrity_check;' 2>/dev/null)" == "ok" ]]
}

if ! verify_sqlite current; then
  verify_sqlite legacy
  echo "Backup memakai format PBKDF2 lama; buat ulang dengan format terbaru setelah restore."
fi
echo "Backup dapat didekripsi dan lulus integrity_check SQLite."
