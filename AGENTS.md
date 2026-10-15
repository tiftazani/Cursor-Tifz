# Kunci: konteks untuk Claude Code

Proyek aktif adalah `kunci/`, bukan aplikasi di root repo. Baca `kunci/HANDOFF.md`
pada awal sesi. Baca `kunci/docs/MAINTENANCE.md` sebelum menyentuh area terkait.
Kedua dokumen berdiri sendiri; tidak membutuhkan memori atau tools Hermes.

## Batas kerja

- Repo lokal: `/Users/tiftazani/Documents/Hermes-AI/Kunci`.
- Folder aplikasi: `/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci`.
- Branch: `cursor/kunci-password-manager-4eaf`. Periksa git lagi sebelum bekerja.
- Jangan sentuh `cuan-yuk-guys/`. Jangan merge ke `main`.
- Jangan commit, push, stash, checkout ulang branch, atau reset kecuali diminta.
- Ada commit lokal yang belum dikirim. Jangan mengganti tree ini dengan clone remote.
- Jangan hapus file untracked milik pekerjaan sebelumnya tanpa persetujuan.
- Script npm di root menjalankan Cuan Yuk Guys. Semua perintah Kunci harus dari `kunci/`.

## Cara kerja

Baca definisi dan pemanggil sebelum mengedit. Pakai fitur bawaan atau dependency yang
sudah terpasang. Buat perubahan sekecil mungkin. Jangan refactor area lain.
Untuk bug, tambahkan tes yang gagal karena bug itu, lalu perbaiki kedua sisi bila ada
salinan web dan ekstensi. Jangan memutasi kode sementara saat build/deploy berjalan.

Sebelum menyatakan selesai, dari `kunci/` jalankan berurutan:

```sh
npx tsc -b
npx vitest run
npm run lint
npm run build
```

Perubahan UI/ekstensi perlu uji browser selain unit test. Tes yang membaca teks source
bukan bukti perilaku UI. Laporkan apa yang diuji dan apa yang belum terbukti.
`npm run build` dapat mengubah PNG hasil generator; cek git diff dan jangan ikutkan
perubahan aset yang tidak diminta. Jangan memakai reporter Vitest `basic`.

## Data dan keamanan

- Jangan meminta, menerima, mencetak, atau memasukkan master password, recovery key,
  password tersimpan, token helper, kode OTP, atau API key melalui percakapan/log.
- Jangan membuka `.env`, credential files, isi `~/.kunci/`, storage vault pengguna,
  atau profil browser pribadi untuk mengambil rahasia.
- Gunakan vault contoh dan profil browser terpisah untuk tes. Pengguna membuka vault
  nyata sendiri; ukur struktur/jumlah saja, bukan isi entri.
- Enkripsi terjadi di klien. Cloud menyimpan ciphertext, bukan vault plaintext.
- Ada pengecualian lama: fitur kirim recovery key lewat email melewatkan key ke Worker
  dan penyedia email. Jangan menyebut alur itu zero-knowledge penuh.
- Jangan mengubah format blob, kunci enkripsi, origin allowlist, atau aturan lock tanpa
  tes migrasi/round-trip dan kajian dampak kehilangan data.
- Fitur tim belum dibuat. `TEAM-SECURITY-DESIGN.md` hanya proposal, bukan fitur selesai.

## Produk dan komunikasi

Jawab Bahasa Indonesia dengan kalimat pendek. Mulai dari hasil, bukan basa-basi.
Jangan mengarang hasil tes, angka, pengalaman, atau sumber. Bedakan fakta dan dugaan.
Pengguna meminta bukti nyata dan pemeriksaan regresi, bukan sekadar build hijau.

Sebelum perubahan tampilan baru, tunjukkan mockup hasil render browser dan tunggu
persetujuan. Pertahankan arah dashboard personal v2 yang sudah ada; jangan otomatis
mengganti dengan iterasi mockup terakhir. Uji desktop/tablet/ponsel serta dua tema.

## Rilis

Kunci memakai Cloudflare Worker `kunci`, bukan Surge, Netlify, atau Vercel.
Tidak ada deployment yang diperlukan untuk perubahan dokumentasi/tes saja.
Untuk perubahan runtime yang akan dirilis: ikuti urutan versi, tes, build, deploy,
restart helper bila perlu, lalu cek bundle LIVE dalam `HANDOFF.md`.
Jangan mengubah secret cloud yang sudah ada tanpa permintaan.

## Status migrasi dari Claude Code (15 Okt 2026)

### Konteks teknis
- Repo GitHub `tiftazani/Cursor-Tifz`. `main` punya histori yang tidak berkaitan (berisi cuan-yuk-guys, laundry-ops, .github), jadi PR dari branch kerja tidak bisa di-merge; PR #6 sudah CLOSED atas permintaan user.
- Akses: https://kunci.tiftazani-cuciin.workers.dev (email + OTP, lalu master password); helper lokal http://127.0.0.1:8780 (`/health` versi 1.4.11 saat dicek); deploy preview Netlify `kunci-tifta`.
- Output Bash kadang tercampur hook graft; arahkan output tes ke log di /tmp lalu baca dari sana.
- Tes tidak boleh memanggil Worker produksi. Timeout tes tidak diatasi dengan menaikkan batas waktu.
- Warning lint `startNew` di `AppShell.tsx:138` dinilai false positive (function declaration ter-hoist); dibiarkan.
- Harness e2e ekstensi (Chromium, profil sementara, vault sintetis) ada di luar repo: /tmp/kunci-ext-e2e/run.mjs.
- Kredensial hanya di vault terenkripsi (IndexedDB `kunci-vault`, blob di Worker `kunci`); tidak ada file plaintext.

### Pekerjaan pending
- [ ] Race antara tulisan ekstensi dan `persist()` web di `VaultContext.tsx` (`listenExtensionVault` di luar `persistChain`): perlu merge entri yang tidak menghidupkan lagi entri yang sudah dihapus. `kunci/src/lib/vault-merge.ts` dan `kunci/tests/vault-merge.test.ts` sudah ada (untracked), tapi belum diintegrasikan ke VaultContext, tes belum dijalankan, belum di-commit.
- [ ] Untracked lain: `.ignore` (graft) dan `kunci/.audit/port-ab.mjs`, `kunci/.audit/port-live.mjs`. Jangan hapus tanpa persetujuan.
- [ ] Belum diuji: Brave asli, situs nyata, sinkronisasi cloud.
- [ ] Fitur tim masih proposal; recovery email belum zero-knowledge penuh; belum ada audit kriptografi independen.
- [ ] User perlu memindahkan sesi ke label sidebar "Kunci" secara manual.

### Riwayat sesi
- 2026-10-09 — Migrasi Kunci dari Hermes — gate hijau (tsc, vitest 485/485, lint 0 error, build hash sama dengan LIVE); commit `cb6aa4d` (handoff + `/graft/` di .gitignore), `ef3ca9f` (tes audit background ekstensi dibuat offline), `a2a1ce3` (`rewrapWithPassword` memperbarui savedAt; vitest 486/486), semua di-push; e2e ekstensi 17/17; thread Bugbot di-resolve; PR #6 ditutup.
