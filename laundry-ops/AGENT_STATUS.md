# Papan status & klaim file antar-agent

Terakhir diperbarui: 15 September 2026, 19:05 WIB (oleh Hermes).
Baca bersama `AGENT_HANDOVER.md`, `AGENT_WORKFLOW.md`, dan `CODING_AGENT_CONTEXT.md`.

Tujuan dokumen ini: satu tempat untuk melihat **siapa memegang file apa** dan **sampai mana pekerjaan berjalan**, supaya Hermes, Codex, Cursor, dan OpenCode tidak menyunting berkas yang sama.

## 1. Titik berangkat yang sudah diverifikasi

| Hal | Nilai | Cara cek |
|---|---|---|
| Repo lokal | `/Users/tiftazani/Documents/ChatGPT/Laundry/Cursor-Tifz` | satu-satunya clone; `~/Cursor-Tifz` bukan clone repo ini |
| Branch | `codex/cuciin-1-8-1` | `git status -sb` |
| HEAD | `67903dc` — sama dengan `origin/codex/cuciin-1-8-1` (0 ahead / 0 behind) | `git rev-list --left-right --count HEAD...origin/...` |
| PR | #18, OPEN, mergeable, semua check hijau | `gh pr view 18` |
| Android | **1.9.2 (versionCode 17)** | `app/build.gradle.kts` |
| Worker produksi | versi `71310107-4ec5-48f8-aedb-481be9107649` (15:10 WIB) | `wrangler deployments list --name cuciin-api` |
| Skema D1 produksi | migrasi `0003` dan `0004` sudah diterapkan | `wrangler d1 execute cuciin-db --remote --command "SELECT name FROM d1_migrations"` |
| Health produksi | `ok`, database `ready` | `curl .../health` |
| Test Worker | 29 lulus (20 lama + 9 baru untuk accessPolicy dan whatsappTemplate) | `cd cloudflare && npm run check` |
| Konfigurasi cloud build | `signing-private/cuciin-cloud.properties` (di luar repo) | `app/build.gradle.kts` |

Working tree bersih. Tidak ada pekerjaan setengah jadi yang menggantung.

## 2. Riwayat singkat 15 September

1. Codex berhenti 12:32 karena kuota, meninggalkan perubahan belum di-commit dan 5 error compile di `ui/MasterScreens.kt`.
2. Hermes mencatat kondisi itu, mem-backup patch-nya, dan menahan diri (tidak menyentuh kode).
3. Codex lanjut setelah kuota terbuka, menyelesaikan 8 item permintaan 12:24, dan commit `a801f0b` pukul 15:11 lalu push.
4. Hermes menambah **fitur tema** (1.9.2): Terang, Gelap, Warna-warni, dan Ikut sistem, dapat dipilih semua peran di Akun & profil. Commit `72b9dbb`.
5. Hermes menyiapkan kandidat `releases/1.9.2-candidate/` dan menyegarkan `RELEASE_READINESS.md`.
6. Ketahuan build debug tidak pernah memuat alamat cloud. Diperbaiki di `46154d1`: konfigurasi dibaca dari file privat di luar repo, dan build gagal bila alamat kosong.
7. Seluruh jejak Cuciin dihapus dari project Vercel `cuan-yuk-guys` (`f21776a`), karena Cuciin menumpang di sana.

## 3. Status delapan item permintaan 15 Sep

| # | Item | Status | Bukti |
|---|---|---|---|
| 1 | Retail ↔ Produk stok saling terhubung | Selesai | `services.product_id` di D1, `productKey` di model, `linkedProduct()`, pengurangan stok saat Nota dibuat dan dikoreksi |
| 2 | Akun & Profil: info cabang benar | Selesai | `ProfilScreen` memakai penugasan pengguna, bukan cabang tampilan Owner |
| 3 | Inventory digabung ke Produk stok, stok multi-cabang | Selesai | Produk stok menyatukan barang jual + bahan habis pakai; mesin/aset pindah ke menu "Aset & mesin cabang"; `addProduct` menerima `Set<String>` cabang |
| 4 | Hanya Owner boleh koreksi Service setelah nota terkirim | Selesai | Ditegakkan di store Android **dan** di Worker |
| 5 | Foto absensi kamera + cap tanggal/waktu di gambar | Selesai | `data/AttendancePhotos.kt`, `AttendanceScreen`, `file_paths.xml`; path foto tidak pernah dikirim ke server |
| 6 | User access control (modul + fungsi) | Selesai | `OwnerSettingsScreen.kt`; tabel `access_policies`; Worker menegakkan policy pada command (403 "Akses fungsi ini dibatasi oleh Owner") |
| 7 | Template WhatsApp (pembuka, isi, penutup) | Selesai | `OwnerSettingsScreen.kt`; tabel `whatsapp_templates`; `ReceiptText.format(…, template)` |

