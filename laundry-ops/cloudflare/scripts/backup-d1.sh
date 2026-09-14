#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN belum tersedia}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID belum tersedia}"
: "${CUCIIN_BACKUP_PASSPHRASE:?CUCIIN_BACKUP_PASSPHRASE belum tersedia}"

backup_dir="${PWD}/backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
plain_file="${backup_dir}/cuciin-${timestamp}.sql"
encrypted_file="${plain_file}.enc"
mkdir -p "$backup_dir"

npx wrangler d1 export cuciin-db --remote --skip-confirmation --output "$plain_file"
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "$plain_file" \
  -out "$encrypted_file" \
  -pass env:CUCIIN_BACKUP_PASSPHRASE
(cd "$backup_dir" && shasum -a 256 "$(basename "$encrypted_file")" > "$(basename "${encrypted_file}.sha256")")
rm -f "$plain_file"
echo "Backup terenkripsi dibuat: ${encrypted_file}"
