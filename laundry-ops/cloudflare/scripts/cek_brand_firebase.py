"""Baca & (kalau diizinkan) setel OAuth brand - sumber %APP_NAME% di email auth Firebase.

Konteks temuan:
- %APP_NAME% diisi OAuth brand name (dokumentasi resmi Firebase).
- Google Sign-in SUDAH aktif: projects/634935388002/defaultSupportedIdpConfigs/google.com enabled=True.
- Firebase Hosting site default = cuciin-ops, jadi fallback seharusnya "cuciin-ops",
  bukan "634935388002". Berarti brand ADA tetapi namanya masih bawaan/numerik.

Endpoint brand:
  Legacy : OAUTH2 API   https://www.googleapis.com/oauth2/v2/userinfo  (bukan ini)
  Branding: https://oauth2.googleapis.com/... (tidak ada)
  Yang benar: Cloud Console "Auth Platform/branding" memakai
  https://iap.googleapis.com/v1/projects/{p}/brands  -> butuh IAP API
  dan  https://cloudresourcemanager.googleapis.com/v1/projects/{p}/oauth2brand (tidak publik)

Praktisnya: brand hanya bisa dibaca/ditulis dari Console
(console.cloud.google.com/auth/branding). Skrip ini membuktikan mana yang bisa dicapai.
"""
import json
import subprocess
import time
from pathlib import Path

REPO = Path("/Users/tiftazani/Documents/ChatGPT/Laundry/Cursor-Tifz")
FB = REPO / "laundry-ops" / "firebase"
PROJECT = "cuciin-ops"
TOKENS = Path.home() / ".config/configstore/firebase-tools.json"


def segarkan_token() -> str:
    for _ in range(2):
        subprocess.run(["npx", "--yes", "firebase-tools", "projects:list"],
                       cwd=FB, capture_output=True, text=True, timeout=300)
        t = json.loads(TOKENS.read_text())["tokens"]
        if t["expires_at"] / 1000 > time.time():
            return t["access_token"]
    raise SystemExit("token tetap kedaluwarsa")


def panggil(method: str, url: str, token: str, body: dict | None = None) -> tuple[int, str]:
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method,
           "-H", f"Authorization: Bearer {token}",
           "-H", "Content-Type: application/json", url]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
    isi, _, kode = out.rpartition("\n")
    return (int(kode) if kode.strip().isdigit() else 0), isi.strip()


if __name__ == "__main__":
    tok = segarkan_token()
    PN = "634935388002"

    calon = [
        ("IAP brands (API, butuh IAP diaktifkan)",
         f"https://iap.googleapis.com/v1/projects/{PN}/brands"),
        ("IAP brands by project id",
         f"https://iap.googleapis.com/v1/projects/{PROJECT}/brands"),
        ("OAuth client (jumlah klien OAuth project)",
         f"https://oauth2.googleapis.com/v1/projects/{PROJECT}/oauthClients"),
    ]
    for label, url in calon:
        kode, isi = panggil("GET", url, tok)
        print(f"=== {label} ===")
        print(f"  HTTP {kode}")
        print("  ", isi[:280].replace("\n", " "))
        print()
