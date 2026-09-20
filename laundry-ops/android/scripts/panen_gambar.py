#!/usr/bin/env python3
"""Ambil tangkapan layar nyata seluruh menu untuk dokumentasi.

Pakai:  python3 panen_gambar.py <email> <sandi> <label> <folder_tujuan>

Menghasilkan satu PNG per menu di folder tujuan, plus `daftar.json` berisi judul yang benar-benar
terlihat di tiap layar. Judul itu dipakai sebagai caption di dokumen, bukan dikarang.

Menu yang tidak dapat dibuka tetap dicatat dengan `terbuka: false` supaya tidak ada gambar palsu
yang menyamar sebagai tangkapan asli.
"""
import html
import json
import os
import re
import subprocess
import sys
import time

ADB = "/opt/homebrew/share/android-commandlinetools/platform-tools/adb"
PKG = "com.cuciin.laundryops.debug"
ACT = f"{PKG}/com.cuciin.laundryops.MainActivity"
EMAIL, SANDI, LABEL, TUJUAN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

MENU = [
    "Antrian laundry", "Service baru", "Absensi karyawan", "Daftar Aset Cabang",
    "Biaya operasional", "Tutup kas",
    "Pelanggan", "WA menunggu", "Arsip WA",
    "Laporan transaksi", "Laporan analitik", "Riwayat aktivitas",
    "Cabang", "Daftar User", "Layanan & harga", "Produk stok",
    "Kontrol Akses Role", "Pengaturan Owner",
    "Akun & profil", "Theme Aplikasi", "Riwayat versi",
]

NAMA_BERKAS = {
    "Antrian laundry": "01-antrian-laundry",
    "Service baru": "02-service-baru",
    "Absensi karyawan": "03-absensi-karyawan",
    "Daftar Aset Cabang": "04-daftar-aset-cabang",
    "Biaya operasional": "05-biaya-operasional",
    "Tutup kas": "06-tutup-kas",
    "Pelanggan": "07-pelanggan",
    "WA menunggu": "08-wa-menunggu",
    "Arsip WA": "09-arsip-wa",
    "Laporan transaksi": "10-laporan-transaksi",
    "Laporan analitik": "11-laporan-analitik",
    "Riwayat aktivitas": "12-riwayat-aktivitas",
    "Cabang": "13-cabang",
    "Daftar User": "14-daftar-user",
    "Layanan & harga": "15-layanan-harga",
    "Produk stok": "16-produk-stok",
    "Kontrol Akses Role": "17-kontrol-akses-role",
    "Pengaturan Owner": "18-pengaturan-owner",
    "Akun & profil": "19-akun-profil",
    "Theme Aplikasi": "20-theme-aplikasi",
    "Riwayat versi": "21-riwayat-versi",
}

PENANDA_MODUL = (
    "Atur urutan menu", "Pekerjaan harian", "Keuangan", "Laporan", "Master data", "Aplikasi",
    "Kontrol Akses Role", "Produk stok", "Daftar Aset Cabang",
)


def sh(*a):
    return subprocess.run([ADB, "shell", *a], capture_output=True, text=True).stdout


def dump(n):
    for _ in range(4):
        sh("pkill", "-f", "uiautomator")
        sh("rm", "-f", f"/sdcard/{n}.xml")
        kel = sh("uiautomator", "dump", f"/sdcard/{n}.xml")
        if "ERROR" in kel or "already registered" in kel:
            time.sleep(1.5)
            continue
        isi = subprocess.run([ADB, "exec-out", "cat", f"/sdcard/{n}.xml"],
                             capture_output=True, text=True).stdout
        if isi.strip():
            return html.unescape(isi)
        time.sleep(1.5)
    return ""


def simpul(x):
    out = []
    for m in re.finditer(r"<node[^>]*>", x):
        n = m.group(0)
        t = re.search(r'text="([^"]*)"', n)
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = (int(b.group(i)) for i in (1, 2, 3, 4))
        out.append({"text": t.group(1) if t else "", "cx": (x1 + x2) // 2, "cy": (y1 + y2) // 2,
                    "click": 'clickable="true"' in n, "box": (x1, y1, x2, y2),
                    "cls": (re.search(r'class="([^"]*)"', n) or [None, ""])[1]})
    return out


def teks(x):
    return [s["text"] for s in simpul(x) if s["text"].strip()]


def pembungkus_klik(simp, s):
    x1, y1, x2, y2 = s["box"]
    kand = []
    for o in simp:
        if not o["click"]:
            continue
        a1, b1, a2, b2 = o["box"]
        if a1 <= x1 and b1 <= y1 and a2 >= x2 and b2 >= y2:
            kand.append((((a2 - a1) * (b2 - b1)), o))
    return min(kand)[1] if kand else None


