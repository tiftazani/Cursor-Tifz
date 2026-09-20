#!/usr/bin/env python3
"""Bangun dokumen HTML colorful + PDF dari docs/ Markdown.

Pemakaian:
    python3 tools/bangun_dokumen.py            # bangun semua
    python3 tools/bangun_dokumen.py --pdf      # termasuk PDF (Chrome headless)

Menulis ke docs/_terbangun/.
"""
import html
import json
import pathlib
import re
import shutil
import subprocess
import sys

AKAR = pathlib.Path(__file__).resolve().parent.parent
DOCS = AKAR / "docs"
LUAR = DOCS / "_terbangun"

# (judul, berkas, bagian)
DOKUMEN = [
    ("Panduan Cuciin", "index.md", "Panduan Cuciin"),
    ("Dokumentasi Teknis", "teknis-android/index.md", "Dokumentasi Teknis"),
    ("Mulai Cepat", "teknis-android/mulai.md", None),
    ("Arsitektur Aplikasi", "teknis-android/arsitektur.md", None),
    ("Data dan Integrasi", "teknis-android/data-dan-integrasi.md", None),
    ("Pengujian", "teknis-android/pengujian.md", None),
    ("Rilis", "teknis-android/rilis.md", None),
    ("Manual Owner", "manual-owner/index.md", "Manual Owner"),
    ("Mulai Cepat", "mulai-cepat.md", None),
    ("Peta Aplikasi", "manual-owner/peta-aplikasi.md", None),
    ("Akses dan Peran", "manual-owner/akses-dan-peran.md", None),
    ("Siklus Transaksi", "manual-owner/operasional.md", None),
    ("Layanan, Harga, dan Stok", "manual-owner/layanan-dan-harga.md", None),
    ("Laporan dan Pembacaan Data", "manual-owner/laporan.md", None),
    ("Konfigurasi dan Pemulihan", "manual-owner/konfigurasi.md", None),
    ("Manual Peran", "manual-peran/index.md", "Manual Peran"),
    ("Mulai Cepat Peran", "manual-peran/mulai-cepat.md", None),
    ("Manual Kasir", "manual-peran/kasir/index.md", None),
    ("Manual Supervisor", "manual-peran/supervisor/index.md", None),
    ("Manual Peran Tambahan", "manual-peran/lainnya.md", None),
]

# Tema warna per dokumen (judul, aksen, aksen2, latar lembut)
TEMA = {
    "Panduan Cuciin": ("#0f766e", "#14b8a6", "#f0fdfa"),
    "Dokumentasi Teknis": ("#1d4ed8", "#3b82f6", "#eff6ff"),
    "Manual Owner": ("#7c3aed", "#a855f7", "#faf5ff"),
    "Manual Peran": ("#b45309", "#f59e0b", "#fffbeb"),
}


def judul_dari(teks: str, cadangan: str) -> str:
    m = re.match(r"#\s+(.+)", teks)
    return m.group(1).strip() if m else cadangan


def frontmatter(teks: str) -> tuple[dict, str]:
    """Ambil blok metadata tabel di awal dokumen, kembalikan (meta, sisa)."""
    meta = {}
    pola = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$")
    for baris in teks.splitlines()[:20]:
        m = pola.match(baris)
        if m and m.group(1) not in ("Metadata", "---", "Bagian") and "---" not in m.group(1):
            meta[m.group(1).strip()] = m.group(2).strip()
    return meta, teks


def sorot(teks: str) -> str:
    """Tandai blok catatan agar bisa ditata berbeda."""
    ganti = {
        "> **INFORMASI**": ("catatan info", "INFORMASI"),
        "> **PERHATIAN**": ("catatan awas", "PERHATIAN"),
        "> **BAHAYA**": ("catatan bahaya", "BAHAYA"),
        "> **Ringkasan:**": ("catatan ringkas", "Ringkasan"),
    }
    for tanda, (kelas, label) in ganti.items():
        if tanda in teks:
            teks = teks.replace(
                tanda,
                f'<div class="{kelas}"><span class="catatan-label">{label}</span>',
                1,
            )
            # tutup di akhir blok kutipan yang menyusul
            teks = re.sub(
                r'(<div class="' + kelas + r'">.*?)(\n\n)',
                r"\1</div>\n\n",
                teks,
                count=1,
                flags=re.S,
            )
    return teks


