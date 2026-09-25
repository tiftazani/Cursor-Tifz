# Papan status & klaim file antar-agent

Terakhir diperbarui: 25 September 2026 (oleh Hermes).
Baca bersama `AGENT_HANDOVER.md`, `AGENT_WORKFLOW.md`, dan `CODING_AGENT_CONTEXT.md`.

Tujuan dokumen ini: satu tempat untuk melihat **siapa memegang file apa** dan **sampai mana pekerjaan berjalan**, supaya Hermes, Codex, Cursor, dan OpenCode tidak menyunting berkas yang sama.

**Keadaan `main` per 25 Sep: `0c3938f`** (rilis 1.10.39, sudah di-push ke `origin/main`).

| Commit | Isi |
| --- | --- |
| `0c3938f` | Rilis 1.10.39: layar Tambah user kini membuat akun login Firebase |
| `dee4ec8` | Dokumen rilis 1.10.38: versi Worker terbaru dan tes dedupe jurnal |
| `f63b779` | Rilis 1.10.38: absensi per cabang untuk kasir multi-cabang |
| `2f7438d` | Papan status: rilis 1.10.37 dan akar masalah hak akses peran |
| `444f57f` | Rilis 1.10.37: penyamaan hak akses memakai endpoint `/v1/snapshot` |

## 0r. Perbaikan DARURAT: beberapa akun tidak bisa login (25 Sep, Hermes)

**Status: SELESAI. Data produksi diperbaiki dan diverifikasi; kode diperbaiki dengan tes penjaga
yang dibuktikan merah lebih dulu; 1.10.39 dibangun dan terpasang di emulator. Sudah di `main`
(`0c3938f`).**

Laporan operasi lewat WhatsApp: beberapa kasir tidak bisa masuk, pesan `Email atau kata sandi tidak
sesuai.`, padahal kata sandinya belum pernah diganti. Tangkapan layar menyebut
`ihsanibnuabdurrauf@gmail.com`.

**Akar masalahnya BUKAN kata sandi.** Login aplikasi diverifikasi Firebase Auth, sedangkan daftar
pengguna hanya baris data di D1. Dua jalur pembuatan akun berbeda:

| Jalur | Akun Firebase | Baris D1 |
| --- | --- | --- |
| Layar **Daftar** (mandiri) | dibuat | dibuat |
| Layar **Daftar User → Tambah user** (Owner) | **TIDAK dibuat** | dibuat |

Kasir yang ditambahkan Owner lewat layar Tambah user karena itu tidak pernah punya akun login.
Barisnya rapi di daftar user dan sandinya benar, tetapi Firebase tidak mengenal emailnya.

**Lima kasir terdampak** (semua `firebase_uid` kosong di produksi):

| Kasir | Ditambahkan | Cabang |
| --- | --- | --- |
| alfin (`alfinhumendru@gmail.com`) | 24 Sep 13:22 WIB | bunayya, laupay-dayeuh, laupay-kirab |
| febri (`febriansyah.atmaja98@gmail.com`) | 24 Sep 13:58 WIB | laupay-kirab, shelly |
| ihsan (`ihsanibnuabdurrauf@gmail.com`) | 24 Sep 13:24 WIB | bunayya, laupay-dayeuh, laupay-kirab, shelly |
| Bu rohma (`rochnatillah22@gmail.com`) | 24 Sep 13:21 WIB | shelly |
| Nabila (`tsanaulaila78@gmail.com`) | 25 Sep 09:38 WIB | shelly |

Semuanya ditambahkan Owner `us.archuleta1207@gmail.com`. Enam kasir lain yang dibuat lewat layar
Daftar tidak terpengaruh.

**Perbaikan kode:** `LoginProvision` (baru) memisahkan aturan pembuatan akun login supaya bisa
diuji; `FirebaseCloud.provisionLoginAccount()` membuat akun lewat instance Firebase kedua supaya
sesi Owner tidak ikut keluar; `UsersScreen` memanggilnya setelah baris pengguna tersimpan. Sandi di
bawah 6 karakter ditolak sebelum baris disimpan.

**Perbaikan data:** akun login lima kasir dibuatkan lewat skrip
(`cloudflare/scripts/fix_akun_firebase.py`) dan diverifikasi dengan
`cloudflare/scripts/verifikasi_akun.py`. Hasil: **12 akun bisa masuk, 0 gagal**, semuanya diterima
`/v1/me` dengan peran dan cabang yang benar.

**Bukti perangkat:** emulator `emulator-5554`, APK `1.10.39-debug` (versionCode 58).
`ihsanibnuabdurrauf@gmail.com` masuk sampai Beranda dan Profil (peran Kasir); alfin juga masuk
dengan 2 cabang. Tangkapan layar di `releases/1.10.39-candidate/bukti/`.

**Uji ulang end-to-end 25 Sep 15:15 WIB (build 1.10.39, emulator):** Owner `us.archuleta1207@gmail.com`
masuk, lalu **menambah user baru dari layar Daftar User** (`ujifix.hermes@gmail.com`, Kasir, cabang
Laupay Kirab). Log perangkat mencatat `Creating user with ujifix.hermes@gmail.com` pada app
`cuciin-provision` — akun login dibuat otomatis. Hasil uji: akun itu **langsung bisa masuk** dan
diterima `/v1/me` 200 dengan peran dan cabang yang benar. Edit berikutnya (ganti cabang ke Bunayya)
juga sampai ke server: jurnal `#1036 staff/delete` + `#1037 staff/upsert` oleh Owner, dan baris
`staff_branches` ikut berubah. Data uji (`ujifix.hermes@gmail.com`, `ujilogin.hermes@gmail.com`,
`daftarmandiri.hermes@gmail.com`) sudah dihapus kembali dari D1 debug dan Firebase.

**Uji ulang 12 akun produksi 25 Sep 15:00 WIB:** 12 dari 12 bisa masuk, 0 gagal; `ihsan` diterima
`/v1/me` 200 dengan 4 cabang. Bandingkan D1 produksi vs Firebase: **tidak ada staf tanpa akun login**.

**Catatan penting soal HP Owner:** HP Owner masih memakai versi lama yang belum punya
`LoginProvision`, jadi akun yang dia tambah **sebelum** APK 1.10.39 terpasang tetap tidak akan bisa
masuk. Kasus Nabila (`tsanaulaila78@gmail.com`) membuktikannya: barisnya ditambah dari HP Owner
25 Sep 09:38 WIB, tetapi akun Firebase-nya baru ada 12:17 WIB lewat skrip perbaikan, bukan lewat
aplikasi. **Tindakan yang dibutuhkan: pasang APK 1.10.39 di HP Owner.** Berkas siap di
`releases/1.10.39-candidate/cuciin-1.10.39-release.apk` (tanda tangan `CN=Tiftazani Khara, OU=Cuciin`,
versionCode 58) dan salinannya di `~/Downloads/Cuciin-1.10.39-release.apk`.

**Belum terbukti:** pasang 1.10.39 di HP cabang/HP Owner yang asli dan buat user baru dari sana;
pembaruan APK dari jarak jauh belum ada fiturnya, jadi pemasangan harus manual.

**Skrip baru yang bisa dipakai ulang** (semuanya di `cloudflare/scripts/`):

- `cek_akun_vs_firebase.py` — membandingkan daftar staf D1 dengan akun Firebase; menemukan akun
  yang ada di daftar tetapi tidak bisa login.
- `fix_akun_firebase.py` — membuat akun login yang hilang dengan sandi awal aplikasi.
- `verifikasi_akun.py` — memeriksa seluruh staf bisa masuk dan diterima server.

Catatan: skrip Python diblokir Cloudflare dengan `403 error code: 1010` bila memakai User-Agent
bawaan Python. Pakai User-Agent mirip aplikasi Android (`okhttp/4.12.0`); Worker sendiri tidak
membatasi User-Agent.

## 0q. Perbaikan: kasir multi-cabang hanya bisa absen di satu cabang (24 Sep, Hermes)

**Status: SELESAI di kode dan server, TERUJI, sudah di `main` (`f63b779`). BELUM dibuktikan dengan absen nyata di HP cabang.**

