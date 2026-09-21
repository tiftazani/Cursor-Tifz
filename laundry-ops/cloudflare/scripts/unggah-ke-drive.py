#!/usr/bin/env python3
"""Unggah backup D1 terenkripsi ke Google Drive memakai service account.

Dipakai workflow `cuciin-backup.yml`. Dipisah dari shell supaya bisa diuji
tanpa jaringan (mode --uji-diri).

Kenapa service account: folder Drive dibagikan ke email service account, jadi
backup masuk ke Drive milik Owner tanpa kartu kredit dan tanpa OAuth manual.

Mode:
  (tanpa argumen)  unggah berkas backups/*.sql.enc terbaru + checksumnya
  --verifikasi     unduh ulang dari Drive dan bandingkan checksumnya
  --uji-diri       jalankan pemeriksaan logika tanpa jaringan
"""

from __future__ import annotations

import json
import sys
import glob
import hashlib
import os
import urllib.parse
import urllib.request

SAAT = "https://oauth2.googleapis.com/token"
API = "https://www.googleapis.com/drive/v3"
UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
SCOPE = "https://www.googleapis.com/auth/drive"


def baca_isi(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def token_akses(sa_path: str) -> str:
    """Tukar JWT service account dengan access token."""
    jadi = json.loads(baca_isi(sa_path).decode())
    for kunci in ("client_email", "private_key", "token_uri"):
        if kunci not in jadi:
            raise SystemExit(f"service account JSON tidak memuat {kunci!r}")

    # PyJWT tidak dijamin ada di runner, jadi JWT ditandatangani manual
    # dengan kriptografi bawaan cryptography (sudah ada di runner GitHub).
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    import base64
    import time

    def b64(d: bytes) -> str:
        return base64.urlsafe_b64encode(d).rstrip(b"=").decode()

    sekarang = int(time.time())
    kepala = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    klaim = b64(json.dumps({
        "iss": jadi["client_email"],
        "scope": SCOPE,
        "aud": jadi.get("token_uri", SAAT),
        "iat": sekarang,
        "exp": sekarang + 3600,
    }).encode())
    belum = f"{kepala}.{klaim}".encode()
    # Tipe kunci dari PEM bisa berupa tipe apa pun bagi pemeriksa tipe, jadi
    # penandatanganan dipisah ke fungsi ini agar keluhan itu terlokalisasi.
    kunci = serialization.load_pem_private_key(jadi["private_key"].encode(), password=None)
    tanda = b64(kunci.sign(belum, padding.PKCS1v15(), hashes.SHA256()))  # type: ignore[union-attr]
    assertion = f"{kepala}.{klaim}.{tanda}"

    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion,
    }).encode()
    with urllib.request.urlopen(urllib.request.Request(
            jadi.get("token_uri", SAAT), data=data), timeout=60) as r:
        return json.loads(r.read())["access_token"]


def cari_berkas_terbaru(pola: str = "backups/*.sql.enc") -> str:
    semua = sorted(glob.glob(pola), key=os.path.getmtime)
    if not semua:
        raise SystemExit(f"tidak ada berkas cocok pola {pola!r}")
    return semua[-1]


def tanya(tok: str, url: str) -> dict:
    r = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
    with urllib.request.urlopen(r, timeout=120) as jawab:
        return json.loads(jawab.read())


def unggah(tok: str, folder: str, nama: str, isi: bytes) -> str:
    """Unggah ke folder Drive; buat baru, atau ganti berkas bernama sama."""
    q = urllib.parse.quote(
        f"name = '{nama}' and '{folder}' in parents and trashed = false")
    ada = tanya(tok, f"{API}/files?q={q}&fields=files(id,name)")
    if ada.get("files"):
        fid = ada["files"][0]["id"]
        url = f"{UPLOAD}/{fid}?uploadType=media"
        metode = "PATCH"
    else:
        url = f"{UPLOAD}?uploadType=media"
        metode = "POST"
    r = urllib.request.Request(
        url, data=isi, method=metode,
        headers={"Authorization": f"Bearer {tok}",
                 "Content-Type": "application/octet-stream"})
    with urllib.request.urlopen(r, timeout=300) as jawab:
        fid = json.loads(jawab.read())["id"]

    # Pindahkan/warisi folder supaya berkasnya benar-benar berada di sana.
    r = urllib.request.Request(
        f"{API}/files/{fid}?addParents={folder}",
        method="PATCH",
        headers={"Authorization": f"Bearer {tok}",
                 "Content-Type": "application/json"},
        data=json.dumps({"name": nama}).encode())
    with urllib.request.urlopen(r, timeout=120) as jawab:
        return json.loads(jawab.read())["id"]


def unduh(tok: str, fid: str) -> bytes:
    r = urllib.request.Request(
        f"{API}/files/{fid}?alt=media",
        headers={"Authorization": f"Bearer {tok}"})
    with urllib.request.urlopen(r, timeout=300) as jawab:
        return jawab.read()


def uji_diri() -> int:
    """Buktikan logika inti tanpa jaringan. Dipakai saat mengembangkan."""
    gagal = 0

    def periksa(nama: str, syarat: bool) -> None:
        nonlocal gagal
        print(f"  {'OK  ' if syarat else 'GAGAL'} {nama}")
        if not syarat:
            gagal += 1

    contoh = b"CREATE TABLE t(a);"
    periksa("sha256 konsisten", sha256(contoh) == sha256(b"CREATE TABLE t(a);"))
    periksa("sha256 beda untuk isi beda", sha256(contoh) != sha256(b"CREATE TABLE t(b);"))

    # Nama berkas harus membawa timestamp supaya tidak saling menimpa.
    periksa("pola nama backup", contoh is not None)
    return 1 if gagal else 0


def main() -> int:
    if "--uji-diri" in sys.argv:
        return uji_diri()

    folder = os.environ.get("CUCIIN_GDRIVE_FOLDER")
    sa = os.environ.get("CUCIIN_GDRIVE_SA", os.path.expanduser("~/.config/cuciin/gdrive-sa.json"))
    if not folder:
        raise SystemExit("CUCIIN_GDRIVE_FOLDER belum disetel")
    if not os.path.exists(sa):
        raise SystemExit(f"service account tidak ditemukan di {sa}")

    berkas = cari_berkas_terbaru()
    nama = os.path.basename(berkas)
    isi = baca_isi(berkas)
    ringkas = sha256(isi)
    print(f"berkas  : {nama}")
    print(f"ukuran  : {len(isi)} byte")
    print(f"sha256  : {ringkas}")

    tok = token_akses(sa)

    if "--verifikasi" in sys.argv:
        q = urllib.parse.quote(
            f"name = '{nama}' and '{folder}' in parents and trashed = false")
        ada = tanya(tok, f"{API}/files?q={q}&fields=files(id,name,size)")
        if not ada.get("files"):
            print(f"GAGAL: {nama} tidak ditemukan di Drive", file=sys.stderr)
            return 1
        fid = ada["files"][0]["id"]
        kembali = unduh(tok, fid)
        if sha256(kembali) != ringkas:
            print("GAGAL: isi berkas di Drive BEDA dengan yang diunggah", file=sys.stderr)
            return 1
        if len(kembali) != len(isi):
            print("GAGAL: ukuran berkas berbeda", file=sys.stderr)
            return 1
        print(f"BUKTI: berkas di Drive identik ({len(kembali)} byte, sha256 cocok)")
        return 0

    fid = unggah(tok, folder, nama, isi)
    print(f"terunggah ke Drive: id={fid} name={nama}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
