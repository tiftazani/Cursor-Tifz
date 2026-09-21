"""Baca nama tampilan project Firebase lewat access_token firebase-tools (npx firebase login:ci).

firebase-tools.json TIDAK menyimpan client_id/client_secret (hanya token), jadi
refresh sendiri tidak bisa. Sebagai gantinya pakai `npx firebase projects:list`,
yang otomatis menyegarkan access_token dan sekaligus menampilkan displayName.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path("/Users/tiftazani/Documents/ChatGPT/Laundry/Cursor-Tifz")
FB = REPO / "laundry-ops" / "firebase"


def jalankan(*arg: str) -> str:
    return subprocess.run(
        ["npx", "--yes", "firebase-tools", *arg],
        cwd=FB, capture_output=True, text=True, timeout=300,
    ).stdout


if __name__ == "__main__":
    print("=== projects:list (nama project vs projectId) ===")
    out = jalankan("projects:list")
    print(out[-1500:])
    print()
    print("=== apakah access_token tersegarkan? ===")
    d = json.loads((Path.home() / ".config/configstore/firebase-tools.json").read_text())
    import time
    sisa = (d["tokens"]["expires_at"] / 1000) - time.time()
    print(f"  berlaku {sisa/60:.1f} menit lagi" if sisa > 0 else f"  masih kedaluwarsa {-sisa/60:.1f} menit")
    print("  izin yang tercatat:", d.get("loginScopes"))
