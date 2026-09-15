# Papan status & klaim file antar-agent

Terakhir diperbarui: 15 September 2026, 15:35 WIB (oleh Hermes).
Baca bersama `AGENT_HANDOVER.md`, `AGENT_WORKFLOW.md`, dan `CODING_AGENT_CONTEXT.md`.

Tujuan dokumen ini: satu tempat untuk melihat **siapa memegang file apa** dan **sampai mana pekerjaan berjalan**, supaya Hermes, Codex, Cursor, dan OpenCode tidak menyunting berkas yang sama.

## 1. Titik berangkat yang sudah diverifikasi

| Hal | Nilai | Cara cek |
|---|---|---|
| Repo lokal | `/Users/tiftazani/Documents/ChatGPT/Laundry/Cursor-Tifz` | satu-satunya clone; `~/Cursor-Tifz` bukan clone repo ini |
| Branch | `codex/cuciin-1-8-1` | `git status -sb` |
| HEAD | `a801f0b` — sama dengan `origin/codex/cuciin-1-8-1` (0 ahead / 0 behind) | `git rev-list --left-right --count HEAD...origin/...` |
| PR | #18, OPEN, mergeable | `gh pr view 18` |
| Android | **1.9.1 (versionCode 16)** | `app/build.gradle.kts` |
| Worker produksi | versi `71310107-4ec5-48f8-aedb-481be9107649` (15:10 WIB) | `wrangler deployments list --name cuciin-api` |
| Skema D1 produksi | migrasi `0004_operational_links.sql` sudah diterapkan | `wrangler d1 execute cuciin-db --remote --command "SELECT name FROM d1_migrations"` |
| Health produksi | `ok`, database `ready`, revision 40 | `curl .../health` |

Working tree bersih. Tidak ada pekerjaan setengah jadi yang menggantung.

## 2. Riwayat singkat hari ini

1. Codex berhenti 12:32 karena kuota, meninggalkan perubahan belum di-commit dan 5 error compile di `ui/MasterScreens.kt`.
2. Hermes mencatat kondisi itu, mem-backup patch-nya, dan menahan diri (tidak menyentuh kode).
3. Codex lanjut setelah kuota terbuka, menyelesaikan 8 item permintaan 12:24, dan commit `a801f0b` pukul 15:11 lalu push.

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

1. **`cloudflare/SYNC_API.md` belum memuat kontrak `accessPolicy` dan `whatsappTemplate`.** Dokumen itu masih pada commit `3d25c4d`. `AGENT_WORKFLOW.md` mewajibkan kontrak request/response ditulis sebelum kedua sisi diubah, jadi ini celah proses.
2. **Belum ada test untuk dua command baru.** Test Worker tetap 20 dan tidak menyentuh `accessPolicy`/`whatsappTemplate`; Android juga tidak menambah test. Yang belum tercakup: retry tidak menggandakan policy, non-Owner ditolak 403, dan idempotensi saat `ON CONFLICT`.
3. **Kandidat `releases/1.9.1-candidate/` belum lengkap.** Isinya baru APK + AAB; `README.md` dan `SHA256SUMS` seperti pada `1.9.0-candidate/` belum ada.
4. **`android/RELEASE_READINESS.md` masih berjudul 1.9.0.** Belum diperbarui untuk 1.9.1.
5. **`AGENT_HANDOVER.md` masih menyebut versi 1.9.0 / versionCode 15 dan commit `3d25c4d`.** Angkanya perlu disegarkan.

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

Catatan 15 Sep 17:00: **fitur tema selesai** di commit `72b9dbb` (Android 1.9.2 / versionCode 17). Tema Terang, Gelap, Warna-warni, dan Ikut sistem dapat dipilih semua peran di Akun & profil. File yang disentuh Hermes:

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

Mockup, skrip kontras, dan bukti tangkapan layar ada di `~/Documents/ChatGPT/Laundry/cuciin-theme-mockup/`. Perubahan tema belum di-push; kalau Codex perlu menyentuh file di atas, koordinasikan dulu karena versi dan changelog sudah naik ke 1.9.2.

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

1. Hermes: tulis kontrak `accessPolicy` + `whatsappTemplate` di `SYNC_API.md`, lalu tambah test Worker untuk retry, role Owner-only, dan idempotensi.
2. Codex: lengkapi `releases/1.9.1-candidate/` (README + SHA256SUMS) dan segarkan `RELEASE_READINESS.md` ke 1.9.1.
3. Setelah keduanya mendarat: perbarui `AGENT_HANDOVER.md` ke 1.9.1 / versionCode 16 / commit terbaru, lalu validasi penuh dan UAT perangkat.

## 7. Lingkungan build di mesin ini

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd laundry-ops/android && ./gradlew testDebugUnitTest lintDebug assembleDebug
```

`android/local.properties` sudah diisi `sdk.dir=/opt/homebrew/share/android-commandlinetools` (di-gitignore, jangan di-commit). Node 26.7.0 dan npm 11.19.0 tersedia untuk `npm run check`. Wrangler 4.131.1 sudah terautentikasi sebagai `tiftazani.khara@gmail.com`.

Catatan: macOS di mesin ini tidak punya `timeout`/`gtimeout`. Jangan pakai perintah itu untuk membatasi proses panjang.
