#!/usr/bin/env python3
"""Verify a signed Cuciin APK without uploading it to any external service."""
import argparse
from pathlib import Path
import re
import struct
import subprocess
import zipfile


def run(*args):
    result = subprocess.run(args, check=True, text=True, capture_output=True)
    return result.stdout


def verify(apk, build_tools):
    signing = run(str(build_tools / 'apksigner'), 'verify', '--verbose', '--print-certs', str(apk))
    if 'Verified using v2 scheme (APK Signature Scheme v2): true' not in signing:
        raise ValueError('APK harus menggunakan tanda tangan v2.')
    expected = (Path(__file__).resolve().parent.parent / 'release-certificate-sha256.txt').read_text().strip()
    actual = re.search(r'certificate SHA-256 digest: ([0-9a-f]+)', signing)
    if not actual or actual.group(1) != expected:
        raise ValueError('Sertifikat APK tidak sama dengan identitas rilis yang telah dicatat.')
    if 'Android Debug' in signing:
        raise ValueError('Sertifikat debug tidak boleh digunakan untuk rilis.')
    badging = run(str(build_tools / 'aapt'), 'dump', 'badging', str(apk))
    if "name='com.cuciin.laundryops'" not in badging.splitlines()[0]:
        raise ValueError('Application ID rilis tidak sesuai.')
    if 'application-debuggable' in badging:
        raise ValueError('APK rilis masih debuggable.')
    if int(re.search(r"targetSdkVersion:'(\d+)'", badging).group(1)) < 36:
        raise ValueError('Target SDK rilis harus minimal 36.')
    allowed = {'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE',
               'com.google.android.providers.gsf.permission.READ_GSERVICES',
               'com.cuciin.laundryops.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}
    permissions = set(re.findall(r"uses-permission: name='([^']+)'", badging))
    if permissions - allowed:
        raise ValueError(f'Izin tambahan memerlukan review: {sorted(permissions - allowed)}')
    run(str(build_tools / 'zipalign'), '-c', '-P', '16', '-v', '4', str(apk))
    libraries = []
    with zipfile.ZipFile(apk) as archive:
        for name in archive.namelist():
            if name.endswith('.dex') and b'MASUK CEPAT' in archive.read(name):
                raise ValueError('UI masuk cepat debug masih termuat dalam APK rilis.')
            if not (name.startswith(('lib/arm64-v8a/', 'lib/x86_64/')) and name.endswith('.so')):
                continue
            data = archive.read(name)
            if data[:5] != b'\x7fELF\x02' or data[5] != 1:
                raise ValueError(f'Format ELF tidak dikenali: {name}')
            offset = struct.unpack_from('<Q', data, 32)[0]
            size, count = struct.unpack_from('<HH', data, 54)
            for index in range(count):
                position = offset + index * size
                if struct.unpack_from('<I', data, position)[0] == 1:
                    alignment = struct.unpack_from('<Q', data, position + 48)[0]
                    if alignment < 16384:
                        raise ValueError(f'ELF belum selaras 16 KB: {name} ({alignment})')
            libraries.append(name)
    print(badging.splitlines()[0])
    print('PASS: tanda tangan rilis v2; non-debuggable; target SDK; izin minimum; ZIP/ELF 16 KB.')
    print('Pustaka native 64-bit:', ', '.join(libraries) or 'tidak ada')
    for line in signing.splitlines():
        if 'certificate SHA-256 digest:' in line:
            print(line)
    print('Pemeriksaan lokal ini bukan sertifikasi Google Play Protect.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('apk', type=Path)
    parser.add_argument('--build-tools', type=Path, required=True)
    args = parser.parse_args()
    verify(args.apk.resolve(), args.build_tools.resolve())
