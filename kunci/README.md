# Kunci

Manajer kata sandi **zero-knowledge** untuk Mac. Hanya jalan di **http://127.0.0.1:8780**. Tidak ada hosting publik.

Brankas dienkripsi di perangkat (AES-256-GCM + PBKDF2 600.000 iterasi) sebelum disimpan di IndexedDB. Kata sandi induk, DEK, dan recovery key tidak pernah keluar dari Mac.

## Ancaman yang ditahan vs yang tidak

**Ditahan**

- Tidak ada server. Tidak ada blob cloud. Cadangan yang kamu unduh tetap ciphertext.
- Reset kata sandi memakai recovery key di klien.

**Tidak ditahan**

- Phishing di situs lain, atau mengetik kata sandi induk di halaman palsu.
- Kata sandi induk yang lemah atau tercuri di perangkat.
- Malware di Mac yang membaca memori / keylogger saat brankas terbuka.

## Chrome masih 1.2.4

Kartu `chrome://extensions` baca `kunci/extension/manifest.json` di disk. Di Mac folder clone-nya `/Users/tiftazani/Cursor-Tifz` — bukan `tifz-apps`.

Kalau git bilang `origin/cursor/kunci-password-manager-4eaf is not a commit`: clone-nya `--single-branch`, jadi ref `origin/branch` memang tidak ada. Fetch tetap nulis commit ke `FETCH_HEAD`. **Jangan** `git checkout origin/cursor/...`. **Jangan** `npm run install-service` kalau git gagal — itu yang nge-build tree lama.

Paste **satu blok**, pakai `&&` (bukan `;`). Kalau git bilang local changes would be overwritten: stash dulu (baris di bawah sudah).

```bash
cd /Users/tiftazani/Cursor-Tifz && \
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*" && \
git fetch origin cursor/kunci-password-manager-4eaf && \
(test -z "$(git status --porcelain)" || git stash push -u -m "sebelum kunci branch") && \
git checkout -B cursor/kunci-password-manager-4eaf FETCH_HEAD && \
test -f kunci/src/views/DashboardView.tsx && \
cd kunci && npm install && npm run install-service
```

`git branch --show-current` harus `cursor/kunci-password-manager-4eaf`. Sidebar localhost: **Ringkasan · 1.3**.

Kalau `manifest` sudah `1.3.0`: Load unpacked ke `kunci/extension` **sekali**. Helper di `127.0.0.1:8780` akan menyuruh Chrome reload sendiri setelah git pull / `npm run install-service`. Errors → Clear all kalau badge lama masih nempel.

Ekstensi hanya menawar simpan username/password **setelah login website terlihat berhasil**. Login gagal (form masih ada, kata sandi salah) tidak ditulis ke brankas.

## Jalankan 24 jam di Mac (tanpa terminal)

```bash
cd /Users/tiftazani/Cursor-Tifz/kunci
npm install
npm run install-service
```

Buka **http://127.0.0.1:8780**. Layanan ikut nyala setiap login Mac. Terminal boleh ditutup.

`install-service` juga memasang **Kunci Helper.app** ke `/Applications` (itu yang terbuka dari sidebar Finder Applications) dan `~/Applications`. Tidak butuh Xcode. Kalau app tidak kelihatan, di Finder pilih Go → Applications, atau dari Kunci: Isi otomatis → Tampilkan di Finder.

Stop: `npm run uninstall-service`

## Recovery key

Saat brankas dibuat (atau saat upgrade brankas lama), Kunci menampilkan recovery key sekali.

- Simpan di luar Kunci (kertas, disk terenkripsi, pengelola password lain).
- **Lupa kata sandi?** Masukkan recovery key + kata sandi baru.
- Recovery key hilang + kata sandi induk lupa = data tidak bisa dipulihkan. Itu desain zero-knowledge, bukan bug.

## Jalankan sementara (dev)

```bash
cd kunci
npm install
npm run dev
```

Buka [http://127.0.0.1:5173](http://127.0.0.1:5173). Mati kalau terminal ditutup. Brankas tetap IndexedDB di browser itu — helper Mac tetap di `:8780`.

### Ekstensi browser (simpan + isi website)

Bekerja seperti Google Password Manager untuk **situs web**:

1. Chrome / Edge / Arc → `chrome://extensions` → Developer mode → Load unpacked → `kunci/extension` (Reload jika sudah terpasang)
2. **Safari (Mac):** `cd kunci && npm run install-safari`. Safari → Settings → Advanced → Show features for web developers → tab Developer → Allow unsigned extensions → **Add Temporary Extension…** → pilih `~/.kunci/safari-extension`. Nyalakan Kunci Autofill, lalu **Always Allow on Every Website**. Tutup Safari = ekstensi sementara hilang; tambahkan lagi, atau `npm run install-safari -- --pack` (Xcode).
3. Buka tab Kunci di `http://127.0.0.1:8780`, buka brankas, lalu di popup ekstensi masukkan kata sandi induk
4. Di halaman login, Kunci mengisi otomatis jika hanya ada satu akun (atau klik **K** / `⌘⇧L`)
5. Setelah kamu login, bar Kunci menawar **Simpan** atau **Perbarui** ke brankas terenkripsi

App desktop Mac tidak bisa diambil password-nya diam-diam (batasan macOS, bukan bug). Isi lewat helper: halaman Autofill → *Isi ke app yang saya klik* (termasuk jendela Safari).

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
- Brankas hanya IndexedDB + cadangan file yang kamu unduh
- Cek kebocoran HIBP hanya mengirim 5 karakter pertama hash SHA-1
- Helper Mac hanya `127.0.0.1` + token
- Ekstensi menyimpan login website ke blob terenkripsi di perangkat (butuh brankas terbuka di popup)
- Website tidak bisa menyuntik input ke aplikasi native tanpa helper — batasan sandbox browser / macOS
