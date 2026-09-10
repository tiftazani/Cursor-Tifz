# Changelog Cuciin Android

Format: versi di `laundry-ops/android/app/build.gradle.kts` (`versionName` / `versionCode`) **harus sama** dengan entri di `VersionHistory.kt`. Layar **Riwayat versi** di app membaca `VersionHistory`.

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
