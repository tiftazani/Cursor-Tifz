# Changelog Cuciin Android

Format: versi di `laundry-ops/android/app/build.gradle.kts` (`versionName` / `versionCode`) **harus sama** dengan entri di `VersionHistory.kt`. Layar **Riwayat versi** di app membaca `VersionHistory`.

## 1.3.0 — 10 Sep 2026 (versionCode 4)

Database di server. HP kasir/owner nge-share dokumen toko yang sama.

- API `https://cuan-tif.vercel.app/api/cuciin` (key di APK), persist di store JSON server
- Sync pull/push + poll 8 detik; cache JSON tetap di HP (offline)
- Firestore `ops/cuciin` kalau `google-services.json` ada (Firebase)

## 1.2.0 — 10 Sep 2026 (versionCode 3)

App operasional di HP, bukan angka dummy.

- Persist JSON di penyimpanan app; session, nota, stok, pelanggan, cabang, audit, tutup kas
- Timestamp Asia/Jakarta; ID nota `{KODE}-{yyMM}-{urut}`
- Analytics & tutup kas dari nota tersimpan (Tunai/QRIS/Transfer = catat metode)
- Foto disalin ke `files/proofs`; share PDF + CSV file
- Tambah pelanggan & cabang; antrian awal kosong

## 1.1.0 — 10 Sep 2026 (versionCode 2)

Firebase Auth + Firestore, tetap jalan lokal tanpa `google-services.json`.

- Plugin Google Services cuma applied kalau `app/google-services.json` ada
- Login/daftar: coba Firebase dulu, fallback akun demo lokal
- Nota, status laundry/bayar, WA, bukti, stok, approve user, audit di-push ke Firestore
- APK debug di `https://cuan-tif.vercel.app/cuciin/cuciin.apk`

## 1.0.0 — 10 Sep 2026 (versionCode 1)

Rilis pertama APK.

- Kotlin + Jetpack Compose, package `com.tiftazani.laundryops`
- Owner Tiftazani Khara; multi cabang (nama, lokasi, Google Maps)
- 1 laundry ≥1 kasir + SPV; data cabang = gabungan kasir
- Antrian menggantung sampai laundry selesai DAN bayar lunas
- Status laundry Masuk / In Progress / Selesai; bayar Belum lunas / Lunas
- WA pending sampai dikirim, lalu archive
- Nota teks / Excel / share; ID unik per cabang; pickup; bukti di penyimpanan HP
- Stok mutasi tanggal, auto potong retail, edit manual
- Analytics Owner harian–tahunan; audit trail; modul + tombol back
- Layar Riwayat versi di dalam aplikasi
