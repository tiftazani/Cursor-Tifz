"""Hapus akun Firebase yang tidak punya baris staff di D1 (email terkunci).

Akun seperti itu tidak bisa login (server menolak) dan tidak bisa daftar ulang
(Firebase menolak: EMAIL_EXISTS). Skrip ini membebaskan emailnya.

Pakai: python3 cloudflare/scripts/hapus_akun_terkunci.py email1 [email2 ...]
Butuh access token OAuth2 firebase-tools di /tmp/.fb_access (ambil lewat
segarkan_token() di cek_akun_vs_firebase.py; hapus berkasnya setelah dipakai).
Hanya menghapus akun yang memang TIDAK ada baris staff-nya di D1.
"""
import json, os, subprocess, sys, urllib.error, urllib.request

PROJECT = "cuciin-ops"
ACCESS = "/tmp/.fb_access"
HERE = os.path.dirname(os.path.abspath(__file__))


def fb_get(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {open(ACCESS).read().strip()}"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


def fb_users():
    out, page = [], None
    while True:
        url = f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:batchGet?maxResults=1000"
        if page:
            url += f"&nextPageToken={page}"
        data = fb_get(url)
        out += data.get("users", [])
        page = data.get("nextPageToken")
        if not page:
            return out


def d1_staff():
    raw = subprocess.run(
        ["npx", "--no-install", "wrangler", "d1", "execute", "cuciin-db", "--remote", "--json",
         "--command", "SELECT lower(email) AS e FROM staff"],
        cwd=os.path.join(HERE, ".."), capture_output=True, text=True).stdout
    return {r["e"] for r in json.loads(raw[raw.index("["):])[0]["results"]}


def main(emails):
    if not emails:
        print("sebutkan email yang mau dihapus")
        return 2
    staff = d1_staff()
    users = {u.get("email", "").lower(): u for u in fb_users()}
    hapus, lewat = [], []
    for e in emails:
        e = e.lower()
        u = users.get(e)
        if not u:
            print(f"  LEWAT {e}: tidak ada di Firebase")
        elif e in staff:
            print(f"  TOLAK {e}: masih punya baris staff di D1")
        else:
            hapus.append(u["localId"])
            print(f"  HAPUS {e} ({u['localId']})")
    if not hapus:
        print("tidak ada yang dihapus")
        return 0
    # force:true wajib; tanpa itu API balas 200 {} tapi tidak menghapus apa pun.
    body = json.dumps({"localIds": hapus, "force": True}).encode()
    req = urllib.request.Request(
        f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:batchDelete",
        data=body, headers={"Authorization": f"Bearer {open(ACCESS).read().strip()}",
                            "Content-Type": "application/json"})
    try:
        json.loads(urllib.request.urlopen(req, timeout=60).read() or b"{}")
        print(f"\n{len(hapus)} akun dihapus dari Firebase.")
    except urllib.error.HTTPError as err:
        print(f"\nGAGAL ({err.code}): {err.read().decode()[:400]}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
