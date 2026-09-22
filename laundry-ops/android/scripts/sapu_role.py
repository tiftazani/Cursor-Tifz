#!/usr/bin/env python3
"""Sapu seluruh menu sebagai satu akun, cari crash yang belum ketemu.

Pakai:  python3 sapu_role.py <email> <sandi> <label> <harus_ada_di_peran>
Contoh: python3 sapu_role.py kasir@contoh.test sandi-uji Kasir Kasir

Kata sandi dikirim lewat argumen atau env (mis. CUCIIN_OWNER), tidak disimpan di skrip ini.
"""
import html
import os
import re
import subprocess
import sys
import time

ADB = "/opt/homebrew/share/android-commandlinetools/platform-tools/adb"
PKG = "com.cuciin.laundryops.debug"
ACT = f"{PKG}/com.cuciin.laundryops.MainActivity"
EMAIL, SANDI, LABEL, PERAN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

MENU = [
    "Antrian laundry", "Service baru", "Absensi karyawan", "Daftar Aset Cabang",
    "Biaya operasional", "Tutup kas",
    "Pelanggan", "WA menunggu", "Arsip WA",
    "Laporan transaksi", "Laporan analitik", "Riwayat aktivitas",
    "Cabang", "Daftar User", "Layanan & harga", "Produk stok",
    "Kontrol Akses Role", "Pengaturan Owner",
    "Akun & profil", "Theme Aplikasi", "Riwayat versi",
]


# Judul yang wajib muncul di layar setelah tiap menu diklik.
#
# Tanpa daftar ini, harness hanya membuktikan "label ditemukan lalu di-tap" dan melaporkan OK.
# Menu yang menendang pengguna balik ke daftar (mis. gerbang izin yang selalu menolak) tetap
# dihitung OK, jadi bug pintu mati lolos dari sapu. Nilai None berarti rute itu memang tidak
# punya judul tetap (mis. layar dengan tab), dan hanya diperiksa lewat `fatal`.
JUDUL = {
    "Antrian laundry": "Antrian",
    "Service baru": "Service baru",
    "Absensi karyawan": "Absensi",
    "Daftar Aset Cabang": "Aset",
    "Biaya operasional": "Biaya",
    "Tutup kas": "Tutup kas",
    "Pelanggan": "Pelanggan",
    "WA menunggu": "WA",
    "Arsip WA": "Arsip",
    "Laporan transaksi": "Laporan",
    "Laporan analitik": "Analitik",
    "Riwayat aktivitas": "Riwayat aktivitas",
    "Cabang": "Cabang",
    "Daftar User": "Daftar User",
    "Layanan & harga": "Layanan",
    "Produk stok": "Produk",
    "Kontrol Akses Role": "Kontrol Akses",
    "Pengaturan Owner": "Pengaturan Owner",
    "Akun & profil": "Akun",
    "Theme Aplikasi": "Theme",
    "Riwayat versi": "Riwayat versi",
}


def sh(*a):
    return subprocess.run([ADB, "shell", *a], capture_output=True, text=True).stdout


def dump(n):
    """Dump UI, dengan pemulihan bila uiautomator menggantung atau mengembalikan isi kosong.

    Dua kegagalan yang sudah terjadi dan harus ditangani di sini:

    1. `uiautomator dump` gagal dengan "UiAutomationService ... already registered" karena proses
       uiautomator dari run sebelumnya masih menggantung. Proses itu dibunuh lalu dump diulang.
    2. Dump bisa menghasilkan berkas kosong. Tanpa pengulangan, seluruh menu setelahnya terbaca
       sebagai "tak sampai modul" padahal layarnya baik-baik saja.

    Kegagalan ini mudah disalahartikan sebagai bug aplikasi, padahal bugnya di alat.
    """
    for _ in range(4):
        sh("pkill", "-f", "uiautomator")
        sh("rm", "-f", f"/sdcard/{n}.xml")
        keluaran = sh("uiautomator", "dump", f"/sdcard/{n}.xml")
        if "ERROR" in keluaran or "already registered" in keluaran:
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


