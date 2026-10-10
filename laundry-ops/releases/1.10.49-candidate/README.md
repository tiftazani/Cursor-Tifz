# Cuciin 1.10.49 (versionCode 68), kandidat hotfix

Menggantikan 1.10.48/67. Kandidat uji, bukan rilis produksi. Belum commit, push, atau deploy.

## Perubahan sejak 1.10.48

- Tutup Kas: rincian produk terjual dihitung dari nota hari ini yang masih berlaku. Nota batal, hapus, atau koreksi tidak lagi menambah angka (uji: dulu 6 pcs Rp48.000 untuk 1 pcs terjual).
- Stok: layanan biasa yang namanya sama dengan produk stok tidak lagi menambah stok saat nota dikoreksi, dihapus, atau dibatalkan.
- Aset: hanya bisa dibuat, diubah, dipindah, atau dihapus di cabang tugas akun (sama dengan aturan server).
- Foto bukti: hanya untuk Service di cabang tugas akun.

## Hasil uji

- Unit test: 483 debug + 483 release, 0 gagal/error/dilewati.
- Lint: 0 error, 15 warning (debug dan release).
- `verify_release.py`: PASS dengan build-tools 35.0.0, 36.0.0, 37.0.0 (JDK 17 di PATH).
- Emulator API 35 offline (Wi-Fi, data, mode pesawat mati): upgrade `install -r` 1.10.48 release -> 1.10.49 release tanpa hapus data, dibuka 2x, proses hidup, 0 FATAL/ANR. Debug 1.10.49 dibuka 2x, 0 FATAL/ANR.

## Belum terbukti

HP nyata, login Firebase sungguhan, upgrade dengan data asli, sinkron dengan Worker produksi, tampilan Compose saat dipakai. Perubahan Worker lokal (role modul kosong) belum dideploy.

## SHA-256

```
721e3162528bfcc6f4d12c371d91fa605c9f822d330c9e2c2382f5c1d0f67576  cuciin-1.10.49-debug.apk
0d235c262b2286f6399a4e177c7441aba51f245bcb0b10f50f5c49e8efb4fed9  cuciin-1.10.49-release.apk
842bcb5ea53d7d4958704c674bc036bff949915be4cfd209e53cc9a5aaa2fb33  cuciin-1.10.49-release.aab
```
