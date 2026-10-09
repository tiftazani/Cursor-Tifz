# Serah terima Kunci ke Claude Code

Snapshot diperiksa 9 Oktober 2026. Ini menggantikan handoff lama. Path lama
`/Users/tiftazani/Cursor-Tifz`, HEAD lama, angka 81 tes, dan backlog lama bukan kondisi
terbaru. Saat dokumen dan kode berbeda, periksa kode dan jalankan tes.

## Mulai tanpa mengulang proyek

Claude Code sudah tersedia di Mac ini: `claude --version` menjawab `2.1.286`.
Login Claude belum diperiksa. Tidak ada migrasi data, clone, atau instalasi ulang yang
diperlukan hanya untuk beralih agen pada Mac yang sama.

```sh
cd /Users/tiftazani/Documents/Hermes-AI/Kunci
claude
```

`CLAUDE.md` di root memberi aturan proyek. Prompt awal yang bisa ditempel:

> Baca CLAUDE.md, kunci/HANDOFF.md, dan kunci/docs/MAINTENANCE.md. Kerjakan hanya
> Kunci pada tree lokal ini. Jangan clone ulang, checkout ulang branch, commit, push,
> deploy, atau mengubah data vault untuk inisialisasi. Periksa git status dan sebutkan
> kondisi terbaru serta batas yang belum diuji. Jangan menganggap proposal fitur tim
> sudah dibuat. Setelah itu tunggu tugas saya.

Dokumen ini adalah pemindahan konteks, bukan pemindahan chat Hermes menjadi sesi
Claude. Claude tidak otomatis memperoleh riwayat percakapan atau tools Hermes.

## Identitas dan git

- Repo lokal: `/Users/tiftazani/Documents/Hermes-AI/Kunci`.
- Root aplikasi: `/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci`.
- Origin: `https://github.com/tiftazani/Cursor-Tifz.git`.
- Branch aktif: `cursor/kunci-password-manager-4eaf`.
- HEAD diperiksa: `6bfa1b2` — `Lock in that a bare loopback name does not claim another port`.
- Dibanding ref upstream lokal: ahead 49, behind 0. Tidak melakukan fetch pada serah
  terima ini; kondisi server GitHub terkini belum diperiksa.
- PR historis: https://github.com/tiftazani/Cursor-Tifz/pull/6. Status PR kini belum
  diperiksa. Jangan menganggap masih OPEN atau mengubah body tanpa membaca edit manusia.
- Dua file untracked sudah ada SEBELUM serah terima: `kunci/.audit/port-ab.mjs` dan
  `kunci/.audit/port-live.mjs`. Bukan fitur baru; harness uji port. Jangan langsung
  menjalankannya: keduanya mencoba bind 8780 yang kini dipakai daemon asli.
- Tidak ada perubahan kode tracked sebelum serah terima. File dokumentasi baru dan
  pembaruan handoff belum di-commit atau di-push.

Pakai clone lokal ini. Clone GitHub saja tidak membawa 49 commit lokal atau dokumen
untracked. Jika nanti pindah mesin, minta keputusan pengguna tentang commit/push atau
transfer repo lokal utuh. Jangan menyalin credential files atau vault ke paket konteks.

Root repo juga menyimpan `cuan-yuk-guys/` (aplikasi lain). `package.json` ROOT
mengarah ke aplikasi itu. Jangan menjalankan lint/build Kunci dari root, mengganti
branch dengan `FETCH_HEAD`, atau memakai `refresh-local` hanya untuk mulai sesi.
`sync-branch`, `ambil-branch`, dan `refresh-local` bisa fetch/stash/checkout; itu
alur pembaruan clone lama, bukan langkah onboarding agen di tree ini.

## Produk, stack, dan batas

Kunci adalah pengelola kata sandi personal. Brankas dienkripsi di perangkat.
Web/PWA memakai React 19, TypeScript, dan Vite 8. Ekstensi Chromium adalah Manifest
V3 dengan JavaScript biasa. Helper Mac memakai Node, LaunchAgent, JXA/Accessibility,
dan app helper. Worker Cloudflare menyimpan satu blob terenkripsi dalam Durable
Object `KunciStore`. Tidak ada Android app di repo; `android://` berasal dari impor
CSV browser.