def pembungkus_klik(simp, s):
    """Container clickable terkecil yang membungkus node `s`, atau None.

    Di Compose, teks dan penangan klik ada di node BERBEDA: node teks sendiri tidak pernah
    clickable, sedangkan container pembungkusnya clickable tapi teksnya kosong. Men-tap koordinat
    node teks tetap bekerja karena container menutupi area yang sama, tetapi men-tap node yang
    TIDAK punya container clickable (mis. judul bagian) tidak melakukan apa pun. Fungsi ini yang
    membedakan keduanya.
    """
    x1, y1, x2, y2 = s["box"]
    kand = []
    for o in simp:
        if not o["click"]:
            continue
        a1, b1, a2, b2 = o["box"]
        if a1 <= x1 and b1 <= y1 and a2 >= x2 and b2 >= y2:
            kand.append((((a2 - a1) * (b2 - b1)), o))
    return min(kand)[1] if kand else None


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


# Penanda yang HANYA ada di layar Modul. "Antrian laundry" dan "Service baru" sengaja TIDAK
# dipakai meski keduanya juga nama menu, karena keduanya muncul pula di beranda dan di layar lain,
# sehingga layar beranda akan salah dikenali sebagai Modul.
PENANDA_MODUL = (
    "Atur urutan menu", "Pekerjaan harian", "Keuangan", "Laporan", "Master data", "Aplikasi",
    "Kontrol Akses Role", "Produk stok", "Daftar Aset Cabang",
)


def di_modul(x=None):
    """Apakah layar sekarang adalah daftar Modul.

    Judul "Kelola laundry" hilang setelah daftar digulir, jadi isi daftar dipakai sebagai penanda
    kedua. Versi lama jatuh ke pemeriksaan teks tab bawah ("ada Modul, tidak ada Antrian"), padahal
    keempat ikon tab lain ikut terbaca di dump sehingga "Antrian" selalu ada dan hasilnya selalu
    False. Akibatnya sapu mengira tidak pernah sampai Modul dan melaporkan "tap gagal" pada menu
    yang sebenarnya ada di layar.
    """
    x = x or dump("cek")
    t = teks(x)
    if any("Kelola laundry" in s for s in t) or any("Atur urutan menu" in s for s in t):
        return True
    return sum(1 for p in PENANDA_MODUL if any(p in s for s in t)) >= 2


def tab_modul(x=None):
    """Titik tap tab "Modul" di bilah bawah, atau None bila bilah itu tidak ada.

    Teks tab berada di dekat dasar layar, sedangkan container clickable-nya kadang dilaporkan
    dengan batas yang melewati dasar jendela, jadi pencarian tidak boleh mensyaratkan pusat
    container ada di bawah ambang tertentu. Ambang dipakai hanya untuk teksnya.
    """
    x = x or dump("tab")
    simp = simpul(x)
    t = [s for s in simp if s["text"].strip() == "Modul" and s["cy"] > 2100]
    if not t:
        return None
    for s in simp:
        if s["click"] and abs(s["cx"] - t[0]["cx"]) <= 20 and s["cy"] > 2000:
            return s
    return t[0]


def di_layar_login(x=None):
    """Apakah layar sekarang adalah form masuk (email + kata sandi).

    Penanda ini dipakai untuk MENAHAN Back. Layar masuk tidak punya tab bawah, jadi
    `ke_modul()` menekan Back tiga kali, aplikasi pindah ke latar, dan pembacaan layar
    berikutnya menampilkan peluncur Android. Akibatnya login dilaporkan "login gagal"
    padahal formnya ada dan tidak ada yang rusak. Terbukti 21 Sep pada 1.10.36-debug.
    """
    x = x or dump("login")
    simp = simpul(x)
    return sum(1 for s in simp if s["cls"].endswith("EditText")) >= 2 and any(
        "Masuk ke akun" in s["text"] for s in simp)


def ke_modul():
    """Pulang ke layar Modul dari mana pun.

    Sebagian menu membuka layar penuh yang TIDAK punya tab bawah (mis. "Laporan analitik"), jadi
    tab "Modul" tidak ada di layar dan penekanan tab mustahil. Karena itu bila tab tidak terlihat,
    tekan Back beberapa kali lebih dulu sampai kerangka bertab kembali. Tanpa langkah ini, semua
    menu sesudah layar penuh dilaporkan "tap gagal" padahal tidak ada yang rusak.

    Layar masuk dikecualikan: di sana Back tidak menaikkan apa pun, ia hanya menaruh aplikasi
    ke latar. Tanpa pengecualian ini, sapu tidak pernah bisa login.
    """
    for putaran in range(3):
        if di_modul():
            return True
        if di_layar_login():
            return False
        m = tab_modul()
        if not m:
            sh("input", "keyevent", "4")
            time.sleep(1.5)
            continue
        tap((m["cx"], m["cy"]), 2.2)
        if di_modul():
            return True
    return False