def tap(xy, j=2.0):
    sh("input", "tap", str(xy[0]), str(xy[1]))
    time.sleep(j)


def di_modul(x=None):
    x = x or dump("cek")
    t = teks(x)
    if any("Kelola laundry" in s for s in t) or any("Atur urutan menu" in s for s in t):
        return True
    return sum(1 for p in PENANDA_MODUL if any(p in s for s in t)) >= 2


def tab_modul(x=None):
    x = x or dump("tab")
    simp = simpul(x)
    t = [s for s in simp if s["text"].strip() == "Modul" and s["cy"] > 2100]
    if not t:
        return None
    for s in simp:
        if s["click"] and abs(s["cx"] - t[0]["cx"]) <= 20 and s["cy"] > 2000:
            return s
    return t[0]


def ke_modul():
    for _ in range(3):
        if di_modul():
            return True
        m = tab_modul()
        if not m:
            sh("input", "keyevent", "4")
            time.sleep(1.5)
            continue
        tap((m["cx"], m["cy"]), 2.2)
        if di_modul():
            return True
    return False


def buka(label):
    if not ke_modul():
        return False
    for i in range(8):
        if i and not di_modul():
            if not ke_modul():
                return False
        x = dump("bm")
        simp = simpul(x)
        t = [s for s in simp if s["text"].strip() == label]
        t = [s for s in t if pembungkus_klik(simp, s)]
        if t:
            titik = pembungkus_klik(simp, t[0])
            tap((titik["cx"], titik["cy"]), 3.5)
            time.sleep(1.2)
            return True
        sh("input", "swipe", "540", "1900", "540", "1400", "250")
        time.sleep(0.8)
    return False


def login():
    x = dump("l0")
    for i in range(4):
        if any(s["cls"].endswith("EditText") for s in simpul(x)):
            break
        b = [s for s in simpul(x) if s["text"] in ("Lewati", "Lanjut")]
        if not b:
            break
        tap((b[0]["cx"], b[0]["cy"]), 3.0)
        x = dump(f"l{i}")
    et = [s for s in simpul(x) if s["cls"].endswith("EditText")]
    if len(et) < 2:
        return False
    tap((et[0]["cx"], et[0]["cy"]), 1.2)
    sh("input", "text", EMAIL)
    time.sleep(1.2)
    sh("input", "keyevent", "61")
    time.sleep(1.0)
    sh("input", "text", SANDI)
    time.sleep(1.2)
    sh("input", "keyevent", "111")
    time.sleep(1.5)
    b = [s for s in simpul(dump("l9")) if s["text"] == "Masuk"]
    if not b:
        return False
    tap((b[0]["cx"], b[0]["cy"]), 16.0)
    return True


def peran_sekarang():
    if not ke_modul():
        return None
    for _ in range(3):
        for t in teks(dump("rp")):
            if "\u00b7" in t and any(r in t for r in ("Owner", "Kasir", "SPV", "Supervisor", "Gudang")):
                return t
        time.sleep(1.0)
    return None


def tangkap(nama):
    os.makedirs(TUJUAN, exist_ok=True)
    jalur = os.path.join(TUJUAN, f"{nama}.png")
    with open(jalur, "wb") as f:
        f.write(subprocess.run([ADB, "exec-out", "screencap", "-p"],
                               capture_output=True).stdout)
    return jalur


print(f"########## PANEN GAMBAR: {LABEL} ##########")
if peran_sekarang() is None:
    print("   masuk akun...")
    if not login():
        sys.exit("gagal masuk akun")
print(f"   peran: {peran_sekarang()}")

hasil = []
for label in MENU:
    dibuka = buka(label)
    terbuka = False
    judul = []
    if dibuka:
        x = dump("cekjudul")
        judul = [t for t in teks(x) if len(t) < 60][:6]
        terbuka = not di_modul(x)
    nama = NAMA_BERKAS[label]
    jalur = tangkap(nama) if terbuka else None
    hasil.append({"menu": label, "berkas": os.path.basename(jalur) if jalur else None,
                  "terbuka": terbuka, "judul": judul})
    tanda = "OK  " if terbuka else "CEK "
    print(f"   {tanda} {label:22} -> {os.path.basename(jalur) if jalur else '-'}")
    if label in ("Antrian laundry", "Service baru", "Pelanggan", "Laporan transaksi"):
        tap((62, 2304), 2.0)

with open(os.path.join(TUJUAN, "daftar.json"), "w") as f:
    json.dump(hasil, f, ensure_ascii=False, indent=2)

buka("Akun & profil")
print(f"\n   gambar tersimpan: {sum(1 for h in hasil if h['terbuka'])}/{len(MENU)}")
print(f"   folder: {TUJUAN}")
