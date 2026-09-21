"""Setel template email auth Firebase cuciin-ops.

Owner ingin email reset sandi menampilkan "Aplikasi Cuciin", bukan
"project-634935388002" (ID numerik project), dan ingin ada keterangan bahwa
email dikirim otomatis.

Cara kerja: `%APP_NAME%` diganti literal "Aplikasi Cuciin" di subject dan body.
Placeholder lain (%EMAIL%, %LINK%, %DISPLAY_NAME%, %NEW_EMAIL%) DIBIARKAN supaya
Firebase tetap mengisinya.

Pakai: python3 email_auth_firebase.py            (baca saja)
       python3 email_auth_firebase.py --tulis    (tulis perubahan)
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
BASE = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT}/config"

NAMA = "Aplikasi Cuciin"
AUTO = "Email ini dikirim otomatis oleh sistem, mohon jangan dibalas."


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
        return int(kode) if kode.isdigit() else 0, {"raw": out[:400]}


def tambah_auto(body: str) -> str:
    """Sisipkan keterangan email otomatis sekali saja, tepat sebelum penutup."""
    if AUTO in body:
        return body
    penanda = "<p>Terima Kasih,</p>"
    sisip = f"<p>{AUTO}</p>\n"
    return body.replace(penanda, sisip + penanda, 1) if penanda in body else body + "\n" + sisip


def ubah(t: dict) -> dict:
    baru = dict(t)
    for k in ("subject", "body"):
        if k in baru:
            baru[k] = baru[k].replace("%APP_NAME%", NAMA)
    baru["body"] = tambah_auto(baru["body"])
    return baru


if __name__ == "__main__":
    tulis = "--tulis" in sys.argv
    tok = segarkan_token()

    kode, d = panggil("GET", BASE, tok)
    if kode != 200:
        raise SystemExit(f"baca config gagal: HTTP {kode} {json.dumps(d)[:300]}")
    se = d["notification"]["sendEmail"]

    kirim, rencana = {}, {}
    for nama in ("resetPasswordTemplate", "verifyEmailTemplate", "changeEmailTemplate"):
        if nama in se:
            kirim[nama] = ubah(se[nama])
            rencana[nama] = kirim[nama]

    print("=== RENCANA PERUBAHAN ===")
    for nama, t in rencana.items():
        print(f"\n  --- {nama} ---")
        print(f"  subject : {t['subject']!r}")
        print(f"  body    : {t['body']!r}")

    if not tulis:
        print("\n(baca saja; tambahkan --tulis untuk menerapkan)")
        raise SystemExit(0)

    print("\n=== TERAPKAN (PATCH) ===")
    body = {"notification": {"sendEmail": kirim}}
    kode, d = panggil("PATCH", BASE + "?updateMask=notification.sendEmail", tok, body)
    print(f"  HTTP {kode}")
    print("  ", json.dumps(d)[:600] if kode != 200 else "diterima")

    print("\n=== BACA ULANG untuk bukti ===")
    kode, d = panggil("GET", BASE, tok)
    se2 = d.get("notification", {}).get("sendEmail", {})
    for nama in kirim:
        t = se2.get(nama, {})
        print(f"\n  --- {nama} ---")
        print(f"  subject : {t.get('subject')!r}")
        print(f"  body    : {t.get('body')!r}")
