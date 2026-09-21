# APK Cuciin

APK distribusi di folder ini:

| Berkas | Isi |
|---|---|
| `cuciin-release.apk` | APK rilis bertanda tangan, dipakai cabang |
| `cuciin-debug.apk` | APK debug, untuk pengujian internal |

Menyalin APK debug terbaru setelah `assembleDebug`:

```bash
cp android/app/build/outputs/apk/debug/app-debug.apk releases/cuciin-debug.apk
```

Untuk kandidat rilis, APK dan AAB **tidak** dilacak Git. Hanya `README.md` dan `SHA256SUMS.txt` yang
di-commit ke `releases/<versi>-candidate/`; berkas binary-nya dibagikan di luar Git.

Sertifikat rilis harus tetap sama supaya APK baru bisa menimpa versi yang sudah terpasang.
Nilai acuannya ada di `android/release-certificate-sha256.txt`, dan `android/scripts/verify_release.py`
memeriksanya otomatis.
