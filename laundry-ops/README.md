# Cuciin — operasional laundry

Aplikasi kasir laundry (Android, Kotlin) masih **belum dibangun**. Yang ada sekarang mockup UI.

## Mockup UI

```bash
cd laundry-ops/mockup
python3 -m http.server 4173
```

- Preview studio: [http://localhost:4173](http://localhost:4173)
- Mode film (HP doang, buat rekam): [http://localhost:4173/?film=1&role=kasir&screen=login](http://localhost:4173/?film=1&role=kasir&screen=login)

Alur operasional: login → pilih pelanggan → kasir (qty) → bayar lunas → WhatsApp nota ke HP pelanggan.

Rekam ulang video walkthrough:

```bash
# butuh Chrome + playwright-core
node mockup/record-walkthrough.mjs
```

## Yang belum

- Project Android (Compose)
- Firebase Auth + Firestore
- `google-services.json`

Tunggu mockup disetujui dulu.
