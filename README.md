# tifz-apps (GitHub: Cursor-Tifz)

Folder Mac: `~/tifz-apps`. Hub app pribadi — tiap project punya foldernya sendiri.

## Folder project

| Folder | Isi |
| --- | --- |
| [`cuan-yuk-guys/`](./cuan-yuk-guys) | Website **Cuan Yuk Guys** (IHSG, reksadana, Cuan Bot) |
| [`kunci/`](./kunci) | **Kunci** — manajer kata sandi zero-knowledge (web + URL publik HTTPS) |

Kode Cuan Yuk Guys: [github.com/tiftazani/Cursor-Tifz/tree/main/cuan-yuk-guys](https://github.com/tiftazani/Cursor-Tifz/tree/main/cuan-yuk-guys)

## Branch

| Branch | Isi |
| --- | --- |
| `main` | Hub + Cuan Yuk Guys (Vercel pakai ini) |
| `kunci` | Kerjaan **Kunci** (di GitHub masih `cursor/kunci-password-manager-4eaf`, Cloud jangan diubah) |
| `cursor/imo-whatsapp-analytics-eb4c` dll. | Draft Cloud Agent (IMO, WhatsApp, bot kota) — nama Cloud biarkan |

## Jalankan di laptop

### Cuan Yuk Guys

```bash
git clone https://github.com/tiftazani/Cursor-Tifz.git ~/tifz-apps
cd ~/tifz-apps/cuan-yuk-guys
cp .env.example .env.local
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### Kunci (password manager)

```bash
cd ~/tifz-apps/kunci
npm install
npm run dev
```

Buka [http://localhost:5173](http://localhost:5173). URL publik HTTPS (zero-knowledge, gerbang OTP): lihat [`kunci/README.md`](./kunci/README.md). Autofill Mac dan ekstensi juga di situ.

## Vercel (wajib sekali)

Situs publik `https://cuan-tif.vercel.app` tetap memakai branch **main**. Karena app sekarang ada di folder, atur Root Directory:

1. Buka [Vercel dashboard](https://vercel.com/dashboard) → project **cuan-tif** (atau nama project-nya)
2. **Settings** → **General** → **Root Directory**
3. Isi: `cuan-yuk-guys`
4. Save, lalu **Deployments** → **Redeploy** (atau push commit baru ke `main`)

Tanpa langkah itu, Vercel masih mencari `package.json` Next.js di root dan build bisa gagal.

## Catatan

Bukan nasihat investasi OJK. Copyright by Tiftazani.
