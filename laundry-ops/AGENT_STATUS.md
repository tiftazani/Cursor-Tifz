# Papan status & klaim file antar-agent

Terakhir diperbarui: 15 September 2026, 14:05 WIB (oleh Hermes).
Baca bersama `AGENT_HANDOVER.md`, `AGENT_WORKFLOW.md`, dan `CODING_AGENT_CONTEXT.md`.

Tujuan dokumen ini: satu tempat untuk melihat **siapa memegang file apa** dan **sampai mana pekerjaan berjalan**, supaya Hermes, Codex, Cursor, dan OpenCode tidak menyunting berkas yang sama.

## 1. Titik berangkat yang sudah diverifikasi

| Hal | Nilai | Cara cek |
|---|---|---|
| Repo lokal | `/Users/tiftazani/Documents/ChatGPT/Laundry/Cursor-Tifz` | satu-satunya clone; `~/Cursor-Tifz` bukan clone repo ini |
| Branch | `codex/cuciin-1-8-1` | `git status -sb` |
| HEAD | `76545ad` — sama dengan `origin/codex/cuciin-1-8-1` (0 ahead / 0 behind) | `git rev-list --left-right --count HEAD...origin/...` |
| PR | #18, OPEN, mergeable, check hijau (validate, verify, Vercel, Security Reviewer) | `gh pr checks 18` |
| Android | 1.9.0 (versionCode 15) | `app/build.gradle.kts` |
| Worker produksi | versi `d451c581-…`, D1 `cuciin-db` | `AGENT_HANDOVER.md` |
| Test Worker | 20/20 lulus di HEAD | `cd cloudflare && npm run check` |

## 2. Pekerjaan yang sedang berjalan (belum di-commit)

Permintaan 15 Sep 12:24 WIB dikerjakan Codex di working tree dan **berhenti pukul 12:32:33 karena kuota** (`usageLimitExceeded`, jendela berikutnya 14:51). Perubahan ada di disk, belum di-commit, dan **belum bisa di-compile**.

Bukti cadangan (dibuat Hermes, working tree tidak diubah):
- patch: `/Users/tiftazani/Documents/ChatGPT/Laundry/cuciin-wip-backup-20260915-140612/tracked-changes.patch`
- berkas baru: `…/untracked/laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/AttendancePhotos.kt`
- snapshot git: `git stash list` → `stash@{0}: codex WIP 2026-09-15 12:30`

### Status tujuh item permintaan 12:24

| # | Item | Status | Bukti |
|---|---|---|---|
| 1 | Retail ↔ Produk stok saling terhubung | Kode selesai, UI produk belum | `ServiceItem.productKey`, `NotaLine.productKey`, `linkedProduct()`, `retailStockShortages()` di `data/CuciinStore.kt` |
| 2 | Akun & Profil: info cabang salah | Belum | `ui/MoreScreens.kt` masih `store.branch(s.branchId).name`; untuk Owner itu cabang pertama penugasan, bukan cabang yang sedang dilihat |
| 3 | Inventory digabung ke Produk stok, stok bisa multi-cabang | Belum | `InventoryScreen` masih ada; `addProduct(..., initialBranchIds: Set<String>)` sudah ada tapi `ProductsScreen` belum diubah |
| 4 | Hanya Owner boleh koreksi Service setelah nota terkirim | Selesai | `CuciinStore.kt` `correctNota`/`deleteNota` menolak `waSent` untuk non-Owner |
| 5 | Foto absensi dari kamera + tanggal/waktu tercap di gambar | Selesai | `data/AttendancePhotos.kt` (baru), `AttendanceScreen` di `ui/BusinessScreens.kt`, `res/xml/file_paths.xml` |
| 6 | User access control (modul + fungsi) | Setengah | `UserAccessPolicy`, `canAccess()`, `saveAccessPolicy()` ada; **belum ada layar**, dan server belum mengenal entitasnya |
| 7 | Template WhatsApp (pembuka, isi, penutup) | Setengah | `WhatsAppTemplate`, `ReceiptText.format(…, template)`, `saveWhatsAppTemplate()` ada; **belum ada layar**, server belum mengenal entitasnya |

### Blocker yang harus dibaca sebelum siapa pun menyentuh file itu

1. **Compile gagal, 5 error, semuanya di `ui/MasterScreens.kt`.** Perintah: `cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew compileDebugKotlin`.
   - baris 400 & 404: `Unresolved reference 'ProductKind'` (file itu tidak mengimpor `com.tiftazani.laundryops.data.*`)
   - baris 504: `addProduct` sekarang minta `Set<String>`, UI masih mengirim `String`
   - baris 505: `updateProduct` sekarang minta `kind` dan `unit`, pemanggil belum diubah
