# Kunci

Manajer kata sandi **zero-knowledge** untuk Mac, berbentuk website. Brankas dienkripsi di perangkat (AES-256-GCM + PBKDF2 600.000 iterasi) **sebelum** disimpan. Kata sandi induk, DEK, dan recovery key **tidak pernah** disimpan di server.

Bisa dibuka di `localhost` atau di **URL HTTPS publik** (Netlify). Tidak ada sistem yang “anti-hack 100%”: yang dikunci di sini adalah agar peretas server, Netlify, atau cadangan cloud **tidak bisa membaca** username/password tanpa kata sandi induk atau recovery key.

## Ancaman yang ditahan vs yang tidak

**Ditahan**

- Server / Netlify Blobs hanya menyimpan ciphertext. Bocornya blob cloud tidak membuka brankas.
- Gerbang publik: hanya email allowlist, OTP 8 karakter, cookie HttpOnly + SameSite=Strict, HTTPS, HSTS, CSP, rate limit.
- Helper Mac tidak lagi menulis DEK ke `~/.kunci/recovery.json`.
- Reset kata sandi memakai recovery key di klien, bukan “kode email yang mengeluarkan kunci enkripsi”.

**Tidak ditahan (risiko yang tetap ada)**

- Phishing: kamu memasukkan kata sandi induk di situs palsu. Selalu cek URL HTTPS milikmu.
- Kata sandi induk yang lemah atau tercuri di perangkat.
- Gmail yang dikuasai orang lain: mereka bisa masuk gerbang OTP dan mengunduh ciphertext, **tetapi tidak bisa mendekripsi** kecuali recovery key juga ada di Gmail (jangan kirim, kecuali kamu sadar risikonya).
- Malware di Mac yang membaca memori / menekan keylogger saat brankas terbuka.

## URL publik (Netlify)

1. Buat site Netlify, **Base directory** = `kunci`.
2. Environment variables (Production + Deploy previews):

   | Variabel | Isi |
   | --- | --- |
   | `KUNCI_SESSION_SECRET` | String acak ≥ 16 karakter (`openssl rand -base64 32`) |
   | `RESEND_API_KEY` | API key [Resend](https://resend.com) untuk OTP masuk |
   | `KUNCI_FROM_EMAIL` | Opsional. Default `Kunci <onboarding@resend.dev>` |

3. Deploy. Buka URL `https://kunci-tifta.netlify.app` (atau domain sendiri + HTTPS).
4. **Project visibility harus Public** (bukan Private / Team login). Private membuat URL publik hanya jalan di browser yang sudah login Netlify, sementara helper di `127.0.0.1:8780` tidak punya cookie itu — OTP dari localhost gagal. Kunci sudah punya gerbang kode Gmail sendiri.
5. Minta kode masuk ke **tiftazani.khara@gmail.com**, lalu buka brankas dengan kata sandi induk.

Localhost (`http://127.0.0.1:8780`) dan URL publik memakai **satu blob terenkripsi** di Netlify Blobs. Setelah kode Gmail di salah satu tampilan, simpan/ubah entri akan muncul di yang lain (butuh kata sandi induk di masing-masing browser). Server tetap tidak melihat password.

Autofill aplikasi Mac tetap butuh helper lokal (`npm run install-service`) di laptop — browser di internet tidak bisa mengetik ke app desktop.

## Jalankan 24 jam di Mac (tanpa terminal)

```bash
cd ~/Cursor-Tifz/kunci
npm install
npm run install-service
```

Buka **http://127.0.0.1:8780**. Layanan ikut nyala setiap login Mac. Terminal boleh ditutup.

Stop: `npm run uninstall-service`

Localhost memakai gerbang OTP yang sama (kode ke Gmail) supaya sesi cloud bisa menulis ke blob yang sama. Helper mem-proxy `/api/*` ke URL publik. Kalau tombol kirim kode gagal dengan HTML login Netlify, site masih Private — ubah ke Public.

## Recovery key

Saat brankas dibuat (atau saat upgrade brankas lama), Kunci menampilkan recovery key sekali.

- Simpan di luar Kunci (kertas, disk terenkripsi, pengelola password lain).
- **Lupa kata sandi?** Masukkan recovery key + kata sandi baru. Server tidak bisa mereset untukmu.
- Kirim ke Gmail hanya jika kamu menerima risiko: Gmail + OTP = orang itu bisa mereset.
- Recovery key hilang + kata sandi induk lupa = data tidak bisa dipulihkan. Itu desain zero-knowledge, bukan bug.

## Jalankan sementara (dev)

```bash
cd kunci
npm install
npm run dev
```

Buka [http://localhost:5173](http://localhost:5173). Mati kalau terminal ditutup.

Untuk mengetes gerbang publik secara lokal: set env, lalu `npx netlify dev` di folder `kunci`.

### Ekstensi browser (simpan + isi website)

Bekerja seperti Google Password Manager untuk **situs web**:

1. Chrome / Edge / Arc → `chrome://extensions` → Developer mode → Load unpacked → `kunci/extension` (Reload jika sudah terpasang)
2. Buka tab Kunci, buka brankas, lalu di popup ekstensi masukkan kata sandi induk
3. Di halaman login, Kunci mengisi otomatis jika hanya ada satu akun (atau klik **K** / `⌘⇧L`)
4. Setelah kamu login, bar Kunci menawar **Simpan** atau **Perbarui** ke brankas terenkripsi

App desktop Mac tidak bisa diambil password-nya diam-diam (batasan macOS, bukan bug). Isi lewat helper: halaman Autofill → *Isi ke app yang saya klik*.

## Cadangan

- **Cadangkan sekarang** mengunduh file JSON terenkripsi dan menyimpan snapshot di IndexedDB
- Pilih folder (Chrome/Edge) agar file `kunci-backup-*.json` ditulis otomatis, misalnya ke iCloud Drive
- Pulihkan dari file atau dari versi di perangkat. Impor CSV hanya untuk pindah dari browser lain — file CSV itu plaintext, hapus setelah impor

## Pintasan

| Pintasan | Aksi |
| --- | --- |
| ⌘K | Cari cepat |
| ⌘N | Entri baru |
| ⌘L | Kunci brankas |
| ⌘⇧L | Autofill di tab aktif (ekstensi) |

## Keamanan teknis

- AES-256-GCM, DEK terbungkus kata sandi induk (PBKDF2-SHA-256, 600k) dan recovery key terpisah
- PUT `/api/vault` menolak field `dek` / `password` / `recoveryKey`; hanya ciphertext yang disimpan
- Cookie sesi HMAC, Origin allowlist (HTTPS site + localhost), rate limit OTP
- Cek kebocoran HIBP hanya mengirim 5 karakter pertama hash SHA-1
- Helper Mac hanya `127.0.0.1` + token
- Ekstensi menyimpan login website ke blob terenkripsi yang sama (butuh brankas terbuka di popup)
- Website tidak bisa menyuntik input ke aplikasi native tanpa helper — batasan sandbox browser / macOS
