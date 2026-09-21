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
| Production URL | `https://kunci-tifta.netlify.app` |
| Netlify site | `kunci-tifta` / id `8c8d1f64-3a3e-4e03-9b19-8e92dd67d473` |
| Deploy preview | `https://deploy-preview-6--kunci-tifta.netlify.app` (sering **401** SSO non-production) |
| Localhost helper UI | `http://127.0.0.1:8780` |
| Dev Vite | `http://127.0.0.1:5173` (+ `#preview-ui` untuk preview tanpa OTP) |
| OTP allowlist | `tiftazani.khara@gmail.com` |

## Apa itu Kunci

Website-first password manager **zero-knowledge**: AES-256-GCM + PBKDF2 600k di klien. Server/Netlify Blobs cuma ciphertext. Gerbang publik = OTP Gmail + cookie sesi. Autofill: ekstensi Chrome (unpacked) + helper Mac (`Kunci Helper.app` + daemon LaunchAgent di `:8780`).

Localhost dan URL publik memakai **satu blob terenkripsi** di Netlify Blobs. Setelah OTP Gmail di salah satu tampilan, simpan/ubah entri muncul di yang lain (butuh kata sandi induk di masing-masing browser). Server tetap tidak melihat password.

## Struktur penting

```
kunci/
  src/                 React UI (views, state/VaultContext, lib/)
  extension/           Chrome MV3 unpacked (manifest 1.2.9)
  helper/              daemon.mjs, install-service, Mac AX fill, repo-paths.mjs
  netlify/functions/   api.ts
  scripts/             sync-branch, ambil-branch.sh, extension-status, gen-icons
  tests/               vitest
  netlify.toml         build di folder kunci; publish dist
  README.md            dokumentasi produk
  HANDOFF.md           file ini
```

Sumber path disk (jangan hardcode `~/tifz-apps`): `kunci/helper/repo-paths.mjs`

- `KUNCI_ROOT` — folder `kunci/`
- `REPO_ROOT` — parent clone
- `EXTENSION_DIR` — `kunci/extension`
- `KUNCI_BRANCH` — `cursor/kunci-password-manager-4eaf`
- `extensionOnDisk()` / `refreshCommands()` — path, versi, stamp untuk auto-reload ekstensi

## Env Netlify

Sudah di-set di site (Production + Deploy previews). Jangan hardcode secret. Contoh: `kunci/.env.example`.

| Variabel | Isi |
| --- | --- |
| `KUNCI_SESSION_SECRET` | String acak ≥ 16 karakter (`openssl rand -base64 32`) |
| `RESEND_API_KEY` | API key Resend untuk OTP |
| `KUNCI_FROM_EMAIL` | Opsional. Default `Kunci <onboarding@resend.dev>` |

Di Netlify Functions: pakai `Netlify.env.get("VAR")`, bukan `process.env` untuk secret.

Project visibility harus **Public** (bukan Private / Team login). Private membuat URL publik hanya jalan di browser yang sudah login Netlify; helper di `127.0.0.1:8780` tidak punya cookie itu — OTP dari localhost gagal.

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
- sidebar **Ringkasan · 1.3**
- helper Mac hijau di `http://127.0.0.1:8780`
- kartu Chrome **Versi 1.2.9** (bukan 1.2.6)

Stop helper: `npm run uninstall-service`.

## Fitur yang sudah ada di branch

1. **Ringkasan home** — skor, komposisi, baru diubah, rekomendasi duplikat + merge/delete (`DashboardView`, `duplicates.ts`, `VSplit` / `split.ts`). Credentials tetap di **Brankas**.
2. **Save web hanya setelah login sukses** — `login-outcome.js` / `src/lib/login-outcome.ts`. Gagal (form masih ada, teks “password salah”, `aria-invalid`) → tidak nulis brankas. App Mac **tidak** keylog; helper hanya fill entri yang sudah ada.
3. **Ekstensi auto-reload** — helper `/health` expose `extensionDir`, `extensionVersion`, `extensionStamp`. Service worker poll `127.0.0.1:8780` / `localhost:8780` → `chrome.runtime.reload()`. Load unpacked **sekali** ke `/Users/tiftazani/Cursor-Tifz/kunci/extension`. Permission `alarms` di manifest.
4. **OTP dual-hit** — localhost + HTTPS reuse kode 2 menit (`src/lib/otp-policy.ts`, `tests/otp-policy.test.ts`). AuthGate cooldown 90s. LaunchAgent `KeepAlive` + `ThrottleInterval` 10.
5. **Stale dist** — daemon mendeteksi `dist/` tanpa “Ringkasan” / “Keadaan akun” dan menampilkan halaman rebuild.
6. **DEV preview** — `#preview-ui` + `previewVault()` melewati OTP untuk cek layout.

