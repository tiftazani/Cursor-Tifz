#!/usr/bin/env python3
"""Uji login Cuciin lewat adb, tanpa koordinat hardcoded.

Pelajarannya: koordinat tombol di layar ini BERGESER saat keyboard lunak
terbuka (email 637->629, sandi 831->751, Masuk 1037->957), dan tombol
"Lupa kata sandi?" menempati y yang sama dengan Masuk saat keyboard
terbuka. Angka koordinat lama di catatan sudah menyesatkan: tap di 957
kena "Lupa kata sandi?", bukan tombol Masuk. Karena itu skrip ini selalu
membaca ulang bounds dari uiautomator dump sebelum setiap tap.

Pakai: python3 uji_login.py <paket> <email> <sandi>
"""
import html
import re
import subprocess
import sys
import time

ADB = "/opt/homebrew/share/android-commandlinetools/platform-tools/adb"
NODE = re.compile(r"<node[^>]*>")


def sh(*args, timeout=120):
    return subprocess.run([ADB, *args], capture_output=True, text=True, timeout=timeout).stdout


def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/_u.xml")
    xml = subprocess.run(
        [ADB, "exec-out", "cat", "/sdcard/_u.xml"], capture_output=True, timeout=120
    ).stdout.decode("utf-8", "replace")
    return html.unescape(xml)


def nodes(xml):
    out = []
    for m in NODE.finditer(xml):
        s = m.group(0)
        b = re.search(r'bounds="\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]"', s)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        out.append(
            {
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "cx": (x1 + x2) // 2, "cy": (y1 + y2) // 2,
                "w": x2 - x1, "h": y2 - y1,
                "text": (re.search(r'text="([^"]*)"', s).group(1) if re.search(r'text="([^"]*)"', s) else ""),
                "cls": ((re.search(r'class="([^"]*)"', s).group(1) if re.search(r'class="([^"]*)"', s) else "?").split(".")[-1]),
                "clickable": (re.search(r'clickable="(\w+)"', s) or [None, "false"])[1] == "true",
                "checked": (re.search(r'checked="(\w+)"', s) or [None, "false"])[1] == "true",
            }
        )
    return out


def texts(xml):
    return [n["text"].strip() for n in nodes(xml) if n["text"].strip()]


def input_field(xml, index=0):
    """EditText ke-index menurut urutan atas ke bawah."""
    fields = sorted([n for n in nodes(xml) if n["cls"] == "EditText"], key=lambda n: n["y1"])
    return fields[index] if index < len(fields) else None


def wide_button(xml, label=None):
    """Tombol lebar (lebar > 800 px) = tombol aksi utama layar ini.

    Ada DUA tombol lebar di layar masuk: "Masuk" dan "Daftar akun baru".
    Mengambil yang terakhir secara posisi pernah menekan "Daftar akun baru"
    (membuka layar pendaftaran) padahal yang dimaksud tombol Masuk. Jadi
    pilih berdasarkan label teks anak di dalam bounds tombol.
    """
    lebar = [n for n in nodes(xml) if n["clickable"] and n["w"] > 800]
    if label is None:
        return lebar
    for n in lebar:
        for t in nodes(xml):
            if (
                label.lower() in t["text"].strip().lower()
                and n["x1"] <= t["cx"] <= n["x2"]
                and n["y1"] <= t["cy"] <= n["y2"]
            ):
                return [n]
    return []


def ime_shown():
    out = sh("shell", "dumpsys", "input_method")
    m = re.search(r"mInputShown=(\w+)", out)
    return m.group(1) == "true" if m else None


def hide_ime():
    """Tutup keyboard dengan aman.

    keyevent 4 menutup keyboard hanya kalau keyboard memang terbuka; kalau
    sudah tertutup, tombol itu keluar dari aplikasi. mInputShown terlambat
    memperbarui statusnya, jadi menutup dua kali berturut-turut pernah
    membuat aplikasi keluar ke home screen. Karena itu: hanya kirim BACK
    kalau dump menunjukkan keyboard benar-benar tampil, dan cukup sekali.
    """
    if ime_shown():
        sh("shell", "input", "keyevent", "4")
        time.sleep(1.5)
    return not ime_shown()


def ime_shown_from(xml):
    """Keyboard terbaca dari dump UI: ada elemen milik paket input method."""
    return any(n["cls"] in ("EditText", "KeyboardView") and n["y1"] > 1500 for n in nodes(xml)) or \
        "com.google.android.inputmethod" in xml


def main():
    if len(sys.argv) != 4:
        print("pakai: uji_login.py <paket> <email> <sandi>", file=sys.stderr)
        return 2
    pkg, email, sandi = sys.argv[1:4]
    hasil = {}

    sh("shell", "am", "force-stop", pkg)
    time.sleep(2)
    sh("shell", "am", "start", "-n", f"{pkg}/com.cuciin.laundryops.MainActivity")
    time.sleep(13)

    xml = dump()
    hasil["layar_awal"] = texts(xml)[:6]
    f = input_field(xml, 0)
    if not f:
        print("TIDAK ADA kolom input; layar:", hasil["layar_awal"])
        return 1
    sh("shell", "input", "tap", str(f["cx"]), str(f["cy"]))
    time.sleep(2)
    sh("shell", "input", "text", email)
    time.sleep(2)

    # Jangan tutup keyboard: bounds tombol dibaca ulang dari dump saat
    # keyboard masih terbuka, jadi tidak perlu menormalkan tata letak.
    xml = dump()
    f = input_field(xml, 1)
    if not f:
        print("TIDAK ADA kolom sandi; layar:", texts(xml)[:8])
        return 1
    sh("shell", "input", "tap", str(f["cx"]), str(f["cy"]))
    time.sleep(2)
    sh("shell", "input", "text", sandi)
    time.sleep(2)

    # Tap di area judul dulu supaya fokus keluar dari kolom, tanpa BACK.
    xml = dump()
    kepala = [n for n in nodes(xml) if n["cls"] == "TextView" and n["y1"] < 400]
    if kepala:
        sh("shell", "input", "tap", str(kepala[0]["cx"]), str(kepala[0]["cy"]))
        time.sleep(1.5)

    xml = dump()
    btn = wide_button(xml, label="Masuk")
    if not btn:
        print("TIDAK ADA tombol Masuk; layar:", texts(xml)[:8])
        return 1
    b = btn[-1]
    hasil["teks_sebelum_tap"] = texts(xml)[:8]
    hasil["ketikan_masuk"] = [n["text"] for n in nodes(xml) if n["cls"] == "EditText"]
    hasil["tap_di"] = (b["cx"], b["cy"])

    sh("logcat", "-c")
    sh("shell", "input", "tap", str(b["cx"]), str(b["cy"]))
    time.sleep(3)

    xml = dump()
    hasil["teks_3dtk"] = texts(xml)[:10]
    hasil["selesai_kirim"] = sh("logcat", "-d")

    for k, v in hasil.items():
        if k == "selesai_kirim":
            baris = [l for l in v.splitlines() if re.search(r"FirebaseAuth|Recaptcha", l)]
            print("log_auth:")
            for l in baris[-4:]:
                print("   ", l.split(": ", 1)[-1][:110])
        elif k == "tap_di":
            print(f"tap_di              : {v}")
        else:
            print(f"{k:20}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
