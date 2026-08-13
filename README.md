# Cuan

Terminal rekomendasi harian **saham IHSG** dan **reksadana** (pasar uang, saham, obligasi).

Kode: [github.com/tiftazani/Cursor-Tifz](https://github.com/tiftazani/Cursor-Tifz)

## URL website publik (Vercel)

GitHub publik = kode bisa dilihat. URL website (seperti `https://cuan.vercel.app`) tetap perlu deploy:

1. Buka [Import Cursor-Tifz di Vercel](https://vercel.com/new/import?s=https://github.com/tiftazani/Cursor-Tifz)
2. Login dengan GitHub
3. Biarkan branch **main**, lalu **Deploy**

Vercel akan memberi URL publik. Password situs ada di `.env.example` (`SITE_PASSWORD`).

## Menjalankan di laptop

Repo sudah publik, clone tidak perlu password GitHub:

```bash
git clone https://github.com/tiftazani/Cursor-Tifz.git
cd Cursor-Tifz
cp .env.example .env.local
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router) · TypeScript · Tailwind · Recharts. Data saham dari Yahoo Finance (`^JKSE`, ticker `.JK`) dengan cache harian WIB dan fallback jika feed gagal.

## Catatan

Bukan nasihat investasi OJK. NAB reksadana adalah katalog kurasi + model yang dikaitkan ke pergerakan pasar, bukan feed resmi OJK.
