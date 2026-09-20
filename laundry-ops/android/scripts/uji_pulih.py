#!/usr/bin/env python3
"""Buka aplikasi sebagai Owner, tunggu sinkronisasi, lalu laporkan state perangkat.

Dipakai untuk membuktikan perbaikan `serverOwnedEntities`: state perangkat harus mengikuti
snapshot server (Aida kembali Kasir), bukan sebaliknya.
"""
import html
import re
import subprocess
import sys
import time

ADB = "/opt/homebrew/share/android-commandlinetools/platform-tools/adb"
PKG = "com.cuciin.laundryops.debug"
ACT = f"{PKG}/com.cuciin.laundryops.MainActivity"
EMAIL, SANDI = sys.argv[1], sys.argv[2]


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
                    "cy": (y1 + y2) // 2, "box": (x1, y1, x2, y2)})
    return out


def teks(x):
    return [s["text"] for s in simpul(x) if s["text"].strip()]


def tap(xy, j=2.0):
    sh("input", "tap", str(xy[0]), str(xy[1])); time.sleep(j)


def segar():
    sh("am", "force-stop", PKG); time.sleep(1.5)
    sh("am", "start", "-n", ACT); time.sleep(9)


def login():
    x = dump("l0")
    et = [s for s in simpul(x) if s["box"][3] - s["box"][1] > 80 and s["box"][2] - s["box"][0] > 500]
    if len(et) < 2:
        print("   bukan layar login:", teks(x)[:8]); return False
    tap((et[0]["cx"], et[0]["cy"]), 1.2)
    sh("input", "text", EMAIL); time.sleep(1.2)
    sh("input", "keyevent", "61"); time.sleep(1.0)
    sh("input", "text", SANDI); time.sleep(1.2)
    sh("input", "keyevent", "111"); time.sleep(1.5)
    b = [s for s in simpul(dump("l9")) if s["text"] == "Masuk"]
    if not b:
        print("   tombol Masuk tidak ketemu"); return False
    tap((b[0]["cx"], b[0]["cy"]), 18.0)
    return True


print("=== buka sebagai Owner, tunggu sinkronisasi ===")
segar()
t = teks(dump("awal"))
if not any("Antrian laundry" in s for s in t):
    if not login():
        sys.exit("login gagal")
print("   beranda:", [s for s in teks(dump("bd")) if "Antrian" in s or "Minggu" in s][:3])

print("   tunggu sinkronisasi 45 detik ...")
time.sleep(45)

print("\n=== state perangkat sesudah sinkronisasi ===")
sh("am", "force-stop", PKG); time.sleep(3)
data = subprocess.run([ADB, "exec-out", "run-as", PKG, "cat", "files/cuciin-data.json"],
                      capture_output=True, text=True).stdout
import json
d = json.loads(data)
for s in sorted(d.get("staff", []), key=lambda x: x["email"]):
    tanda = "  <<< UJI" if "gudang-uji" in s["email"] or "alfin" in s["email"] else ""
    print(f"  {s['email']:34s} {s.get('name',''):12s} role={s.get('role','')}{tanda}")
print(f"\n  jumlah staff: {len(d['staff'])}  (server: 8)")
print("  roles:")
for r in d.get("accessRoles", []):
    print(f"    {r['id']:26s} {r.get('name',''):12s} builtin={r.get('builtIn')}")
