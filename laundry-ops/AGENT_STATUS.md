# Papan status & klaim file antar-agent

Terakhir diperbarui: 16 September 2026, 17:05 WIB (oleh Hermes).
Baca bersama `AGENT_HANDOVER.md`, `AGENT_WORKFLOW.md`, dan `CODING_AGENT_CONTEXT.md`.

Tujuan dokumen ini: satu tempat untuk melihat **siapa memegang file apa** dan **sampai mana pekerjaan berjalan**, supaya Hermes, Codex, Cursor, dan OpenCode tidak menyunting berkas yang sama.

## 0. Pekerjaan yang sedang berjalan (16 Sep, Hermes)

**Tujuan:** menerapkan sistem desain Jemur ke seluruh aplikasi, mengganti ikon, memigrasikan data cabang dan akun operasional, serta memperbaiki tiga layar yang dikeluhkan Owner.

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
| Android | **1.10.0 (versionCode 19)** | `app/build.gradle.kts` |
| Paket aplikasi | `com.cuciin.laundryops` (+ `.debug`) | `app/build.gradle.kts` |
| Firebase project | **`cuciin-ops`** (lama: `cuciin-ops-tiftazani`) | `firebase/README.md` |
| Worker produksi | versi `09ce0c80-70eb-4655-994f-a8cece811921` | `wrangler deployments list` |
| Health produksi | `ok`, database `ready`, revision 286 | `curl .../health` |
| Test Worker | 38 lulus | `cd cloudflare && npm run check` |
| Test Android | 94 lulus (47 debug + 47 rilis), lint 0 error | `./gradlew testDebugUnitTest testReleaseUnitTest lintDebug` |
| Kandidat rilis | `releases/1.10.0-candidate/` | folder + `SHA256SUMS` |
| Data produksi | 4 cabang, 8 akun (2 Owner + 6 Kasir), 0 data operasional dummy | `wrangler d1 execute cuciin-db --remote` |

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
6. **PR #18 dan #19** masih terbuka; `main` belum memuat 1.9.2 sampai 1.10.0.
7. **Kata sandi awal `test1234`** wajib diubah semua akun sebelum data nyata dipakai.
8. **State loading dan error di layar data belum lengkap.** Hanya layar masuk yang menampilkan indikator proses; sebagian besar layar belum membedakan "belum ada data" dari "sinkronisasi gagal".
9. **Sebagian daftar panjang masih berupa tumpukan kartu**: pelanggan, layanan, produk, persediaan, riwayat stok, biaya, absensi, dan ringkasan petugas laporan. Pola `ListCard` + `ListRow` sudah dipakai di cabang, user, dan riwayat aktivitas.
10. **Tabel laporan keuangan masih memaksa lebar 1470dp** dan digeser horizontal dengan teks 10sp; perlu reflow untuk layar sempit dan font besar.
11. **Alamat lengkap Shelly belum ada**, jadi kolom alamat dan tautan peta cabang itu masih kosong.
12. **Backup pascamigrasi sudah dibuat** di `firebase-migration/backup-d1/post-migration-rev286-20260916.sql` (revision 286, 4 cabang, 8 akun, integrity ok). Backup lama `pre-real-data-20260916.sql` adalah kondisi sebelum migrasi dan tidak bisa direstore sendirian.

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
