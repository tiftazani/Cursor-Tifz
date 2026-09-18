# Cuciin — operasional laundry

Owner: **Owner Cuciin**. Android Kotlin (`com.cuciin.laundryops`) + mockup HTML.

## Android

Folder: [`android/`](./android). Versi sekarang **1.10.0** (versionCode 19). Changelog: [`android/CHANGELOG.md`](./android/CHANGELOG.md).

Melanjutkan dengan coding agent lain: mulai dari [handover teknis](./AGENT_HANDOVER.md), [prompt siap-tempel](./AGENT_PROMPTS.md), dan [protokol kerja beberapa agent](./AGENT_WORKFLOW.md).

**APK debug:** ada di [`releases/`](./releases), bukan lagi dari halaman web. Halaman Vercel sudah tidak menyimpan berkas Cuciin.

Database toko di server Cloudflare Worker (`cuciin-api`) — HP kasir/owner nge-share. Cache tetap di HP.

Kalau repo sudah di-clone:

```bash
cd ~/Cursor-Tifz
git checkout main
git pull origin main
```

```bash
cd ~
git clone https://github.com/tiftazani/Cursor-Tifz.git
cd Cursor-Tifz/laundry-ops/android
./gradlew assembleDebug
```

Masuk cepat di login: Owner / Kasir / SPV. Database server nyala lewat API; Firebase nyala kalau `app/google-services.json` ada.

Permission: INTERNET saja. Bukti foto disimpan di HP. WA lewat intent `wa.me`.

## Mockup web

Mockup dijalankan lokal, tidak di-hosting:

```bash
cd laundry-ops/mockup
./start.sh
```
