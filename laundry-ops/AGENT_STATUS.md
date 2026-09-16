# Papan status & klaim file antar-agent

Terakhir diperbarui: 16 September 2026, 12:05 WIB (oleh Hermes).
Baca bersama `AGENT_HANDOVER.md`, `AGENT_WORKFLOW.md`, dan `CODING_AGENT_CONTEXT.md`.

Tujuan dokumen ini: satu tempat untuk melihat **siapa memegang file apa** dan **sampai mana pekerjaan berjalan**, supaya Hermes, Codex, Cursor, dan OpenCode tidak menyunting berkas yang sama.

## 0. Pekerjaan yang sedang berjalan (16 Sep, Hermes)

**Tujuan:** menerapkan sistem desain bergaya Airbnb ke seluruh aplikasi, mengganti ikon, dan memperbaiki tiga layar yang dikeluhkan Owner.

**Klaim file Hermes untuk pekerjaan ini:**

```
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/theme/Theme.kt        (palet + CuciinShape)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/components/Widgets.kt (komponen bersama)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/UiMetrics.kt
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/MoreScreens.kt        (laporan + periode)
laundry-ops/android/app/src/main/java/com/cuciin/laundryops/ui/MasterScreens.kt      (daftar cabang)
laundry-ops/android/app/src/main/res/drawable/ic_launcher_foreground.xml             (ikon baru)
laundry-ops/android/app/src/main/res/drawable/cuciin_mark.xml
laundry-ops/android/app/src/main/res/values/colors.xml
laundry-ops/android/app/src/test/java/com/cuciin/laundryops/ui/theme/ThemePaletteTest.kt
```

**Codex: jangan menyunting file di atas sampai pekerjaan ini selesai dan dicatat di sini.** Area `ui/AuthScreens.kt`, `ui/OpsScreens.kt`, `ui/BusinessScreens.kt`, dan `ui/OwnerSettingsScreen.kt` **tidak** dipegang Hermes dan tetap milik Codex, tetapi tampilannya ikut berubah karena memakai komponen bersama.

**Aturan yang berubah dan wajib dipatuhi siapa pun:**

1. **Warna aksen bukan biru lagi.** Token `Teal` sekarang berisi merah aksen tema. Jangan menulis warna biru literal di layar baru; pakai token tema.
2. **Tombol utama memakai near-black**, bukan warna aksen. Gunakan `PrimaryBtn` untuk pekerja utama dan `AccentBtn` hanya untuk satu aksi paling utama per layar.
3. **Radius mengikuti `CuciinShape`**, bukan angka bebas: tombol 8, kartu 20, lencana 14, pil 9999.
4. **Daftar panjang memakai `ListCard` + `ListRow` + `RowDivider`**, bukan tumpukan `CardBlock`. Tumpukan kartu hanya untuk beberapa item.
5. **Semua pasangan warna wajib lolos WCAG.** Rausch Red asli (#ff385c) gagal 4.5:1, jadi jangan dipakai sebagai teks atau latar tombol. Jalankan `verifikasi-palet.py` di `~/Documents/ChatGPT/Laundry/cuciin-airbnb-mockup/` setelah mengubah palet.

## 1. Titik berangkat yang sudah diverifikasi

| Hal | Nilai | Cara cek |
|---|---|---|
| Repo lokal | `/Users/tiftazani/Documents/ChatGPT/Laundry/Cursor-Tifz` | satu-satunya clone; `~/Cursor-Tifz` bukan clone repo ini |
| Branch | `codex/cuciin-1-8-1` | `git status -sb` |
| Android | **1.10.0 (versionCode 19)** | `app/build.gradle.kts` |
| Paket aplikasi | `com.cuciin.laundryops` (+ `.debug`) | `app/build.gradle.kts` |
| Firebase project | **`cuciin-ops`** (lama: `cuciin-ops-tiftazani`) | `firebase/README.md` |
| Worker produksi | versi `5a2741cc-96b8-423a-8de1-8b2e1ea66f35` | `wrangler deployments list` |
| Health produksi | `ok`, database `ready` | `curl .../health` |
| Test Worker | 35 lulus | `cd cloudflare && npm run check` |
| Test Android | 94 lulus (47 debug + 47 rilis), lint 0 error | `./gradlew testDebugUnitTest testReleaseUnitTest lintDebug` |
| Kandidat rilis | `releases/1.10.0-candidate/` | folder + `SHA256SUMS` |

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
2. **Nama "tiftazani" masih ada di tiga tempat yang terkunci eksternal** dan tidak bisa diubah tanpa biaya besar:
   - URL Worker `cuciin-api.tiftazani-cuciin.workers.dev` (subdomain akun Cloudflare)
   - Repo GitHub `tiftazani/Cursor-Tifz`
   - Email Owner `tiftazani.khara@gmail.com` (dipertahankan atas permintaan Owner)
3. **Isi template email reset** masih bawaan Firebase (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`).
4. **PR #18 dan #19** masih terbuka; `main` belum memuat 1.9.2 sampai 1.10.0.
5. **Kata sandi awal `test1234`** wajib diubah semua akun sebelum data nyata dipakai.

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
