# Aturan pemeliharaan Kunci

Dokumen ini memindahkan pengetahuan kerja dari skill Kunci Hermes. Bisa dibaca oleh
Claude Code tanpa akses Hermes. Klaim historis bukan pengganti uji kode saat ini.
Untuk snapshot, path, command dan hasil tes terbaru, baca `../HANDOFF.md`.

## Site, match, duplikat, dan simpan

Identitas entri berasal dari `entry.url`, atau `urls[0]` bila url kosong. Seluruh
`urls` adalah riwayat merge, bukan identitas. Menggabungkan berdasarkan semua URL
membuat satu alamat asing menjembatani beberapa site melalui union-find.
Jangan menjadikan nama sebagai host bila entri punya URL sendiri. Email dalam nama
bukan domain tempat akun disimpan.

Pengelompokan duplikat harus membedakan username dan layer/path login. Jangan
menggabungkan password login dengan PIN di `/transfer/confirm`. Username berbeda
pada host sama bukan duplikat. Entri OTP/TOTP/authenticator tidak ikut kelompok.
`www.` dinormalisasi; host/layer berbeda tidak digabung hanya karena domain family.

Aturan autofill tidak sama dengan aturan duplikat. Pada autofill, layer mengurutkan
pilihan, bukan otomatis menyembunyikan semua pilihan layer lain. Target overwrite
saat capture harus berasal dari primary host/layer, bukan history URL yang kebetulan
cocok. Periksa `decideLoginSave` di `src/lib/capture.ts` dan `extension/crypto.js`.

Prioritas pre-selection duplikat: akun tersedia, nama bukan raw URL, nama lebih
informatif dari host, password tersedia, baru kemudian waktu perubahan. Normalisasi
`www.` pada kedua operand. `agoda.com` tetap nama valid; scheme/path yang membuktikan
raw URL. Password konflik tetap `Cek dulu`; pilihan awal bukan izin auto-merge/delete.

Site mengikuti Public Suffix List, bukan dua label terakhir. Shared host seperti
`surge.sh`, `github.io`, `co.uk` harus dipisahkan dari site pelanggan. Aturan berada di
`extension/site.js` dan dire-export oleh web. Generator PSL menormalisasi IDN ke
punycode. Wildcard memiliki satu label tambahan, exception mengalahkan wildcard.
Jangan mengedit data generated untuk satu kasus. `tests/public-suffix.test.ts` menjaga
aturan, `tests/match-parity.test.ts` menjaga salinan.

Loopback harus menyertakan port dalam identitas site: `127.0.0.1:5178` bukan
`127.0.0.1:8780`. Nama polos `localhost` tidak mengklaim aplikasi port mana pun.
Perubahan port harus konsisten di match dan login-outcome, web serta ekstensi.
Lihat `tests/loopback-port.test.ts`. Jangan memperluas kesamaan loopback untuk
mengatasi error origin; matching dan origin trust adalah dua keputusan berbeda.

Alamat yang disimpan melewati `storedUrl` (origin + path, tanpa query/fragment/userinfo).
Cek alamat baru dan `prev.url`/`prev.urls` pada update. Jangan menyimpan one-time token.
Matching masih dapat membaca raw capture URL sebelum sanitasi. Tidak ada migrasi
massal entri lama hanya karena sanitasi capture sudah diperbaiki.

## Form dan ekstensi

Jangan isi vault password ke OTP, signup, reset, new-password, API-key atau form payment.
Baca bentuk form bersama label tombol/URL. Tombol sekunder `Change Password` pada SAP
Fiori bukan bukti form login adalah change-password. Uji login asli dan form perubahan
password sungguhan. Web `login-intent.ts` dan ekstensi `login-intent.js` harus setuju.

