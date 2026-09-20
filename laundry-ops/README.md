# Cuciin — operasional laundry

Owner: **Owner Cuciin**. Android Kotlin (`com.cuciin.laundryops`) + mockup HTML.

## Android

Folder: [`android/`](./android). Versi sekarang **1.10.30** (versionCode 49). Changelog: [`android/CHANGELOG.md`](./android/CHANGELOG.md).

Melanjutkan dengan coding agent lain: mulai dari [handover teknis](./AGENT_HANDOVER.md), [prompt siap-tempel](./AGENT_PROMPTS.md), dan [protokol kerja beberapa agent](./AGENT_WORKFLOW.md). **Status yang berlaku selalu ada di [`AGENT_STATUS.md`](./AGENT_STATUS.md)** — dokumen lain bisa tertinggal.

**APK:** ada di [`releases/`](./releases), bukan lagi dari halaman web. Halaman Vercel sudah tidak menyimpan berkas Cuciin; tautan APK lama sudah mati.

Database toko di server Cloudflare Worker (`cuciin-api`) — HP kasir/owner nge-share. Cache tetap di HP. Release memakai Worker produksi, debug memakai Worker + D1 test yang terpisah.

Kalau repo sudah di-clone:

```bash
cd ~/Documents/ChatGPT/Laundry/Cursor-Tifz
git pull
```

```bash
cd laundry-ops/android
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
./gradlew assembleDebug
```

Login hanya memakai **email dan kata sandi**; tidak ada masuk cepat berdasarkan role, dan role selalu diperoleh dari akses akun setelah autentikasi. Firebase Auth hidup kalau `app/google-services.json` ada; tanpa berkas itu aplikasi tetap dibangun tetapi login mati.

Permission: INTERNET saja. Bukti foto disimpan di HP. WA lewat intent `wa.me`.

## Mockup web

Mockup dijalankan lokal, tidak di-hosting:

```bash
cd laundry-ops/mockup
./start.sh
```