## Netlify / production

- Site: base directory `kunci`, production branch historically `cursor/kunci-password-manager-4eaf`.
- Git production deploy sering **error**: `Skipped due to account credit usage exceeded` (plan Free / `nf_team_dev`). Deploy preview PR tetap ready.
- Production pernah di-publish lewat `netlify api restoreSiteDeploy` dari preview siap → bundle `index-BYIugXV8.js` (ada Ringkasan · 1.3). Push berikutnya bisa lagi diskip credit.
- SSO: `sso_login` non_production → preview 401; URL publik yang dipakai user = `https://kunci-tifta.netlify.app`.
- Agent cloud sering **tidak** punya `NETLIFY_AUTH_TOKEN`; publish lewat CLI user yang sudah `netlify login`, atau Netlify UI / restore deploy.

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
- Tambah `.netlify` ke gitignore (sudah).
- Kalau update PR lewat tool: **baca body GitHub dulu** dan preserve edit manusia. Body PR bisa usang (masih menyebut 1.2.6 / `checkout origin/...`); fakta terkini: **1.2.9** + `FETCH_HEAD`.

## Known issues / backlog

| Issue | Status |
| --- | --- |
| Deteksi duplikat terlalu longgar (cluster besar lintas situs, e.g. Adguard↔Admedika) | Belum dikeraskan |
| Skor kesehatan 0 wajar kalau ratusan password lemah | By design penalti |
| Chrome masih 1.2.6 di Mac sampai Load unpacked 1.2.9 sekali | User action |
| Production Netlify credit abis | Restore preview / tunggu credit / naik plan |
| PR description stale vs kode | Sync kalau sentuh PR lagi |
| Tombol Errors di chrome://extensions | Sering bekas; Clear all. Sumber lama: `crypto.randomUUID()` di HTTP (sudah di-wrap di 1.2.8+) |

## Alur ekstensi (ringkas)

1. Pertama kali: `chrome://extensions` → Load unpacked → `/Users/tiftazani/Cursor-Tifz/kunci/extension`.
2. Helper harus nyala (`install-service`).
3. Setelah git pull / file di `extension/` berubah, SW melihat stamp baru dari `/health` dan reload sendiri.
4. Kartu harus **1.2.9**. Reload manual Chrome ≠ ganti file Git.
5. Save login: tunggu outcome sukses; jangan simpan saat submit gagal.

## Alur Mac helper (ringkas)

- Plist: `~/Library/LaunchAgents/com.kunci.daemon.plist`
- Token: `~/.kunci/helper-token`
- App: `/Applications/Kunci Helper.app` (+ salinan `~/Applications`)
- Accessibility: centang **Kunci Helper**. Jangan klik app di Dock (spawn dialog).
- Daemon proxy `/api/*` ke `https://kunci-tifta.netlify.app`.

## Prompt seed untuk harness baru

```
Kerjakan hanya di kunci/ pada branch cursor/kunci-password-manager-4eaf
(repo tiftazani/Cursor-Tifz, PR #6). Baca kunci/HANDOFF.md duluan.

Mac path: /Users/tiftazani/Cursor-Tifz.
Jangan sentuh cuan-yuk-guys. Jangan merge main. Zero-knowledge: jangan
hardcode secrets. Extension unpacked: kunci/extension (1.2.9). Helper:
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
| Manifest | `extension/manifest.json` (`1.2.9`) |
| Netlify API | `netlify/functions/api.ts` |
| Netlify config | `netlify.toml` |

## Catatan keamanan (produk)

**Ditahan:** ciphertext-only di server; OTP allowlist + cookie; recovery reset di klien.

**Tidak ditahan:** phishing master password; master lemah; Gmail dikuasai orang lain + recovery key ikut di Gmail; malware di Mac saat brankas terbuka.
