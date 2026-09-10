# Cuciin Android

Package `com.tiftazani.laundryops`. Versi sekarang **1.4.1**.

Database toko ada di server: `https://cuan-tif.vercel.app/api/cuciin`. HP kasir/owner nge-share dokumen yang sama. Cache JSON tetap di HP kalau lagi offline.

Firebase Firestore dipakai otomatis kalau `google-services.json` ada.

## Unduh APK

Debug APK (install di HP, izinkan unknown source):

**[https://cuan-tif.vercel.app/cuciin/cuciin.apk](https://cuan-tif.vercel.app/cuciin/cuciin.apk)**

Atau langsung: [raw GitHub](https://raw.githubusercontent.com/tiftazani/Cursor-Tifz/main/cuan-yuk-guys/public/cuciin/cuciin.apk)

applicationId debug: `com.tiftazani.laundryops.debug`.

Antrian awal kosong — tambah stok & pelanggan, lalu buat nota.

Kalau folder `Cursor-Tifz` sudah ada, jangan clone lagi:

```bash
cd ~/Cursor-Tifz
git checkout main
git pull origin main
```

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

Tanpa `google-services.json` app **tetap jalan** (API server + cache HP).

1. Firebase Console → project baru → Android app `com.tiftazani.laundryops`
2. Tambah juga package debug `com.tiftazani.laundryops.debug` (sama json)
3. Download `google-services.json` → taruh di `laundry-ops/android/app/`
4. Auth: Email/Password. Firestore: deploy `firestore.rules`
5. Rebuild APK

File sungguhan di-gitignore. Contoh: `app/google-services.json.example`.
