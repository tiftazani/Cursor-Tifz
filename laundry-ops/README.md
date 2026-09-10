# Cuciin — operasional laundry

Owner: **Tiftazani Khara**. Android Kotlin (`com.tiftazani.laundryops`) + mockup HTML.

## Android

Folder: [`android/`](./android). Versi sekarang **1.0.0** (lihat [`android/CHANGELOG.md`](./android/CHANGELOG.md)). Riwayat yang sama muncul di app: **Riwayat versi**.

```bash
cd laundry-ops/android
# sdk.dir di local.properties, atau ANDROID_HOME
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk` (applicationId `com.tiftazani.laundryops.debug`).

Masuk cepat di login: Owner / Kasir / SPV (data lokal, Firebase belum diikat).

Permission: INTERNET saja. Bukti foto disimpan di HP. WA lewat intent `wa.me`.

## Mockup web

**[https://cuan-tif.vercel.app/cuciin](https://cuan-tif.vercel.app/cuciin)**

```bash
cd laundry-ops/mockup
./start.sh
```
