#!/usr/bin/env python3
"""Gabungkan halaman HTML menjadi 3 dokumen utuh + PDF.

Pemakaian:
    python3 tools/gabung_dokumen.py

Hasil:
    docs/_terbangun/<nama>/dokumen.html  (satu berkas, gambar tertanam base64)
    docs/_terbangun/<nama>/dokumen.pdf
"""
import base64
import pathlib
import re
import time
import subprocess
import sys

AKAR = pathlib.Path(__file__).resolve().parent.parent
DOCS = AKAR / "docs"
LUAR = DOCS / "_terbangun"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# (nama keluaran, judul, aksen, aksen2, lembut, daftar halaman relatif ke docs/_terbangun)
DOKUMEN = [
    (
        "Panduan-Cuciin", "Panduan Cuciin",
        "#0f766e", "#14b8a6", "#f0fdfa",
        [
            ("panduan-cuciin/index.html", "Panduan Cuciin"),
            ("halaman/teknis-android-mulai.html", "Dokumentasi Teknis · Mulai Cepat"),
            ("halaman/mulai-cepat.html", "Manual Owner · Mulai Cepat"),
        ],
    ),
    (
        "Dokumentasi-Teknis-Cuciin", "Dokumentasi Teknis",
        "#1d4ed8", "#3b82f6", "#eff6ff",
        [
            ("dokumentasi-teknis/teknis-android-index.html", "Ikhtisar"),
            ("halaman/teknis-android-mulai.html", "Mulai Cepat"),
            ("halaman/teknis-android-arsitektur.html", "Arsitektur Aplikasi"),
            ("halaman/teknis-android-data-dan-integrasi.html", "Data dan Integrasi"),
            ("halaman/teknis-android-pengujian.html", "Pengujian"),
            ("halaman/teknis-android-rilis.html", "Rilis"),
        ],
    ),
    (
        "Manual-Owner-Cuciin", "Manual Owner",
        "#7c3aed", "#a855f7", "#faf5ff",
        [
            ("manual-owner/manual-owner-index.html", "Ikhtisar"),
            ("halaman/mulai-cepat.html", "Mulai Cepat"),
            ("halaman/manual-owner-peta-aplikasi.html", "Peta Aplikasi"),
            ("halaman/manual-owner-akses-dan-peran.html", "Akses dan Peran"),
            ("halaman/manual-owner-operasional.html", "Siklus Transaksi"),
            ("halaman/manual-owner-layanan-dan-harga.html", "Layanan, Harga, dan Stok"),
            ("halaman/manual-owner-laporan.html", "Laporan dan Pembacaan Data"),
            ("halaman/manual-owner-konfigurasi.html", "Konfigurasi dan Pemulihan"),
        ],
    ),
    (
        "Manual-Peran-Cuciin", "Manual Peran",
        "#b45309", "#f59e0b", "#fffbeb",
        [
            ("manual-peran/manual-peran-index.html", "Ikhtisar"),
            ("halaman/manual-peran-mulai-cepat.html", "Mulai Cepat Peran"),
            ("halaman/manual-peran-kasir-index.html", "Manual Kasir"),
            ("halaman/manual-peran-supervisor-index.html", "Manual Supervisor"),
            ("halaman/manual-peran-lainnya.html", "Manual Peran Tambahan"),
        ],
    ),
]

DAFTAR_ISI = """
<nav class="daftar-isi">
  <h2>Daftar isi</h2>
  <ol>{butir}</ol>
</nav>
"""


def ambil_badan(html: str) -> str:
    """Ambil isi <div class=\"kartu\">...</div> dari halaman."""
    m = re.search(r'<div class="kartu">(.*?)</div>\s*<p class="kaki">', html, re.S)
    return m.group(1) if m else html


def tanam_gambar(badan: str) -> str:
    """Ganti src gambar dengan data URI agar PDF mandiri."""
    def ganti(m):
        p = pathlib.Path(m.group(2))
        if not p.exists():
            return m.group(0)
        data = base64.b64encode(p.read_bytes()).decode()
        return f'{m.group(1)}"data:image/png;base64,{data}"'
    return re.sub(r'(<img[^>]*src=)"([^"]+\.png)"', ganti, badan)


def beri_id(badan: str, i: int) -> str:
    """Beri id pada judul utama bagian agar daftar isi bisa menautkannya."""
    return re.sub(r"<h1>", f'<h1 id="bagian-{i}">', badan, count=1)


def kumpulkan(dok: tuple) -> pathlib.Path:
    nama, judul, aksen, aksen2, lembut, halaman = dok
    bagian, butir = [], []
    for i, (rel, label) in enumerate(halaman):
        f = LUAR / rel
        if not f.exists():
            print(f"  LEWAT (tidak ada): {rel}")
            continue
        badan = beri_id(tanam_gambar(ambil_badan(f.read_text(encoding="utf-8"))), i)
        bagian.append(f'<section class="bagian" id="bagian-{i}">{badan}</section>')
        butir.append(f'<li><a href="#bagian-{i}">{label}</a></li>')

    kode = f"""<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<title>{judul} — Cuciin</title>
<style>
:root {{ --aksen: {aksen}; --aksen2: {aksen2}; --lembut: {lembut}; }}
{CSS_INTI}
</style></head><body>
<header class="sampul">
  <span class="label">Cuciin · versi 1.10.30</span>
  <h1>{judul}</h1>
  <p class="sub">Dokumen ini dibangun dari berkas Markdown di <code>docs/</code> dan memakai tangkapan layar asli dari aplikasi.</p>
</header>
<div class="wadah">
{DAFTAR_ISI.format(butir="".join(butir))}
<div class="kartu">
{"".join(bagian)}
</div>
<p class="kaki">Cuciin · {judul} · 20 September 2026</p>
</div></body></html>"""

    keluar = LUAR / nama
    keluar.mkdir(parents=True, exist_ok=True)
    f_html = keluar / "dokumen.html"
    f_html.write_text(kode, encoding="utf-8")
    return f_html


def ke_pdf(sumber: pathlib.Path, keluar: pathlib.Path) -> bool:
    if keluar.exists():
        keluar.unlink()
    subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
         "--no-pdf-header-footer", f"--print-to-pdf={keluar}", f"file://{sumber}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(180):
        time.sleep(0.5)
        if keluar.exists() and keluar.stat().st_size > 20000:
            return True
    return False


CSS_INTI = pathlib.Path(__file__).resolve().parent.joinpath("_css_dokumen.css").read_text(encoding="utf-8")


def main() -> int:
    ingin_pdf = "--no-pdf" not in sys.argv
    hasil = []
    for dok in DOKUMEN:
        print(f"== {dok[1]}")
        f_html = kumpulkan(dok)
        baris = {"judul": dok[1], "html": str(f_html.relative_to(AKAR)),
                 "ukuran_html": f_html.stat().st_size}
        if ingin_pdf:
            f_pdf = f_html.with_name("dokumen.pdf")
            ok = ke_pdf(f_html, f_pdf)
            baris["pdf"] = str(f_pdf.relative_to(AKAR)) if ok else None
            baris["ukuran_pdf"] = f_pdf.stat().st_size if ok else 0
            print(f"   {'PDF OK' if ok else 'PDF GAGAL'} {baris.get('ukuran_pdf',0)//1024} KB")
        hasil.append(baris)
    import json
    (LUAR / "dokumen-utuh.json").write_text(json.dumps(hasil, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
