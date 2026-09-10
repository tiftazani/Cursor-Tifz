# Cuciin — operasional laundry

Spek v1 ada di rencana agent. **Android / APK belum dibangun.** Sekarang mockup HTML.

## Website simulasi (permanen)

Mockup di-host di Vercel yang sama dengan repo ini — URL-nya nempel, bukan tunnel Cloudflare.

- **Preview branch ini:** [https://cuan-git-cursor-laundry-ops-mockup-5516-tiftazanis-projects.vercel.app/cuciin/](https://cuan-git-cursor-laundry-ops-mockup-5516-tiftazanis-projects.vercel.app/cuciin/)
- **Production** (setelah merge ke `main`): [https://cuan-tif.vercel.app/cuciin/](https://cuan-tif.vercel.app/cuciin/)

Sumber UI: `laundry-ops/mockup/`. File yang ke-serve: `cuan-yuk-guys/public/cuciin/` (di-copy pas `npm run build`).

## Jalanin di laptop

```bash
cd laundry-ops/mockup
./start.sh
```

Lalu buka [http://127.0.0.1:4173](http://127.0.0.1:4173) — pakai `127.0.0.1`, bukan `localhost`.

## Yang belum

- Project Android (Compose)
- Firebase Auth + Firestore + App Check
- Privacy Policy & Play Console
