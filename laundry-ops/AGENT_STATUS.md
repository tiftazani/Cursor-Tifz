# Papan status & klaim file antar-agent

Terakhir diperbarui: 20 September 2026 (oleh Hermes).
Baca bersama `AGENT_HANDOVER.md`, `AGENT_WORKFLOW.md`, dan `CODING_AGENT_CONTEXT.md`.

Tujuan dokumen ini: satu tempat untuk melihat **siapa memegang file apa** dan **sampai mana pekerjaan berjalan**, supaya Hermes, Codex, Cursor, dan OpenCode tidak menyunting berkas yang sama.

## 0e. Pekerjaan terbaru (20 Sep, Hermes) — modul & fungsi izin diperinci, 1.10.30

**Status: kode selesai, gate hijau, teruji di perangkat. SUDAH di-commit (`1b1e126`, `38bd79e`).
BELUM di-push (menunggu perintah Owner). Worker debug SUDAH dideploy (`717ddfa4`); Worker produksi
BELUM.**

Katalog izin diperinci dari **12 modul / 17 fungsi** menjadi **15 modul / 41 fungsi**, ditambah
preset peran, pemisahan baca/tulis dan ubah/hapus, dan penerjemahan kunci katalog lama.

| Kelas | Gejala | Perbaikan |
|---|---|---|
| Migrasi kunci | Role di server memakai `owner.manage`/`attendance.write`; katalog baru tidak mengenalinya sehingga seluruh hak master data hilang | `AccessCatalog.migrate` menerjemahkan kunci lama saat role DIBACA, bukan hanya saat izin diperiksa |
| Cermin kunci | APK 1.10.29 di cabang membuang kunci baru lewat `sanitize()` | `withLegacyMirror` menulis kunci lama sebagai cermin bila SELURUH anggotanya dimiliki |
| Worker bayar | `order.payment` dipetakan ke `service.correct`, jadi akun ber-kebijakan ditolak saat mencatat pembayaran | dipetakan ke `service.payment` |
| Worker absen | `attendance.*` dipetakan ke `attendance.write` yang sudah tidak ada | `attendance.self` |
| Worker pelanggan | hanya memeriksa MODUL, sehingga kebijakan tanpa `customer.write` tetap bisa menulis | memeriksa fungsinya |
| Fungsi hantu | `settings.manage`, `cash.view`, `inventory.delete` tidak punya pemeriksa | `settings.manage`/`cash.view` dibuang; `inventory.delete` diberi titik jaga |
| Tombol hapus | tombol "Hapus" pada koreksi Service ada walau `service.delete` dicabut | tombol dibuang, penolakan dilaporkan lewat pesan |
| Hitungan role | kartu role menghitung cermin kunci lama sebagai fungsi, preset "Hanya lihat" tampil 10 fungsi padahal 9 | `AccessCatalog.berlaku` menerjemahkan kunci lama lebih dulu; tiga tempat tampilan dan satu baris log memakainya |

Hasil terukur: Android **267 kasus, 0 gagal** (debug dan rilis); Worker **60 kasus, 0 gagal**; lint
bersih (0 error, 19 warning lama tanpa error: 12 `UseKtx`, 4 `GradleDependency`, 1
`AndroidGradlePluginVersion`, 1 `ObsoleteSdkInt`). Bukti pengunci: mengembalikan bug pada
`customAccessRequirement` membuat 3 test GAGAL; melepas migrasi dari `AccessPolicy` membuat 1 test
GAGAL.

**Uji negatif tambahan (20 Sep): bukti test penegakan masih bisa gagal.** Satu entri dihapus dari
daftar tangan `diperiksa` di `AccessFunctionEnforcementTest.kt`; `daftarPemeriksaSesuaiKenyataanKode`
langsung GAGAL (exit 1). Berkas dipulihkan dan `git diff` terbukti kosong, lalu test dijalankan ulang
dan hijau. Ini membuktikan test itu benar-benar membandingkan dengan kenyataan kode, bukan sekadar
lulus apa pun isinya.

Angka katalog diukur langsung ke kode, bukan dikutip: 15 `ModuleDef(`, 41 `fn(`, 15 entri
`ownerLocked`, 5 `Preset(`. Komentar KDoc di `AccessCatalog.kt` dan `AccessFunctionEnforcementTest.kt`
yang sebelumnya menulis 16 modul/43 fungsi dan modul `settings` (tidak ada di kode) sudah dibetulkan.

**Gate dijalankan ulang dari `clean` pada 20 Sep** (bukan hasil cache `UP-TO-DATE`): 267 debug + 267
release Android dan 60 Worker, seluruhnya lulus, 0 gagal. Angka itu dibaca dari berkas XML hasil run
yang benar-benar dieksekusi, bukan dari ingatan.

**Sapu menu per peran pada 1.10.30-debug (selesai):** Owner **21/21**, Kasir **11/21**, Supervisor
**8/21**, tanpa satu pun `FATAL EXCEPTION` dari paket `com.cuciin.laundryops`. Dua "crash" di sapu
Kasir dan satu di sapu Owner berasal dari `UiAutomationService` milik alat uji. **Skrip sapu sudah
diperbaiki** supaya menyaring `Process: <paket>` sebelum menghitung crash; Owner dijalankan ulang
dan hasilnya 21/21 dengan 0 crash. Kasir dan Supervisor sama dengan baseline 1.10.29, jadi tidak ada
pelebaran hak.

**Preset peran terbukti di perangkat:** role uji dibuat lewat UI, preset "Hanya lihat" diterapkan
(8 modul / 9 fungsi), disimpan, lalu masih utuh sesudah aplikasi dihentikan paksa dan dibuka ulang.
Role uji dihapus kembali lewat UI. Perbaikan hitungan di atas berasal dari uji ini.

**APK rilis bertanda tangan selesai:** `releases/1.10.30-candidate/` berisi APK rilis, AAB, dan APK
debug beserta `SHA256SUMS.txt`. `verify_release.py` PASS (tanda tangan v2, non-debuggable, target SDK
36, izin minimum, ZIP/ELF selaras 16 KB). Sertifikat sama dengan 1.10.29, jadi dapat menimpa
pemasangan lama. APK distribusi di akar `releases/` (`cuciin-release.apk`, `cuciin-debug.apk`) juga
sudah 1.10.30.

**Kompatibilitas mundur TERBUKTI di perangkat.** Role Supervisor disimpan ulang lewat UI 1.10.30,
cermin `attendance.write` terverifikasi benar-benar tertulis di `cuciin-data.json`, lalu APK 1.10.29
dipasang DI ATASNYA (`adb install -r -d`). Supervisor di 1.10.29 tetap membuka **8/21** menu, sama
dengan di 1.10.30, 0 crash. Ini yang membuktikan klaim "APK lama tetap hidup" bukan sekadar teori.
Perangkat dikembalikan ke 1.10.30 sesudahnya.

**Berkas yang Hermes pegang (pekerjaan 1.10.30):** `data/AccessCatalog.kt`, `data/AccessPolicy.kt`,
`data/Models.kt`, `data/CuciinStore.kt`, `data/VersionHistory.kt`, `ui/AccessScreens.kt`,
`ui/RouteAccess.kt`, `ui/OpsScreens.kt`, `ui/MasterScreens.kt`, `ui/BusinessScreens.kt`,
`ui/AssetScreens.kt`, `ui/MoreScreens.kt`, `ui/CuciinNav.kt`, `ui/NavTabs.kt`,
`res/values/colors.xml`, `app/build.gradle.kts`, `CHANGELOG.md`, dan test
`AccessPresetTest.kt`, `AccessCatalogMigrationTest.kt`, `AccessUpgradeRegressionTest.kt`,
`AccessFunctionEnforcementTest.kt`, `AccessPolicyTest.kt`, `ServicePriceAccessTest.kt`,
`MenuRouteTest.kt`, `NavBarContractTest.kt`, `RouteAccessTest.kt`, `SupervisorMenuTest.kt`;
di sisi Worker `cloudflare/src/command-sync.ts` dan `cloudflare/tests/access-policy.test.mjs`;
ditambah seluruh berkas `.md` di `laundry-ops/` (audit dokumen 20 Sep). Daftar ini adalah kenyataan
`git diff` pekerjaan 1.10.30, bukan perkiraan. **Agen lain: jangan sentuh berkas itu sampai baris ini
diperbarui.**

Belum dibuktikan: deploy Worker produksi (menunggu perintah Owner), push ke remote.

### 0e-2. Pembersihan dokumen & repo (20 Sep, Hermes)

Sesudah pekerjaan 1.10.30 selesai, dokumen yang dibaca agen lain dan manusia diaudit terhadap
kenyataan kode. Yang ditemukan dan diperbaiki:

| Dokumen | Klaim basi | Sekarang |
|---|---|---|
| `android/RELEASE_READINESS.md` | 1.10.1/v20, 47 test, 39 test Worker | 1.10.30/v49, 267 test, 60 Worker |
| `AGENT_HANDOVER.md` | 1.10.0/v19, PR #18 "aktif", migrasi berhenti 0004 | 1.10.30/v49, PR merged, migrasi 0008 |
| `CODING_AGENT_CONTEXT.md` | versi 1.10.0/v19, model izin nama-peran | 1.10.30/v49 + katalog 15/41 + AccessPolicy |
| `android/README.md` | **package lama `com.tiftazani.laundryops`** di 5 tempat, 1.9.0, tautan APK 404, "Firestore otomatis" | package benar, 1.10.30, Firestore dihapus |
| `README.md` | "Masuk cepat di login: Owner/Kasir/SPV" (fitur terlarang) | login email + kata sandi saja |
| `AGENT_PROMPTS.md` | versionCode 19 | versionCode 49 |
| `cloudflare/DATABASE_SCHEMA.md` | 5 tabel tak terdokumentasi | dilengkapi, diverifikasi ke D1 produksi |
| `PLAY-PROTECT.md` | versi pemeriksaan tak ditandai | ditandai 1.10.24 + dicek ulang di 1.10.30 |

