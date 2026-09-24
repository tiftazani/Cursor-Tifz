# Handoff: Kunci (password manager) — Cursor-Tifz

Dokumen ini untuk memindahkan kerjaan Kunci ke agent harness lain. Paste atau attach file ini sebagai konteks awal.

## Identitas

| Item | Nilai |
| --- | --- |
| Owner | **Tiftazani** (PM). Chat bahasa Indonesia natural, bukan meeting-speak. |
| Repo | `https://github.com/tiftazani/Cursor-Tifz` |
| App folder | **`kunci/`** saja. Jangan ubah `cuan-yuk-guys/` kecuali diminta. |
| Branch kerja | `cursor/kunci-password-manager-4eaf` |
| HEAD saat handoff | `7e11689` — *Reuse a live Kunci OTP instead of emailing Gmail on dual localhost/HTTPS hits.* |
| PR | https://github.com/tiftazani/Cursor-Tifz/pull/6 (base `main`, **OPEN**, bukan draft) |
| Mac clone | `/Users/tiftazani/Cursor-Tifz` — **bukan** `~/tifz-apps`, **bukan** folder Finder bernama Cursor (itu app Cursor) |
| Extension path | `/Users/tiftazani/Cursor-Tifz/kunci/extension` |
| Production URL | `https://kunci.tiftazani-cuciin.workers.dev` |
| Cloudflare | Worker `kunci` (akun `tiftazani.khara@gmail.com`), storage Durable Object |
| Deploy preview | Tidak ada (Workers deploy langsung; cek lokal via `npx wrangler dev`) |
| Localhost helper UI | `http://127.0.0.1:8780` |
| Dev Vite | `http://127.0.0.1:5173` (+ `#preview-ui` untuk preview tanpa OTP) |
| OTP allowlist | `tiftazani.khara@gmail.com` |

## Apa itu Kunci

Website-first password manager **zero-knowledge**: AES-256-GCM + PBKDF2 600k di klien. Server (Durable Object) cuma ciphertext. Gerbang publik = OTP Gmail + cookie sesi. Autofill: ekstensi Chrome (unpacked) + helper Mac (`Kunci Helper.app` + daemon LaunchAgent di `:8780`).

Localhost dan URL publik memakai **satu blob terenkripsi** di Durable Object. Setelah OTP Gmail di salah satu tampilan, simpan/ubah entri muncul di yang lain (butuh kata sandi induk di masing-masing browser). Server tetap tidak melihat password.

## Struktur penting

```
kunci/
  src/                 React UI (views, state/VaultContext, lib/)
  extension/           Chrome MV3 unpacked (manifest 1.4.0)
  helper/              daemon.mjs, install-service, Mac AX fill, repo-paths.mjs
  worker/              index.ts (API + KunciStore Durable Object)
  scripts/             sync-branch, ambil-branch.sh, extension-status, gen-icons
  tests/               vitest
  wrangler.toml        build di folder kunci; publish dist + worker
  README.md            dokumentasi produk
  HANDOFF.md           file ini
```

Sumber path disk (jangan hardcode `~/tifz-apps`): `kunci/helper/repo-paths.mjs`

- `KUNCI_ROOT` — folder `kunci/`
- `REPO_ROOT` — parent clone
- `EXTENSION_DIR` — `kunci/extension`
- `KUNCI_BRANCH` — `cursor/kunci-password-manager-4eaf`
- `extensionOnDisk()` / `refreshCommands()` — path, versi, stamp untuk auto-reload ekstensi

## Env / secret Cloudflare

Sudah di-set via `npx wrangler secret put` (tidak di repo, tidak di git). Contoh: `kunci/.env.example`.

Cek cepat: `npx wrangler secret list` — kalau `RESEND_API_KEY` tidak ada di daftar, OTP email akan jawab 500 `RESEND_API_KEY belum di-set`.

| Variabel | Isi |
| --- | --- |
| `KUNCI_SESSION_SECRET` | String acak ≥ 16 karakter (`openssl rand -base64 32`) |
| `RESEND_API_KEY` | API key Resend untuk OTP. **Kosong** — key lama hanya ada di Netlify dalam bentuk ter-mask, jadi harus dibuat ulang di resend.com/api-keys, lalu `npm run set-resend-key` (baca dari papan klip, tidak lewat shell history) |
| `KUNCI_FROM_EMAIL` | Opsional. Default `Kunci <onboarding@resend.dev>` |

