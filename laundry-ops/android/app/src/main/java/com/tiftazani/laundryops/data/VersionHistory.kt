package com.tiftazani.laundryops.data

/**
 * Sumber versi di app. Selaras dengan `versionName` / `versionCode` di Gradle.
 * Tambah entri di sini setiap bump APK — layar Riwayat versi membacanya.
 */
data class AppRelease(
    val name: String,
    val code: Int,
    val date: String,
    val notes: List<String>,
)

object VersionHistory {
    val currentName: String = "1.0.0"
    val currentCode: Int = 1

    val releases: List<AppRelease> = listOf(
        AppRelease(
            name = "1.0.0",
            code = 1,
            date = "10 Sep 2026",
            notes = listOf(
                "Rilis pertama Android Cuciin (Kotlin + Jetpack Compose).",
                "Owner: Tiftazani Khara. Multi cabang: nama, lokasi, titik Google Maps.",
                "Satu laundry bisa banyak kasir dan SPV. Data cabang = gabungan kasir.",
                "Antrian menggantung sampai laundry selesai DAN bayar lunas.",
                "Status laundry: Masuk / In Progress / Selesai. Bayar: Belum lunas / Lunas.",
                "List WA pending sampai dikirim, lalu pindah ke archive (tetap bisa dibuka).",
                "Nota: teks, Excel, PDF; ID unik per cabang; waktu lengkap; pelaku; pickup.",
                "Stok: mutasi per tanggal, auto potong retail, edit manual kasir.",
                "Analytics Owner harian–tahunan, pecah per cabang dan kasir. Audit trail.",
                "Bukti foto/dokumen disimpan di HP, bukan cloud. Modul terpisah + tombol back.",
            ),
        ),
    )
}