Dependency runtime hanya `react` dan `react-dom`. Tools pengembangan sudah tercantum
di `package.json`: TypeScript, Vite, Vitest, oxlint, Playwright, Wrangler. Jangan
mengganti stack atau menambah library untuk fitur bawaan. Versi Node saat pemeriksaan
`v26.10.0`, npm `11.19.1`. Lockfile adalah acuan instalasi ulang, bukan angka di sini.

Gerbang email hanya untuk email allowlist `tiftazani.khara@gmail.com`.
OTP memberi akses ciphertext/cloud sync, bukan kunci untuk membukanya.
Server saat ini tidak mendukung akun tim, People, Groups, permission, atau shared vault.
`docs/TEAM-SECURITY-DESIGN.md` adalah proposal dengan syarat review keamanan dan
prototype lintas pengguna. Jangan menyajikannya sebagai implementasi selesai.

## Peta kode dan alur data

Semua path berikut relatif terhadap `kunci/`:

- `src/App.tsx`: gerbang sesi cloud, status setup/locked/unlocked, tema.
- `src/state/VaultContext.tsx`: pusat unlock, persist, sync, backup, trash, recovery,
  dan inactivity lock. Baca semua pemanggil bila mengubah hasil persist.
- `src/types.ts`: Entry, Vault, EncryptedBlob, settings dan view ids.
- `src/lib/crypto.ts`: PBKDF2-SHA256 600.000 iterasi, AES-256-GCM, DEK dan recovery
  wraps. DEK adalah kunci acak yang mengenkripsi isi brankas.
- `src/db/idb.ts`: IndexedDB `kunci-vault`, object store `kv`: ciphertext, backup,
  hint, folder handle, dan reload session. Penyimpanan terikat origin browser.
- `src/lib/refresh-session.ts`: key non-extractable di IndexedDB; sessionStorage hanya
  tab id. Jangan menggantinya dengan raw/base64 key dalam web storage.
- `src/lib/cloud.ts`: sesi cookie/bearer, retry stale token, baca/tulis cloud.
- `src/extension/bridge.ts`: sinkronisasi app dan ekstensi.
- `src/views/AppShell.tsx`: nav, list/detail, filter, draft, keyboard/multi-selection.
- `src/views/DashboardView.tsx`, `HealthView.tsx`: ringkasan dan temuan kesehatan.
- View personal lain: `GeneratorView.tsx`, `HistoryView.tsx`, `AutofillView.tsx`,
  `BackupView.tsx`, `SettingsView.tsx`, `EntryPane.tsx`, `Gate.tsx`.
- `src/lib/duplicates.ts`: kelompok dan pilihan duplikat.
- `src/lib/match.ts`, `capture.ts`, `login-intent.ts`, `login-outcome.ts`: kecocokan
  entri, target simpan, jenis form, bukti login berhasil.
- `extension/crypto.js`, `login-intent.js`, `login-outcome.js`: salinan aturan web;
  parity tests harus setuju. Bukan semua aturan boleh diubah hanya di TypeScript.
- `extension/site.js`, `public-suffix.js`: aturan site bersama; `src/lib/site.ts`
  re-export file JS yang sama. Data PSL dibuat oleh `scripts/gen-public-suffix.mjs`.
- `extension/background.js`: storage ekstensi, antrean save, cloud push, pending save.
- `extension/content.js` dan `content.css`: field detection, iframe, ikon/bar autofill,
  tangkap login dan tawaran simpan. `popup.js`/`popup.html`: unlock/pilih akun.
- `src/lib/dead-links.ts`, `dead-link-probe.ts`: cek domain yang berhenti resolve.
- `helper/daemon.mjs`: UI lokal, proxy `/api/*`, health, token/origin gate, Mac fill.
- `helper/repo-paths.mjs`: path dihitung dari file, versi/stamp, perintah refresh.
- `helper/install-service.mjs`, `build-helper-app.mjs`, `mac-ax.mjs`: instalasi dan
  pengisian native Mac. Jangan keylog aplikasi.
