# Cuciin — operasional laundry

Spek v1 ada di rencana agent. **Android / APK belum dibangun.** Sekarang mockup HTML.

## Website simulasi (publik, awet)

Buka ini di Mac — nggak perlu `localhost`, nggak perlu Cloudflare tunnel:

**[https://raw.githack.com/tiftazani/Cursor-Tifz/cursor/laundry-ops-mockup-5516/laundry-ops/mockup/index.html](https://raw.githack.com/tiftazani/Cursor-Tifz/cursor/laundry-ops-mockup-5516/laundry-ops/mockup/index.html)**

Cadangan (CDN GitHub): [jsDelivr](https://cdn.jsdelivr.net/gh/tiftazani/Cursor-Tifz@cursor/laundry-ops-mockup-5516/laundry-ops/mockup/index.html)

Setelah PR merge ke `main`, URL tetap di Vercel production: [https://cuan-tif.vercel.app/cuciin/](https://cuan-tif.vercel.app/cuciin/)  
(Preview Vercel branch ini ke-kunci SSO, jangan pakai itu dari Mac.)

Sumber UI: `laundry-ops/mockup/`. Copy ke `cuan-yuk-guys/public/cuciin/` pas build.

## Jalanin di laptop

```bash
cd laundry-ops/mockup
./start.sh
```

Lalu [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Yang belum

- Project Android (Compose)
- Firebase Auth + Firestore + App Check
- Privacy Policy & Play Console