Temuan repo: **60 APK/AAB kandidat lama (1.5.1-1.10.24) masih dilacak Git** padahal `.gitignore`
sudah mengecualikannya dan aturan repo melarang. Semuanya dihentikan dari pelacakan dengan
`git rm --cached` setelah diverifikasi 60/60 ada di disk, jadi berkas tetap bisa dibagikan. Riwayat
lama masih memuat blobs itu (`.git` 451 MB); mengecilkannya butuh penulisan ulang riwayat dan itu
belum dilakukan. `1.9.1-candidate` juga satu-satunya kandidat tanpa `README.md`; sekarang lengkap
beserta `SHA256SUMS.txt`.

`R.color.foam` yang tidak dipakai dibuang. Kandidat 1.10.30 diperiksa kesegarannya: dua berkas sumber
tersentuh sesudah build, tetapi penanda sudah ada di dex dan `foam` tidak ada di `resources.arsc`,
jadi **tidak perlu build ulang**.

## 0d. Pekerjaan terbaru (19 Sep, Hermes) — tujuh kelas bug izin ditutup, 1.10.28

**Status: selesai, gate hijau, teruji di perangkat, versi 1.10.28 (versionCode 47), branch
`codex/cuciin-1-8-1`. BELUM di-push dan BELUM di-deploy (menunggu perintah Owner).**

Sesudah 1.10.27 menegakkan seluruh 17 fungsi `AccessCatalog`, regresi menemukan bahwa **menambah
penjaga belum cukup: cara MENOLAK izin punya pola kegagalannya sendiri.** Tujuh kelas ditemukan dan
ditutup:

| Kelas | Gejala | Perbaikan |
|---|---|---|
| A | `require(boleh(...))` melempar → **aplikasi mati** saat simpan | ganti jadi pesan tolak |
| B | `if (!boleh(...)) return` tanpa pesan → UI tetap bilang "tersimpan" | kembalikan `String?`, UI pakai pesannya |
| C | gerbang rute hanya memeriksa MODUL, penjaganya memeriksa FUNGSI → menu tampil lalu mati saat simpan | `RouteAccess` memeriksa modul **dan** fungsi |
| D | enam tombol alur tulis dikunci NAMA PERAN, bukan fungsi | dikunci fungsi |
| E | `require()` lain di `saveNota` masih bisa melempar (cabang tak valid) | `notaReject()` diperiksa UI lebih dulu |
| F | rute tulis tanpa gerbang (`assetNew`, `assetEdit`, `assetTypes`, `stokEdit`, `queueEdit`, `accessRole`) | tombolnya dikunci fungsi |
| G | layar ber-gerbang fungsi masih menendang pengguna lewat nama peran (`UsersScreen`, `OwnerSettingsScreen`) | memakai fungsi yang sama dengan gerbangnya |