- `worker/index.ts`: API, allowlist email, session, OTP/rate limit, sanitasi blob.
- `wrangler.toml`: Worker `kunci`, assets `dist`, Durable Object, migrasi SQLite `v1`.
- `public/sw.js`, `src/lib/pwa.ts`: service worker/cache; bisa menyebabkan UI lama.
- `src/lib/preview-vault.ts`: fixture `#preview-ui`. Bukan data vault nyata.
- `tests/`: 70 file tes saat pemeriksaan. `.audit/`: harness lama, bukan suite utama;
  periksa port, path, syntax, storage dan side effect sebelum menjalankannya.

Saat startup, klien membaca IndexedDB dan cloud, lalu memilih blob berdasarkan
`savedAt`. Ini sinkronisasi personal, bukan revision/CAS untuk beberapa pengguna.
Persist mengantrekan enkripsi → IndexedDB → ekstensi → cloud → backup sesuai setting.
Kegagalan cloud dapat membuat data hanya tersimpan lokal; jangan bilang sync berhasil
hanya karena save lokal berhasil. Backup folder memakai izin File System Access.

## Status pekerjaan terakhir

Perubahan berikut sudah berada di commit lokal, bukan daftar tugas untuk dibuat ulang:

- `61b81fc`, `6bfa1b2`: loopback membedakan port. Login `127.0.0.1:8780` tidak boleh
  ditawarkan di `127.0.0.1:5178`; nama polos `localhost` tidak boleh melompati port.
  Guard: `tests/loopback-port.test.ts`.
- `4eb1ad3`: URL simpan lewat `storedUrl`, buang query/fragment/userinfo agar one-time
  token tidak ikut disimpan. Guard: `tests/saved-url.test.ts`.
- `505971e`, `34d9939`: inject iframe, username-first, daftar akun vertikal, tepat satu
  frame menawarkan pending save. Guard: iframe/reinject/username-only tests.
- `c969b27`: Public Suffix List membedakan site shared-host seperti Surge/GitHub Pages.
  Guard: `tests/public-suffix.test.ts`, `tests/match-parity.test.ts`.
- `688563e`: LaunchAgent memakai path Node yang tahan upgrade Homebrew.
- `6ce9708`: bar ekstensi tetap terbaca bila ada beberapa username panjang.
- `57aa441`, `e66f7dc`: deteksi domain tidak resolve, ulang probe, simpan bukti harian.
- `31d22b2`, `8632aca`: pilih beberapa entri dan Delete lewat keyboard.
- `ea8a7eb`: pre-selection duplikat mengutamakan informasi terbaca, bukan hanya recency.
- `305b658`: restore unlock sesudah refresh serta dua tahap login.
- `8ca8f4e`, `8ca10f5`, `121d438`: frame laptop dan alur personal; dashboard kembali
  ke arah v2 yang disetujui. Iterasi v8 historis bukan otomatis acuan terbaik.
- Sebelumnya: failure toast, draft remount, permanent-delete confirmation, masking,
  stale token retry, OTP write-order, Worker/daemon hardening, public bundle hygiene.

Daftar backlog lama yang berkata duplikat lintas site belum diperbaiki sudah usang.
Namun perbaikan kode tidak otomatis membersihkan seluruh entri lama. `storedUrl`
membersihkan alamat entri terkait ketika alur simpan dipakai lagi, bukan migrasi global.
Jangan mengubah isi vault pengguna secara otomatis untuk merapikan data.

Tidak ada tugas fitur baru yang diberikan dalam sesi migrasi ini. Kelanjutan ditentukan
oleh pengguna. Batas nyata yang masih ada: fitur tim belum diimplementasikan, audit
kriptografi independen belum dibuktikan, dan tidak ada klaim semua skenario browser
atau semua data nyata bersih. Mockup asli tidak ditemukan dalam repo/scratch yang
 diperiksa pada pencarian terbatas; bila perlu mengubah desain, minta acuan/approval,
jangan mengarang parity.

## Menjalankan dan menjaga data

Dari root aplikasi:

```sh
cd /Users/tiftazani/Documents/Hermes-AI/Kunci/kunci
npm run dev
```

Vite: `http://127.0.0.1:5173`. Preview fixture:
`http://127.0.0.1:5173/#preview-ui`. Build preview: `npm run preview`, port 4173.
Vite proxy `/api` mengarah ke CLOUD NYATA. Jangan memakai endpoint write produksi
sebagai fixture. Preview UI mengubah state contoh; tidak membuktikan sync, crypto,
jumlah entri nyata, cache pengguna, atau izin native.

