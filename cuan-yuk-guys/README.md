# Cuan Yuk Guys

Desk privat rekomendasi harian **saham IHSG** dan **reksadana**.

Lokasi di GitHub: folder [`cuan-yuk-guys/`](https://github.com/tiftazani/Cursor-Tifz/tree/main/cuan-yuk-guys) di dalam repo [Cursor-Tifz](https://github.com/tiftazani/Cursor-Tifz) — bukan di root `main`.

Situs publik: [cuan-tif.vercel.app](https://cuan-tif.vercel.app/)

## Menjalankan di laptop

```bash
git clone https://github.com/tiftazani/Cursor-Tifz.git
cd Cursor-Tifz/cuan-yuk-guys
cp .env.example .env.local
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Password situs ada di `.env.example` (`SITE_PASSWORD`).

## Vercel

Branch production: **main**. Root Directory project Vercel: **`cuan-yuk-guys`**.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Recharts. Data saham dari Yahoo Finance (`^JKSE`, ticker `.JK`) dengan cache harian WIB dan fallback jika feed gagal.

## Catatan

Bukan nasihat investasi OJK. NAB reksadana adalah katalog kurasi + model yang dikaitkan ke pergerakan pasar, bukan feed resmi OJK. Copyright by Tiftazani.