**Bukti Kelas C di perangkat, bukan hanya test:** role kustom "modul `service` tanpa fungsi
`service.create`" dibuat, lalu dijalankan. 1.10.27 → menu tampil dan **`FATAL EXCEPTION:
java.lang.IllegalArgumentException: Akses Buat Service dicabut untuk role akun ini` di
`CuciinStore.saveNota`**. 1.10.28 → menu tertutup. Lapis tengah (gerbang tetap longgar, penjaga
baru aktif) juga diuji: aplikasi bertahan dan menampilkan pesan tolak.

**Celah sisi server ikut ditutup:** `order.create`/`order.put` menerima `unitPrice` dari payload apa
adanya; hanya komisi yang dihitung ulang dari katalog. Perangkat yang dimodifikasi bisa menulis harga
apa pun walau tombolnya disembunyikan di UI. Worker sekarang memeriksa fungsi `service.price` dan
menolak harga yang menyimpang, tetapi tetap menerima harga katalog dan harga yang sudah tersimpan
pada Service itu (supaya koreksi rincian lain tidak ikut ditolak).

**PENTING — gerbang deploy Worker ini:** perintah sinkronisasi **tidak membawa versi aplikasi**.
Penjaga harga baru akan ikut menolak APK lama yang masih menjalankan alur "Kasir ubah harga", dan
penjaga harga di sisi klien baru ada sejak **1.10.21 (versionCode 40)**. **Jangan deploy Worker ini ke
produksi sebelum seluruh perangkat 20 cabang memakai versionCode ≥ 40**, atau cabang lama akan
kehilangan kemampuan menyimpan Service.

**Gate:** Android **214 test debug + 214 release lulus**, lint lulus, **Worker 56 test lulus**
(naik dari 53). Setiap test pengunci baru dibuktikan GAGAL saat bug-nya dikembalikan.

**Uji perangkat pada APK 1.10.28 (emulator 1080x2400):** Owner `uji_owner1027b.py` **11/11 OK**
(termasuk Simpan Service sampai tersimpan), sapu menu Kasir **11/21 terbuka, 0 crash**, sapu menu SPV
**8/21 terbuka, 0 crash**, dan aturan harga dibuktikan dua arah: Owner melihat "Ubah harga · Rp 5.000",
Kasir pada baris yang sama hanya melihat "Hapus".

**Dua insiden saat menguji, keduanya dipulihkan dan diverifikasi:**

1. **Fixture perangkat memicu delete massal ke D1 debug.** Menulis berkas data perangkat langsung
   (di luar jurnal) membuat diff sinkronisasi membaca "hilang dari shadow" sebagai "dihapus", lalu
   mengirim DELETE. `access_roles` D1 debug sempat kosong dan 120 entri audit terhapus. Dipulihkan
   lewat **D1 Time Travel restore**. Pelajaran: fixture perangkat hanya boleh lewat mutasi aplikasi
   atau jurnal `sync_changes`, dan matikan jaringan SEBELUM menyentuh berkas.
2. **Uji tulis lewat adb merusak harga layanan.** Tombol DEL tidak membersihkan kolom, jadi angka
   tersambung (`10000` → `100000`) dan ikut tersimpan ke server. Dipulihkan lewat jurnal
   `sync_changes` di server. Pelajaran: sebelum menekan Simpan pada uji tulis, BACA ULANG isi kolom
   dan batalkan bila tidak sesuai.

Keduanya tercatat di `references/incident-device-fixture.md` pada skill `cuciin`.

**Berkas yang Hermes pegang:** `data/CuciinStore.kt`, `data/SyncProtocol.kt`, `ui/RouteAccess.kt`,
`ui/OpsScreens.kt`, `ui/MasterScreens.kt`, `ui/AssetScreens.kt`, `ui/MoreScreens.kt`,
`ui/OwnerSettingsScreen.kt`, `data/VersionHistory.kt`, `app/build.gradle.kts`, `CHANGELOG.md`,
`app/src/test/.../RouteAccessTest.kt`, `app/src/test/.../AccessFunctionEnforcementTest.kt`,
`cloudflare/src/command-sync.ts`, `cloudflare/tests/command-sync.test.mjs`,
`releases/1.10.28-candidate/`. **Agen lain: jangan sentuh berkas itu sampai baris ini diperbarui.**

## 0b. Worker PRODUKSI sudah di-deploy (18 Sep, Hermes)

**Status: selesai. Version ID `0a3735c3-ef1b-4549-a437-dfe4b458177c`, deployed
2026-09-18T14:10:57Z.**

Produksi terakhir di-deploy 17 Sep 11:06, jadi perbaikan antrean sinkronisasi dari 18 Sep
(`bd55890` + `4c2e0a6`) belum ada di sana. Sekarang sudah.

Yang dibuktikan:
- Bundle lokal dari commit HEAD identik dengan yang di-upload (build deterministik, SHA256
  sama pada dua build berturut-turut: `4a8efceb1148610bfa66ceccc3c463f1be460ec71d3a5dde482da922d37934ba`).
- Perbaikan A/B/C/D benar-benar ada di bundle: `payment.delete`, `order.delete`, `retryable`,
  hasil per-perintah (`results`).
- Tidak ada migrasi baru yang perlu dijalankan; `0008` sudah diterapkan di produksi
  sebelumnya. Deploy ini hanya mengganti kode Worker.
- Data produksi tidak tersentuh: `orders 8`, `payments 4`, `staff 8`, `branches 4`,
  `access_roles 4`, `sync_changes 403`, revision 403 (sama sebelum dan sesudah deploy).
- Gate sebelum deploy: Worker 53 test lulus, `npm run check` lulus.

Yang **belum** dibuktikan: perilaku perbaikan A/B/C/D di produksi belum pernah dijalankan
dengan token sungguhan. Rute tanpa auth hanya `/health` dan `/v1/registration`, jadi
verifikasi perilaku butuh perangkat dengan login Firebase. Jalankan uji tulis end-to-end dari
perangkat produksi saat APK 1.10.26 dibagikan.

## 0. Pekerjaan terbaru (18 Sep, Hermes) — seluruh 17 fungsi izin kini ditegakkan

**Status: selesai, gate hijau, teruji di perangkat, versi 1.10.27 (versionCode 46), branch
`codex/cuciin-1-8-1`.**

**Berkas yang Hermes pegang: `data/CuciinStore.kt`, `ui/RouteAccess.kt`, `ui/MoreScreens.kt`,
`ui/MasterScreens.kt`, `data/VersionHistory.kt`, `app/build.gradle.kts`, `CHANGELOG.md`,
`app/src/test/.../AccessFunctionEnforcementTest.kt`, `app/src/test/.../RouteAccessTest.kt`,
`releases/1.10.26-candidate/README.md`, `releases/1.10.27-candidate/`.
Agen lain: jangan sentuh berkas itu sampai baris ini diperbarui.**

Versi 1.10.26 baru menegakkan 8 dari 17 fungsi katalog. Sembilan sisanya hanya menghiasi layar:
mencabut centangnya tidak mengubah perilaku apa pun, padahal layar Kontrol Akses Role
menjanjikannya. Sekarang seluruh 17 diperiksa: **15 lewat titik jaga di `CuciinStore.kt`**,
**2 lewat gerbang rute di `RouteAccess.kt`** yang kini memuat modul DAN fungsi.

Titik jaga baru: `queue.status` (`advanceLaundry`), `queue.handover` (`markPickedUp`),
`service.create` (`saveNota`), `stock.write` (`editStock`, `editStocks`), `inventory.write`
(`addInventory`, `updateInventory`, `deleteInventory`), `whatsapp.send` (`markWaSent`),
`customer.write` (`addCustomer`, `updateCustomer`), `owner.manage` (15 titik: cabang, user,
layanan, produk, jenis aset, template WhatsApp), plus `analytics.view` dan `audit.view` di
gerbang rute.

Tanda tangan berubah: `addCustomer` dan `addBranch` kini mengembalikan nilai nullable;
pemanggil di `MasterScreens.kt` menampilkan pesan penolakan.

Test diperkuat supaya tidak bisa lulus tanpa kode yang memeriksa:
`tidakAdaFungsiKatalogYangBelumDiperiksa` membaca seluruh sumber kode utama,
`daftarPemeriksaSesuaiKenyataanKode` mengunci daftar tangan, dan
`setiapTitikJagaFungsiMasihAdaDiStore` menghitung titik jaga per fungsi.

Bukti test menangkap bug: hapus penjaga `queue.status` → 4 test gagal; hapus penjaga
`owner.manage` di `addStaff` → 2 test gagal. Gate: **202 debug + 202 release lulus**, lint
lulus, **53 test Worker lulus**. APK kandidat di `releases/1.10.27-candidate/`.

Uji perangkat pada APK debug 1.10.27 (emulator 1080x2400): `uji_owner1027b.py` **10/10 OK**,
termasuk **Simpan Service sampai tersimpan (notas 7 → 8, omzet 277.000 → 282.000)** dan tiga
menu laporan tetap terbuka untuk Owner; `uji_izin5.py` **7/7 OK** (Kasir tidak melihat kartu
Koreksi Service maupun tombol Hapus). Data uji dibersihkan lewat aplikasi: notas kembali 7,
tally `277.000 = 221.000 + 56.000` cocok, target tercatat di `deletedNotaIds`.

## 0. Pekerjaan sebelumnya (18 Sep, Hermes) — centang fungsi Kontrol Akses Role tidak berpengaruh

**Status: selesai, terverifikasi di emulator, versi 1.10.26 (versionCode 45). Perbaikan
sisanya dilanjutkan di 1.10.27.**

**Berkas yang Hermes pegang: `data/CuciinStore.kt`, `ui/OpsScreens.kt`, `ui/MoreScreens.kt`,
`ui/BusinessScreens.kt`, `data/VersionHistory.kt`, `app/build.gradle.kts`, `CHANGELOG.md`,
`app/src/test/.../AccessFunctionEnforcementTest.kt`, `releases/1.10.26-candidate/`.
Agen lain: jangan sentuh berkas itu sampai baris ini diperbarui.**

Layar **Kontrol Akses Role** menjanjikan "Fungsi tanpa centang berarti tidak diizinkan".
Catatan: bagian ini sempat menulis "hanya `analytics.view` dan `service.price` yang diperiksa".
Angka itu **salah**. Pengukuran ulang langsung ke kode: 8 dari 17 diperiksa, 9 belum.

Alur picu yang terbukti di perangkat sebelum perbaikan: Owner mencabut centang **Koreksi
Service** pada sebuah role, menetapkan role itu ke seorang Kasir, lalu Kasir membuka nota.
Kartu **Koreksi Service** tetap tampil dan tetap bisa menyimpan, walau centangnya sudah
dicabut. Sebabnya jalur uang itu dijaga peran lama (`role != Supervisor`), bukan fungsi
katalog.

Perbaikan: `CuciinStore` punya helper `boleh(modul, fungsi)` dan `tolak(fungsi, pesan)` yang
menanyakan `AccessPolicy` pada `AccessCatalog` untuk role sesi. Jalur yang kini dijaga
fungsi: `service.correct` (koreksi dan hapus Service), `service.payment` (pelunasan),
`expense.write` (tambah/hapus biaya), `attendance.write` (absen masuk/keluar), `cash.close`
(tutup kas), `customer.write` (hapus pelanggan), `owner.access` (ubah role pengguna).

Temuan kedua: layar **Tutup kas** meminta "Pilih satu cabang" tanpa menyediakan pemilih
cabang, sehingga buntu bagi Owner yang melihat semua cabang. Kini layar itu punya pemilih
cabang sendiri.

Bukti: `AccessFunctionEnforcementTest` (200 test debug + 200 release lulus) terbukti gagal
ketika tiga penjagaan berbeda dikembalikan ke bug-nya satu per satu. Uji perangkat: pemilih
cabang Tutup kas 8/8 OK; Kasir tidak lagi melihat kartu Koreksi Service; Owner tetap
melihatnya dan editor terbuka penuh; data perangkat tidak berubah, tally tetap cocok.
Rincian ada di `releases/1.10.26-candidate/README.md`.

## 0a. Pekerjaan sebelumnya (18 Sep, Hermes) — kemacetan antrean sinkronisasi

**Status: selesai, terverifikasi di emulator, commit `47d5171` + `2d1bd48` di branch
`codex/cuciin-1-8-1` (sudah di-rebase di atas `origin/main` `0c84ad6`, tidak bercabang).**

Ditemukan saat menguji alur tulis end-to-end, bukan saat membaca kode: mencatat biaya
operasional berhasil tersimpan di perangkat tetapi **tidak pernah sampai ke server**.
Log perangkat menampilkan `CuciinCloud: Sinkronisasi ditolak server (422)` berulang dan
antrean berisi 11 perintah tidak berkurang.

Tiga sebab bertumpuk di `cloudflare/src/command-sync.ts`:

1. `payment.delete` ada di wire protocol perangkat (`SyncProjection`) tetapi tidak ada di
   `KNOWN_COMMANDS`; setiap penghapusan pembayaran ditolak
   `422 Tipe command tidak didukung` dan menahan antreannya.
2. Satu command yang gagal di-parse membatalkan **seluruh** batch dengan 422 **tanpa
   `results`** (`raw.commands.map(parseCommand)` di dalam satu `try`). Sisi perangkat
   hanya bisa memindahkan command ke daftar `rejected` kalau `results` ada, sehingga tidak
   ada satu pun yang bisa dibuang dan antreannya macet permanen.
3. Command yang ditolak permanen (4xx) membuat command sesudahnya berstatus `retryable`
   selamanya (`priorFailure=true` tanpa membedakan jenis galat).

Perbaikan: `payment.delete` ditambahkan ke `KNOWN_COMMANDS` beserta `planPayment` untuk
operasi hapus (idempoten bila baris sudah hilang); `pushCommands` mem-parse per command dan
melaporkan yang rusak satu per satu; rantai hanya dihentikan gangguan sementara.

**Berkas yang disentuh Hermes (jangan disunting bersamaan):**

- `cloudflare/src/command-sync.ts`
- `cloudflare/tests/queue-stall.test.mjs` (baru, 4 test)
- `cloudflare/tests/wire-contract.test.mjs` (baru, 3 test)
- `android/app/build.gradle.kts`, `android/CHANGELOG.md`,
  `android/app/src/main/java/com/cuciin/laundryops/data/VersionHistory.kt`
- `releases/1.10.25-candidate/` (README + SHA256SUMS; APK tidak ikut Git)

**Bukti:**

| Pemeriksaan | Hasil |
| --- | --- |
| Gate Worker | 51 test lulus (naik dari 44) |
| Gate Android | 191 test debug + 191 test release, 0 gagal |
| Test pengunci | 7 test, terbukti gagal saat perilaku lama dikembalikan satu per satu |
| Antrean perangkat | pending 11 ke 0, rejected 0, revision 670 ke 674 |
| Data sampai server | biaya `cost-5caba443-d84f` muncul di D1 debug |
| Uji ulang 1.10.25 | biaya baru langsung tersinkron, pending 0, revision 679 ke 686 |
| Peran SPV di 1.10.25 | header `Aida · SPV`; Laporan transaksi & analitik TERBUKA; Riwayat aktivitas TIDAK TAMPIL; crash 0 |

Worker debug `cuciin-api-debug` sudah dideploy ulang (version `5599e3c2-f7f1-4a17-b53a-c3a46e05c9ed`).
**Worker produksi belum dideploy** dan sengaja menunggu keputusan Owner.

## 0. Pekerjaan yang sedang berjalan (17 Sep, Hermes)

**Tujuan:** sistem layout konsisten, menu aset cabang, Kontrol Akses Role, dan tampilan utama baru.

**Sudah diterapkan ke produksi dan diverifikasi:**

- Migrasi `0006_asset_types.sql` (tabel `asset_types`, 6 jenis bawaan) dan `0007_access_roles.sql` (tabel `access_roles`, 3 role bawaan) sudah diterapkan ke D1 produksi.
- Worker produksi dideploy ulang (version `445117ac-cd1b-4a84-a10a-b5fb2d001560`) dan mengenal command `assetType.*` serta `accessRole.*`.
- Dibaca balik: `migrations list` memuat 0001 sampai 0007, `PRAGMA table_info(access_roles)` sesuai, 3 baris role bawaan, `/health` ok revision 356, dan data produksi tidak berubah (5 orders, 4 branches, 8 staff).

**Perubahan aplikasi yang sudah diverifikasi di emulator:**

- `OpsScreens.kt`: tampilan utama memakai dua filter sebaris (periode bawaan hari ini dan cabang) serta tiga kartu status yang dapat diketuk: Sedang dikerjakan, Cucian telat, Selesai. Cucian telat = estimasi selesai lewat tetapi pengerjaan belum selesai.
- `AccessScreens.kt` (baru): daftar role, editor role dengan checklist modul dan fungsi, serta pemilih role per pengguna.
- `AccessCatalog.kt` (baru): katalog modul dan fungsi, satu sumber untuk layar dan pemeriksaan izin.
- `AccessPolicy.kt` (baru): penentu izin yang dapat diuji tanpa Android; Owner selalu penuh, role menentukan modul dan fungsi, kebijakan per pengguna hanya mempersempit.
- `AccessPolicyTest.kt` (baru): 11 test lulus.
- `OwnerSettingsScreen.kt`: kontrol akses pengguna dipindahkan ke menu Kontrol Akses Role; layar ini hanya memuat template WhatsApp.
- `MoreScreens.kt`: menu baru "Kontrol Akses Role" di grup Master data.

**Gate yang lulus:** 68 unit test debug dan 68 unit test release (0 gagal), lint debug dan release, APK debug dan release, AAB, `verify_release.py`, dan `npm run check` Worker (40 test). Kandidat `releases/1.10.8-candidate/` sudah dibuat dan checksum-nya diverifikasi.

**Perbaikan 1.10.8:** lembar pilihan sekarang membedakan jenis pilihan secara bentuk, bukan hanya warna. Pilihan banyak memakai kotak centang (terisi penuh saat dipilih, kosong bergaris saat tidak), tiap baris menampilkan label "Dipilih" atau "Tidak dipilih", baris terpilih berlatar berbeda, dan tersedia hitungan "1 dari 12 modul dipilih" plus tombol Pilih semua dan Kosongkan. Tombol Selesai dibatasi `heightIn(max = 560.dp)` dengan daftar `weight(1f)` sehingga selalu terlihat penuh (terukur 46px di emulator). Pilihan tunggal tetap memakai radio tanpa label tambahan.

**1.10.9 (17 Sep):** filter periode di layar utama menambah pilihan "Pilih dua tanggal" (`customRange` + `DateTimeFields` di dalam sheet periode yang kini dapat digulir). Ketiga PDF dicetak ulang mengikuti desain terlampir melalui modul baru `data/ReportPdf.kt`: laporan transaksi (kartu metrik, rekonsiliasi berdampingan dengan per cabang, tabel rincian 10 kolom, hanya bagian yang dipilih yang dicetak), laporan analitik (donut dengan total di tengah dan legenda lengkap), dan nota pelanggan (kapsul status terpisah, ringkasan pembayaran dengan total navy). Baris tabel PDF membungkus dengan tinggi adaptif sehingga tidak ada elipsis. Gate lulus: 68 test debug + 68 test release, lint, APK/AAB, `verify_release.py`, checksum `releases/1.10.9-candidate/`.

**1.10.10 (17 Sep):** menu baru **Theme Aplikasi** (`ui/ThemeScreen.kt`) berisi Light, Dark, dan Custom. `CuciinThemeMode` kini tiga nilai; `CuciinCustomTheme` menyimpan enam warna ARGB yang diatur lewat slider R/G/B, kode hex, dan pratinjau langsung; `toPalette()` menurunkan seluruh token sisanya dan `readableOn()` menghitung warna teks di atas tombol/header agar selalu kontras. Pengaturan tema dihapus dari `ProfilScreen` dan diganti pintasan. Ditemukan dan diperbaiki bug server: alias `assetType` hilang di `parseCommand` sehingga 23 perintah aset tertahan 422; ditambah test yang mengiterasi seluruh entityType. Worker debug dan produksi sudah dideploy ulang (produksi version `a8f7f1f2-89ec-4266-b00e-f8653da9fc6f`); antrean perangkat kembali 0. Gate lulus: 72 test debug + 72 release, lint, APK/AAB, `verify_release.py`, `npm run check` (41 test), checksum `releases/1.10.10-candidate/`.

**1.10.10 (17 Sep, lanjutan):** pengisian data awal dipindah ke jalur Excel, bukan dari dalam aplikasi. Alat baru di `laundry-ops/scripts/`: `fetch_d1_reference.py` (membaca acuan entitas dari D1) dan `import_template_to_d1.py` (Excel -> SQL + jurnal `sync_changes`). Template `releases/1.10.10-candidate/template-data-cuciin.xlsx` berisi sembilan sheet, dan panduannya di `PANDUAN-IMPOR-EXCEL.md`. Alur diuji di D1 uji: 8 baris masuk, 8 entri jurnal, dan idempoten saat dijalankan dua kali. Perbaikan menyertai yang tetap dipakai: `CuciinStore.newId()` (UUID) dan `branches.firstOrNull()?.id.orEmpty()` pada catatan audit.

**1.10.10 (17 Sep, urutan menu):** susunan menu layar Modul dirapikan dan dipindah ke `ui/MenuOrder.kt` supaya dapat diuji tanpa Android. Bagian yang tampil berurutan: Pekerjaan harian, Keuangan, Pelanggan, Laporan, Master data, lalu Aplikasi paling bawah. "Theme Aplikasi" keluar dari bagian laporan dan "Riwayat versi" kini di urutan paling bawah. Layar `MoreScreens.kt` hanya merender katalog; ikon dan ringkasan disimpan sebagai nama di katalog lalu dipetakan di layar. Test baru `MenuOrderTest.kt` (13 test) mengunci urutan bagian, urutan isi tiap bagian, dan penyaringan izin tanpa mengubah urutan. Gate lulus: 85 test debug + 85 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.10-candidate/` diperbarui. Pengaturan urutan menu oleh pengguna (naik/turun) belum dibuat, menunggu keputusan Owner.