Laporan lapangan: Aida (`aidanurita25@gmail.com`) ditugaskan ke dua cabang, tetapi di layar Absensi
hanya muncul Bunayya dan absen di cabang kedua selalu ditolak. Pemeriksaan D1 produksi menunjukkan
**empat kasir terdampak**, bukan hanya Aida:

| Kasir | Cabang penugasan |
| --- | --- |
| Aida (`aidanurita25@gmail.com`) | laupay-kirab, bunayya |
| alfin (`alfinhumendru@gmail.com`) | laupay-dayeuh, laupay-kirab, bunayya |
| febri (`febriansyah.atmaja98@gmail.com`) | laupay-kirab, shelly |
| ihsan (`ihsanibnuabdurrauf@gmail.com`) | bunayya, laupay-dayeuh, laupay-kirab, shelly |

**Akar masalah ada di aplikasi, bukan di data.** `Session` hanya menyimpan satu `branchId`, yaitu
cabang pertama penugasan, dan seluruh layar menyaring dengan `it.id == session.branchId`. `checkOut`
juga menutup baris pertama hari itu tanpa melihat cabang, sehingga absen pulang di cabang kedua
justru menutup catatan cabang pertama.

**Lubang kedua yang ditemukan saat perbaikan:** sesi yang sudah login tidak pernah disegarkan saat
daftar cabang berubah di server. Aida ditambahkan Owner ke cabang kedua 24 Sep 13:19 WIB, tetapi
sesi yang sudah terbuka tetap memegang satu cabang sampai aplikasi dimulai ulang.

**Perbaikan:** `Session` menyimpan seluruh `branchIds`; aturan absensi dipindah ke `AttendanceScope`
dan penyegaran sesi ke `SessionScope` (keduanya baru, bisa diuji tanpa layar); `checkIn`/`checkOut`/
`todayAttendance` menerima cabang eksplisit; migrasi `0009_attendance_per_branch.sql` mengganti
`UNIQUE(staff_email, work_date)` menjadi `UNIQUE(staff_email, work_date, branch_id)`. Penulisan
absensi di Worker menjaga **dua** kunci unik sekaligus agar perangkat versi lama yang masih mengirim
id acak tetap diterima, bukan ditolak 409 lalu antreannya macet.

Layar lain yang sebelumnya juga terkurung satu cabang ikut diperbaiki: Nota, Biaya, Aset, Kas,
Persediaan, dan Riwayat mutasi stok.

**Bukti:**

- Android **313 tes lulus**, 0 gagal, di varian debug dan release.
- `AttendanceMultiBranchTest` — **6 merah** saat aturan lama dipasang kembali.
- `SessionBranchRefreshTest` — **4 merah** saat penyegaran sesi dimatikan.
- Worker **77 tes lulus**; tes "absensi satu karyawan dicatat per cabang" merah saat migrasi 0009
  dikeluarkan dari daftar migrasi harness, dan tes dedupe jurnal merah sebelum perbaikan (2 !== 1).
- Migrasi diterapkan ke D1 produksi `cuciin-db`. Kunci `UNIQUE (staff_email, work_date, branch_id)`
  diverifikasi langsung pada `sqlite_master`. Tabel `attendance` produksi berisi **0 baris** saat
  migrasi jalan, jadi tidak ada data yang tersentuh.
- Worker ter-deploy: `2f033fb6-096d-44df-a965-90c52e7bb4f3`, `/health` menjawab 200.

**Belum terbukti:** absen nyata dua cabang oleh kasir asli di HP cabang. Verifikasi emulator
tertahan di layar login karena sandi tidak dipakai dari chat. Migrasi pada perangkat 1.10.37 asli
juga belum diuji langsung; jalur kompatibilitasnya baru diuji di harness Worker.

## 0p. Perbaikan: perubahan peran dari server tidak pernah sampai ke perangkat (22 Sep, Hermes)

**Status: SELESAI, TERUJI, sudah di `main` (`444f57f`). Belum dibuktikan di emulator untuk APK 1.10.37.**

Akar masalahnya di `CloudSync.kt`, fungsi `hakAksesDariServer()`:

```kotlin
val conn = open("GET")   // tanpa argumen path -> alamat dasar Worker
```

Worker tidak punya rute di akar (`/`), jadi permintaan selalu dijawab 404. `runCatching` menelan
kegagalannya, fungsi mengembalikan `null`, dan `samakanHakAkses` **tidak pernah berjalan** pada
perangkat yang sudah `bootstrapped`. Akibatnya: peran yang sudah diubah di server tetap tampil
lama di HP, dan akun yang sudah dihapus tetap muncul di layar Daftar User.

**Bukti sebelum perbaikan (21 Sep, 1.10.36-debug):** `aidanurita25@gmail.com` masih tampil
"Aida · SPV" di HP, sementara D1 sudah menyimpannya sebagai `Kasir`.

**Perbaikan:** satu baris, `open("GET", apiUrl("/v1/snapshot"))`.

**Bukti sesudah perbaikan:** setelah data aplikasi dibersihkan dan akun masuk ulang di emulator,
peran Aida tampil **Kasir** — dikonfirmasi Owner 22 Sep.

**Tes penjaga.** `SnapshotPrivilegeEndpointTest.kt`, 2 tes. Terbukti **merah saat perbaikan
dikembalikan** ke `open("GET")` (2 gagal), hijau saat dipulihkan (2 lulus).

**Gate.** `testDebugUnitTest` 290/0/0, `testReleaseUnitTest` 290/0/0, `lintRelease` 0 error
(18 warning), `verify_release.py` PASS. Sertifikat rilis tidak berubah
(`3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`).

**Artefak.** `laundry-ops/releases/1.10.37-candidate/` (APK rilis, APK debug, AAB, SHA256SUMS,
README) + salinan akar `releases/cuciin-release.apk` dan `releases/cuciin-debug.apk`, hash identik.

**Yang belum dibuktikan:** APK 1.10.37 belum dipasang ulang di emulator (emulator mati saat
verifikasi). Yang terbukti adalah 1.10.36-debug dengan perbaikan yang sama.


Yang **sudah** hidup: workflow mirror D1 berjadwal `0 18 * * *` (01:00 WIB) — terbukti
`completed/success` di `main`, cadangan `cuciin-backup-db` terisi 8 staff / 26 tabel.
Worker produksi **sudah** memuat perbaikan login: versi `5ec0843c-714a-4ca1-bbe3-1294f774df21`
(di-deploy 21 Sep 10:41 UTC), terbukti lewat log `wrangler tail` dan `/v1/me` 200 untuk akun
ber-`firebase_uid` NULL.

**Kuota tulis D1 masih jadi batas nyata.** Per 21 Sep: 126.199 baris tulis, didominasi
`INSERT OR IGNORE INTO processed_commands` (167.226 tulis / 55.742 kali, dari pengiriman ulang
antrean perangkat). Selama kuota habis, transaksi kasir gagal tersimpan ke server dan menumpuk di
antrean lokal perangkat sampai kuota pulih 07:00 WIB. Perbaikan `0o` hanya membuat **login** tetap
jalan; ia tidak menambah kuota.

## 0o. Perbaikan: login gagal 500 saat kuota tulis D1 habis (21 Sep, Hermes)

**Status: SELESAI dan TERBUKTI DI PRODUKSI.** Worker produksi sudah di-deploy `5ec0843c-714a-4ca1-bbe3-1294f774df21`.

Bagian `0m` di bawah menyimpulkan kegagalan login ini "bukan bug aplikasi". **Kesimpulan itu salah**
dan sudah dikoreksi di sini. Kuota habis memang pemicunya, tetapi yang mengubahnya jadi 500 adalah cacat
nyata di kode Worker: satu `UPDATE` kecil yang kegagalannya dibiarkan menjalar ke atas.

Akar tepatnya, `cloudflare/src/index.ts` baris 94 saat itu:

```ts
if (staff) await env.DB.prepare("UPDATE staff SET firebase_uid=? WHERE email=? AND firebase_uid IS NULL")...
```

Ini dijalankan hanya saat login **pertama** (baris staff belum punya `firebase_uid`). Cloudflare menolak
tulis itu (`code: 7500`), exception naik ke `authorize()`, Worker menjawab **500 code 1101**, dan app
menerjemahkannya jadi "Server identitas belum tersedia". Login kedua dan seterusnya berhasil karena tidak
butuh tulis, sehingga gejalanya tampak seperti "akun Owner rusak" padahal servernya yang menutup pintu.