Kalau `RESEND_API_KEY` kosong, gerbang OTP **tidak** memblokir localhost: kalau brankas sudah ada di IndexedDB `127.0.0.1:8780`, app langsung jalan dan perubahan hanya tersimpan lokal. Situs publik tetap butuh kode. Tombol "Buka gerbang kode email" ada di Pengaturan → Sesi.

Deploy: `npm run deploy` (= build + `wrangler deploy`). Lihat secret: `npx wrangler secret list`. Storage = Durable Object `KunciStore` (konsisten kuat, jadi cap percobaan OTP tidak bisa diakali).

**Migrasi blob dari Netlify.** Brankas lama ada di Netlify Blobs store `kunci-secure` (site `kunci-tifta`). Sudah disalin ke Durable Object Worker pada 2026-09-24; ciphertext diverifikasi identik byte-per-byte (570.384 byte `data`). Salinan cadangan: `~/.kunci/netlify-vault-20260924.json` (mode 600). Brankas Netlify lama **belum dihapus** — hapus setelah yakin Worker jalan.

> Netlify sudah ditinggalkan (kredit akun habis, deploy diblokir). Jangan buat ulang `netlify.toml` / `.netlify`.

## Cara jalanin Mac (kritis)

Clone sering `--single-branch` → **jangan** `git checkout origin/cursor/...` (fatal: not a commit). Fetch nulis commit ke `FETCH_HEAD`. Kalau working tree kotor (`.gitignore`, `README.md`, dll.), stash dulu.

Paste **satu blok**, pakai `&&`:

```bash
cd /Users/tiftazani/Cursor-Tifz && \
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*" && \
git fetch origin cursor/kunci-password-manager-4eaf && \
(test -z "$(git status --porcelain)" || git stash push -u -m "sebelum kunci branch") && \
git checkout -B cursor/kunci-password-manager-4eaf FETCH_HEAD && \
test -f kunci/src/views/DashboardView.tsx && \
cd kunci && npm install && npm run install-service
```

Alternatif setelah sudah di tree yang benar:

```bash
cd /Users/tiftazani/Cursor-Tifz/kunci
npm run sync-branch
npm run install-service
# atau
npm run refresh-local
```

Sukses lokal:

- `git branch --show-current` = `cursor/kunci-password-manager-4eaf`
- ada `kunci/src/views/DashboardView.tsx`
- sidebar **Ringkasan · 1.4.0** (dari `extension/VERSION`, bukan hardcode)
- helper Mac hijau di `http://127.0.0.1:8780`
- kartu Chrome **Versi 1.4.0**

Stop helper: `npm run uninstall-service`.

## Fitur yang sudah ada di branch

1. **Ringkasan home** — skor, komposisi, baru diubah, rekomendasi duplikat + merge/delete (`DashboardView`, `duplicates.ts`, `VSplit` / `split.ts`). Credentials tetap di **Brankas**.
2. **Save web hanya setelah login sukses** — `login-outcome.js` / `src/lib/login-outcome.ts`. Gagal (form masih ada, teks “password salah”, `aria-invalid`) → tidak nulis brankas. App Mac **tidak** keylog; helper hanya fill entri yang sudah ada.
3. **Ekstensi auto-reload** — helper `/health` expose `extensionDir`, `extensionVersion`, `extensionStamp`. Service worker poll `127.0.0.1:8780` / `localhost:8780` → `chrome.runtime.reload()`. Load unpacked **sekali** ke `/Users/tiftazani/Cursor-Tifz/kunci/extension`. Permission `alarms` di manifest.
4. **OTP dual-hit** — localhost + HTTPS reuse kode 2 menit (`src/lib/otp-policy.ts`, `tests/otp-policy.test.ts`). AuthGate cooldown 90s. LaunchAgent `KeepAlive` + `ThrottleInterval` 10.
5. **Stale dist** — daemon mendeteksi `dist/` tanpa “Ringkasan” / “Keadaan akun” dan menampilkan halaman rebuild.
6. **DEV preview** — `#preview-ui` + `previewVault()` melewati OTP untuk cek layout.

## Cloudflare / production

