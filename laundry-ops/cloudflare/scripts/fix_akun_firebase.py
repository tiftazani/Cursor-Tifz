"""Buat akun login Firebase untuk staf yang ditambahkan Owner lewat layar "Pengguna baru".

Akun-akun ini ada di D1 tapi tidak pernah punya akun Firebase, jadi tidak mungkin login.
Sandi awal yang dipakai = test1234 (sandi awal aplikasi, sesuai yang sudah diketik staf).

Langkah per akun:
  1. signIn dengan test1234 -> kalau berhasil, akun sudah ada dan benar.
  2. kalau belum ada, signUp dengan test1234.
  3. signIn ulang -> ambil idToken.
  4. GET /v1/me dengan token itu -> buktikan server mengizinkan (role + cabang).

Hanya mencetak status, bukan token atau sandi.
"""
import json
import urllib.error
import urllib.request

WORKER = "https://cuciin-api.tiftazani-cuciin.workers.dev"
KEY = json.load(open("android/app/google-services.json"))["client"][0]["api_key"][0]["current_key"]
SIGNIN = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={KEY}"
SIGNUP = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}"
PASSWORD = "test1234"

EMAILS = [
    "alfinhumendru@gmail.com",
    "febriansyah.atmaja98@gmail.com",
    "ihsanibnuabdurrauf@gmail.com",
    "rochnatillah22@gmail.com",
    "tsanaulaila78@gmail.com",
]


def post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def sign_in(email):
    code, data = post(SIGNIN, {"email": email, "password": PASSWORD, "returnSecureToken": True})
    return (data.get("idToken"), data.get("localId")) if code == 200 else (None, None)


def sign_up(email):
    code, data = post(SIGNUP, {"email": email, "password": PASSWORD, "returnSecureToken": True})
    if code == 200:
        return "created", data.get("localId")
    return data.get("error", {}).get("message", f"HTTP {code}"), None


def me(token):
    req = urllib.request.Request(f"{WORKER}/v1/me", headers={"Authorization": f"Bearer {token}"})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:120]


print("=== perbaikan akun login Firebase ===\n")
for email in EMAILS:
    token, uid = sign_in(email)
    if token:
        print(f"[{email}] akun sudah ada (login berhasil)")
    else:
        result, uid = sign_up(email)
        if result == "created":
            print(f"[{email}] akun DIBUAT (uid={str(uid)[:10]}...)")
            token, uid = sign_in(email)
            if not token:
                print(f"[{email}] !! dibuat tapi login ulang gagal")
                continue
        else:
            print(f"[{email}] !! gagal dibuat: {result}")
            continue
    status, body = me(token)
    if status == 200 and isinstance(body, dict):
        print(f"[{email}] /v1/me OK: role={body.get('role')} nama={body.get('name')} cabang={len(body.get('branchIds', []))}")
    else:
        print(f"[{email}] !! /v1/me HTTP {status}: {body}")
    print()