def login_owner():
    """Masuk sebagai Owner memakai kredensial dari env CUCIIN_OWNER.

    Dipakai HANYA untuk memulihkan scope perangkat setelah sapu peran selesai. Kredensial tidak
    ditulis di berkas ini.
    """
    global EMAIL, SANDI
    simpan = (EMAIL, SANDI)
    akun = os.environ.get("CUCIIN_OWNER", "")
    if ":" not in akun:
        return False
    EMAIL, SANDI = akun.split(":", 1)
    try:
        return login()
    finally:
        EMAIL, SANDI = simpan


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
    """Judul peran di layar Modul, mis. "Cuciin · Owner".

    Dicoba beberapa kali karena layar Modul butuh sepersekian detik untuk selesai digambar setelah
    tab ditekan. Membaca sekali membuat hasilnya None pada sapu yang sebenarnya sudah masuk akun,
    dan pemanggilnya lalu menyimpulkan perlu login ulang padahal tidak.
    """
    if not ke_modul():
        return None
    for _ in range(3):
        for t in teks(dump("rp")):
            if "·" in t and any(r in t for r in ("Owner", "Kasir", "SPV", "Supervisor", "Gudang")):
                return t
        time.sleep(1.0)
    return None


def keluar_akun():
    if not ke_modul():
        return False
    for i in range(10):
        k = [s for s in simpul(dump(f"k{i}")) if "Keluar dari akun" in s["text"]]
        if k:
            tap((k[0]["cx"], k[0]["cy"]), 4.5)
            return True
        sh("input", "swipe", "540", "1900", "540", "1500", "250")
        time.sleep(0.9)
    return False


def buka_menu(label):
    """Membuka satu menu dan MEMBUKTIKAN layarnya benar-benar terbuka.

    Kembalian: (ditemukan, terbuka, judul).

    - `ditemukan` berarti label menu ada di layar Modul dan berhasil di-tap.
    - `terbuka` berarti judul layar tujuan benar-benar muncul sesudahnya.

    Versi lama hanya mengembalikan `ditemukan`, sehingga menu yang menendang pengguna balik ke
    daftar (gerbang izin selalu menolak, rute tidak terdaftar) tetap dihitung OK. Itu sebabnya
    "Pengaturan Owner" pernah dilaporkan 21/21 padahal layarnya tidak pernah terbuka.

    Menu yang belum terlihat digulir, tetapi DIULANG hanya bila layar masih di Modul. Tanpa
    pemeriksaan itu, satu gulir yang berakhir di luar layar Modul membuat sisa gulir dilakukan di
    sembarang layar, dan menu berikutnya dilaporkan "TIDAK TERBUKA" padahal hanya tap-nya meleset.
    Itu menghasilkan temuan palsu pada menu "Pelanggan".
    """
    if not ke_modul():
        return False, False, []
    for i in range(8):
        if i and not di_modul(dump("bm")):
            if not ke_modul():
                return False, False, []
        x = dump("bm")
        simp = simpul(x)
        t = [s for s in simp if s["text"].strip() == label]
        # Nama menu bisa SAMA dengan nama bagian, mis. "Pelanggan" adalah judul bagian sekaligus
        # label menu di dalamnya. Di Compose, node teks tidak pernah bertanda clickable; penangan
        # klik ada di container pembungkus yang teksnya kosong. Karena itu kandidat disaring ke node
        # yang PUNYA container clickable yang membungkusnya, dan titik tap diambil dari container
        # itu. Men-tap judul bagian akan diam saja dan menunya dilaporkan gagal padahal tidak ada
        # yang salah.
        t = [s for s in t if pembungkus_klik(simp, s)]
        if t:
            titik = pembungkus_klik(simp, t[0])
            tap((titik["cx"], titik["cy"]), 3.5)
            time.sleep(1.5)
            x2 = dump("jl")
            judul = [s for s in teks(x2) if len(s) < 40][:4]
            # Menu yang tidak membuka apa pun meninggalkan pengguna di daftar Modul, dan label
            # menu itu sendiri masih terbaca di layar. Mencocokkan judul dengan nama menu karena itu
            # selalu berhasil dan menu mati dilaporkan OK. Bukti harus datang dari layar TUJUAN:
            # daftar Modul tidak boleh lagi terlihat, baru judulnya dicocokkan.
            masih_modul = di_modul(x2)
            wajib = JUDUL.get(label)
            if wajib is None:
                terbuka = not masih_modul
            else:
                terbuka = (not masih_modul) and any(wajib.lower() in j.lower() for j in judul)
            return True, terbuka, judul
        sh("input", "swipe", "540", "1900", "540", "1400", "250")
        time.sleep(0.8)
    return False, False, []


