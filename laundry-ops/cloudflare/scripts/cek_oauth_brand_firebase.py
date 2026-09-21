"""Periksa OAuth brand (sumber %APP_NAME%) di project cuciin-ops.

Dokumentasi resmi Firebase: %APP_NAME% di template email auth diisi OAuth brand
name. Kalau OAuth brand belum ada (Google Sign-in belum diaktifkan), %APP_NAME%
jatuh ke nama default Firebase Hosting site, dan akhirnya ke project ID. Itulah
sebabnya email menampilkan "project-634935388002" walau nama project sudah
"Cuciin Ops" - mengubah nama project tidak berpengaruh.

Skrip ini memeriksa:
1. Daftar OAuth brand di project ini (iap.googleapis.com v1 brands).
2. Apakah brand bisa dibuat lewat API (sehingga tidak perlu klik Console).
3. Status Google Sign-in di Firebase Auth.
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

    print("=== 1. Daftar OAuth brand (sumber %APP_NAME%) ===")
    kode, isi = panggil("GET", f"https://iap.googleapis.com/v1/projects/{PROJECT}/brands", tok)
    print(f"  HTTP {kode}")
    print("  ", isi[:600])

    print("\n=== 2. Apakah brand default Firebase Hosting yang dipakai? ===")
    kode, isi = panggil(
        "GET",
        f"https://firebasehosting.googleapis.com/v1beta1/projects/{PROJECT}/sites",
        tok,
    )
    print(f"  HTTP {kode}")
    print("  ", isi[:600])

    print("\n=== 3. Status provider Google Sign-in di Firebase Auth ===")
    url = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT}/defaultSupportedIdpConfigs"
    kode, isi = panggil("GET", url, tok)
    print(f"  HTTP {kode}")
    try:
        d = json.loads(isi)
        for c in d.get("defaultSupportedIdpConfigs", []):
            print(f"    {c.get('name')}  enabled={c.get('enabled')}")
    except ValueError:
        print("  ", isi[:400])
