#!/bin/bash
# Ambil branch Kunci tanpa remote-tracking ref.
# Clone --single-branch tidak punya origin/cursor/... — itu yang bikin:
#   fatal: 'origin/cursor/kunci-password-manager-4eaf' is not a commit
# Fetch selalu nulis commit ke FETCH_HEAD. Jangan checkout origin/branch.
set -euo pipefail

REPO="${KUNCI_REPO:-/Users/tiftazani/Cursor-Tifz}"
BRANCH="cursor/kunci-password-manager-4eaf"

if [[ ! -d "$REPO/.git" ]]; then
  echo "Folder $REPO bukan git clone. Set KUNCI_REPO ke path Cursor-Tifz."
  exit 1
fi

cd "$REPO"
echo "Repo: $PWD"

# Buka fetch supaya origin/branch ada untuk lain kali. Checkout tetap pakai FETCH_HEAD.
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git fetch origin "$BRANCH"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree kotor — stash dulu (git stash list). Jangan pop kecuali lo butuh edit itu."
  git stash push -u -m "sebelum kunci branch"
fi

git checkout -B "$BRANCH" FETCH_HEAD

if [[ ! -f kunci/src/views/DashboardView.tsx ]]; then
  echo "DashboardView.tsx tidak ada. Masih tree lama — STOP. Jangan npm run install-service."
  exit 1
fi

echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse --short HEAD)"
echo "File Ringkasan ada."

if [[ "${1:-}" == "--install" ]]; then
  cd kunci
  npm install
  npm run install-service
fi