Boundary regex `\b` tidak memisahkan underscore pada `shared_password`. Hint field
harus memisahkan non-alphanumeric, menerima underscore/spasi/hyphen yang relevan,
namun tidak mencocokkan potongan di dalam `someadmin`. Uji ejaan field sungguhan.
Dua tahap shared password/perusahaan lalu akun personal memerlukan identitas layer;
satu Entry bukan wadah dua password untuk diisi tanpa membedakan tahap.

Simpan setelah ada bukti login berhasil, bukan hanya submit. Masih ada form/error
password/aria-invalid berarti jangan tulis. Capture pending diikat ke tab.
Iframe membutuhkan content scripts `all_frames`; cek frame sebelum berkata halaman
kosong. Reinject hanya frame yang belum memiliki scripts agar declaration tidak dobel.
Tepat satu frame mengklaim pending save: top jika host cocok, kalau tidak child yang
cocok. Frame yang tidak berhak berhenti tanpa membuang pending milik frame lain.
Halaman tanpa pemilik harus dismiss supaya save tidak muncul pada site selanjutnya.

Username-first harus menampilkan pilihan akun. Jangan diam-diam mengisi email hanya
karena satu match saat belum ada password. Beberapa akun ditampilkan vertikal, semua
tersedia, dapat discroll. Jangan `slice(0,3)` atau paksa email panjang dalam satu row.
Bar floating perlu border-box, copy width minimum, wrap, button max-width/word wrap.
Guard: `tests/extension-bar-layout.test.ts`.

Uji ekstensi dengan profil Playwright terpisah dan extension unpacked sungguhan.
MV3 worker tidak berjalan pada harness headless yang pernah dipakai di sini; gunakan
headed. Worker tidak dapat sendMessage ke listener dirinya sendiri; panggil dari
extension page seperti `chrome-extension://<id>/popup.html`.
Dynamic import tidak boleh di ServiceWorkerGlobalScope; impor crypto dari extension
page. Seed hanya vault sintetis. Jangan baca storage ekstensi/profil pengguna.

Iframe coordinates relatif terhadap frame; tambahkan offset iframe sebelum viewport
click. Closed shadow root bar bisa dibaca lewat Accessibility/CDP pada profil fixture.
Jangan menjalankan harness lama ke login nyata hanya karena namanya `live`.

## Cloud/session dan persist

Bearer lama bisa menutupi cookie hidup karena Worker memilih bearer atau cookie.
Retry satu kali tanpa header pada GET/PUT/probe/push sebelum menyatakan sesi habis.
Drop token bukan verdict signed-out; jangan menutup sesi sebelum cookie diuji.
Extension cross-origin fetch perlu `credentials:'include'` untuk cookie.

Localhost dengan vault IndexedDB dapat jalan tanpa sesi cloud. Skip write bila probe
sudah tahu tidak ada sesi. Flag mulai unknown agar public host boleh mencoba pertama.
Gangguan network tidak boleh menjadi keputusan permanen tidak sync. Jangan membuat
401 berulang pada setiap action yang sejak awal tidak perlu mengirim cloud request.

Persist harus melaporkan hasil. Jangan toast sukses ketika IndexedDB gagal.
Periksa seluruh pemanggil bila hasil async berubah; fire-and-forget perlu penanganan
reject. Auto-lock dapat terjadi antara panel dibuka dan tombol ditekan.
Antrean write harus memegang promise pending, bukan hasil await yang membuka race.
Bulk action satu operasi grup, bukan satu persist per entri. Hitung ID yang benar-benar
ada/diubah. Empty selection berarti no-op, bukan semua entri.

Cloud personal memakai `savedAt`, bukan kontrol konflik berbasis revision.
Jangan mengatakan siap multi-user. Jangan ganti blob dari ekstensi sebelum berhasil
mendekripsi/memvalidasi dengan key aktif. Jangan hapus local copy karena cloud baca gagal.

## Reload session, inactivity, dan preview

