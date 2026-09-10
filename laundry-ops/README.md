# Cuciin — operasional laundry

Owner: **Tiftazani Khara**. Android Kotlin (`com.tiftazani.laundryops`) + mockup HTML.

## Android

Folder: [`android/`](./android). Versi sekarang **1.3.0**. Changelog: [`android/CHANGELOG.md`](./android/CHANGELOG.md).

**Unduh APK debug:** [https://cuan-tif.vercel.app/cuciin/cuciin.apk](https://cuan-tif.vercel.app/cuciin/cuciin.apk)

Database toko di server — HP kasir/owner nge-share. Cache tetap di HP.

Kalau repo sudah di-clone:

```bash
cd ~/Cursor-Tifz
git checkout main
git pull origin main
```

**Unduh APK debug:** [https://cuan-tif.vercel.app/cuciin/cuciin.apk](https://cuan-tif.vercel.app/cuciin/cuciin.apk)

```bash
cd ~
git clone https://github.com/tiftazani/Cursor-Tifz.git
cd Cursor-Tifz/laundry-ops/android
./gradlew assembleDebug
```

Masuk cepat di login: Owner / Kasir / SPV. Database server nyala lewat API; Firebase nyala kalau `app/google-services.json` ada.

Permission: INTERNET saja. Bukti foto disimpan di HP. WA lewat intent `wa.me`.

## Mockup web

**[https://cuan-tif.vercel.app/cuciin](https://cuan-tif.vercel.app/cuciin)**

```bash
cd laundry-ops/mockup
./start.sh
```