**1.10.11 (17 Sep, pengaturan urutan menu):** menu Modul kini dapat disusun pengguna. Susunan hidup di `ui/MenuOrder.kt` (`MenuOrder` katalog murni + `MenuLayout` susunan yang berlaku) dan disimpan per HP lewat `ui/MenuPrefs.kt`; tidak ikut tersinkron, sama seperti tema. Layar baru `ui/MenuOrderScreen.kt` dengan pintasan di paling atas layar Modul: panah naik dan turun per menu, tombol pindah bagian, panah per judul bagian, serta tombol Kembalikan urutan awal. Susunan tersimpan dirapikan terhadap katalog sehingga menu baru dari pembaruan tetap muncul di bagian bawaannya. Bagian bawaan berurutan: Pekerjaan harian, Keuangan, Pelanggan, Laporan, Master data, Aplikasi. Gate lulus: 98 test debug + 98 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.11-candidate/`. Diuji di emulator: geser menu, pindah bagian (Theme Aplikasi ke Keuangan), dan susunan bertahan setelah aplikasi dibuka ulang.

**1.10.12 (17 Sep, bar navigasi + animasi):** diperbaiki bug bar navigasi bawah yang hilang hanya di layar Service: daftar rute berbar ditulis ulang terpisah di `CuciinNav.kt` dan rute `nota` tertinggal. Sekarang rute berbar selalu diturunkan dari katalog tab baru `ui/NavTabs.kt` (tab, label, izin) dan dikunci `NavBarContractTest.kt`. Animasi ditambahkan lewat `ui/Motion.kt` (durasi mengikuti skala animasi sistem; bila animasi dimatikan, gerak mati): geser dan pudar saat pindah layar dengan arah maju/mundur, efek tekan pada tombol dan kartu status, angka kartu status menghitung naik, baris antrian muncul mengalir (`ui/components/EnterOnce.kt`, dibatasi 6 baris), bar bawah muncul dan hilang lembut. Semua hanya alpha, geser, dan skala lewat graphicsLayer supaya ringan di HP kelas bawah. Gate lulus: 104 test debug + 104 test release, lint, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.12-candidate/`. Uji emulator: bar terbaca di kelima tab; animasi terbukti dengan rekaman layar pada skala animasi 8x; waktu render 50th 16ms dan 99th 18ms.

**1.10.13 (17 Sep, login + keyboard):** diperbaiki layar login yang terpotong saat keyboard Android muncul. Penyebabnya layar login dirancang satu layar penuh tanpa gulir, sehingga saat ruang menyusut 300-400dp bagian bawah (tulisan "Lupa kata sandi?" dan tombol "Daftar akun") terpotong tanpa cara menjangkaunya. Aturan tata letak baru hidup di `ui/LoginLayout.kt` dan dikunci `LoginLayoutTest.kt`: ruang lega tetap satu layar penuh tanpa gulir, ruang sempit dipadatkan dan boleh digulir, dan saat keyboard terbuka layar menggulir otomatis ke kartu isian lewat `BringIntoViewRequester`. Gate lulus: 109 test debug + 109 test release, lint, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.13-candidate/`. Diuji di emulator pada lima tinggi ruang (2400 sampai 1100 piksel).

**1.10.14 (17 Sep, tab macet):** diperbaiki tab Antrian yang tidak bisa diklik setelah layar Service dibuka lewat tombol "Service baru". Penyebab: perpindahan tab memakai `popUpTo("home") { saveState = true }` berpasangan `restoreState = true`, pola untuk graf navigasi bertingkat, sedangkan graf Cuciin datar; pada keadaan setelah `nota` dibuka lewat tombol, `navigate` tidak menghasilkan perpindahan apa pun. Perbaikan: satu panggilan `navigate` dengan `launchSingleTop` + `popUpTo("home")` tanpa saveState/restoreState, dan tab aktif tidak dinavigasi ulang. Aturan hidup di `ui/NavTransition.kt`, dikunci `NavTransitionContractTest.kt`. Gate lulus: 115 test debug + 115 test release, lint, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.14-candidate/`. Diuji di emulator: kelima tab dari layar Service, bolak-balik lima putaran, lewat tab maupun tombol, dan setelah tombol kembali.