Web reload session memakai `CryptoKey` non-extractable di IndexedDB, tab id random di
sessionStorage, wrap fingerprint dan last interaction time. Tidak boleh raw/base64
vault key di localStorage/sessionStorage. Save key di semua jalur unlock/recovery/
rotation; clear pada explicit lock/logout/destroy. Bersihkan legacy unsafe session.

Refresh tidak mereset waktu inactivity. Check deadline lagi ketika tab tersembunyi
bangun. Uji sebelum/sesudah expiry, explicit lock, storage failure, tab closure,
duplicate/concurrent tabs, cloud expiry, ciphertext rusak/berganti. Klaim hanya kasus
yang sudah dibuktikan browser. Angka timeout unit tidak membuktikan effect React.

`#preview-ui` membuka fixture tanpa blob/key. Jangan biarkan refresh-session effect
mengunci fixture atau dereference null blob. Bila screenshot menampilkan `Kunci
terkunci`, cek status shell sebelum menyalahkan layout/data lama. Preview melewati
crypto/persist/cloud; tidak membuktikan jumlah entri nyata atau service-worker pengguna.

## UI, draft, selection, dan delete

Arah personal dashboard kembali ke v2 yang disetujui. Mockup baru perlu persetujuan
pengguna sebelum kode live berubah. Jangan menyamakan palette dengan pixel parity.
Frame laptop mulai 701px, phone <=700px tetap flat; baca CSS terbaru dan ukur,
jangan turunkan breakpoint sembarang agar side rail muat. Nav child dapat menjadi
horizontal walau sidebar parent masih column; ukur elemen yang berubah oleh query.

Uji desktop, tablet, phone, light/dark melalui toggle nyata. Periksa scroll sampai
bagian bawah, overflow horizontal, focus/keyboard, touch target dan empty/error state.
QuickFind harus benar-benar membuka dan Escape menutup, bukan hanya button clicked.
Dashboard/health/sidebar harus setuju pada jumlah temuan dan entri terdampak.
HIBP belum diperiksa sampai request selesai; perubahan entri membatalkan hasil relevan.
Jangan menyimpan plaintext password tambahan sebagai signature cache React.

Jangan key EntryPane dengan search/filter/draftDirty. Itu meremount pane dan membuang
edit. Gunakan epoch hanya saat remount disengaja; semua navigasi yang membuang draft
harus melewati confirmDiscard. DraftDirty dalam key membuat input hilang tiap ketikan.

Selection memakai IDs pada filtered order yang sedang terlihat. Prune saat filter
berubah. Shift range bukan range seluruh vault tersembunyi. Plain click tetap membuka
satu entri tanpa selection; active pane berbeda dari selected IDs.
Delete tidak boleh mencuri key dari input/textarea/contenteditable atau dialog aktif.
Handler di container list, bukan hanya row yang belum tentu fokus. Ke trash bisa
undo; hapus permanen harus konfirmasi dan menyebut jumlah. Periksa single dan bulk
purge, bukan hanya satu tombol. Guard: delete-key/multi-select/destructive-confirm tests.

## Cek domain yang hilang

Ini heuristic lokal, bukan DNS service yang memberi jawaban pasti di semua jaringan.
Fetch/image gagal tidak membedakan DNS mati, TLS salah dan site privat. Probe WebSocket
memakai waktu kegagalan, mengulang bila perlu dan membaca attempt tercepat.
Dua kegagalan lambat tetap `unclear`, bukan `alive`; jangan menghapus evidence nyata.
Threshold dan konstanta dibaca dari `dead-links.ts`, jangan menyalin angka dari memori.
Bukti `dead` perlu dua hari berbeda; rerun hari yang sama tidak mempercepatnya.

Exclude local/reserved names dan IP. Collapse host agar tidak satu probe per entri.
Situs bisa tutup sambil domain tetap hidup; cek ini tidak menemukannya. Kontak pihak
ketiga mengungkap IP serta kemungkinan akun pengguna, jadi harus meminta persetujuan
sebelum jalan. Jangan menjalankan mass-probe vault nyata untuk onboarding.

