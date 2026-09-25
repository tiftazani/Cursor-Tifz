"""Bandingkan akun Firebase Auth dengan daftar staf di D1 produksi.

Dipakai untuk menjawab laporan "beberapa akun tidak bisa login": akun yang ada di D1
tetapi tidak ada di Firebase Auth tidak akan pernah bisa masuk, karena aplikasi masuk
lewat Firebase lebih dulu.

Pakai: python3 cek_akun_vs_firebase.py
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


def daftar_firebase(token: str) -> dict:
    """Semua akun Firebase Auth, dipaginasi 1000 per halaman."""
    akun = {}
    halaman = ""
    while True:
        url = (f"https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT}"
               f"/accounts:batchGet?maxResults=1000")
        if halaman:
            url += f"&pageToken={halaman}"
        proc = subprocess.run(
            ["curl", "-s", "-H", f"Authorization: Bearer {token}", url],
            capture_output=True, text=True, timeout=120,
        )
        data = json.loads(proc.stdout or "{}")
        if "error" in data:
            raise SystemExit(f"Firebase menolak: {data['error']}")
        for u in data.get("users", []):
            akun[u.get("email", "").lower()] = u
        halaman = data.get("nextPageToken", "")
        if not halaman:
            break
    return akun


def daftar_d1() -> list[dict]:
    """Baris tabel staff di D1 produksi, lewat wrangler."""
    proc = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "cuciin-db", "--remote", "--json",
         "--command",
         "SELECT lower(email) AS email, name, role, approved FROM staff ORDER BY role, email"],
        cwd=REPO / "laundry-ops" / "cloudflare",
        capture_output=True, text=True, timeout=300,
    )
    if proc.returncode != 0:
        raise SystemExit(f"wrangler gagal: {proc.stderr[:400]}")
    # Keluaran wrangler kadang diawali baris non-JSON; ambil dari '[' pertama.
    mulai = proc.stdout.find("[")
    return json.loads(proc.stdout[mulai:])[0]["results"]


def main() -> int:
    token = segarkan_token()
    fb = daftar_firebase(token)
    staff = daftar_d1()

    print(f"Firebase Auth: {len(fb)} akun")
    print(f"D1 staff     : {len(staff)} baris")
    print()

    tanpa_firebase = []
    for baris in staff:
        email = baris["email"]
        akun = fb.get(email)
        if akun is None:
            tanpa_firebase.append(baris)
            tanda = "TIDAK ADA di Firebase"
        elif akun.get("disabled"):
            tanda = "DIMATIKAN di Firebase"
            tanpa_firebase.append(baris)
        elif not akun.get("emailVerified"):
            tanda = "email belum diverifikasi"
        else:
            tanda = "ok"
        print(f"  {baris['role']:<11} {email:<34} {baris['name']:<22} {tanda}")

    print()
    if tanpa_firebase:
        print(f"PERLU TINDAKAN: {len(tanpa_firebase)} akun staf tidak bisa masuk")
        for baris in tanpa_firebase:
            print(f"  - {baris['email']} ({baris['name']}, {baris['role']})")
    else:
        print("Semua staf D1 punya akun Firebase yang aktif.")

    hanya_firebase = sorted(set(fb) - {b["email"] for b in staff})
    if hanya_firebase:
        print()
        print(f"Ada di Firebase tetapi tidak ada di D1 ({len(hanya_firebase)}):")
        for email in hanya_firebase:
            print(f"  - {email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
