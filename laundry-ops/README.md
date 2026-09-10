# Cuciin — operasional laundry

Spek v1 ada di rencana agent. **Android / APK belum dibangun.** Sekarang mockup HTML.

Owner: **Tiftazani Khara**. App per cabang (nama, lokasi, Maps). Data cabang = gabungan kasir. SPV tetap antrian + stok.

## Website simulasi

**[https://cuan-tif.vercel.app/cuciin](https://cuan-tif.vercel.app/cuciin)**

Sumber UI: `laundry-ops/mockup/`. Copy ke `cuan-yuk-guys/public/cuciin/` pas build.

## Mockup v1.1

- Status ganda: Laundry Masuk / In Progress / Selesai + Belum lunas / Lunas. Menggantung sampai keduanya beres.
- WA pending list sampai dikirim, lalu archive (tetap bisa dibuka).
- Owner analytics harian–tahunan, pecah per cabang & kasir.
- Stok: mutasi per tanggal, auto potong pas jual retail, edit manual kasir.
- Audit trail. Nota: teks / PDF / Excel, ID unik per cabang, pickup time, bukti foto di HP (bukan cloud).
- Tombol back di tiap layar.

## Jalanin di laptop

```bash
cd laundry-ops/mockup
./start.sh
```

Lalu [http://127.0.0.1:4173](http://127.0.0.1:4173).
