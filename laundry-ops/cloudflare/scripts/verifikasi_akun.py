"""Verifikasi akun login setelah perbaikan data.

Untuk setiap staf D1: coba login dengan kata sandi awal aplikasi (test1234),
lalu panggil /v1/me untuk memastikan server menerima identitasnya.
Memakai User-Agent mirip aplikasi Android karena Cloudflare menolak UA skrip.
"""
import json
import urllib.error
import urllib.request

WORKER = "https://cuciin-api.tiftazani-cuciin.workers.dev"
KEY = json.load(open("android/app/google-services.json"))["client"][0]["api_key"][0]["current_key"]
SIGNIN = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={KEY}"
UA = "okhttp/4.12.0"
PASSWORD = "test1234"

D1_STAFF = json.load(open("/tmp/d1_staff.json"))
rows = D1_STAFF[0]["results"] if isinstance(D1_STAFF, list) else D1_STAFF["results"]
emails = sorted(r["email"] for r in rows)

print("=== login tiap staf D1 dengan kata sandi awal ===\n")
ok, bad = [], []
for email in emails:
    body = json.dumps({"email": email, "password": PASSWORD, "returnSecureToken": True}).encode()
    req = urllib.request.Request(SIGNIN, data=body, headers={"Content-Type": "application/json", "User-Agent": UA})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        data = json.loads(r.read())
        token = data.get("idToken")
    except urllib.error.HTTPError as e:
        err = json.loads(e.read().decode()).get("error", {}).get("message")
        print(f"  GAGAL  {email:42s} {err}")
        bad.append(email)
        continue
    req2 = urllib.request.Request(f"{WORKER}/v1/me", headers={"Authorization": f"Bearer {token}", "User-Agent": UA})
    try:
        r2 = urllib.request.urlopen(req2, timeout=30)
        me = json.loads(r2.read())
        print(f"  OK     {email:42s} role={me.get('role'):10s} cabang={len(me.get('branchIds', []))} nama={me.get('name')}")
        ok.append(email)
    except urllib.error.HTTPError as e2:
        print(f"  /v1/me {e2.code}  {email:42s} {e2.read().decode()[:80]}")
        bad.append(email)

print(f"\nringkas: {len(ok)} bisa login, {len(bad)} gagal")
if bad:
    print("gagal:", ", ".join(bad))