**Perbaikan.** `authorize()` dipecah menjadi `resolveStaff()` dan `linkFirebaseUid()`.
`linkFirebaseUid()` menyerap kegagalan tulis dan melaporkannya lewat nilai balik, bukan exception.
Pencarian lewat email sudah membuktikan identitasnya sah, jadi login tetap dilanjutkan dan penyambungan
`firebase_uid` diulang pada login berikutnya. Akun yang tidak terdaftar tetap ditolak.

**Bukti di produksi (log Worker, `wrangler tail`, saat kuota tulis memang habis):**

```
[warn]  'Gagal menyambungkan firebase_uid, login tetap dilanjutkan'
        Error: D1_ERROR: exceeded D1's free tier daily row write limit
outcome=ok                      <- permintaan TETAP sukses
/v1/me -> HTTP 200  {"role":"Owner","branchIds":[4 cabang]}
```

String `Gagal menyambungkan firebase_uid` hanya ada di kode baru, jadi log ini membuktikan versi
`5ec0843c` benar-benar yang melayani. Dua akun ber-`firebase_uid` NULL (Owner kedua) lolos `/v1/me` 200
lewat REST **dan** lewat app di emulator (masuk ke layar Antrian laundry).

**Bukti tes.** `cloudflare/tests/login-quota.test.mjs`, 5 tes, terbukti **merah saat perbaikan dikembalikan**:

```
perbaikan aktif        -> 5 lulus, 0 gagal
perbaikan dikembalikan -> 2 lulus, 3 gagal   <- MERAH
perbaikan dipulihkan   -> 5 lulus, 0 gagal
```

Gate Worker naik dari 64 ke **69 tes, 0 gagal**, `tsc --noEmit` bersih. Commit `efafa45`, CI
`Cuciin Cloudflare validation` hijau.

**Pelajaran yang berlaku untuk kode Worker berikutnya:** jangan pernah membiarkan operasi tulis yang
sifatnya opsional (percepatan, cache, penanda) bisa menggagalkan seluruh permintaan. Kuota D1 free tier
100.000 tulis/hari **per akun** dan bisa habis kapan saja, termasuk karena pekerjaan agen sendiri.
Tulis opsional harus dibungkus, dan keputusan sah/tidaknya pemakai diambil dari baca.

**Yang TIDAK diperbaiki oleh ini:** saat kuota tulis habis, **transaksi kasir tetap gagal tersimpan ke
server** (`command_retryable` muncul di log dengan `7500`). Antrean lokal perangkat menahannya, jadi
tidak ada data hilang, dan terkirim saat kuota pulih 07:00 WIB. Ini batas free tier, bukan bug.

## 0n. Keadaan lingkungan 21 Sep 2026 (baca ini sebelum menilai apa pun)

Papan ini sempat salah melaporkan pada hari yang sama, jadi angka di bawah diukur, bukan dikutip.

| Hal | Nilai nyata | Cara mengecek ulang |
| --- | --- | --- |
| Versi aplikasi | `1.10.35` / `versionCode 54` | `grep versionName laundry-ops/android/app/build.gradle.kts` |
| Sumber versi (3) | `build.gradle.kts`, `data/VersionHistory.kt`, `android/CHANGELOG.md` — ketiganya `1.10.35`, sinkron | `grep 1.10 laundry-ops/android/CHANGELOG.md` (letaknya di `android/`, BUKAN di akar `laundry-ops/`) |
| Gate Android | 288 debug + 288 release = 576, 0 gagal, lint bersih | `./gradlew clean testDebugUnitTest testReleaseUnitTest lintDebug`, baca `app/build/test-results/*/*.xml` |
| Gate Worker | 69/69 lulus | `cd laundry-ops/cloudflare && npm run check` |
| Worker produksi | `fd21cc8c-6f4b-4d47-b392-38fdf9b3f890` | `npx wrangler deployments list --name cuciin-api` |
| `/health` | 200, `revision: 0` | `curl -s https://cuciin-api.tiftazani-cuciin.workers.dev/health` |
| Tanda tangan rilis | `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee` (TIDAK berubah) | `apksigner verify --print-certs <apk>` |
| Kandidat rilis | `releases/1.10.36-candidate/` — APK + APK debug + AAB + README + SHA256SUMS, ketiganya `OK`, `verify_release.py` PASS | `shasum -a 256 -c SHA256SUMS.txt` |
| Kuota tulis D1 | **habis lagi** per 21 Sep (126.199 baris tulis; batas 100.000/hari). Reset 2026-09-22 00:00 UTC (07:00 WIB) | `INSERT` ke tabel probe; `code: 7500` berarti habis |

**Dua hal yang sempat salah dilaporkan pada 21 Sep, beserta koreksinya:**

1. `CHANGELOG.md` dan AAB pernah dilaporkan "hilang". Keduanya **ada**: CHANGELOG di `laundry-ops/android/CHANGELOG.md`, AAB di `releases/1.10.35-candidate/cuciin-1.10.35-release.aab`. Kesalahannya mencari di akar `laundry-ops/`. Sebelum menyatakan sesuatu hilang, cari dengan `find . -iname` lebih dulu.
2. `SHA256SUMS.txt` di akar `releases/` memang **benar-benar basi** (ditulis 00:12, APK diganti 01:21) sehingga `shasum -c` berbunyi `FAILED`. Sudah dihitung ulang di commit `511075f`.

## 0l. Bug: data transaksi tetap tampil di perangkat setelah server dibersihkan

**Status: diperbaiki, teruji, dan sudah dipasang di produksi. Terbukti di perangkat.**

Keluhan Owner setelah pembersihan D1: aplikasi rilis **masih** menampilkan transaksi dan data
keuangan (Laporan transaksi: 7 Service, Rp 251.000) dan masih ada di emulator. Data di server
sudah 0, jadi ini **bukan sisa data** — ini bug jalur baca.

### Akar masalah

`materializedSnapshot()` di `cloudflare/src/index.ts` membangun snapshot dari `{}` ketika baris
`sync_snapshots` tidak ada:

```ts
let snapshot = stored ? withoutLocalCredentials(JSON.parse(stored.payload_json)) : {};
```

Akibatnya `snapshot.updatedAt` tidak pernah ada, dan `num(snapshot,"updatedAt")` mengembalikan
`0`. Di perangkat, `CuciinStore.applyCloud()` menolak snapshot yang lebih tua daripada state
lokal:

```kotlin
if (s.updatedAt < localUpdatedAt && !CloudSync.hasPreparedRemote()) return
```

Perangkat memegang `localUpdatedAt` dari transaksi terakhir, jadi snapshot `updatedAt = 0`
**dibuang** dan data lama di perangkat tidak pernah terhapus. Jalur tulis (`putSnapshot`) tidak
kena karena menulis `snapshot.updatedAt = revision`; hanya jalur baca yang cacat.

Ini muncul justru karena pembersihan sebelumnya **benar**: menghapus `sync_changes` dan
`sync_snapshots` menghilangkan satu-satunya sumber `updatedAt`. Selama jurnal masih ada,
`applyJournalToSnapshot` mengisi `updatedAt` dari `change.updated_at`.

### Perbaikan

`materializedSnapshot` mengisi `updatedAt` bila kosong, memakai `Date.now()`. Memakai `revision`
tidak cukup: saat jurnal dan baris snapshot sama-sama kosong, `revision` juga 0 sehingga
`updatedAt` tetap 0. Bug ini ditemukan oleh tes penjaga sendiri, bukan dari penalaran.

