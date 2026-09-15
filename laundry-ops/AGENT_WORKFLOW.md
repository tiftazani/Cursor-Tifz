# Protokol kerja beberapa agent

Gunakan dokumen ini saat satu pekerjaan dibagi ke Hermes, OpenCode, Cursor, Codex, atau reviewer.

Klaim file yang sedang berlaku dicatat di `AGENT_STATUS.md`. Baca file itu sebelum menyentuh kode.

## Sebelum pekerjaan dimulai

1. Koordinator memilih satu branch dan menyebut commit dasar.
2. Setiap agent mengklaim daftar file atau folder. Tidak ada dua agent mengedit berkas yang sama tanpa koordinasi. Tulis klaimnya di `AGENT_STATUS.md`, bukan hanya di chat.
3. Agent membaca `AGENT_HANDOVER.md`, `CODING_AGENT_CONTEXT.md`, `AGENT_STATUS.md`, dan dokumen domain terkait.
4. Perubahan API, database, atau role harus memiliki pemilik tunggal. Agent lain boleh review, tidak mengubah kontrak secara paralel.

## Pembagian yang aman

| Area | Pemilik ideal | Verifikasi |
|---|---|---|
| Compose, navigasi, PDF/WA | agent Android UI | test/lint/build Android |
| Store, outbox, sync protocol | agent data Android | test sync Android + review Worker contract |
| Worker, D1, command, laporan | agent backend | `npm run check` + migration review |
| Runbook, changelog, handover | agent dokumentasi | link, versi, dan fakta produksi konsisten |
| Integritas dan security | reviewer terpisah | audit read-only berbasis skenario nyata |

Pekerjaan yang belum di-commit wajib disebut di `AGENT_STATUS.md` sebelum agent lain masuk ke area yang sama. Jangan menyimpan perubahan setengah jadi hanya di working tree tanpa catatan.

## Urutan ketika kontrak berubah

1. Tulis kontrak request/response dan versi kompatibilitas di `cloudflare/SYNC_API.md`.
2. Tambahkan atau sesuaikan migrasi D1 bila diperlukan; migration lama tidak boleh diubah setelah produksi.
3. Tambahkan validasi server dan test untuk retry, role, cabang, serta data lama.
4. Perbarui Android agar membaca respons baru tanpa menghapus retry atau pending-remote recovery.
5. Uji setidaknya perangkat baru, perangkat dengan cache lama, dua perangkat pada cabang sama, dan akun non-Owner.
6. Deploy hanya dalam urutan migrasi → Worker → APK, dengan backup dan rollback sesuai runbook.

## Format handover hasil kerja

```text
Tujuan:
File diubah:
Aturan bisnis/data yang dijaga:
Test dan hasil:
Migrasi/deploy diperlukan:
Risiko atau UAT tersisa:
Commit atau diff:
```

## Batas yang memerlukan Owner

Agent tidak boleh membuat keputusan atas password nyata, MFA, tujuan backup privat, keystore/passphrase, saldo awal, harga/komisi operasional, data pelanggan nyata, kebijakan privasi, atau go-live 20 cabang. Catat sebagai tindakan Owner pada handover, lalu lanjutkan pekerjaan teknis yang aman.
