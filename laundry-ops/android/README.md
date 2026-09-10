# Cuciin Android

Package `com.tiftazani.laundryops`. Versi sekarang **1.1.0**.

## Unduh APK

Debug APK (install di HP, izinkan unknown source):

**[https://cuan-tif.vercel.app/cuciin/cuciin.apk](https://cuan-tif.vercel.app/cuciin/cuciin.apk)**

Atau dari GitHub Actions artifact `cuciin-debug-apk` setelah push ke `main`.

applicationId debug: `com.tiftazani.laundryops.debug`.

## Build di Mac

Repo harus di-clone dulu. Jangan `cd laundry-ops/android` dari home kosong.

```bash
cd ~
git clone https://github.com/tiftazani/Cursor-Tifz.git
cd Cursor-Tifz
git pull
cd laundry-ops/android
# ANDROID_HOME atau sdk.dir di local.properties
./gradlew assembleDebug
```

APK lokal: `app/build/outputs/apk/debug/app-debug.apk`.

## Firebase

Tanpa `google-services.json` app **tetap jalan** (data di HP).

1. Firebase Console → project baru → Android app `com.tiftazani.laundryops`
2. Tambah juga package debug `com.tiftazani.laundryops.debug` (sama json)
3. Download `google-services.json` → taruh di `laundry-ops/android/app/`
4. Auth: Email/Password. Firestore: deploy `firestore.rules`
5. Rebuild APK

File sungguhan di-gitignore. Contoh: `app/google-services.json.example`.
