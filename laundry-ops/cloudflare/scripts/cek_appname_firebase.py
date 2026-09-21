"""Cari tahu mengapa %APP_NAME% berisi "project-634935388002", dan apa yang boleh diubah.

Temuan sejauh ini:
- Template email auth TIDAK bisa diubah lewat API: HTTP 400 EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED.
  Jadi placeholder %APP_NAME% harus dibiarkan, dan yang diperbaiki adalah NILAI-nya.
- `npx firebase projects:list` menampilkan "Cuciin Ops", tetapi email memakai
  "project-634935388002" (ID numerik). Dua sumber ini berbeda, jadi harus dicari
  sumber mana yang dipakai pengirim email.

Diperiksa di sini:
1. displayName di Cloud Resource Manager (projects.get) - sumber nama untuk Cloud Console.
2. Apakah PATCH project boleh (updateMask=displayName).
3. defaultSupportedIdpConfigs dan oobCode, untuk melihat apakah ada endpoint lain
   yang mengizinkan perubahan.
"""
import json
import subprocess
import sys
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


def panggil(method: str, url: str, token: str, body: dict | None = None) -> tuple[int, dict]:
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method,
           "-H", f"Authorization: Bearer {token}",
           "-H", "Content-Type: application/json", url]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
    isi, _, kode = out.rpartition("\n")
    try:
        return int(kode), json.loads(isi) if isi.strip() else {}
    except ValueError:
        return int(kode) if kode.isdigit() else 0, {"raw": out[:300]}


if __name__ == "__main__":
    tok = segarkan_token()

    print("=== 1. displayName via Cloud Resource Manager ===")
    kode, d = panggil("GET", f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}", tok)
    print(f"  HTTP {kode}")
    print(f"  displayName : {d.get('name')!r}")
    print(f"  projectId   : {d.get('projectId')!r}")
    print(f"  projectNumber: {d.get('projectNumber')!r}")
    print(f"  lifecycleState: {d.get('lifecycleState')!r}")

    print("\n=== 2. boleh PATCH displayName? (uji di project ini) ===")
    kode, d = panggil(
        "PATCH",
        f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}?updateMask=displayName",
        tok,
        {"name": "Cuciin Ops"},
    )
    print(f"  HTTP {kode}")
    print("  ", json.dumps(d)[:300] if kode != 200 else "diterima (nama ditulis ulang sama)")

    print("\n=== 3. Firebase v1beta1 projects:displayName ===")
    kode, d = panggil("GET", f"https://firebase.googleapis.com/v1beta1/projects/{PROJECT}", tok)
    print(f"  HTTP {kode}")
    print(f"  displayName: {d.get('displayName')!r}")

    print("\n=== 4. izin yang dipegang akun ini ===")
    kode, d = panggil(
        "POST",
        "https://cloudresourcemanager.googleapis.com/v1/projects/" + PROJECT + ":testIamPermissions",
        tok,
        {"permissions": [
            "resourcemanager.projects.get",
            "resourcemanager.projects.update",
            "firebase.projects.update",
            "firebaseauth.configs.update",
            "identitytoolkit.projects.updateConfig",
        ]},
    )
    print(f"  HTTP {kode}")
    print(f"  diizinkan: {d.get('permissions')}")