### Bukti

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run check` | tsc bersih, validasi skema lolos, **64/64 tes lulus** (61 lama + 3 baru) |
| Tes penjaga | `cloudflare/tests/snapshot-freshness.test.mjs` |
| Bukti merah | perbaikan dibalik: **2 dari 3 tes MERAH**; dipulihkan: hijau |
| Deploy produksi | Worker `cuciin-api` versi `fd21cc8c-6f4b-4d47-b392-38fdf9b3f890` |
| `/health` | 200, `database: ready`, `revision: 0` |
| Perangkat, Antrian laundry | Sedang dikerjakan **0**, Cucian telat **0**, Selesai **0**, "Tidak ada cucian dikerjakan" |
| Perangkat, Biaya operasional | Total biaya cabang **Rp 0**, "0 transaksi biaya", "Belum ada biaya" |

Uji perangkat memakai APK rilis 1.10.35 setelah `pm clear` lalu login Kasir, sehingga snapshot
ditarik dari Worker yang sudah diperbaiki. D1 produksi diperiksa ulang sesudahnya: tetap bersih
(`orders` 0, `expenses` 0, `payments` 0, `processed_commands` 0), artinya sinkronisasi tidak
menghidupkan kembali data lama.

**Efek yang masih perlu diuji Owner:** perangkat cabang yang sudah lama terpasang **belum** tentu
tertarik snapshot baru ini sampai aplikasi dibuka dan sinkronisasi berjalan. Perangkat yang masih
memegang outbox lama akan mengirim ulang command-nya karena `processed_commands` kosong, dan
command itu diterima sebagai baru.

## 0m. Login rilis gagal 500: kuota tulis D1 free tier habis (bukan bug aplikasi)

> **KOREKSI (21 Sep malam):** judul dan kesimpulan bagian ini **salah**. Kuota habis memang pemicunya,
> tetapi yang mengubahnya jadi 500 adalah cacat nyata di kode Worker. Sudah diperbaiki dan teruji —
> lihat bagian `0o` di atas. Bagian ini dibiarkan utuh sebagai catatan bagaimana kesimpulan pertama
> keliru: kesimpulan itu berhenti di "kuota habis" tanpa menanyakan mengapa kuota habis bisa mematikan
> login yang identitasnya sudah terbukti sah.

**Status: akar ditemukan dan dibuktikan. Menunggu reset kuota, tidak ada perbaikan kode yang diperlukan.**

Gejala: app rilis 1.10.35 menampilkan "Server identitas belum tersedia (500)" pada semua percobaan login, termasuk akun Owner.

Bukti langsung:

```
npx wrangler d1 execute cuciin-db --remote --command "INSERT ..."
→ code: 7500
  "Your account has exceeded D1's free tier daily row write limit.
   Upgrade to a paid plan or wait until tomorrow (midnight UTC)"