## 4. Yang masih kurang (bukan bug, tapi belum lengkap)

1. **Sisi Vercel belum dibersihkan.** Repo sudah tidak punya route Cuciin, tapi project `cuan-tif` dan alias/custom domain-nya masih perlu ditinjau dari dashboard Vercel. Dijadwalkan Owner, belum dikerjakan.
2. **PR #18 sedang menunggu merge.** Kontrak, test, dan dokumen sudah lengkap di cabang; `main` belum memuat 1.9.2 sampai PR di-merge.

Yang sudah ditutup 15 Sep malam: kontrak `accessPolicy`/`whatsappTemplate` di `SYNC_API.md`, 9 test Worker baru, dan `AGENT_HANDOVER.md` yang kini menyebut 1.9.2 / versionCode 17 / commit `9bd026f`.

## 5. Klaim file (berlaku sampai handover berikutnya)

Aturan: satu file satu pemilik. Kalau butuh mengubah file milik agent lain, minta lewat chat/PR, jangan edit langsung.

### Bebas — tidak ada yang memegang

Semua file kode dalam keadaan bersih dan ter-commit. Siapa pun boleh mengambil area berikut dengan mencatatnya di sini lebih dulu.

### Pegangan Hermes (bila tugas server dilanjutkan)

```
laundry-ops/cloudflare/SYNC_API.md
laundry-ops/cloudflare/migrations/0005_*.sql          (bila perlu)
laundry-ops/cloudflare/tests/*.mjs
laundry-ops/AGENT_STATUS.md                            (dokumen ini)
```

### Pegangan Codex (bila tugas UI/rilis dilanjutkan)

```
laundry-ops/android/CHANGELOG.md
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/VersionHistory.kt
laundry-ops/android/RELEASE_READINESS.md
laundry-ops/releases/
```

Catatan 15 Sep 19:05: **pekerjaan Hermes selesai dan sudah di-push** (`f21776a`). Android 1.9.2 / versionCode 17, kandidat rilis lengkap, jejak Vercel dihapus. Tidak ada pekerjaan setengah jadi di working tree. File yang disentuh Hermes:

```
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/theme/Theme.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/theme/ThemePrefs.kt   (baru)
laundry-ops/android/app/src/main/res/values/colors.xml
laundry-ops/android/app/src/main/res/values/themes.xml
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/MoreScreens.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/AuthScreens.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/CuciinNav.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/OpsScreens.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/components/Widgets.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/MainActivity.kt
laundry-ops/android/CHANGELOG.md
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/VersionHistory.kt
```

Mockup, skrip kontras, dan bukti tangkapan layar ada di `~/Documents/ChatGPT/Laundry/cuciin-theme-mockup/`.

Sebelum menyentuh file di atas, jalankan `git diff` dan `git log --oneline -5` lebih dulu: versi, changelog, dan `VersionHistory` sudah naik ke 1.9.2, dan berkas kandidat rilis sudah diperbarui. APK kandidat lama (1.5.1 sampai 1.7.1) **sengaja dibiarkan** sebagai arsip meski masih memuat alamat Vercel lama; jangan hapus tanpa izin Owner.

### Pegangan bersama — jangan disunting tanpa bicara dulu

```
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/CuciinStore.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/Models.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/SyncProtocol.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/ReceiptText.kt
laundry-ops/cloudflare/src/command-sync.ts
laundry-ops/cloudflare/src/index.ts
```

File-file itu menyimpan aturan uang, stok, komisi, otorisasi, dan protokol sinkronisasi. Perubahan di sana wajib lewat review dan test, bukan suntingan cepat.

## 6. Urutan kerja yang disarankan

1. Merge PR #18 ke `main` supaya `main` memuat 1.9.2 (keputusan Owner).
2. Tinjau project Vercel `cuan-tif` dari dashboard (alias, custom domain, riwayat deploy).

## 7. Lingkungan build di mesin ini

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd laundry-ops/android && ./gradlew testDebugUnitTest lintDebug assembleDebug
```

`android/local.properties` sudah diisi `sdk.dir=/opt/homebrew/share/android-commandlinetools` (di-gitignore, jangan di-commit). Node 26.7.0 dan npm 11.19.0 tersedia untuk `npm run check`. Wrangler 4.131.1 sudah terautentikasi sebagai `tiftazani.khara@gmail.com`.

Catatan: macOS di mesin ini tidak punya `timeout`/`gtimeout`. Jangan pakai perintah itu untuk membatasi proses panjang.
