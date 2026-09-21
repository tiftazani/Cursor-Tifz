#!/usr/bin/env python3
"""Pulihkan state perangkat ke kondisi server, lewat jalur yang sah.

Masalah yang diselesaikan: perangkat ini menyimpan state uji yang berbeda dari server —
`aidanurita25@gmail.com` berperan Supervisor di perangkat padahal Kasir di server, akun uji
`gudang-uji@contoh.test` masih ada, dan dua role uji "Gudang" masih tersimpan.

Cara kerja: akun **Owner** masuk, lalu state perangkat dibiarkan menerima snapshot server.
Karena `role` dan `accessRole` sekarang milik server (perbaikan `serverOwnedEntities`), snapshot
server yang masuk akan menurunkan Aida kembali ke Kasir tanpa mengangkat apa pun ke server.

Akun uji dihapus lewat UI Owner (Daftar User), bukan dengan menyunting JSON perangkat.
"""
import html
import re
import subprocess
import sys
import time

ADB = "/opt/homebrew/share/android-commandlinetools/platform-tools/adb"
PKG = "com.cuciin.laundryops.debug"
ACT = f"{PKG}/com.cuciin.laundryops.MainActivity"


def sh(*a):
    return subprocess.run([ADB, "shell", *a], capture_output=True, text=True).stdout


def dump(n):
    for _ in range(4):
        sh("pkill", "-f", "uiautomator")
        sh("rm", "-f", f"/sdcard/{n}.xml")
        out = sh("uiautomator", "dump", f"/sdcard/{n}.xml")
        if "ERROR" in out or "already registered" in out:
            time.sleep(1.5); continue
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
        out.append({"text": t.group(1) if t else "", "cx": (x1 + x2) // 2,
                    "cy": (y1 + y2) // 2, "click": 'clickable="true"' in n,
                    "box": (x1, y1, x2, y2)})
    return out


def teks(x):
    return [s["text"] for s in simpul(x) if s["text"].strip()]


def tap(xy, j=2.0):
    sh("input", "tap", str(xy[0]), str(xy[1]))
    time.sleep(j)


def segar():
    sh("am", "force-stop", PKG)
    time.sleep(1.5)
    sh("am", "start", "-n", ACT)
    time.sleep(9)


def login(email, sandi):
    x = dump("l0")
    et = [s for s in simpul(x) if "EditText" in s["text"] or s["text"] == ""]
    et = [s for s in simpul(x) if s["box"][3] - s["box"][1] > 80 and s["box"][2] - s["box"][0] > 500]
    if len(et) < 2:
        print("   field login tidak ketemu:", teks(x)[:6])
        return False
    tap((et[0]["cx"], et[0]["cy"]), 1.2)
    sh("input", "text", email)
    time.sleep(1.2)
    sh("input", "keyevent", "61")
    time.sleep(1.0)
    sh("input", "text", sandi)
    time.sleep(1.2)
    sh("input", "keyevent", "111")
    time.sleep(1.5)
    b = [s for s in simpul(dump("l9")) if s["text"] == "Masuk"]
    if not b:
        print("   tombol Masuk tidak ketemu")
        return False
    tap((b[0]["cx"], b[0]["cy"]), 16.0)
    return True


if __name__ == "__main__":
    print("=== pulihkan perangkat ke state server ===")
    print("Langkah manual: masuk Owner, tunggu sinkronisasi, lalu periksa role Aida.")