## Worker/daemon hardening

Jangan kirim `err.message` internal ke client; stable error, detail di log yang aman.
Normalize missing storage value ke null sebelum JSON. Validasi tipe JSON dari luar.
Rate window berpatokan start, bukan lastRequest yang bergeser selamanya.
Jangan truthiness-check timestamp yang sah bernilai 0. OTP disimpan setelah email
berhasil dikirim, attempt cap atomik di DO. HEAD bukan GET dengan body.

Unauthenticated daemon `/health`/`/apps` tidak boleh memblokir event loop dengan
readFileSync/spawnSync berulang tanpa cache. Handle server error/EADDRINUSE agar
KeepAlive tidak crash-loop. LaunchAgent adalah pemilik port 8780; jangan bind ulang.
Path Mac jangan masuk public bundle. Helper menyediakan refresh commands; token input
harus SecretInput. Jangan hardcode clone path/branch ke UI publik.

Jangan memperbaiki `safeEqual` early unequal-length return tanpa bukti: OTP digest dan
session MAC memakai fixed-width; audit lama menyatakan bukan kebocoran praktis.
Temuan berlabel info/bukan bug bukan tugas implementasi.

## Tes: jebakan yang sudah terjadi

- `npx vitest run` adalah runner utama; reporter `basic` tidak valid di Vitest 4.
- `cloud.ts` memiliki state module scope. Gunakan resetModules/import baru untuk tes
  yang membutuhkan sesi bersih. Baca format SHEET_HEADERS sebelum membuat CSV fixture.
- Import `extension/background.js` otomatis memulai health polling. Filter mock fetch
  berdasarkan URL `/api/vault`, jangan menganggap call pertama adalah cloud push.
- Jalankan tes mencurigakan sendiri dan full suite. Full suite dapat menutupi fixture
  salah atau state bocor. Timeout tunggal bukan bukti akar bug sudah diketahui.
- Sandbox `node:vm` untuk page scripts harus menyediakan `URL`. Tanpa itu parse masuk
  catch dan parity terlihat gagal meski kode benar.
- Fixture encrypted blob harus sesuai predicate nyata, bukan struktur yang dikarang.
  Baca `isEncryptedBlob` sebelum membuat data.
- Test source string menjaga wiring/declaration, bukan bukti browser/crypto/runtime.
- `.mjs` berjalan dengan node; TypeScript butuh runner yang memang tersedia. Jangan
  menganggap vite-node terpasang karena harness lama menyebutnya.
- Bila patch region gagal dua kali, baca file lagi; jangan terus menambal view lama.
  JSX bracket ganda dapat membuat error jauh dari baris edit.
- Jangan menulis ulang fungsi produksi dalam probe lalu mengklaim produksi terbukti.
  Jalankan/import modul nyata. Mutation testing harus restore setiap file di finally,
  verifikasi diff, dan tidak berjalan bersama build/deploy.
- Harness fixture harus memakai port bebas, menutup browser/server di finally, output
  di scratch. Jangan tinggalkan probe baru dalam repo tanpa niat menjadikannya tes.
- Build generator dapat mengubah PNG tanpa perubahan source. Periksa git status,
  kembalikan hanya output yang run sendiri buat, jangan reset perubahan pengguna.

Untuk audit paralel, tetapkan kepemilikan file yang tidak bertabrakan: lib/db,
state/views, worker/helper, extension. Beri daftar already-fixed dan aturan rahasia pada
setiap agent. Review temuan anak, jalankan sendiri gate, jangan percaya klaim upload/
deploy tanpa URL/id dan bukti. Audit report rusak/terpotong berarti area belum terbukti,
bukan otomatis clean. Hasil review harus ditautkan ke kode sekarang dan tes nyata.
