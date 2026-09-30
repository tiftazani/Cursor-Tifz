#!/usr/bin/env python3
"""Verifikasi endpoint cloud yang benar-benar masuk ke dalam APK.

Kenapa ada: pada 1 Okt 2026 perintah build kandidat 1.10.43 mengekspor
CUCIIN_DEBUG_CLOUD_URL="$CUCIIN_CLOUD_URL" (URL produksi), sehingga APK debug memuat
endpoint PRODUKSI. Paket debug itu dipasang di emulator, login sebagai Owner, lalu
mendorong tiga entri accessRole ke D1 produksi (revision 3417 -> 3420).

Pelajaran: endpoint harus diperiksa di dalam ARTEFAK, bukan hanya di konfigurasi build.
APK debug yang menunjuk produksi membuat setiap transaksi uji menjadi mutasi data
operasional.

Pakai:
    python3 scripts/guard_endpoint.py <apk> --expect <host> [--forbid <host>]
"""

import argparse
import re
import sys
import zipfile

HOST_DI_DEX = re.compile(rb"https://([a-z0-9.-]+\.workers\.dev)")
NAMA_DEX = re.compile(r"classes\d*\.dex$")


def endpoint_di_apk(path):
    """Kembalikan {host: {nama dex}} dari seluruh dex di dalam APK."""
    hosts = {}
    with zipfile.ZipFile(path) as z:
        for nama in z.namelist():
            if not NAMA_DEX.match(nama):
                continue
            data = z.read(nama)
            for m in HOST_DI_DEX.finditer(data):
                host = m.group(1).decode("utf-8", "replace")
                hosts.setdefault(host, set()).add(nama)
    return hosts


def main():
    p = argparse.ArgumentParser(description="Periksa endpoint cloud di dalam APK.")
    p.add_argument("apk", help="berkas APK yang diperiksa")
    p.add_argument("--expect", required=True, help="host yang WAJIB ada di artefak")
    p.add_argument("--forbid", default=None, help="host yang TIDAK boleh ada di artefak")
    a = p.parse_args()

    hosts = endpoint_di_apk(a.apk)
    print(f"Endpoint di {a.apk}:")
    if not hosts:
        print("  (tidak ada host *.workers.dev ditemukan di dex)")
    for host, dex in sorted(hosts.items()):
        print(f"  {host}  ({', '.join(sorted(dex))})")

    gagal = []
    if a.expect not in hosts:
        gagal.append(f"host {a.expect} tidak ditemukan")
    if a.forbid and a.forbid in hosts:
        gagal.append(f"host terlarang {a.forbid} ADA di artefak")
    if gagal:
        print("GAGAL: " + "; ".join(gagal))
        return 1
    print("OK: endpoint artefak sesuai harapan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
