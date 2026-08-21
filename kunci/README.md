# Kunci

Manajer kata sandi **lokal** untuk Mac, dalam bentuk website. Brankas dienkripsi di perangkat (AES-256-GCM + PBKDF2 600.000 iterasi). Kata sandi induk tidak pernah dikirim ke server.

Cocok dibuka di Safari/Chrome di MacBook, atau dipasang sebagai app (Add to Dock / standalone).

## Fitur

- Simpan **username + password**, atau **password saja**, untuk website atau aplikasi Mac
- **Autofill website** lewat ekstensi browser (tombol K di field password, atau ⌘⇧L)
- **Autofill aplikasi desktop Mac** lewat helper lokal (`npm run helper`) yang mengetik ke app di depan
- Cadangan **Salin berurutan** jika helper belum jalan (username dulu, password menyusul)
- **Riwayat** username/password lama tiap kali kredensial diganti, bisa disalin atau dipakai lagi
- Cadangan **manual** (unduh file terenkripsi) dan **otomatis** (setiap perubahan / jam / hari), plus folder di disk lewat Chrome/Edge
- Generator password & passphrase, kesehatan brankas, cek kebocoran Have I Been Pwned (k-anonymity), TOTP/authenticator, catatan aman, field kustom, favorit, tag, auto-lock, hapus papan klip, impor CSV Chrome/Bitwarden

## Jalankan 24 jam (tanpa terminal)

```bash
cd ~/Cursor-Tifz/kunci
npm install
npm run install-service
```

Lalu buka **http://127.0.0.1:8780** — layanan ikut nyala setiap login Mac. Terminal boleh ditutup.

Reset kata sandi: di layar kunci pilih **Lupa kata sandi?** Kode 6 digit dikirim ke **tiftazani.khara@gmail.com** (Mail.app harus sudah login Gmail, atau isi `~/.kunci/smtp.json`).

Stop: `npm run uninstall-service`

## Jalankan sementara (dev)

```bash
cd kunci
npm install
npm run dev
```

Buka [http://localhost:5173](http://localhost:5173). Ini mati kalau terminal ditutup.

### Ekstensi browser (autofill website)

1. Chrome / Edge / Arc → `chrome://extensions`
2. Developer mode → Load unpacked → pilih folder `kunci/extension`
3. Buka tab Kunci dan buka brankas (ekstensi menyimpan salinan terenkripsi)
4. Di popup ekstensi, masukkan kata sandi induk
5. Di halaman login, klik tombol **K** di samping password

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

## Deploy (opsional)

Ini aplikasi klien: yang di-host hanya UI. Data tetap di browser masing-masing.

Di Netlify, set **Base directory** ke `kunci`. `netlify.toml` sudah mengatur SPA redirect dan header keamanan.

## Keamanan

- Enkripsi di klien; blob IndexedDB tidak bisa dibaca tanpa kata sandi induk
- Helper Mac hanya `127.0.0.1` dan membutuhkan token
- Cek kebocoran hanya mengirim 5 karakter pertama hash SHA-1
- Website **tidak bisa** menyuntik input ke aplikasi native tanpa helper — itu batasan sandbox browser, bukan kekurangan UI
