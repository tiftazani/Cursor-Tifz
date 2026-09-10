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
    val currentName: String = "1.4.0"
    val currentCode: Int = 5

    val releases: List<AppRelease> = listOf(
        AppRelease(
            name = "1.4.0",
            code = 5,
            date = "10 Sep 2026",
            notes = listOf(
                "UI baru: teal, kartu, hero, bukan form Material polos.",
                "User, pelanggan, kasir/SPV, cabang, layanan, produk: tambah · ubah · hapus.",
                "Layout menyesuaikan HP sempit, tablet, dan landscape (bottom bar / rail).",
            ),
        ),
        AppRelease(
            name = "1.3.0",
            code = 4,
            date = "10 Sep 2026",
            notes = listOf(
                "Database di server: HP kasir/owner nge-share lewat https://cuan-tif.vercel.app/api/cuciin.",
                "Poll 8 detik. Nota/stok/pelanggan/audit ikut ke server, cache tetap di HP.",
                "Firebase Firestore (ops/cuciin) nyala otomatis kalau google-services.json ada.",
            ),
        ),
        AppRelease(
            name = "1.2.0",
            code = 3,
            date = "10 Sep 2026",
            notes = listOf(
                "Bukan demo: data tersimpan di HP (JSON). Tutup app, nota/stok/audit tetap ada.",
                "Waktu nota, ID per cabang, analytics, tutup kas dihitung dari transaksi nyata.",
                "Pelanggan & cabang bisa ditambah. Foto disalin ke folder app. PDF/CSV file beneran.",
                "Antrian awal kosong. Isi stok & pelanggan, lalu buat nota.",
            ),
        ),
        AppRelease(
            name = "1.1.0",
            code = 2,
            date = "10 Sep 2026",
            notes = listOf(
                "Firebase Auth + Firestore: nyala otomatis kalau google-services.json ada.",
                "Tanpa file itu, app tetap jalan full fitur pakai data lokal di HP.",
                "Nota, WA terkirim, lunas, stok, approve user, audit ikut ke-push ke cloud.",
                "APK debug bisa diunduh dari halaman Cuciin di web.",
            ),
        ),
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