CSS = pathlib.Path(__file__).resolve().parent.joinpath("_css_dokumen.css").read_text(encoding="utf-8")


def bangun_satu(judul: str, berkas: pathlib.Path, bagian: str, keluar: pathlib.Path) -> pathlib.Path:
    import markdown as md

    teks = berkas.read_text(encoding="utf-8")
    aksen, aksen2, lembut = TEMA.get(bagian or "", ("#0f766e", "#14b8a6", "#f0fdfa"))
    if bagian is None:
        for nama, tema in TEMA.items():
            if nama in str(keluar).replace("\\", "/"):
                aksen, aksen2, lembut = tema
                break

    # jadikan gambar relatif terhadap docs/
    teks = re.sub(r"\]\((?!http|/)([^)]+\.png)\)", r"](__AKAR__/\1)", teks)
    teks = teks.replace("__AKAR__", str(DOCS))

    body = md.markdown(teks, extensions=["tables", "fenced_code", "toc", "attr_list"])
    body = body.replace("<blockquote>", '<div class="catatan">').replace("</blockquote>", "</div>")
    for pola, kelas, label in [
        (r"<p><strong>INFORMASI</strong>", "catatan-info", "INFORMASI"),
        (r"<p><strong>PERHATIAN</strong>", "catatan-awas", "PERHATIAN"),
        (r"<p><strong>BAHAYA</strong>", "catatan-bahaya", "BAHAYA"),
    ]:
        body = re.sub(
            pola + r"</p>",
            f'<span class="catatan-label">{label}</span>',
            body,
        )
    css = (
        CSS.replace("__AKSEN2__", aksen2)
        .replace("__AKSEN__", aksen)
        .replace("__LEMBUT__", lembut)
        .replace("__AKSEN2__", aksen2)
    )

    kode = f"""<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(judul)} — Cuciin</title>
<style>{css}</style></head><body>
<header class="sampul">
  <span class="label">{html.escape(bagian or "Panduan Cuciin")}</span>
  <h1>{html.escape(judul)}</h1>
  <p class="sub">Aplikasi operasional laundry Cuciin — versi 1.10.30</p>
</header>
<div class="wadah"><div class="kartu">
{body}
</div>
<p class="kaki">Cuciin · Dokumen ini dibangun dari berkas Markdown di <code>docs/</code></p>
</div></body></html>"""
    keluar.parent.mkdir(parents=True, exist_ok=True)
    keluar.write_text(kode, encoding="utf-8")
    return keluar


CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def ke_pdf(sumber: pathlib.Path, keluar: pathlib.Path, ukuran="A4") -> bool:
    keluar.parent.mkdir(parents=True, exist_ok=True)
    if keluar.exists():
        keluar.unlink()
    subprocess.Popen(
        [
            CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--no-pdf-header-footer", f"--print-to-pdf={keluar}",
            f"--print-to-pdf-no-header", f"file://{sumber}",
        ],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    import time
    for _ in range(60):
        time.sleep(0.5)
        if keluar.exists() and keluar.stat().st_size > 2000:
            return True
    return False


def main() -> int:
    ingin_pdf = "--pdf" in sys.argv
    if LUAR.exists():
        shutil.rmtree(LUAR)
    hasil = []
    for judul, rel, bagian in DOKUMEN:
        sumber = DOCS / rel
        if not sumber.exists():
            print(f"LEWAT (tidak ada): {rel}")
            continue
        nama = rel.replace("/", "-").replace(".md", "")
        keluar = LUAR / bagian.lower().replace(" ", "-") / f"{nama}.html" if bagian else LUAR / "halaman" / f"{nama}.html"
        p = bangun_satu(judul, sumber, bagian, keluar)
        baris = {"judul": judul, "html": str(p.relative_to(AKAR))}
        if ingin_pdf:
            pdf = p.with_suffix(".pdf")
            ok = ke_pdf(p, pdf)
            baris["pdf"] = str(pdf.relative_to(AKAR)) if ok else None
        hasil.append(baris)
        print(("PDF OK  " if baris.get("pdf") or not ingin_pdf else "PDF GAGAL ") + str(p.relative_to(AKAR)))
    (LUAR / "daftar.json").write_text(json.dumps(hasil, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{len(hasil)} dokumen dibangun di {LUAR.relative_to(AKAR)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
