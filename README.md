# Cursor-Tifz

Repo hub Tiftazani. Aplikasi tidak lagi menempati seluruh root GitHub — tiap project punya foldernya sendiri.

## Folder project

| Folder | Isi |
| --- | --- |
| [`cuan-yuk-guys/`](./cuan-yuk-guys) | Website **Cuan Yuk Guys** (IHSG, reksadana, Cuan Bot) |
| [`laundry-ops/`](./laundry-ops) | **Cuciin** — aplikasi Android operasional laundry |

Kode aplikasi: [github.com/tiftazani/Cursor-Tifz/tree/main/cuan-yuk-guys](https://github.com/tiftazani/Cursor-Tifz/tree/main/cuan-yuk-guys)

## Jalankan di laptop

```bash
git clone https://github.com/tiftazani/Cursor-Tifz.git
cd Cursor-Tifz/cuan-yuk-guys
cp .env.example .env.local
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Vercel (wajib sekali)

Situs publik `https://cuan-tif.vercel.app` tetap memakai branch **main**. Karena app sekarang ada di folder, atur Root Directory:

1. Buka [Vercel dashboard](https://vercel.com/dashboard) → project **cuan-tif** (atau nama project-nya)
2. **Settings** → **General** → **Root Directory**
3. Isi: `cuan-yuk-guys`
4. Save, lalu **Deployments** → **Redeploy** (atau push commit baru ke `main`)

Tanpa langkah itu, Vercel masih mencari `package.json` Next.js di root dan build bisa gagal.

### Cuciin tidak lagi memakai Vercel

Project Vercel **cuan-tif** hanya untuk **Cuan Yuk Guys**. Mockup dan APK Cuciin sudah dihapus dari sana karena numpang di project aplikasi lain.

- API operasional Cuciin: `https://cuciin-api.tiftazani-cuciin.workers.dev` (Cloudflare Worker + D1).
- APK: dibagikan dari folder [`laundry-ops/releases/`](./laundry-ops/releases), bukan dari halaman web.

Kalau kelak butuh mockup web Cuciin lagi, jalankan lokal: `cd laundry-ops/mockup && ./start.sh`.

## Catatan

Bukan nasihat investasi OJK. Copyright by Tiftazani.