**1.10.15 (17 Sep, nama debug):** aplikasi varian debug kini bernama **Cuciin Debug** di layar HP, sedangkan versi rilis tetap **Cuciin**. Namanya diambil dari `app/src/debug/res/values/strings.xml` (hanya berlaku untuk varian debug), bukan dari `res/values/strings.xml` bersama. Dibaca balik dari APK: debug `application-label:'Cuciin Debug'`, rilis `application-label:'Cuciin'`. Sekaligus ditegaskan: bug tab macet hanya ada di rilis 1.10.13 ke bawah; perbaikannya dibuktikan ada di dalam APK rilis 1.10.14 dan 1.10.15 (kelas `NavTransition` ditemukan di `classes.dex`, tidak ada di 1.10.13). Gate lulus: 115 test debug + 115 test release, lint, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.15-candidate/`.

**1.10.16 (18 Sep, layar pembuka + login kaca):** tiga hal dikerjakan sekaligus. (1) Layar pembuka baru `ui/OnboardingScreen.kt` + `ui/OnboardingPrefs.kt`: tiga halaman geser, muncul sekali setelah pemasangan, bisa dibuka lagi lewat tautan "Tentang aplikasi" di halaman masuk. Gambar rasio 9:20 (841x1870) dari Owner, dikompres ke webp ~200 KB per gambar. (2) Halaman login memakai kartu kaca gelap (`ui/GlassCard.kt`): latar navy 42%, isian bening dengan garis putih tipis. Kaca gelap dipilih karena wallpaper login ramai dan kaca terang membuat tulisan putih kehilangan kontras. (3) Bar putih 60px di bawah halaman login diperbaiki: sebabnya `Scaffold` memotong area bar sistem dari konten, sehingga latar Scaffold terang terlihat di bagian yang tidak tertutup wallpaper. Layar penuh kini melewatkan padding Scaffold dan mengatur insetnya sendiri; bar sistem dibuat tembus pandang dari tema. Atribut tema yang butuh API lebih baru dipisah ke `values-v27` dan `values-v29` karena minSdk 26 (lint menangkap ini). Gate lulus: 121 test debug + 121 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.16-candidate/`.

**1.10.17 (18 Sep, tumpang tindih judul pembuka):** diperbaiki judul halaman layar pembuka yang tertimpa tombol. Sebabnya tata letak dua wadah berisi penuh layar: judul terdorong ke dasar oleh pengisi fleksibel di dalam wadahnya, sementara tombol berada di wadah lain yang juga menempel di dasar. Perbaikan: seluruh isi (logo, judul, baris pendukung, titik halaman, tombol) disusun satu kolom yang mengalir dari atas ke bawah dengan satu pengisi fleksibel di antara logo dan judul. Diukur di emulator sebelum/sesudah: judul y 2187-2211 (tertimpa) menjadi y 1651-1825; jarak judul ke tombol 13 px menjadi 208 px. Gate lulus: 121 test debug + 121 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.17-candidate/`.

**1.10.18 (18 Sep, tombol kedua layar pembuka):** di halaman terakhir layar pembuka, tombol kedua bertulisan "Lihat panduan singkat" padahal kerjanya hanya menutup layar. Sekarang tombol kedua hanya muncul selama masih ada halaman berikutnya dan isinya selalu "Lewati"; di halaman terakhir dihilangkan karena tombol utamanya sudah "Masuk ke akun". Aturannya hidup di `Onboarding.primaryLabel`, `Onboarding.hasSecondButton`, dan `Onboarding.secondLabel` supaya bisa diuji tanpa Android, dikunci tiga test baru. Gate lulus: 124 test debug + 124 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.18-candidate/`. Diuji di emulator: halaman 3 hanya memuat satu tombol.

**Kebijakan artefak Git (18 Sep):** `.gitignore` kini menutup `laundry-ops/releases/*-candidate/*.apk` dan `*.aab`. Sebelumnya repo menyimpan 304 MB APK terlacak dan `.git` sudah 671 MB; kandidat 1.10.2 sampai 1.10.17 belum pernah masuk Git dan totalnya 826 MB, sehingga dimasukkan hanya catatannya (README, SHA256SUMS, PANDUAN-IMPOR-EXCEL.md, template Excel). Artefak kandidat yang sedang berlaku ditambahkan dengan `git add -f`. Kode 1.10.2 sampai 1.10.18 sudah di-commit (commit `3e8e631` dan `4e98767`), belum dipush.

**1.10.19 (18 Sep, nama pemilik netral):** nama yang tampil di aplikasi tidak lagi memakai nama pribadi, tetapi nama usaha. Aplikasi ini dijual ke banyak pemilik laundry sehingga nama di layar harus netral. Alamat email sengaja tidak diubah karena itu identitas akun Firebase; menggantinya memutus login semua perangkat. Yang diubah: `CuciinStore.ownerName`, `cloudflare/scripts/seed-debug.sql`, `mockup/index.html`, `mockup/app.js`, dan fixture `SyncProtocolTest.kt`. Migrasi baru `cloudflare/migrations/0008_owner_name_neutral.sql` mengganti nama di tabel `staff` **dan** menulis jurnal `sync_changes`, karena snapshot perangkat dibentuk dari snapshot tersimpan plus jurnal; kalau hanya tabel yang diubah, perangkat yang sudah memegang salinan tetap menampilkan nama lama. Migrasi idempoten (dijalankan dua kali: `rows_written` 5 lalu 0, entri jurnal tetap 1). Dua test Android baru (`OwnerNameTest`, `NoPersonalNameInSourcesTest`) dan dua test Worker baru mengunci aturan ini. Bukti APK: `strings classes*.dex` hanya menyisakan dua kemunculan, yaitu URL Worker dan alamat email. Gate lulus: 130 test debug + 130 test release, 43 test Worker, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.19-candidate/`.

**Migrasi 0008 sudah diterapkan ke PRODUKSI (18 Sep, 02:40 WIB):** nama Owner di tabel `staff` produksi menjadi "Cuciin", dengan 4 entri jurnal (satu per cabang: bunayya, laupay-kirab, laupay-dayeuh, shelly). Dijalankan ulang: `rows_written` nol, entri tetap 4, total jurnal tetap 397. Backup sebelum migrasi sudah dipindah ke tempat permanen: `~/Documents/ChatGPT/Laundry/firebase-migration/backup-d1/pre-owner-name-neutral-20260918-0235.sql` (496 KB, berisi data: 8 staff, 4 cabang, 7 orders, 393 entri jurnal). Cara memulihkannya ada di `CARA-RESTORE.md` di folder yang sama.

**BUG YANG DITEMUKAN SEBELUM MIGRASI JALAN, dan pelajarannya:** versi pertama migrasi 0008 menulis SATU entri jurnal saja. Itu salah total. `pullChanges` di `command-sync.ts` menyaring jurnal untuk pengguna non-Owner dengan `branch_id IN (cabang pengguna)` dan entri `staff` hanya lolos bila cabangnya cocok, sehingga kasir dan SPV di cabang lain tidak akan pernah menerima nama baru walaupun Owner melihatnya. Aturan yang benar ada di `staffJournalScopes`: satu entri per cabang tugas. **Setiap migrasi yang menyentuh entitas `staff` wajib menulis satu entri jurnal per cabang, bukan satu saja.** Bug ini ketahuan dengan menyimulasikan filter `pullChanges` per cabang di D1 uji sebelum menyentuh produksi; cara itu wajib dipakai lagi untuk migrasi sejenis.

**Idempotensi `sync_changes`:** tabel itu TIDAK punya indeks unik pada `command_id`, jadi `INSERT OR IGNORE` tidak menjamin apa pun. Penjagaan idempoten wajib memakai `NOT EXISTS` yang membandingkan `command_id` DAN `branch_id`.

**PENTING untuk agent lain:** `NoPersonalNameInSourcesTest` akan GAGAL bila ada yang menambahkan kembali kata "tiftazani" di `src/main`, `src/main/res`, atau `src/debug` selain sebagai bagian alamat email `tiftazani.khara@gmail.com`. Itu disengaja.

**1.10.20 (18 Sep, warna dialog pemilih tanggal):** dilaporkan Owner bahwa warna kotak pemilih tanggal terlihat aneh. Penyebabnya `ui/DateTimeFields.kt` memakai `android.R.style.Theme_Material_Light_Dialog_Alert` yang dipaku mati; tema bawaan itu membawa aksen teal sehingga tombol "Pilih" dan "Batal" berwarna teal sementara tombol aplikasi magenta. Perbaikan: tema sendiri `Theme.Cuciin.Picker` di `res/values/themes_picker.xml` dengan aksen `cuciin_accent` (#C1358F), warnanya disimpan sejalan dengan palet Compose di `ui/theme/Theme.kt`. Berlaku di delapan tempat pemakaian lewat satu fungsi (filter periode, estimasi selesai Service, tanggal kejadian stok, tanggal beli aset). Dibuktikan per piksel dari tangkapan layar: warna dominan dialog `#C1358F`, warna teal nol. Empat test baru `PickerThemeTest` mengunci supaya tema bawaan Android tidak kembali dipakai. Gate lulus: 135 test debug + 135 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.20-candidate/`.

**ATURAN untuk agent lain:** jangan pakai `android.R.style.*` untuk dialog di aplikasi ini. Dialog sistem tidak mewarisi palet Compose, jadi warnanya akan berbeda dari tombol aplikasi. Pakai `R.style.Theme_Cuciin_Picker` lewat `pickerContext()` di `ui/DateTimeFields.kt`. `PickerThemeTest` akan gagal bila aturan ini dilanggar.