```

Email Cloudflare (diterima user bersamaan): operasi **"Rows written"**, limit **100.000**/hari, reset **2026-09-22 00:00:00 UTC** (07:00 WIB). Kalimat resminya: *"D1 row write requests will return errors until the limit resets. Your stored data is not affected."*

Kenapa jadi 500 di login: `/health` tetap **200** (`{"ok":true,"database":"ready","revision":0}`) karena ia hanya membaca. Login menulis (baris sesi/`processed_commands`), jadi Worker mengembalikan 500 dan app menerjemahkannya jadi pesan identitas.

Bukan bug app maupun Worker: baca hidup, tulis mati. Kuota habis tersedot oleh pekerjaan hari itu — pembersihan 50.623 baris, uji perangkat, sapu peran, puluhan putaran tes.

Keadaan data saat kuota habis (dibaca, bukan ditulis): `staff` 8, `staff_branches` 14, `branches` 4, `access_roles` 3, `organizations` 1; seluruh tabel transaksi, keuangan, jurnal, dan command **0**. Tidak ada sisa sampah uji yang perlu dibereskan saat kuota pulih — begitu reset, tulis jalan sendiri.

Tindakan yang dihindari: menyalakan Workers Paid ($5/bulan) tanpa persetujuan. Bila nanti login sering menyentuh limit ini di operasi normal 20 cabang, itu tanda kuota free tier memang tak cukup, dan naik paket jadi keputusan bisnis.

## 0m-2. Penyebab kuota tulis habis sudah dipastikan, dan cadangan D1 kedua dibuat (21 Sep, Hermes)

**Penyebab lonjakan tulis: pekerjaan agen sendiri, bukan aplikasi.** Diukur dari analitik D1
per jam (`d1AnalyticsAdaptiveGroups`, tanggal 21 Sep):

```
00:00Z  tulis=69.779  kueri-tulis=34.749   ← regression test menyeluruh (permintaan user)
02:00Z  tulis=50.640  kueri-tulis=10       ← pembersihan 50.623 baris di ## 0j
04:00Z  tulis=900     kueri-tulis=300
05:00Z  tulis=904     kueri-tulis=302
06:00Z  tulis=900     kueri-tulis=300
07:00Z  tulis=891     kueri-tulis=297
```

Total dua lonjakan = 120.419 baris tulis, sendirian sudah melewati batas 100.000/hari.
Angka 50.640 cocok dengan pembersihan 50.623 baris; selisihnya sisa operasi hari itu.

**Sinkronisasi aplikasi tidak menulis ke D1.** Diukur langsung: 5 siklus penuh
(`/v1/snapshot` + `/v1/sync/changes`) menghasilkan selisih `write_queries_24h` = **0**.
App 60 detik idle tanpa login juga 0. Jadi polling 12 detik hanya membuang kuota **baca**
(5.000.000/hari; terpakai 529.807), bukan kuota tulis.

**Polling tetap diperlambat** dari 12 detik ke 60 detik (`CloudSync.kt`, `poll.postDelayed`).
Alasannya bukan kuota tulis, melainkan baterai dan paket data 20 cabang: 300 permintaan/jam
turun jadi 60. Pengiriman transaksi lokal tetap instan karena `push()` memanggil
`synchronize()` sendiri; polling hanya untuk menarik perubahan cabang lain.

**Cadangan D1 kedua: `cuciin-backup-db`** (`0165ec93-8567-4774-8f80-78e4e604a7da`, region APAC).
Dibuat gratis tanpa kartu kredit, mengisi celah yang dulu mentok di R2/Drive.

- Skrip: `laundry-ops/cloudflare/scripts/mirror-d1.sh` — export produksi lalu impor ke cadangan.
- Workflow: `.github/workflows/cuciin-d1-mirror.yml`, jadwal `0 18 * * *` (**01:00 WIB sekali sehari**,
  keputusan user). Sengaja bukan tiap 6 jam: `wrangler d1 export` mengunci database produksi
  sesaat, dan jadwal 6 jam jatuh di 07:00/13:00/19:00/01:00 WIB — dua di antaranya jam sibuk kasir.
- **Terbukti jalan dua kali berturut-turut** (`exit 0`), mencakup jalur cadangan kosong dan
  jalur cadangan sudah terisi; verifikasi membandingkan jumlah `staff` produksi vs cadangan (8 = 8).
- **Jadwal otomatis belum aktif** sampai workflow ini masuk branch default `main`. Sebelum itu,
  jalankan manual: `bash laundry-ops/cloudflare/scripts/mirror-d1.sh`.

Dua jebakan yang sudah ditangani skrip, jangan dihapus tanpa alasan:

1. `DROP TABLE` pada tabel yang masih dirujuk foreign key gagal dengan
   `no such table: main.staff` dan membatalkan seluruh berkas. Wajib
   `PRAGMA foreign_keys=OFF;` di berkas yang sama dengan pernyataan DROP.
2. Dengan `set -o pipefail`, `grep` yang tidak menemukan hasil mengembalikan kode 1 dan
   menghentikan skrip — padahal "cadangan kosong" itu keadaan sah. Setiap pipeline
   `wrangler ... | grep` diberi `|| true`.

**Batasan yang harus diketahui sebelum mengandalkan mirror ini:**

- `wrangler d1 export` mengunci database produksi sesaat (wrangler memperingatkan sendiri).
  Jangan naikkan frekuensi ke tiap jam; 6 jam sudah cukup dan jadwalnya jatuh di luar jam sibuk.
- Kuota 100.000 tulis/hari berlaku **per akun, bukan per database**. Mengimpor ke cadangan
  ikut memotong kuota produksi. Saat ini murah (50 baris = 50 tulis, 200/hari), tapi begitu
  data transaksi tumbuh, impor penuh 4x sehari bisa memakan kuota yang dibutuhkan kasir.
  Ukur ulang sebelum menganggapnya aman di 20 cabang.
- **Time Travel tetap jaring pengaman terbaik untuk 7 hari terakhir** (gratis, selalu aktif,
  tanpa mengunci DB). Mirror ini untuk yang lebih lama dari 7 hari dan untuk selamat bila
  akun Cloudflare hilang. Keduanya saling melengkapi, bukan saling menggantikan.

### 0j-1. Cadangan sempat KOSONG 25 Sep 2026 — urutan langkah dan urutan tabel

**Status: diperbaiki dan dipulihkan; 5 tes baru mengunci perilakunya.**

Saat memeriksa CI pada 25 Sep 2026 ketemu `cuciin-backup-db` **tanpa satu tabel pun**.
Run mirror 24 Sep 20:58 UTC gagal, dan langkahnya sudah lebih dulu membuang seluruh
tabel cadangan. Jadi bukan cuma gagal menyalin: salinan yang ada ikut hilang.

Dua sebab bertumpuk, keduanya harus diperbaiki bersamaan:

1. **`wrangler d1 export` menulis pernyataan mengikuti urutan tabel di `sqlite_master`,
   bukan urutan ketergantungan.** Di export produksi, `CREATE TABLE products` muncul
   setelah `INSERT INTO services ... product_id`. Impor berhenti dengan
   `no such table: main.products`. Setelah urutan CREATE dibereskan, muncul galat
   berikutnya: `FOREIGN KEY constraint failed`, karena baris induk ditulis setelah
   baris anak. Berkas export membuka dengan `PRAGMA defer_foreign_keys=TRUE`, tetapi
   **D1 tidak menjalankan pragma itu untuk impor berkas**, jadi cek FK tetap per pernyataan.
2. **Urutan langkah skrip terbalik.** Tabel cadangan dibuang dulu, baru impor dijalankan.
   Impor gagal di tengah = cadangan kosong. Galat impor juga disembunyikan
   `>/dev/null 2>&1`, dan verifikasi hanya membandingkan jumlah `staff`, sehingga
   kegagalannya cuma muncul sebagai "tidak terbaca" di antara baris log lain.

Perbaikan yang sekarang ada di repo:

- `cloudflare/scripts/reorder_d1_export.py` — memecah export, membaca ketergantungan FK
  dari tiap `CREATE TABLE`, menyusun tabel secara topologis, menaruh `CREATE INDEX` dan
  `CREATE TRIGGER` di akhir, lalu **membuktikan hasilnya bisa dijalankan ulang** di SQLite
  lokal dengan `foreign_keys=ON`, satu pernyataan per transaksi (paling ketat).
- `mirror-d1.sh` — export diuji SEBELUM cadangan disentuh; isi cadangan lama diselamatkan
  ke berkas dulu; impor gagal memasang kembali isi lama; galat impor tidak lagi disembunyikan;
  verifikasi membandingkan **delapan tabel**, bukan hanya `staff`.
- Workflow `cuciin-d1-mirror.yml` — laporan menandai database yang tidak terbaca dan keluar
  kode 1, tidak lagi menulis "tidak terbaca" di antara baris lain.

Bukti: impor ulang menulis 26 tabel / 2.338 baris; delapan tabel produksi dan cadangan
**identik**; `bash scripts/mirror-d1.sh` dijalankan penuh sampai "Mirror selesai dan
terverifikasi". `tests/reorder-d1-export.test.mjs` (5 tes) dibuktikan **merah lebih dulu**
terhadap versi lama (4 dari 5 gagal). `npm run check`: 82 tes lulus.

**Jangan ubah dua hal ini tanpa tes:** urutan "uji export → simpan cadangan lama → buang →
impor", dan penolakan berkas yang tidak bisa dijalankan ulang. Keduanya yang mencegah
cadangan kosong terulang.

## 0k. Email reset sandi: teks "project-634935388002" berasal dari OAuth brand, bukan nama project

**Status: akar masalah terbukti; perubahan template TIDAK bisa lewat API — harus dari Console.**

Permintaan Owner: ubah teks "project-634935388002" di email reset sandi menjadi "Aplikasi Cuciin",
termasuk "Tim project-634935388002 Anda", dan tambahkan keterangan bahwa email dikirim otomatis.

### Apa yang terbukti

`%APP_NAME%` di semua template email auth **tidak diambil dari nama project**. Dokumentasi resmi
Firebase (Authentication FAQ) menyatakan `%APP_NAME%` diisi **OAuth brand name**; hanya jika brand
belum ada barulah dipakai nama default Firebase Hosting site, dan paling akhir project ID.

Keadaan project `cuciin-ops` yang dibaca langsung:

| Pemeriksaan | Hasil |
| --- | --- |
| `displayName` di Cloud Resource Manager | `Cuciin Ops` (benar) |
| `displayName` di Firebase v1beta1 | `Cuciin Ops` (benar) |
| `npx firebase projects:list` | `Cuciin Ops` (benar) |
| Site Firebase Hosting default | `cuciin-ops` |
| Google Sign-in | **sudah aktif**: `defaultSupportedIdpConfigs/google.com enabled=True` |
| Subject template reset sandi | `Reset sandi Anda untuk %APP_NAME%` |

Jadi nama project sudah benar di semua tempat, dan yang tampil di email tetap
`project-634935388002` — angka itu `projectNumber`, bukan `projectId`. Menaikkan/mengubah nama
project **tidak akan pernah** memperbaikinya. Itu sebabnya percobaan sebelumnya sia-sia.

### Mengapa tidak bisa dikerjakan dari sini

Dua jalan ditutup, keduanya oleh Google, bukan oleh konfigurasi project:

| Jalan | Hasil |
| --- | --- |
| `PATCH /admin/v2/projects/cuciin-ops/config?updateMask=notification.sendEmail` | **HTTP 400 `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`** |
| Baca/tulis OAuth brand (`iap.googleapis.com/v1/projects/.../brands`) | **HTTP 403**, IAP API tidak aktif; brand hanya dikelola Console |

Template email auth memang sengaja dikunci untuk mencegah penyalahgunaan sebagai alat spam.

### Yang harus dikerjakan Owner di Console

Buka **https://console.cloud.google.com/auth/branding** untuk project `cuciin-ops`, lalu setel
**App name** menjadi `Aplikasi Cuciin`. Itu nilai yang mengisi `%APP_NAME%` di ketiga template
(reset sandi, verifikasi email, perubahan email).

Catatan penting: perubahan **App name** dan **Logo** pada brand yang sudah diverifikasi memerlukan
peninjauan ulang Google. Tanpa persetujuan, `%APP_NAME%` tetap memakai nilai lama.

Keterangan "email dikirim otomatis" juga tidak bisa ditambahkan lewat API karena alasan yang sama;
harus disunting di Console pada Authentication lalu Templates.

Skrip pemeriksa (read-only, aman dijalankan ulang):
`cloudflare/scripts/cek_project_firebase.py`, `cloudflare/scripts/cek_appname_firebase.py`,
`cloudflare/scripts/cek_oauth_brand_firebase.py`, `cloudflare/scripts/cek_brand_firebase.py`.
`cloudflare/scripts/email_auth_firebase.py --tulis` sudah dicoba dan **ditolak Google**; simpan
sebagai catatan, jangan diulang tanpa alasan baru.

## 0j. Data transaksi & keuangan produksi dibersihkan (21 Sep, Hermes)

**Status: selesai dan terverifikasi pada D1 produksi `cuciin-db`.**

Perintah Owner: hapus semua data transaksi dan keuangan di database produksi (aplikasi release);
pertahankan hanya data user (kasir, SPV, Owner) dan data cabang. Aplikasi debug tidak disentuh.

Ini membersihkan **sisa yang tertinggal** dari pembersihan sebelumnya. Pembersihan terdahulu memakai
`bersihkan-data-produksi.sql` dan terlihat berhasil, tetapi sebagian data sudah kembali terisi
sesudahnya sehingga Owner masih melihat transaksi dan data keuangan. Keadaan nyata sebelum
pembersihan ini, dibaca langsung dari produksi:

| Tabel | Baris sebelum |
| --- | ---: |
| `processed_commands` | 50.411 |
| `sync_changes` | 103 |
| `audit_logs` | 59 |
| `order_lines` | 11 |
| `orders` | 7 |
| `products` | 5 |
| `branch_stocks` | 4 |
| `payments` | 4 |
| `stock_moves` | 4 |
| `attendance` | 2 |
| `cash_closes`, `customers`, `whatsapp_templates` | 1 masing-masing |

Cadangan segar dibuat lebih dulu:
`firebase-migration/backup-d1/cuciin-prod-preHapus2-20260921T022023Z.sql` (27.957.854 byte).
Cadangan itu diuji bisa dipulihkan (`PRAGMA integrity_check` = `ok`, `orders` = 7) **sebelum**
satu baris pun dihapus.

Skrip: `cloudflare/scripts/bersihkan-transaksi-produksi.sql`. Skrip diuji dulu di SQLite lokal
dari salinan cadangan produksi, baru dijalankan ke `--remote`. Urutan `DELETE` menghormati foreign
key dan memakai `PRAGMA defer_foreign_keys` supaya urutan tidak bisa menggagalkan proses di tengah.

Hasil di produksi: `success: true`, **50.623 baris terhapus**, ukuran basis data **25,76 MB → 0,32 MB**.

| Dipertahankan | Baris |
| --- | ---: |
| `staff` (user: Owner, SPV, kasir) | 8 |
| `staff_branches` | 14 |
| `branches` | 4 |
| `access_roles` | 3 |
| `organizations` | 1 |

Semua tabel transaksi, keuangan, katalog, dan jejak sinkronisasi: **0**. Termasuk `services` dan
`asset_types`, atas keputusan Owner. Tabel `access_policies`, `asset_types`, `attendance`,
`audit_logs`, `branch_stocks`, `cash_closes`, `customers`, `expenses`, `inventory_items`,
`order_lines`, `orders`, `payments`, `processed_commands`, `products`, `services`, `stock_moves`,
`sync_changes`, `sync_command_guards`, `sync_snapshots`, `whatsapp_templates` semuanya kosong.

Data lama tidak bisa hidup kembali: `/health` produksi menjawab **200**
`{"ok":true,"database":"ready","revision":0}`. Kursor revisi 0 berarti perangkat menarik dari
keadaan bersih, bukan menyisir riwayat lama.

**Efek yang perlu diketahui:** karena `processed_commands` ikut dikosongkan, perangkat yang masih
menyimpan outbox akan mengirim ulang command lamanya dan command itu **diterima sebagai baru**.
Perangkat 1.10.29 yang masih dipakai 20 cabang harus diuji ulang setelah pembersihan ini.

`cuciin-debug-db` tidak disentuh sama sekali, sesuai perintah Owner.

## 0i. Pekerjaan terbaru (21 Sep, Hermes) — kegagalan masuk akhirnya terlihat, rilis 1.10.35/v54

**Status: selesai di working tree, rilis 1.10.35 dibangun & terverifikasi di perangkat. Belum di-commit.**

### Jawaban: mengapa sandi salah tampak seperti tombol yang tidak bereaksi

Ditanyakan Owner setelah uji perangkat: menekan **Masuk** dengan sandi salah membuat tombol kembali
seperti semula tanpa penjelasan apa pun. Log perangkat membuktikan aplikasi **memang** menerima
penolakan dari server identitas:

```
FirebaseAuth: Logging in as <email> with empty reCAPTCHA token
RecaptchaCallWrapper: Initial task failed for action RecaptchaAction(action=signInWithPassword)
  with exception - The supplied auth credential is incorrect, malformed or has expired.