2. **Jangan aktifkan command `accessPolicy` / `whatsappTemplate` dulu.** `data/SyncProtocol.kt` sudah punya spec untuk keduanya, jadi Android akan mengantre command dengan `entityType` itu. Server (`cloudflare/src/command-sync.ts`) belum punya alias maupun `KNOWN_COMMANDS` untuk keduanya, jadi balasannya 422 "Tipe command tidak didukung" — dan 422 dianggap penolakan permanen, bukan retry. Artinya perubahan Owner akan mendarat di daftar konflik, bukan tersinkron.
3. Item 6 dan 7 butuh pekerjaan server lebih dulu: alias command, tabel D1, otorisasi Owner-only, dan entri di `SYNC_API.md`.

## 3. Klaim file (berlaku sampai handover berikutnya)

Aturan: satu file satu pemilik. Kalau butuh mengubah file milik agent lain, minta lewat chat/PR, jangan edit langsung.

### Pegangan Codex — pekerjaan 15 Sep 12:24 yang belum selesai

Codex melanjutkan pekerjaannya sendiri. File yang jadi miliknya:

```
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/MasterScreens.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/BusinessScreens.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/AttendancePhotos.kt
laundry-ops/android/app/src/main/res/xml/file_paths.xml
```

Sisa tugas di pegangannya: betulkan 5 error compile, sambungkan `ProductsScreen` ke `kind`/`unit`/`Set<String>` cabang, gabungkan menu Inventory ke Produk stok, perbaiki label cabang di `ProfilScreen`, lalu buat layar **User access control** dan **Template WhatsApp**.

### Pegangan Hermes

Hermes tidak menyentuh UI Android di atas. Milik Hermes:

```
laundry-ops/cloudflare/SYNC_API.md
laundry-ops/cloudflare/migrations/0004_*.sql          (baru)
laundry-ops/cloudflare/src/command-sync.ts
laundry-ops/cloudflare/src/index.ts
laundry-ops/cloudflare/tests/*.mjs
laundry-ops/AGENT_STATUS.md                            (dokumen ini)
```

Isi pekerjaan Hermes: kontrak + migrasi D1 + command server untuk `accessPolicy` dan `whatsappTemplate` (alias, tabel, otorisasi Owner-only, scope cabang, idempotensi, test retry/role), plus dokumen sinkronisasi. Tujuannya supaya item 6 dan 7 punya sisi server yang siap sebelum layarnya dihidupkan.

### Pegangan bersama — jangan disunting tanpa bicara dulu

```
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/CuciinStore.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/Models.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/SyncProtocol.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/ReceiptText.kt
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/ui/MoreScreens.kt
laundry-ops/android/CHANGELOG.md
laundry-ops/android/app/src/main/java/com/tiftazani/laundryops/data/VersionHistory.kt
```

`CuciinStore.kt`, `Models.kt`, dan `SyncProtocol.kt` sudah berisi perubahan Codex yang belum di-commit. Siapa pun yang menyentuhnya wajib `git diff` dulu dan menyebutkan alasannya, supaya perubahan setengah jadi itu tidak hilang.

`MoreScreens.kt` belum tersentuh siapa pun sejak HEAD; item 2 dan layar item 6–7 kemungkinan besar mendarat di sini, jadi satu agent saja yang boleh memegangnya pada satu waktu.

## 4. Urutan kerja yang disarankan

1. Codex: betulkan 5 error compile (tanpa mengubah perilaku lain) dan pastikan `./gradlew testDebugUnitTest` hijau. Ini membuka jalan bagi semua orang.
2. Codex: lanjutkan sisa item UI (2, 3, lalu layar 6–7).
3. Hermes: kerjakan sisi server 6–7 (kontrak → migrasi → command → test) di jalur yang tidak bertabrakan.
4. Setelah keduanya mendarat: naikkan versi, changelog, `VersionHistory`, lalu validasi penuh.

## 5. Lingkungan build di mesin ini

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd laundry-ops/android && ./gradlew testDebugUnitTest lintDebug assembleDebug
```

`android/local.properties` sudah diisi `sdk.dir=/opt/homebrew/share/android-commandlinetools` (di-gitignore, jangan di-commit). Node 26.7.0 dan npm 11.19.0 tersedia untuk `npm run check`.
