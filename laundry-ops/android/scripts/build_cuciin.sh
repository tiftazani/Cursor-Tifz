#!/usr/bin/env bash
# Jalur build resmi Cuciin.
#
# Kenapa ada: pada 1 Okt 2026 perintah build kandidat 1.10.43 mengekspor
# CUCIIN_DEBUG_CLOUD_URL="$CUCIIN_CLOUD_URL" (URL produksi), sehingga APK debug memuat
# endpoint PRODUKSI. Paket debug itu dipasang di emulator dan mendorong tiga entri
# accessRole ke D1 produksi (revision 3417 -> 3420).
#
# Skrip ini menutup jalur itu dari dua arah:
#   1. membuang env cloud dari lingkungan build (debug tidak pernah mewarisi produksi);
#   2. memverifikasi endpoint di dalam APK hasil build, bukan hanya konfigurasinya.
#
# Pakai: scripts/build_cuciin.sh [debug|release|semua]   (default: debug)
set -euo pipefail
cd "$(dirname "$0")/.."

VARIAN="${1:-debug}"
case "$VARIAN" in
  debug | release | semua) ;;
  *)
    echo "Pakai: $0 [debug|release|semua]" >&2
    exit 2
    ;;
esac

# 1. Bersihkan env cloud. CUCIIN_SIGNING_PROPERTIES dan JAVA_HOME tetap dibutuhkan,
#    jadi keduanya tidak ikut dibuang.
BERSIH=(env -u CUCIIN_DEBUG_CLOUD_URL -u CUCIIN_CLOUD_URL -u CUCIIN_CLOUD_PROPERTIES)

HOST_PRODUKSI="cuciin-api.tiftazani-cuciin.workers.dev"
HOST_DEBUG="cuciin-api-debug.tiftazani-cuciin.workers.dev"

if [ "$VARIAN" = "debug" ] || [ "$VARIAN" = "semua" ]; then
  echo "== Build debug (env cloud dibersihkan) =="
  "${BERSIH[@]}" ./gradlew assembleDebug --console=plain
  echo "== Verifikasi endpoint APK debug =="
  python3 scripts/guard_endpoint.py \
    app/build/outputs/apk/debug/app-debug.apk \
    --expect "$HOST_DEBUG" \
    --forbid "$HOST_PRODUKSI"
fi

if [ "$VARIAN" = "release" ] || [ "$VARIAN" = "semua" ]; then
  echo "== Build rilis (env cloud dibersihkan) =="
  "${BERSIH[@]}" ./gradlew assembleRelease bundleRelease --console=plain
  echo "== Verifikasi endpoint APK rilis =="
  python3 scripts/guard_endpoint.py \
    app/build/outputs/apk/release/app-release.apk \
    --expect "$HOST_PRODUKSI"
fi

echo "Selesai: endpoint artefak sudah diperiksa."
