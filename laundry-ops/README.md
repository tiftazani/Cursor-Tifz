# Cuciin — operasional laundry

Spek v1 ada di rencana agent. **Android / APK belum dibangun.** Sekarang mockup HTML.

## Buka mockup

`localhost:4173` di **Macbook lo** cuma hidup kalau server-nya juga jalan **di Mac yang sama**. Server di Cloud Agent nggak kelihatan dari laptop.

### Di Mac (paling gampang)

```bash
cd laundry-ops/mockup
chmod +x start.sh
./start.sh
```

Lalu Safari/Chrome: [http://127.0.0.1:4173](http://127.0.0.1:4173) — pakai `127.0.0.1`, bukan `localhost` (kadang nembak IPv6 terus refused).

Atau double-click `index.html`.

### Preview dari GitHub (tanpa ngejalanin apa-apa)

Setelah branch `cursor/laundry-ops-mockup-5516` ke-push:

[https://cdn.jsdelivr.net/gh/tiftazani/Cursor-Tifz@cursor/laundry-ops-mockup-5516/laundry-ops/mockup/index.html](https://cdn.jsdelivr.net/gh/tiftazani/Cursor-Tifz@cursor/laundry-ops-mockup-5516/laundry-ops/mockup/index.html)

Kalau CSS/JS belum ke-update, tambah `?t=2` di URL (cache jsDelivr).

## Yang belum

- Project Android (Compose)
- Firebase Auth + Firestore + App Check
- Privacy Policy & Play Console
