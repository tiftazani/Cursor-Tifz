# Cuciin — operasional laundry

Spek v1 ada di rencana agent. **Android / APK belum dibangun.** Sekarang mockup HTML.

## Mockup v1

```bash
cd laundry-ops/mockup
python3 -m http.server 4173
```

- Studio: [http://localhost:4173](http://localhost:4173)
- Film: [http://localhost:4173/?film=1&role=kasir&screen=register](http://localhost:4173/?film=1&role=kasir&screen=register)

Alur: daftar (pilih Kasir / SPV / role custom) → nunggu Owner → masuk → antrian → nota baru → janji & bayar → WA nota → geser status → WA siap ambil → tutup kas.

## Yang belum

- Project Android (Compose)
- Firebase Auth + Firestore + App Check
- Privacy Policy & Play Console