def fatal(paket="com.cuciin.laundryops.debug"):
    """Baris FATAL EXCEPTION MILIK PAKET INI beserta jejak penyebabnya.

    Versi lama hanya mengambil baris pertama, sehingga laporan berbunyi
    "CRASH: 1 ['Antrian laundry']" tanpa sebab dan tanpa kelas. Itu tidak cukup untuk
    memutuskan apakah crash nyata atau sisa dari run sebelumnya, jadi jejaknya diambil sekalian.

    Buffer crash memuat FATAL dari SELURUH proses, termasuk `uiautomator` yang dipakai alat ini
    sendiri untuk membaca layar. Tanpa penyaringan paket, kegagalan uiautomator terbaca sebagai
    crash aplikasi: laporan Owner pernah berbunyi "CRASH: 1 ['Daftar User']" padahal menu itu
    terbuka normal dan buffer crash tidak memuat satu pun FATAL dari cuciin.
    """
    t = sh("logcat", "-d", "-b", "crash", "-t", "400")
    blok = re.findall(r"FATAL EXCEPTION[\s\S]{0,900}", t)
    ringkas = []
    for b in blok:
        baris = [l.strip() for l in b.split("\n") if l.strip()]
        proses = next((l for l in baris if l.startswith("Process:")), "")
        if paket not in proses:
            continue
        # Baris 1 = FATAL EXCEPTION: thread; cari baris penyebab dan satu frame aplikasi.
        sebab = next((l for l in baris[1:] if "Exception" in l or "Error" in l), "")
        frame = next((l for l in baris[1:] if "com.cuciin" in l), "")
        ringkas.append(f"{baris[0]} | {sebab} | {frame}")
    return ringkas


print(f"########## SAPU MENU: {LABEL} ##########")
sh("logcat", "-c")
segar()
peran = peran_sekarang()
print(f"   peran awal: {peran}")
if not peran or PERAN not in (peran or ""):
    if peran:
        keluar_akun()
        segar()
    x = dump("o0")
    if not any("Antrian laundry" in t for t in teks(x)):
        if not login():
            sys.exit("login gagal")
    peran = peran_sekarang()
print(f"   peran: {peran}")

hasil = []
for m in MENU:
    ditemukan, terbuka, judul = buka_menu(m)
    f = fatal()
    hasil.append((m, terbuka, judul, len(f)))
    tanda = "OK " if terbuka and not f else "CEK"
    print(f"   {tanda}  {m:22s}  {'tampil' if terbuka else ('tap gagal' if not ditemukan else 'TIDAK TERBUKA')}  {judul[:2]}  fatal={len(f)}")
    if f:
        print(f"        {f[0][:130]}")
        sh("logcat", "-c")
    segar()

print("\n=== RINGKASAN ===")
print(f"   menu dibuka   : {sum(1 for h in hasil if h[1])}/{len(MENU)}")
print(f"   tidak tampil  : {[h[0] for h in hasil if not h[1]]}")
print(f"   crash         : {[h[0] for h in hasil if h[3]]}")
print(f"   aplikasi hidup: {bool(sh('pidof', PKG).strip())}")

# Kembalikan scope perangkat ke Owner. Tanpa ini perangkat ditinggal dalam scope satu cabang
# (mis. supervisor:...:laupay-kirab), dan laporan berikutnya tampak seperti data hilang.
print("\n=== pulihkan sesi Owner ===")
sh("logcat", "-c")
segar()
if peran_sekarang() and PERAN not in (peran_sekarang() or ""):
    pass
if peran_sekarang() != "Cuciin · Owner":
    keluar_akun()
    segar()
    if not login_owner():
        print("   TIDAK BISA pulihkan sesi Owner, perangkat ditinggal di scope cabang")
        sys.exit(3)
print(f"   peran akhir: {peran_sekarang()}")