Daemon asli sedang berjalan di `http://127.0.0.1:8780`, PID snapshot 41538.
`/health` terverifikasi HTTP 200, `ok:true`, version/uiRevision/extensionVersion
`1.4.11`, dan semua path mengarah ke clone lokal di atas.
Jangan memulai `npm start`/helper kedua atau harness yang bind 8780.

```sh
launchctl print gui/$(id -u)/com.kunci.daemon
launchctl kickstart -k gui/$(id -u)/com.kunci.daemon
```

Plist: `~/Library/LaunchAgents/com.kunci.daemon.plist`.
Log: `~/Library/Logs/kunci.log` dan `kunci.err.log`; jangan mencetak rahasia log.
Jika benar-benar tidak terdaftar, bootstrap plist, bukan kickstart berulang:

```sh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kunci.daemon.plist
```

`npm run install-service` membangun UI, memasang LaunchAgent dan Helper.app.
Tidak perlu dilakukan ulang untuk migrasi agen. App di `/Applications/Kunci Helper.app`
dan `~/Applications`. Pengisian native memerlukan izin Accessibility oleh pengguna.
Token helper di `~/.kunci/helper-token`; jangan baca atau bagikan nilainya.
Jangan menghapus IndexedDB, browser profile, `~/.kunci/`, DO storage, atau backup.
`localhost` dan `127.0.0.1` memiliki storage browser berbeda.

Pengguna memakai Brave di Mac. Ekstensi unpacked harus dari
`/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci/extension`, lihat `brave://extensions`.
Versi sumber `extension/VERSION`: `1.4.11`; manifest sama. Helper memeriksa stamp dan
menyuruh reload. Versi sama belum menjamin file yang dimuat sama: cek folder/stamp.
Memindahkan folder dapat mengubah extension id; periksa origin allowlist web, daemon,
dan ekstensi, jangan membuka izin semua extension atau semua loopback origin.
Safari punya installer, tetapi dukungan Safari kini belum diuji dalam serah terima.

## Tes dan hasil nyata pada snapshot ini

Dijalankan dari `kunci/`:

- `npx tsc -b`: lulus.
- Run pertama `npx vitest run`: 69 file/484 tes lulus, satu timeout 5000ms pada
  `tests/extension-background-audit.test.ts` → `serialises two SAVE_LOGIN calls so
  neither entry is lost`.
- File itu dijalankan sendiri: 6/6 tes lulus, sekitar 544ms.
- Run penuh kedua: 70/70 file, 485/485 tes lulus, sekitar 1,09 detik.
  Akar timeout pertama belum terbukti; jangan menyembunyikan atau menaikkan timeout
  tanpa memeriksa fetch/helper/network harness.
- `npm run lint`: exit 0, 11 warning, tidak ada error. Warning meliputi unused vars,
  unnecessary escape, React Fast Refresh, set-state-in-effect dan immutability.
- `npm run build`: lulus; JS `index-DoL3Sd-u.js` 470,20 kB dan CSS
  `index-BwOlqZie.css` 34,10 kB. Generator mengubah empat PNG secara byte; perubahan
  hasil build itu dikembalikan ke HEAD, bukan perubahan aplikasi.
- `npm run extension-status`: branch/HEAD/path benar, manifest dan VERSION setuju.
- LaunchAgent `state=running`, program `/opt/homebrew/bin/node`; `/health` 200.
- Produksi melalui curl dengan User-Agent browser: `/api/ping` 200 `{"ok":true}`;
  HTML 200 menunjuk `/assets/index-DoL3Sd-u.js`; asset HTTP 200 `text/javascript`,
  470.209 byte, membawa string versi `1.4.11`. Hash asset sama dengan build lokal.
  urllib tanpa User-Agent mendapat 403; jangan salah baca itu sebagai app mati.

Tidak melakukan deploy, restart service, commit, push, kirim OTP, cloud write, buka
vault nyata, atau tes UI/autofill nyata pada sesi serah terima ini. Hasil unit/build
bukan jaminan penuh keamanan atau seluruh flow pengguna.