**1.10.21 (18 Sep, nuansa biru + preset tema + harga khusus Owner):** tiga hal. (1) Palet Light dan Dark diganti mengikuti warna logo dan gambar layar pembuka: biru #0048B4 dan biru langit #D8E4F0. Light: latar #F4F8FD, kartu putih, aksen #0048B4, header #00306E, teks #0B1A2E. Dark: latar #0A1220, kartu #121C2E, aksen #7FB4FF, teks #EAF2FC. Kuning #F7CA3A dipertahankan sebagai aksen menu aktif karena di logo pun kuning hadir. 28 dari 28 pasangan warna lulus WCAG AA. Warna navy lama yang dipaku di `GlassCard` dan `OnboardingScreen` ikut disesuaikan. (2) Tema Custom kini punya tiga preset di `CuciinCustomTheme.presets`: Biru Cuciin (bawaan), Biru Cuciin Gelap, dan Magenta Jemur. (3) Fungsi baru `service.price` di `AccessCatalog`, ditandai `ownerOnlyByDefault`; tombol "Ubah harga" disembunyikan untuk yang tidak berhak dan `CuciinStore.setCartPrice` mengembalikan Boolean sehingga menolak perubahannya. Jalur koreksi Service juga dijaga. `ensureAccessRoles` kini menambal role bawaan yang tersimpan dengan `AccessCatalog.builtInFunctionsFor`, karena isi role dibekukan saat pertama dibuat. Gate lulus: 147 test debug + 147 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.21-candidate/`.

**ATURAN untuk agent lain (harga):** jangan menambahkan jalur baru yang menulis `unitPrice` tanpa memeriksa `store.canChangePrice()`. Harga adalah data uang. `ServicePriceAccessTest` akan gagal bila aturan ini dilanggar.