```

Jadi ini bukan kegagalan jaringan dan bukan Play Services yang tidak lengkap — dua dugaan awal itu
salah. Ada **dua** sebab yang bertumpuk, dan keduanya harus ditutup:

1. **Pesan dikirim lewat jalur yang tidak dirender di layar pra-login.** `toast()` memakai
   `SnackbarHost` yang berada di dalam `Scaffold` ber-sesi (`CuciinNav.kt:148`); layar Masuk
   dirender di luar `Scaffold` itu. Bukti: `uiautomator dump` tidak pernah memuat satu pun elemen
   `Snackbar` meski `showSnackbar` dipanggil.
2. **Jawaban datang di thread yang salah.** Seluruh listener Firebase dipanggil di thread internal
   Firebase, dan pembaruan state Compose dari thread itu tidak tergambar. Ini yang membuat
   penyebabnya tidak terlihat meski pesannya sudah benar.

Perbaikan: `finish()` mengantar jawaban lewat `ui { }`; layar Masuk dan layar Daftar menyimpan
pesannya di state layar dan menampilkannya sebagai `FeedbackBanner`; parameter `toast` yang tidak
lagi terpakai dibuang dari `LoginScreen`/`RegisterScreen` sehingga bug lama tidak bisa dikembalikan
tanpa gagal kompilasi.

Penjaga tambahan: batas waktu 20 detik (`main.postDelayed(watchdog, 20_000)`) supaya tombol tidak
pernah berhenti tanpa jawaban, dan `addOnCanceledListener` karena kegagalan reCAPTCHA **membatalkan**
Task, bukan memanggil listener gagal biasa.

### Rilis 1.10.35 (versionCode 54)

Versi dinaikkan karena `src/main` berubah. **Ketiga sumber versi sebelumnya tidak sinkron** dan
diselaraskan sekaligus: `app/build.gradle.kts` sempat 1.10.34/v53 sementara `VersionHistory.kt` dan
`CHANGELOG.md` masih berhenti di 1.10.30/v49.

| Pemeriksaan | Hasil |
| --- | --- |
| `testDebugUnitTest` / `testReleaseUnitTest` dari `clean` | 285 / 285, **0 gagal**, 0 error |
| `lintDebug` + `lintRelease` | **0 error** |
| `verify_release.py` | PASS (v2, non-debuggable, izin minimum, ZIP/ELF 16 KB) |
| Sertifikat | `3a988c53...befee` **tidak berubah** → menimpa 1.10.33 di perangkat tanpa uninstall |
| Perangkat: sandi salah (release) | pesan **Email atau kata sandi tidak sesuai.** tampil di layar |
| Perangkat: sandi benar Kasir (release) | masuk ke **Antrian laundry**, cabang **Laupay Kirab** |

Tes penjaga dibuktikan bisa MERAH: `jawabanDiantarKeMainThread` merah saat `ui { }` dibuang;
`gagalMasukDitampilkanDiLayarBukanLewatPesanSingkat` merah saat pesan dikembalikan ke `toast`.

Artefak: `releases/1.10.35-candidate/` (+ `README.md`), dan salinan akar `releases/cuciin-release.apk`
serta `releases/cuciin-debug.apk` sudah disamakan (hash identik dengan kandidat).

### Belum terbukti pada versi ini

- Batas waktu 20 detik belum pernah benar-benar berbunyi di perangkat: pada emulator ini rantai
  Firebase selalu berakhir di `addOnCanceledListener` dalam ~1,3 detik.
- Perbaikan hanya diuji di satu emulator, bukan HP cabang. Tidak ada `androidTest`.
- Sapu menu per peran pada 1.10.35 belum dijalankan ulang (sapu terakhir pada 1.10.30).
- Tombol Simpan pada dialog Ubah kata sandi belum diuji ulang setelah perubahan ini.
- Akun Owner `tiftazani.khara@gmail.com` masih memakai sandi yang tidak diketahui pemiliknya
  (akibat insiden uji di `## 0h`); jalur sukses diuji memakai akun Kasir.

### Skrip uji baru: `android/scripts/uji_login.py`

Menggantikan koordinat tap yang ditempel-tempel. **Koordinat tombol di layar ini bergeser** saat
keyboard lunak terbuka (email 637→629, sandi 831→751, Masuk 1037→957), dan tombol "Lupa kata sandi?"
menempati y yang sama dengan Masuk saat keyboard terbuka. Catatan koordinat lama di `references/`
karena itu menyesatkan: tap di 957 kena "Lupa kata sandi?", bukan tombol Masuk, sehingga login
tampak tidak berfungsi padahal tidak ada percobaan yang salah.