- Deploy: `npm run deploy` (build + `wrangler deploy`) → `https://kunci.tiftazani-cuciin.workers.dev`.
- Storage: Durable Object `KunciStore` (migrasi `v1`, SQLite). Headers keamanan di `public/_headers`.
- Secrets: `KUNCI_SESSION_SECRET`, `RESEND_API_KEY` (opsional `KUNCI_FROM_EMAIL`) via `wrangler secret put`.
- Arsitektur: static SPA + `run_worker_first = ["/api/*", "/kunci-status"]`, jadi `/api/*` tidak pernah ditelan SPA fallback.

## Verifikasi

```bash
cd kunci
npm test          # ~81 tests (vitest)
npm run extension-status
```

Lint: `npm run lint` (oxlint).

## Perintah npm berguna

| Script | Fungsi |
| --- | --- |
| `npm run sync-branch` | Fetch + checkout `FETCH_HEAD` + cek DashboardView |
| `npm run ambil-branch` | Bash equivalent (`scripts/ambil-branch.sh`) |
| `npm run install-service` | Build dist + pasang LaunchAgent + Helper.app |
| `npm run refresh-local` | sync-branch lalu install-service |
| `npm run uninstall-service` | Stop daemon |
| `npm run extension-status` | Cek versi manifest vs branch |
| `npm run install-safari` | Safari temporary extension |
| `npm run dev` | Vite 5173 |
| `npm run build` | icons + tsc + vite build |
| `npm run helper` / `npm start` | Daemon (+ serve UI) |

## Larangan / preferensi product

- Jangan keylog native Mac apps.
- Jangan commit compiled `Kunci Helper.app`.
- Prefer `osacompile` JXA lalu Swift; jangan wajibkan `swiftc` saja.
- Jangan merge ke `main` kecuali diminta (Vercel Cuan Yuk Guys di `main`, root `cuan-yuk-guys`).
- Jangan hardcode secrets.
- Netlify sudah ditinggalkan; abaikan `.netlify` di gitignore (legacy).
- Kalau update PR lewat tool: **baca body GitHub dulu** dan preserve edit manusia. Body PR bisa usang (masih menyebut versi lama / `checkout origin/...`); fakta terkini: **1.4.0** + `FETCH_HEAD`.

## Known issues / backlog

| Issue | Status |
| --- | --- |
| Deteksi duplikat terlalu longgar (cluster besar lintas situs, e.g. Adguard↔Admedika) | Belum dikeraskan |
| Skor kesehatan 0 wajar kalau ratusan password lemah | By design penalti |
| Chrome masih versi lama di Mac sampai Load unpacked sekali | User action |
| PR description stale vs kode | Sync kalau sentuh PR lagi |
| Tombol Errors di chrome://extensions | Sering bekas; Clear all. Sumber lama: `crypto.randomUUID()` di HTTP (sudah di-wrap) |

## Alur ekstensi (ringkas)

1. Pertama kali: `chrome://extensions` → Load unpacked → `/Users/tiftazani/Cursor-Tifz/kunci/extension`.
2. Helper harus nyala (`install-service`).
3. Setelah git pull / file di `extension/` berubah, SW melihat stamp baru dari `/health` dan reload sendiri.
4. Kartu harus **1.4.0**. Reload manual Chrome ≠ ganti file Git.
5. Save login: tunggu outcome sukses; jangan simpan saat submit gagal.
6. Ikon toolbar: `was_pinned_by_default: false`, jadi **tidak** muncul sendiri. Pin lewat puzzle-piece → pin. Ini bukan bug kode.

### Aturan duplikat

- Dua akun beda di host sama = bukan duplikat. Username beda selalu lolos.
- Host harus **sama persis**. `accounts.google.com` ≠ `myaccount.google.com` ≠ `mail.google.com`. Jangan pakai domain family.
- Layer URL (path) harus sama. `/login` dan `/transfer/confirm` = dua password berbeda.
- Nama entri berisi email (`tiftazani@gmail.com`) **bukan** host. `hostFromUrl` menolak string tanpa scheme yang mengandung `@`; `nameMatchesHost` juga menolak nama ber-`@` supaya entri tidak ditawarkan di `gmail.com` hanya karena nama = alamat email.
- Entri bernama OTP/TOTP/2FA/authenticator tidak pernah masuk cluster.
- Cek: `npx vite-node .audit/dupe-ab.mjs`.

### Layer password (satu situs, banyak prompt)

