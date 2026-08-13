# Cuan

Terminal rekomendasi harian **saham IHSG** dan **reksadana** (pasar uang, saham, obligasi).

## URL publik (Vercel) — tanpa terminal

Repo GitHub ini privat, jadi website tidak otomatis punya URL. Deploy sekali lewat browser:

1. Buka [https://vercel.com/new](https://vercel.com/new)
2. Pilih **Continue with GitHub**, izinkan akses ke repo `tiftazani/Cursor-Tifz`
3. Import project **Cursor-Tifz**
4. Di bagian Branch, pilih `cursor/cuan-ihsg-reksadana-880a` (jangan `main` — `main` masih kosong)
5. Environment Variable (opsional; default sudah ada di kode):
   - Name: `SITE_PASSWORD`
   - Value: sama dengan di `.env.example`
6. Klik **Deploy**
7. Setelah hijau, Vercel memberi URL seperti `https://cuan-xxxx.vercel.app`

Buka URL itu, lalu masuk dengan password situs. Setiap push ke branch yang sama akan ikut ter-deploy.

## Menjalankan di laptop

Harus di folder repo, bukan di home directory (`~`):

```bash
gh auth login
gh repo clone tiftazani/Cursor-Tifz
cd Cursor-Tifz
git checkout cursor/cuan-ihsg-reksadana-880a
cp .env.example .env.local
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Password ada di `SITE_PASSWORD` (lihat `.env.example`).

GitHub tidak menerima password akun untuk `git clone`. Pakai `gh auth login` atau Personal Access Token.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Recharts. Data saham dari Yahoo Finance (`^JKSE`, ticker `.JK`) dengan cache harian WIB dan fallback jika feed gagal.

## Catatan

Bukan nasihat investasi OJK. NAB reksadana adalah katalog kurasi + model yang dikaitkan ke pergerakan pasar, bukan feed resmi OJK.
