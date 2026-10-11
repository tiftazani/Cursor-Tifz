"""Cari akun Firebase yang tidak punya baris staff di D1 (email terkunci).

Akun seperti itu tidak bisa dipakai login (server menolak, approved=0/tidak ada baris)
DAN tidak bisa dipakai mendaftar lagi (Firebase menolak, EMAIL_EXISTS).

Pakai: python3 cloudflare/scripts/audit_akun_yatim.py
Hanya membaca. Tidak menghapus apa pun. Token: sama seperti hapus_akun_terkunci.py.
Project Firebase dipakai bersama produksi dan debug: akun "TERKUNCI" bisa saja punya
baris staff di cuciin-debug-db; cek dulu sebelum menghapus.
"""
import json, os, subprocess, sys

PROJECT = "cuciin-ops"
ACCESS = "/tmp/.fb_access"


def token():
    return open(ACCESS).read().strip()


def firebase_users():
    import urllib.request
    out, page = [], None
    while True:
        url = f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:batchGet?maxResults=1000"
        if page:
            url += f"&nextPageToken={page}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token()}"})
        data = json.loads(urllib.request.urlopen(req, timeout=60).read())
        out += data.get("users", [])
        page = data.get("nextPageToken")
        if not page:
            return out


def d1_staff():
    raw = subprocess.run(
        ["npx", "--no-install", "wrangler", "d1", "execute", "cuciin-db", "--remote", "--json",
         "--command", "SELECT lower(email) AS e FROM staff"],
        cwd=os.path.join(os.path.dirname(__file__), ".."), capture_output=True, text=True).stdout
    start = raw.index("[")
    return {r["e"] for r in json.loads(raw[start:])[0]["results"]}


def main():
    fb, staff = firebase_users(), d1_staff()
    print(f"Akun Firebase: {len(fb)} | Baris staff D1: {len(staff)}\n")
    print(f"{'email':38s} {'status':10s} dibuat")
    print("-" * 70)
    yatim = []
    for u in sorted(fb, key=lambda x: x.get("email", "")):
        e = u.get("email", "").lower()
        if e in staff:
            print(f"{e:38s} {'OK':10s} {u.get('createdAt','')}")
        else:
            yatim.append(e)
            print(f"{e:38s} {'TERKUNCI':10s} {u.get('createdAt','')}")
    print(f"\nAkun terkunci: {len(yatim)}")
    for e in yatim:
        print("  -", e)
    json.dump(yatim, open("/tmp/akun_terkunci.json", "w"), indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