## Rilis, cloud, dan secret

Produksi: `https://kunci.tiftazani-cuciin.workers.dev`, Worker `kunci`.
Bukan Surge/Vercel. Netlify hanya sejarah migrasi. Jangan membuat ulang Netlify.
Backup/migrasi Netlify pernah dicatat di handoff lama; keberadaan backup dan status
salinan lama belum diperiksa ulang. Jangan menghapus salinan lama berdasarkan catatan itu.

`wrangler.toml` menunjuk assets `dist` dan `run_worker_first` pada `/api/*` serta
`/kunci-status`. Worker memakai satu DO dan key `vault`, email tunggal, sesi 12 jam.
Jangan mengubah binding/migration atau menambahkan akun kedua tanpa desain isolasi.

Secret bernama `KUNCI_SESSION_SECRET`, `RESEND_API_KEY`, opsional `KUNCI_FROM_EMAIL`.
Nilai tersimpan di Cloudflare, tidak disertakan dalam paket konteks.
Status login Wrangler dan secret list belum diperiksa pada sesi ini.
Jika diperlukan: `npx wrangler whoami`, `npx wrangler secret list` menampilkan metadata.
Jangan merotasi secret yang ada untuk onboarding. Upload secret hanya lewat masukan
aman milik pengguna, tidak melalui chat/argumen shell/log. `npm run set-resend-key`
adalah script lama yang membaca clipboard dan membersihkannya; pakai hanya jika
pengguna meminta pemasangan key dan mengetahui clipboard akan dikonsumsi.

Untuk perubahan runtime yang disetujui dirilis:

1. Bila `extension/*.js` berubah, bump versi. `extension/VERSION` sumber utama;
   selaraskan manifest, `scripts/extension-status.mjs`, README, HANDOFF, dan literal
   mock di `tests/extension-background-audit.test.ts`. Views membaca injected version.
2. Jalankan empat gate di atas dan tes browser terkait. Versi hanya penanda rilis,
   bukan pengganti tes. Jangan deploy saat mutation test masih berjalan.
3. `npm run deploy` = build baru + wrangler deploy. `wrangler deploy` sendirian
   mengupload `dist` yang sudah ada, sehingga dapat merilis bundle lama.
4. Bila code helper berubah, restart LaunchAgent. Jika installer/path berubah,
   lakukan instalasi yang sesuai. Minta pengguna reload ekstensi bila stamp belum
   terambil. Jangan klaim reload pengguna sudah terjadi tanpa bukti.
5. Baca asset URL dari index.html LIVE, cek HTTP/content-type/ukuran/versi dan perilaku.
   Asset lama yang tidak ada bisa dijawab HTML 200 oleh SPA fallback.
6. Cek `/health` version/uiRevision. Bila sidebar masih lama, cek service worker/cache;
   hard-refresh tidak sama dengan hapus storage. Jangan hapus vault untuk refresh.

Perubahan dokumen/tes saja tidak perlu deploy atau bump versi.

## Batas keamanan yang harus disebutkan

Server menyimpan isi vault sebagai ciphertext. Ancaman phishing, malware/keylogger,
XSS/origin yang dikuasai, password induk lemah, dan endpoint saat unlock tetap ada.
Jangan mengklaim anti-hack 100%.

Fitur opsional email recovery adalah pengecualian penting: `src/lib/cloud.ts` →
`POST /api/mail/recovery` → Worker menerima recovery key plaintext dan mengirim ke
Resend/email. Jangan menyamakan alur ini dengan ciphertext-only penuh. Jangan menguji
alur itu memakai key nyata atau menganggap sudah aman untuk shared vault.

## Referensi berikutnya

`docs/MAINTENANCE.md` memindahkan aturan/pitfall dari skill Kunci Hermes ke dokumen
repo yang bisa dibaca Claude. `docs/TEAM-SECURITY-DESIGN.md` memberi syarat fitur tim.
`README.md` menjelaskan pemakaian produk, tetapi masih memuat contoh path clone lama;
untuk Mac ini, gunakan path snapshot di atas. Tidak perlu membaca seluruh repo dari
nol: mulai dari peta area tugas, definisi/pemanggil, tes terkait, lalu gate penuh.