**1.10.22 (18 Sep, menu Modul menutup aplikasi):** dilaporkan Owner bahwa mengklik "Antrian laundry" atau "Service baru" di layar Modul membuat aplikasi langsung keluar untuk peran apa pun. Penyebab dari logcat: `IllegalArgumentException: Navigation destination that matches route queue cannot be found in the navigation graph` di `MoreScreens.kt:120`. Katalog menu memakai nama menunya sendiri sebagai rute (`queue`, `service`), sedangkan graf navigasi memakai `home` dan `nota` karena kedua rute itu dipakai bersama tab bawah. Perbaikan: `MenuOrder.destinationOf` memetakan rute menu ke rute graf. Sekaligus disamakan: menu yang tabnya disembunyikan untuk SPV (Service baru, WA menunggu) kini ikut disembunyikan di menu Modul, karena server menolak pembuatan Service oleh SPV sehingga pesanannya akan gagal tersinkron tanpa penjelasan. Pengunci: `MenuRouteTest` membandingkan tiap rute menu dengan daftar `composable(...)` di `CuciinNav.kt`. Gate lulus: 153 test debug + 153 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`, checksum `releases/1.10.22-candidate/`. Disapu di emulator dengan DUA akun supaya menu khusus Owner ikut teruji: Kasir 12 diklik tanpa crash + 10 tidak tampil, Owner 10 diklik tanpa crash + 0 tidak tampil. Total 22 dari 22 menu teruji, 0 crash. **Catatan penting: sapuan pertama dijalankan pada build 1.10.21 yang masih terpasang, bukan APK 1.10.22.** `adb install -r` gagal diam-diam sehingga versi lama tetap terpasang; selalu periksa `dumpsys package ... | grep versionName` setelah memasang, jangan percaya keluaran install saja.

**ATURAN untuk agent lain (rute menu):** setiap menu baru di `MenuOrder.catalog` wajib punya rute yang terdaftar di `CuciinNav.kt`, atau dipetakan lewat `MenuOrder.destinationOf`. `MenuRouteTest` akan gagal bila aturan ini dilanggar. Jangan menambah `nav.navigate("...")` dengan rute yang tidak ada di graf: Compose Navigation melempar pengecualian dan aplikasi langsung keluar.

**1.10.23 (18 Sep, sapuan regresi setelah 1.10.22 masuk main):** tiga bug nyata ditemukan, semuanya jenis yang lolos build hijau.

1. **Dua menu Laporan memakai modul izin yang salah, dan dua modul katalog tidak pernah diperiksa.** `AccessCatalog` memuat 12 modul, hanya 10 yang pernah diperiksa. Modul `analytics` dan `audit` bisa dicentang di Kontrol Akses Role tetapi tidak pernah diperiksa, sehingga mencentangnya tidak berpengaruh. Lebih buruk: role bawaan Supervisor memuat modul `analytics` beserta fungsi `analytics.view`, tetapi menu "Laporan transaksi", "Laporan analitik", dan "Riwayat aktivitas" memeriksa modul `owner` sehingga tetap terkunci untuknya. Perbaikan: pemetaan rute ke modul dipindah ke `ui/RouteAccess.kt` (dapat diuji tanpa Android), dan `RouteAccessTest` mengunci agar setiap modul katalog benar-benar diperiksa di suatu tempat.
2. **Riwayat aktivitas memakai cabang `"melati"` yang sudah tidak ada** di dua tempat `CuciinStore` (persetujuan user dan tutup kas tanpa cabang). Entri audit dengan cabang itu tidak pernah lolos filter per-cabang `pullChanges`, jadi catatannya tidak sampai ke perangkat mana pun.
3. **`CuciinStore.branch()` melempar `NoSuchElementException`** karena memakai `first()` dan `first { }`. Katalog cabang bisa kosong sesaat atau memuat id yang belum tersinkron, dan ada 29 pemanggil di seluruh kode utama. Sekarang selalu mengembalikan nilai dengan cabang pengganti. Tiga tempat lain ikut diperbaiki: dua di `MasterScreens` dan `nextNotaId`.

Satu klaim awal dikoreksi sendiri: bug periode laporan analitik **tidak pernah bisa terjadi dari UI** (nilainya state lokal layar yang hanya diisi dari daftar yang sama), jadi statusnya pengerasan, bukan perbaikan. Sudah disebut begitu di `CHANGELOG.md`, `VersionHistory.kt`, dan README kandidat.

Pengunci: `RouteAccessTest`, `AuditBranchTest`, `BranchLookupTest`, `ReportPeriodTest`. Setiap test dibuktikan gagal saat bug-nya dikembalikan. Gate lulus: 173 test debug + 173 test release, lint debug dan release, APK/AAB bertanda tangan, `verify_release.py`. Diuji di emulator pada versi terpasang yang sudah diverifikasi: ketiga menu Laporan terbuka, CRASH 0. Checksum `releases/1.10.23-candidate/`.

**1.10.24 (18 Sep, uang hilang dari laporan kas):** ditemukan saat Owner bertanya apakah aplikasi sudah benar-benar bebas bug. `paymentRecords()` membuang SELURUH `paid` sebuah nota begitu nota itu punya SATU entri jurnal, sehingga nota yang dibayar sebagian SEBELUM jurnal pembayaran ada lalu dilunasi kehilangan bagian lamanya dari laporan kas dan tutup kas. Dibuktikan di perangkat dengan skenario yang benar: cara lama melaporkan 236.000 dari uang sebenarnya 266.000 (hilang 30.000); cara baru melaporkan 266.000. Aturannya dipindah ke `data/PaymentTally.kt` dan dikunci `PaymentLedgerTallyTest`. Gate lulus: 184 test debug + 184 test release, lint, APK/AAB bertanda tangan, `verify_release.py`. Checksum `releases/1.10.24-candidate/`.

**PELAJARAN cara menguji (penting):** test pengunci TIDAK BOLEH menyalin ulang logika yang diuji. Versi pertama `PaymentLedgerTallyTest` menulis ulang perhitungannya di dalam test sehingga tetap LULUS walaupun bug-nya dikembalikan; itu tidak mengunci apa pun. Pindahkan aturannya ke fungsi murni di kode produksi, panggil dari test, lalu BUKTIKAN test gagal saat bug dikembalikan.

**PELAJARAN kedua:** uji harus memakai kondisi yang benar-benar membedakan cara lama dan baru. Uji pertama saya memakai nota yang jurnalnya sudah mencakup seluruh `paid` sehingga kedua cara sama; itu tidak membuktikan apa pun. Kondisi berbahaya: nota TANPA jurnal yang lalu mendapat jurnal untuk pembayaran berikutnya.

**Nama Owner akhirnya sampai ke perangkat (18 Sep, sore):** masalah lama "header Modul masih Tiftazani - Owner" ternyata punya DUA sebab yang keduanya harus diperbaiki, dan yang kedua baru ketahuan sekarang.

1. Migrasi `0008_owner_name_neutral.sql` diterapkan ke D1 **produksi** pada 02:40 tapi TIDAK ke D1 **debug**. Sekarang sudah diterapkan ke debug juga (`changes: 2`), idempoten (`rows_written: 0` saat dijalankan ulang), 5 entri jurnal. Backup sebelum migrasi: `~/Documents/ChatGPT/Laundry/firebase-migration/backup-d1/pre-0008-debug-20260918-1555.sql` (884 KB, teruji bisa dipulihkan: 9 staff, 7 branches, 7 orders, nama Owner masih Tiftazani).

2. **`sync_snapshots` di debug masih memuat nama lama.** Perangkat menerima data dari snapshot penuh saat bootstrap dan dari jurnal saat sync biasa. Migrasi hanya memperbaiki tabel `staff` dan jurnal, TIDAK snapshot. Karena entri jurnal migrasi bernomor 581-585 sedangkan revision perangkat sudah 662, perangkat tidak pernah menariknya. Perbaikan: snapshot debug diperbaiki langsung (`staff.name` -> Cuciin), lalu ditulis entri jurnal BARU bernomor 663-667 (satu per cabang) supaya perangkat ikut menerimanya. Hasil: perangkat revision 667 dan header layar Modul berbunyi **"Cuciin - Owner"**.

**ATURAN untuk agent lain (migrasi entitas staff):** memperbaiki tabel dan jurnal TIDAK cukup. Snapshot server juga harus diperbaiki, dan kalau perangkat sudah punya revision lebih tinggi dari nomor entri jurnal, tulis entri jurnal BARU dengan nomor di atas revision perangkat. Urutan lengkapnya ada di skill `cuciin`.

**ATURAN untuk agent lain (ganti nama tampilan):** jangan ubah nama orang di catatan historis. Dari 72 kemunculan nama pribadi di snapshot, hanya 1 (`staff[].name`) yang boleh diubah; 71 sisanya ada di `audit[].user`, `stockMoves[].by`, `notas[].kasir`, `notas[].lines[].handledByName`, dan `payments[].by` — itu fakta masa lalu dan mengubahnya memalsukan riwayat.

**PR #16 ditutup:** sudah usang (paket `com.tiftazani` dan `LoginGate.kt` tidak ada lagi di main) dan bertentangan dengan aturan "tidak ada masuk cepat tanpa kata sandi untuk peran apa pun". PR #9, #6, #5 tidak menyentuh `laundry-ops` (proyek lain).

**ATURAN untuk agent lain (penerimaan uang):** penerimaan lama = `paid` nota dikurangi jumlah jurnalnya, bukan seluruh `paid` dan bukan nol. Jangan mengubah `PaymentTally.legacyAmount` tanpa menjalankan `PaymentLedgerTallyTest` dengan bug dikembalikan.

**ATURAN untuk agent lain (modul izin):** setiap modul di `AccessCatalog` wajib dipakai setidaknya satu rute di `RouteAccess` atau satu tab di `NavTabs`. Menambah modul katalog tanpa memakai modulnya di salah satu tempat itu membuat hak akses yang tidak pernah berlaku. `RouteAccessTest` akan gagal.

**ATURAN untuk agent lain (cabang):** jangan memakai `branches.first()` atau `branches.first { }`. Pakai `firstOrNull` dengan cadangan; katalog cabang bisa kosong atau memuat id yang belum tersinkron, dan pemanggilnya ada di banyak layar. `AuditBranchTest` dan `BranchLookupTest` akan gagal bila pola itu kembali.

**Menunggu perintah Owner:**
- Penghapusan data contoh (dummy) di produksi belum dijalankan. Jangan hapus tanpa backup dan perintah eksplisit.
- Berkas Excel berisi data nyata belum diterima, jadi belum ada data yang ditembakkan ke D1 produksi.

**Catatan penting:** role dan pengguna sekarang tersimpan sebagai `accessRoles` pada snapshot dan `staff.accessRoleId`. Pengguna tanpa `accessRoleId` otomatis memakai role bawaan sesuai peran lamanya, jadi data lama tetap berjalan tanpa migrasi khusus.

## 0a. Klaim file Hermes saat ini

```
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/components/Widgets.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/UiMetrics.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/MoreScreens.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/MenuOrder.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/MenuOrderScreen.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/MenuPrefs.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/NavTabs.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/NavTransition.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/OnboardingScreen.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/OnboardingPrefs.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/GlassCard.kt
laundry-ops/android/app/src/main/res/values-v27/themes.xml
laundry-ops/android/app/src/main/res/values-v29/themes.xml
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/OnboardingScreen.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/LoginLayout.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/AuthScreens.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/Motion.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/components/Motion.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/components/EnterOnce.kt
laundry-ops/android/app/src/test/java/com/cuciin/laundryops/ui/MenuOrderTest.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/OpsScreens.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/OwnerSettingsScreen.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/BusinessScreens.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/AssetScreens.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/AccessScreens.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/AnalyticsReportScreen.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/FileExports.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/ChartPalette.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/AssetCodes.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/AssetPhotos.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/AccessCatalog.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/AccessPolicy.kt
laundry-ops/cloudflare/migrations/0006_asset_types.sql
laundry-ops/cloudflare/migrations/0007_access_roles.sql
laundry-ops/cloudflare/migrations/0008_owner_name_neutral.sql
```

## 0b. Riwayat klaim sebelumnya (16 Sep, Hermes)

**Tujuan:** menerapkan sistem desain Jemur ke seluruh aplikasi, mengganti ikon, memigrasikan data cabang dan akun operasional, serta memperbaiki tiga layar yang dikeluhkan Owner.

> **Catatan pembacaan:** daftar di bawah adalah klaim file pada 16 Sep untuk pekerjaan versi 1.9.x, dan
> sebagian keterangannya sudah tidak berlaku. Dua yang terbukti sudah tidak ada di kode sekarang:
> "masuk cepat" pada `AuthScreens.kt` (fitur itu dihapus; login hanya email + kata sandi) dan
> `demoLogin` pada `CuciinStore.kt`. Seed bawaan sekarang berisi 4 cabang nyata (Bunayya, Laupay
> Kirab, Laupay Dayeuh, dan satu lagi), bukan cabang contoh. Untuk keadaan sekarang, pakai tabel
> "Titik berangkat" dan bagian 0e di atas.

**Klaim file Hermes untuk pekerjaan ini:**

```
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/theme/Theme.kt        (palet Jemur + CuciinShape + navSelected)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/components/Widgets.kt (komponen bersama)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/UiMetrics.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/MoreScreens.kt        (laporan, periode, riwayat aktivitas)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/MasterScreens.kt      (daftar cabang, Daftar User)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/AuthScreens.kt        (latar login, masuk cepat)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/CuciinNav.kt          (navigasi bawah navy + kuning)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/BusinessScreens.kt    (istilah aset, absensi)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/OpsScreens.kt         (ikon layanan, ekspor)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/CuciinStore.kt      (seed 4 cabang + 6 kasir, demoLogin)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/VersionHistory.kt
laundry-ops/android/app/src/main/res/mipmap-*/                                        (ikon launcher dari zip)
laundry-ops/android/app/src/main/res/drawable-nodpi/                                  (logo + latar login)
laundry-ops/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher*.xml
laundry-ops/cloudflare/src/command-sync.ts                                            (payload penuh order.*, jurnal stock.batch)
laundry-ops/cloudflare/src/index.ts                                                   (CHANGE_DATASETS order, tombstone)
laundry-ops/cloudflare/tests/command-sync.test.mjs                                    (3 test baru)
```

**Codex: jangan menyunting file di atas sampai pekerjaan ini selesai dan dicatat di sini.**

**Aturan yang berubah dan wajib dipatuhi siapa pun:**

1. **Arah visual adalah Jemur, bukan Airbnb.** Struktur navy (`heroA` #0D164B), aksi utama pink (`prim` #C1358F), aksen kuning hanya untuk item navigasi aktif (`navSelected` #F7CA3A), permukaan putih, sudut membulat 14 sampai 26.
2. **Tombol utama memakai navy** (`PrimaryBtn`, `TealDeep`), bukan near-black. `AccentBtn` pink hanya untuk satu aksi paling utama per layar.
3. **Radius mengikuti `CuciinShape`**, bukan angka bebas: tombol 14, kartu 20, lencana 14, pil 9999.
4. **Target sentuh minimum 44dp.** Tombol kembali, `SelectChip`, dan tombol tambah cabang sudah dinaikkan; jangan dikembalikan ke 40dp.
5. **Daftar panjang memakai `ListCard` + `ListRow` + `RowDivider`**, bukan tumpukan `CardBlock`. Cabang, user, dan riwayat aktivitas sudah memakai pola ini.
6. **Semua pasangan warna wajib lolos WCAG.** Pink asli gagal sebagai teks kecil; teks kecil memakai `TealDeep` navy atau `primDeep`. Jalankan `contrast-check.py` setelah mengubah palet.
7. **Metadata minimum 12sp dan tanpa all-caps.** `Chip` dan `Eyebrow` tidak lagi mengubah teks menjadi huruf kapital.
8. **Nama menu pengguna adalah "Daftar User"** dan menampilkan Owner, Kasir, serta SPV dengan pencarian dan penyaring peran.


## 1. Titik berangkat yang sudah diverifikasi

| Hal | Nilai | Cara cek |
|---|---|---|
| Repo lokal | `/Users/tiftazani/Documents/ChatGPT/Laundry/Cursor-Tifz` | satu-satunya clone; `~/Cursor-Tifz` bukan clone repo ini |
| Branch | `codex/cuciin-1-8-1` | `git status -sb` |
| Android | **1.10.30 (versionCode 49)** | `app/build.gradle.kts` |
| Paket aplikasi | `com.cuciin.laundryops` (+ `.debug`) | `app/build.gradle.kts` |
| Firebase project | **`cuciin-ops`** (lama: `cuciin-ops-tiftazani`) | `firebase/README.md` |
| Worker produksi | versi `16f4a825-ab15-4edc-853f-f78fa0363877` (memuat rilis 1.10.30) | `wrangler deployments list` |
| Worker debug | versi `717ddfa4-2fe1-49c3-ab65-1c17e9733a5d` (memuat pekerjaan 1.10.30) | `wrangler deployments list -c wrangler.debug.toml` |
| Health produksi | `ok`, database `ready`, revision 409 (20 Sep 2026) | `curl .../health` |
| Test Worker | 60 lulus | `cd cloudflare && npm run check` |
| Test Android | **267 lulus** (267 debug + 267 rilis), lint 0 error | `./gradlew testDebugUnitTest testReleaseUnitTest lintDebug` |
| Kandidat rilis | `releases/1.10.30-candidate/` | folder + `SHA256SUMS.txt` |
| Data produksi | 4 cabang, 8 akun, 8 nota, 4 role akses | `wrangler d1 execute cuciin-db --remote` |

Angka pada tabel ini berasal dari pengukuran langsung ke produksi dan ke kode pada 20 September 2026.
Tabel versi-versi 1.10.0 sampai 1.10.29 di bagian berikutnya **sengaja dibiarkan apa adanya** sebagai
catatan sejarah; jangan pakai angkanya untuk menyimpulkan keadaan sekarang.

Tabel ini sengaja bisa diperiksa ulang: setiap baris menyebut cara mengeceknya, jadi bila angkanya
berbeda saat diperiksa, yang salah adalah tabel ini — bukan alat pemeriksanya.

## 2. Perpindahan identitas aplikasi (16 September 2026)

Ini perubahan besar yang mengubah banyak hal sekaligus. Ringkasannya:

| Sebelum | Sesudah |
|---|---|
| Paket `com.tiftazani.laundryops` | Paket `com.cuciin.laundryops` |
| Firebase project `cuciin-ops-tiftazani` | Firebase project `cuciin-ops` |
| Domain reset `cuciin-ops-tiftazani.web.app` | Domain reset `cuciin-ops.web.app` |
| Nama Owner `Tiftazani Khara` | Nama Owner `Tiftazani` (Owner kedua memakai `Ustutifa`) |
| Worker menerima 1 project | Worker menerima **2 project** selama peralihan |

Yang **tidak** berubah: Worker URL, D1, skema database, signing key, dan seluruh data operasional.

Konsekuensi yang wajib diketahui siapa pun yang menyentuh repo ini:

1. **APK baru tidak menimpa APK lama.** Paket berbeda berarti aplikasi berbeda di mata Android. Versi lama tetap terpasang dan harus dicopot manual.
2. **Data lokal tidak berpindah.** Foto absensi, cache, dan outbox versi lama tetap di aplikasi lama.
3. **Jangan hapus project lama dari `FIREBASE_PROJECT_IDS`** sampai seluruh perangkat 20 cabang sudah pindah. Menghapusnya terlalu cepat akan memutus HP yang belum diperbarui.
4. **Konfigurasi Firebase API punya quirk.** Endpoint `config` selalu mengembalikan app pertama untuk semua permintaan, jadi konfigurasi app debug disusun manual dari `mobilesdk_app_id` yang sebenarnya. Rinciannya di `firebase/README.md`.

## 3. Klaim file (berlaku sampai handover berikutnya)

Aturan: satu file satu pemilik. Kalau butuh mengubah file milik agent lain, minta lewat chat/PR, jangan edit langsung.

### Pegangan Hermes (selesai 16 Sep 10:35, sudah di-commit lokal)

```
laundry-ops/cloudflare/src/index.ts              (FIREBASE_PROJECT_IDS + firebaseProjectIds)
laundry-ops/cloudflare/wrangler.toml             (dua project selama peralihan)
laundry-ops/cloudflare/tests/firebase-project-migration.test.mjs   (baru, 6 test)
laundry-ops/cloudflare/README.md
laundry-ops/firebase/README.md
laundry-ops/firebase/.firebaserc
laundry-ops/android/app/build.gradle.kts         (paket, versi 1.10.0)
laundry-ops/android/app/proguard-rules.pro
laundry-ops/android/app/google-services.json.example
laundry-ops/android/CHANGELOG.md
laundry-ops/android/RELEASE_READINESS.md
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/CuciinStore.kt   (nama Owner)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/VersionHistory.kt
laundry-ops/releases/1.10.0-candidate/           (baru)
laundry-ops/releases/cuciin-release.apk
laundry-ops/releases/cuciin-debug.apk
laundry-ops/README.md
laundry-ops/AGENT_STATUS.md                      (dokumen ini)
```

Skrip migrasi dan backup ada di luar repo: `~/Documents/ChatGPT/Laundry/cuciin-theme-mockup/` dan `~/Documents/ChatGPT/Laundry/firebase-migration/`.

### Pegangan Codex (area UI/rilis)

```
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/**
laundry-ops/android/app/src/test/java/com/cuciin/laundryops/ui/**
laundry-ops/android/app/src/main/res/**
```

Hermes tidak menyentuh area itu pada pekerjaan ini kecuali dua baris nama Owner di `CuciinStore.kt` dan `VersionHistory.kt`.

### Pegangan bersama — jangan disunting tanpa bicara dulu

```
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/CuciinStore.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/Models.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/SyncProtocol.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/data/ReceiptText.kt
laundry-ops/cloudflare/src/command-sync.ts
laundry-ops/cloudflare/src/index.ts
laundry-ops/cloudflare/SYNC_API.md
```

File-file itu menyimpan aturan uang, stok, komisi, otorisasi, dan protokol sinkronisasi. Perubahan di sana wajib lewat review dan test, bukan suntingan cepat.

## 4. Yang masih kurang

1. **Seluruh perangkat 20 cabang belum pindah ke paket baru.** Setelah semua pindah, `cuciin-ops-tiftazani` boleh dihapus dari `FIREBASE_PROJECT_IDS` lalu project lama dinonaktifkan.
2. **APK lama tidak bisa lagi menulis ke server.** Sejak jurnal command aktif, PUT snapshot ditolak 426 untuk pengguna biasa, jadi APK 1.8.1 hanya bisa membaca. Perangkat lama harus dicopot setelah 1.10.0 dipasang.
3. **Data lokal perangkat yang sudah terpasang tidak ikut berubah.** Seed 4 cabang dan 6 kasir hanya berlaku untuk instalasi bersih; perangkat yang sudah menyimpan snapshot lama akan menerima data server saat sinkronisasi. Migrasi seed berversi belum dibuat.
4. **Nama "tiftazani" masih ada di tiga tempat yang terkunci eksternal** dan tidak bisa diubah tanpa biaya besar:
   - URL Worker `cuciin-api.tiftazani-cuciin.workers.dev` (subdomain akun Cloudflare)
   - Repo GitHub `tiftazani/Cursor-Tifz`
   - Email Owner `tiftazani.khara@gmail.com` (dipertahankan atas permintaan Owner)
5. **Isi template email reset** masih bawaan Firebase (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`).
6. **PR #18 sampai #21 sudah MERGED**, jadi catatan lama "masih terbuka" sudah tidak berlaku.
   Meski begitu `main` masih tertinggal **37 commit** dari `codex/cuciin-1-8-1`: `main` berhenti di
   versionCode 43 / 1.10.24, sedangkan branch kerja sudah 1.10.30 / 49. Perlu PR baru supaya `main`
   memuat 1.10.25 sampai 1.10.30 (keputusan Owner).
7. **Kata sandi awal `test1234`** wajib diubah semua akun sebelum data nyata dipakai.
8. **State loading dan error di layar data belum lengkap.** Beranda dan riwayat aktivitas sudah menampilkan `SyncNotice` saat server belum terhubung, tetapi layar lain belum. Hanya layar masuk yang punya indikator proses panjang.
9. **Sebagian daftar sudah jadi baris.** Pelanggan, layanan, produk, aset, biaya, persediaan, riwayat stok, riwayat WA, dan ringkasan petugas laporan sudah memakai `ListCard` + `ListRow`. Tabel laporan keuangan diganti kartu bertingkat per Service supaya terbaca di layar sempit.
10. **Alamat lengkap Shelly belum ada**, jadi kolom alamat dan tautan peta cabang itu masih kosong.
11. **Backup pascamigrasi sudah dibuat** di `firebase-migration/backup-d1/post-migration-rev286-20260916.sql` (revision 286, 4 cabang, 8 akun, integrity ok). Backup lama `pre-real-data-20260916.sql` adalah kondisi sebelum migrasi dan tidak bisa direstore sendirian.
    **Koreksi 20 Sep:** kedua berkas itu **sudah tidak ada** di disk maupun di Git — folder `firebase-migration/backup-d1/` tidak lagi ada di repo. Catatan ini disimpan sebagai riwayat; jangan dicari. Yang benar-benar bisa dipakai sekarang adalah workflow `cuciin-backup`, dan workflow itu **belum pernah dijalankan sekali pun** (`gh run list --workflow=cuciin-backup.yml` kosong), sedangkan folder `backups/` dibuat oleh `.gitignore`. Artinya data produksi saat ini **tanpa backup terverifikasi**. Jalankan `cuciin-backup` secara manual sebelum menyentuh data produksi.
    **Alur backup sudah diuji 20 Sep dan terbukti bekerja:** `npx wrangler d1 export cuciin-db --remote`
    menghasilkan 1.258 baris SQL / 26 tabel, enkripsi `openssl aes-256-cbc -pbkdf2 -iter 600000`
    menghasilkan berkas biner yang nol tabel terbaca tanpa kunci, dan `verify-backup.sh` melaporkan
    `OK` beserta lulus `integrity_check`. Yang belum ada hanyalah passphrase asli; itu milik Owner
    (diatur sebagai `CUCIIN_BACKUP_PASSPHRASE`) dan tidak disimpan di repo. Seluruh berkas uji berisi
    data produksi sudah dihapus setelah pengujian.

## 5. Urutan kerja yang disarankan

1. Merge PR ke `main` supaya `main` memuat 1.10.0 (keputusan Owner).
2. Pilot 1.10.0 di dua perangkat, cocokkan laporan dengan server.
3. Setelah pilot bersih, distribusikan ke 20 cabang dan copot APK lama dari tiap perangkat.
4. Setelah seluruh perangkat melapor versi 1.10.0, hapus project lama dari `FIREBASE_PROJECT_IDS`, deploy Worker, lalu nonaktifkan project Firebase lama.

## 6. Lingkungan build di mesin ini

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export CUCIIN_SIGNING_PROPERTIES=/Users/tiftazani/Documents/ChatGPT/Laundry/signing-private/cuciin-signing.properties
cd laundry-ops/android && ./gradlew testDebugUnitTest lintDebug assembleDebug
```

`android/local.properties` sudah diisi `sdk.dir=/opt/homebrew/share/android-commandlinetools` (di-gitignore, jangan di-commit). Node 26.7.0 dan npm 11.19.0 tersedia untuk `npm run check`. Wrangler 4.131.1 sudah terautentikasi.

Catatan: macOS di mesin ini tidak punya `timeout`/`gtimeout`. Jangan pakai perintah itu untuk membatasi proses panjang.