Skrip membaca ulang `bounds` dari `uiautomator dump` sebelum setiap tap, memilih tombol lebar
berdasarkan **label teks di dalam bounds** (ada dua tombol lebar di layar Masuk: "Masuk" dan
"Daftar akun baru"), dan menghindari `keyevent 4` untuk menutup keyboard karena tombol itu keluar
dari aplikasi saat keyboard sudah tertutup.


## 0h. Pekerjaan terbaru (21 Sep dini hari, Hermes) — kata sandi, pembersihan data produksi, rilis 1.10.33

**Status: SELESAI, di-commit `4a5bab9`, sudah di-push. PR #22 `CLEAN`/`MERGEABLE`.**

### Jawaban: tabel `staff` memang tidak menyimpan kata sandi

`staff` di D1 berisi `email`, `organization_id`, `name`, `role`, `approved`, `active`,
`updated_at`, `firebase_uid`. **Tidak ada** kolom sandi, dan itu memang rancangannya, bukan tabel
yang belum dibuat:

- Kata sandi asli dipegang **Firebase Authentication**. Worker tidak punya endpoint ganti sandi
  sama sekali (`/v1/me`, `/v1/snapshot`, `/v1/sync/*`, `/v1/registration`, `/v1/admin/reproject` saja).
  Bahkan Worker **membuang** `passwordHash` sebelum snapshot dikirim ke perangkat (`src/index.ts:265`).
- Perangkat menyimpan **hash lokal PBKDF2-SHA256 120.000 iterasi** (`Passwords.kt`) sebagai cadangan
  saat server tidak terjangkau. Hash itu tinggal di perangkat, tidak pernah ke D1.
- Jadi menyimpan sandi di D1 tidak perlu: ia menggandakan rahasia di tempat yang paling banyak
  dibaca. Yang benar adalah memastikan kedua sandi **berubah bersama**, dan itu yang diperbaiki.

### Cacat nyata yang ditemukan dan diperbaiki

1. **Ganti kata sandi tidak pernah memperbarui hash lokal.** `FirebaseCloud.enabled` selalu benar di
   rilis, jadi tombol "Simpan kata sandi" selalu memakai jalur Firebase dan
   `store.changeMyPassword()` tidak pernah jalan. Akibatnya orang yang mengganti kata sandi lalu
   keluar **tidak bisa masuk lagi** dengan kata sandi barunya.
2. **"Lupa kata sandi" punya celah sama.** Kata sandi Firebase berubah lewat tautan email di luar
   aplikasi, hash lokal tetap yang lama dan menolak kata sandi baru.

Perbaikan: setelah Firebase menerima kata sandi baru, hash lokal ikut diperbarui lewat pengait
`FirebaseCloud.changeLocal`; setelah tautan reset dikirim, hash lokal dibuang lewat
`FirebaseCloud.forgetLocal` sehingga layar masuk memverifikasi lewat Firebase. Penolakan lokal
sekarang ditampilkan sebagai pesan, bukan dilaporkan sukses. Dikunci oleh `PasswordSyncTest` (4 kasus);
`RouteAccessTest` yang sudah ada sempat menangkap versi pertama perbaikan karena hasilnya dibuang.

### Pemakaian D1 produksi setelah dibersihkan

Diminta Owner: sisa hanya user, Owner, cabang, dan layanan. Dijalankan lewat
`cloudflare/scripts/bersihkan-data-produksi.sql` (969 baris terhapus, 26 tabel).

| Dipertahankan | Jumlah | Dibuang | Jumlah |
|---|---|---|---|
| `staff` (6 Kasir + 2 Owner) | 8 | `orders` / `order_lines` | 8 / 14 |
| `branches` | 4 | `payments`, `cash_closes`, `expenses` | 4, 1, 0 |
| `services` | 9 | `customers`, `attendance` | 1, 2 |
| `access_roles` | 3 | `branch_stocks`, `stock_moves`, `inventory_items` | 4, 5, 0 |
| | | `audit_logs`, `asset_types`, `whatsapp_templates` | 74, 0, 1 |
| | | `sync_changes`, `processed_commands`, `sync_snapshots` | 421, 433, 1 |

`sync_snapshots` ikut dikosongkan supaya data transaksi lama tidak bisa dipulihkan.
**D1 debug `cuciin-debug-db` TIDAK disentuh** (9 staff, 6 cabang, 10 layanan, 8 order seperti semula).

Bukti sesudah: `/health` 200 `revision: 0`; `/v1/snapshot` dan `/api/cuciin` **401** tanpa token
(jalur PUT snapshot lama tidak hidup kembali); `sync_changes` 0 baris, sequence maksimum 0.
Cadangan sebelum dibersihkan: `firebase-migration/backup-d1/cuciin-prod-preBersih-20260920T173214Z.sql` (554.652 byte).

### Belum terbukti

- **Masuk ulang dengan kata sandi baru belum terbukti di perangkat.** Uji ke Firebase langsung dari
  Mac dengan sandi akun uji mengembalikan `INVALID_LOGIN_CREDENTIALS`, yang justru membuktikan kata
  sandi akun **berhasil diubah** lewat aplikasi. Sandi akun `tiftazani.khara@gmail.com` sekarang
  tidak diketahui siapa pun; Owner menyetel ulang lewat Firebase Console.
- Ada satu uji di tengah jalan yang tidak sengaja menekan tombol Simpan saat mengisi kolom untuk
  menguji keadaan terkunci. Akibatnya kata sandi akun Owner berubah. Emulator hanya dipakai uji.

## 0g. Pekerjaan terbaru (20 Sep malam, Hermes) — rilis 1.10.31 & 1.10.32, peringatan sinkronisasi di layar data

**Status: SELESAI, di-commit `f1d2695` + `5716ebb`, SUDAH di-push. CI PR #22 hijau seluruhnya.**

Sebab `1.10.30` tidak memuat perbaikan: nomor versi tidak dinaikkan padahal isinya berubah, jadi
`releases/1.10.30-candidate/` berisi APK build pagi (08:02) sementara APK baru hanya ada di
`releases/cuciin-release.apk`. Sekarang versi dinaikkan agar tidak tertukar.

| Versi | Isi | Berkas |
|---|---|---|
| **1.10.31** (`versionCode` 50) | Perbaikan sinkronisasi hak akses | `releases/1.10.31-candidate/` |
| **1.10.32** (`versionCode` 51) | + peringatan sinkronisasi di 11 layar data | `releases/1.10.32-candidate/` |

`SyncNotice` sebelumnya hanya di Beranda dan Profil. Sekarang juga di Pelanggan, Cabang, Daftar User,
Layanan & harga, Produk stok, Biaya operasional, Absensi, Daftar Aset Cabang, Tipe Aset, Riwayat
aktivitas, dan Tutup kas. Daftar User paling berbahaya: peran yang tampak di perangkat bisa berbeda
dari yang berlaku di server.

**Bukti nyata (APK rilis, menunjuk Worker produksi):**

- Versi terpasang terbaca `1.10.31` lalu `1.10.32`, `versionCode` 50 lalu 51 — menimpa tanpa uninstall.
- Dengan WiFi dan data dimatikan, **Daftar User menampilkan "6 perubahan belum terkirim"** beserta
  penjelasannya. Sebelum perbaikan, layar ini diam saja.
- Setelah koneksi pulih, peringatan hilang sendiri dan daftar tetap **8 user**.
- `1.10.31`: `276 + 276` test lulus, `1.10.32`: `276 + 276` test lulus, lint **0 error**,
  `verify_release.py` PASS, sertifikat `3a988c53…`.

**CI:** workflow `Cuciin Android APK` dan `Cuciin Cloudflare validation` untuk PR #22 semuanya
**pass, 0 fail** (termasuk Cursor Security Reviewer).

**Catatan penting soal kata sandi awal.** Tabel `staff` di D1 **tidak menyimpan kata sandi** — hanya
`email`, `name`, `role`, `approved`, `active`, `firebase_uid`. Autentikasi sepenuhnya di Firebase.
Jadi "ganti `test1234` pada 8 akun produksi" **tidak bisa** dikerjakan dari sisi server atau repo:
satu-satunya jalur sah adalah per akun, oleh pemiliknya, lewat **Akun & profil → ganti kata sandi**
(butuh sandi lama, `FirebaseCloud.kt`) atau **Lupa kata sandi** untuk kirim email reset. Jangan
menyetel kata sandi akun orang lain tanpa keputusan Owner.

