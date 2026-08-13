# Cuan

Terminal rekomendasi harian **saham IHSG** dan **reksadana** (pasar uang, saham, obligasi).

## Menjalankan

```bash
cp .env.example .env.local
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Password akses ada di `SITE_PASSWORD` (lihat `.env.example`).

## Stack

Next.js (App Router) · TypeScript · Tailwind · Recharts. Data saham dari Yahoo Finance (`^JKSE`, ticker `.JK`) dengan cache harian WIB dan fallback jika feed gagal.

## Catatan

Bukan nasihat investasi OJK. NAB reksadana adalah katalog kurasi + model yang dikaitkan ke pergerakan pasar, bukan feed resmi OJK.