- `layerFromUrl(url)` = path tanpa trailing slash, huruf kecil. Dipakai bersama oleh `src/lib/match.ts` dan `extension/crypto.js`.
- `matchesForUrl` **tidak menyembunyikan** match, hanya mengurutkan: entri yang path-nya sama persis dengan halaman naik ke atas, entri tanpa path/root jadi cadangan.
- Popup ekstensi menampilkan layer di baris kedua (`username · /transfer/confirm`) supaya dua kredensial di satu host terbaca beda.
- Simpan login juga pakai layer: `decideLoginSave` pilih entri yang path-nya sama dulu. Kalau tidak, PIN di `/transfer/confirm` akan menimpa login `/login` yang username-nya sama.
- Layer bukan filter: entri lain di host sama tetap ditawarkan, hanya turun urutan.
- Cek: `tests/match-parity.test.ts` (parity + urutan), `tests/capture.test.ts`, `tests/extension-crypto.test.ts`.

### Kapan ikon Kunci muncul

- Ada field `password` + form terklasifikasi login → ikon di samping password.
- Kotak kode sekali pakai (`autocomplete="one-time-code"`, `inputmode` numerik, nama `otp`/`totp`/`mfa`) → **tidak pernah**. Ini OTP, bukan password.
- Satu field rahasia sendirian di halaman non-login (API key, token, webhook) → **tidak**. Aturan: `passwords.length === 1` + tanpa username yakin + tanpa sinyal login di tombol/URL. Contoh: modal OpenAI Compatible (Check/Create/Cancel).
- Belum ada password tapi form jelas langkah login (tombol Continue/Next/Masuk, atau URL `/login` `/signin`) → ikon di samping kotak email. Contoh: `agoda.com/account/signin.html`.
- Signup, reset, change-password, pencarian, pembayaran, newsletter → tidak pernah.
- Cek: `node .audit/agoda-live.mjs`, `node .audit/modal-live.mjs`, `node .audit/otp-live.mjs`, dan `node .audit/ext-live.mjs` (Playwright, muat ekstensi sungguhan).

## Alur Mac helper (ringkas)

- Plist: `~/Library/LaunchAgents/com.kunci.daemon.plist`
- Token: `~/.kunci/helper-token`
- App: `/Applications/Kunci Helper.app` (+ salinan `~/Applications`)
- Accessibility: centang **Kunci Helper**. Jangan klik app di Dock (spawn dialog).
- Daemon proxy `/api/*` ke `https://kunci.tiftazani-cuciin.workers.dev`.

## Prompt seed untuk harness baru

```
Kerjakan hanya di kunci/ pada branch cursor/kunci-password-manager-4eaf
(repo tiftazani/Cursor-Tifz, PR #6). Baca kunci/HANDOFF.md duluan.

Mac path: /Users/tiftazani/Cursor-Tifz.
Jangan sentuh cuan-yuk-guys. Jangan merge main. Zero-knowledge: jangan
hardcode secrets. Extension unpacked: kunci/extension (1.4.0). Helper:
127.0.0.1:8780. Git Mac: fetch + checkout -B … FETCH_HEAD (bukan origin/branch).
Bahasa chat: Indonesia natural.
```

## Referensi cepat file

| Area | Path |
| --- | --- |
| Vault state | `src/state/VaultContext.tsx` |
| Ringkasan UI | `src/views/DashboardView.tsx` |
| Duplikat | `src/lib/duplicates.ts` |
| Login save outcome | `src/lib/login-outcome.ts`, `extension/login-outcome.js`, `extension/content.js` |
| OTP policy | `src/lib/otp-policy.ts` |
| Paths / stamp | `helper/repo-paths.mjs` |
| Daemon /health | `helper/daemon.mjs` |
| Install Mac | `helper/install-service.mjs` |
| Extension SW | `extension/background.js` |
| Manifest | `extension/manifest.json` (`1.4.0`) |
| Cloudflare worker + API | `worker/index.ts` |
| Cloudflare config | `wrangler.toml` |

## Catatan keamanan (produk)

**Ditahan:** ciphertext-only di server; OTP allowlist + cookie; recovery reset di klien.

**Tidak ditahan:** phishing master password; master lemah; Gmail dikuasai orang lain + recovery key ikut di Gmail; malware di Mac saat brankas terbuka.