**Backup D1 terjadwal — diperbaiki.** `.github/workflows/cuciin-backup.yml` sebelumnya hanya punya
`workflow_dispatch`, jadi belum pernah jalan sendiri dan tidak ada backup terjadwal sama sekali.
Ditambah `schedule: cron "0 20 * * *"` (03:00 WIB).

Skrip `scripts/backup-d1.sh` + `scripts/verify-backup.sh` **diuji lokal dan terbukti benar**:
backup uji dienkripsi AES-256-CBC/PBKDF2 600000 iterasi, `shasum -c` lulus, dekripsi + restore ke
SQLite `PRAGMA integrity_check` = `ok` → keluar 0. **Uji negatif:** passphrase salah → keluar 1,
jadi verifikasi tidak bisa lolos palsu. Uji ini memakai passphrase karangan lokal, bukan milik produksi.

Yang **belum** terbukti: workflow-nya belum benar-benar jalan di GitHub, karena repo **tidak punya
secret** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, dan `CUCIIN_BACKUP_PASSPHRASE` (`gh secret
list` kosong) dan repo publik. Isi passphrase produksi **hanya boleh** dipegang Owner; jangan
membuatkannya di sini.

## 0f. Pekerjaan terbaru (20 Sep, Hermes) — sinkronisasi hak akses, APK 1.10.30 dibangun ulang, Worker produksi dideploy

**Status: SELESAI dan TERBUKTI di perangkat produksi. Di-commit `e9440ec`. BELUM di-push.**

Tiga cacat sinkronisasi yang membuat keadaan server tidak pernah sampai ke perangkat:

| Kelas | Gejala nyata | Perbaikan |
|---|---|---|
| Angkat hak akses | Perangkat mengubah `staff`/`accessRole`/`accessPolicy` saat bootstrap lalu mengirimkannya ke server | `SyncProjection.serverOwnedEntities` — entitas hak akses tidak direkonsiliasi dari perangkat |
| Entri hantu | Entri hak akses yang hilang di server bertahan di perangkat selamanya | `reconcileBootstrap` mengikuti server penuh; `SyncProjection.samakanHakAkses` berlaku juga di jalur `pullChanges` |
| Kursor di depan jurnal | Worker mengembalikan `nextRevision` = `after` saat tidak ada baris cocok, sehingga kursor klien yang sudah di depan server dipantulkan dan halaman jurnal lebih tua tidak pernah dibaca lagi | Worker: `nextRevision` di-clamp ke `latestRevision`. Perangkat: kursor ditetapkan dari server (`acceptRemote`, `completePreparedRemote`, `reconcileRejectedRemote`), bukan `maxOf` |

**Bukti terukur (semua dijalankan ulang, bukan dikutip):**

- Gate bersih `clean` lalu `testDebugUnitTest testReleaseUnitTest lintDebug assembleDebug assembleRelease`: **276 + 276 kasus, 0 gagal, 0 error**; lint **0 error**. Naik dari 267 karena tambahan `BootstrapPrivilegeTest` (6 kasus).
- Worker `npm test`: **61 kasus, 0 gagal** (naik dari 60).
- Uji negatif dua sisi: memulihkan `maxOf` pada perangkat dan menghapus clamp di Worker masing-masing membuat test GAGAL, lalu hijau lagi setelah dikembalikan.
- **Bukti produksi di perangkat (APK release, menunjuk Worker produksi):** masuk sebagai Owner, Daftar User menampilkan **8 dari 8 user**, `aidanurita25@gmail.com` = **Kasir**, tanpa `alfin` dan `gudang-uji`. Role uji **Test** dihapus lewat Kontrol Akses Role; server sekarang **3 role bawaan** saja.
- **Worker produksi dideploy**: versi `07442ff9-6f7f-4d13-a932-261a3f40dfc3`, health `revision: 409` saat deploy.
- APK rilis `1.10.30`/`versionCode 49`, sertifikat `3a988c53…` (sama dengan sebelumnya, bisa menimpa pemasangan lama), `verify_release.py` PASS.
  `releases/cuciin-release.apk` sha256 `a5d7d7329664d523db595843beb07de2fc3502ac2f0e9a94c2762d812ef3ce6e`;
  `releases/cuciin-debug.apk` sha256 `e4715a6e46cb64cfe3294edc7e4653db5e020459f1eaf75d7872cdcbb6fe152d`.
- Backup D1 produksi sebelum perubahan: `firebase-migration/backup-d1/cuciin-prod-20260920T141453Z.sql` (541 KB, 26 tabel, 1004 baris).
- Sapu peran di APK debug: Owner **21/21 menu tampil, 0 crash**, kembali ke `Cuciin · Owner`.

**Catatan lingkungan penting:** APK **debug** selalu menunjuk Worker debug (`cuciin-api-debug…`, D1
`cuciin-debug-db`), dan APK **release** menunjuk produksi. Basis data debug punya riwayat sendiri
(revisi jurnal 1018) dan berbeda isinya; kesimpulan tentang data produksi **tidak boleh** diambil
dari APK debug. Jalur sah untuk memeriksa atau mengubah data produksi adalah APK release.

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
| Android | **1.10.35 (versionCode 54)** | `app/build.gradle.kts`; juga harus sama di `VersionHistory.kt` dan `CHANGELOG.md` |
| Paket aplikasi | `com.cuciin.laundryops` (+ `.debug`) | `app/build.gradle.kts` |
| Firebase project | **`cuciin-ops`** (lama: `cuciin-ops-tiftazani`) | `firebase/README.md` |
| Worker produksi | versi `07442ff9-6f7f-4d13-a932-261a3f40dfc3` | `wrangler deployments list` |
| Worker debug | versi `717ddfa4-2fe1-49c3-ab65-1c17e9733a5d` (memuat pekerjaan 1.10.30) | `wrangler deployments list -c wrangler.debug.toml` |
| Health produksi | `ok`, revision 0 (kursor bersih pasca-pembersihan) | `curl .../health` |
| Test Worker | 61 lulus | `cd cloudflare && npm run check` |
| Test Android | **285 lulus** (285 debug + 285 rilis), lint 0 error | `./gradlew testDebugUnitTest testReleaseUnitTest lintDebug` (jalankan dari `clean`; `app/build/test-results/` menyimpan hasil run terakhir) |
| Kandidat rilis | `releases/1.10.35-candidate/` | folder + `SHA256SUMS.txt` + `README.md` |
| Data produksi | 4 cabang, 8 akun, 9 layanan, 3 role akses; **semua tabel transaksi 0** | `wrangler d1 execute cuciin-db --remote` |

Angka pada tabel ini berasal dari pengukuran langsung ke produksi dan ke kode pada 21 September 2026.
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
    **Koreksi 21 Sep:** `cuciin-backup.yml` sekarang **sudah terbukti jalan** — run `35575319046`
    `completed/success`, semua langkah hijau: export `cuciin-db --remote` (berkas
    `cuciin-20260921T075617Z.sql`), enkripsi, `verify-backup.sh` melaporkan `OK` + lulus
    `integrity_check`, lalu melaporkan ukuran + sha256. Lima secret GitHub sudah dipasang
    (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CUCIIN_BACKUP_PASSPHRASE`, plus
    `GDRIVE_SA_JSON`/`CUCIIN_GDRIVE_FOLDER` yang kini tidak dipakai).
    **Salinan backup tetap tidak disimpan otomatis.** Empat jalur penyimpanan gratis sudah diuji
    sampai mentok di batas penyedianya, bukan karena bug: Cloudflare R2 menolak tanpa kartu
    kredit (`code 10042`); Google Drive lewat service account ditolak Google karena service
    account berkuota nol (`storageQuota limit: 0`, pesan resmi "Service Accounts do not have
    storage quota"); Google Drive lewat OAuth butuh OAuth client, dan halaman Branding mentok
    tanpa billing; artifact GitHub hanya tersimpan kalau repo privat, dan repo ini publik.
    Backup manual Owner ada di `~/Documents/ChatGPT/Laundry/firebase-migration/backup-d1/`.
    Cloudflare hanya menyimpan 30 hari, jadi cadangan lokal itu yang penting.

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
