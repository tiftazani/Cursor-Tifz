package com.cuciin.laundryops.ui

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pemilih tanggal dan jam memakai komponen Compose, bukan dialog bawaan Android.
 *
 * Dua masalah pernah terjadi karena memakai dialog bawaan:
 *
 * 1. Dialognya memakai `android.R.style.Theme_Material_Light_Dialog_Alert` yang dipaku mati.
 *    Tema bawaan itu membawa aksen teal, sehingga tombol "Pilih" dan "Batal" berbeda warna
 *    dari seluruh tombol aplikasi.
 * 2. Dialog bawaan selalu terang. Di tema Gelap dan Custom, dialog itu muncul sebagai kotak
 *    putih menyolok di atas latar gelap.
 *
 * Komponen Compose mengambil warna dari `MaterialTheme.colorScheme`, yang sudah diturunkan
 * dari palet Cuciin, jadi warnanya ikut berubah saat tema diganti. Test ini menjaga supaya
 * dialog bawaan Android tidak dipakai lagi.
 */
class PickerThemeTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    /** Buang komentar supaya penjelasan tentang cara lama tidak terbaca sebagai pemakaian. */
    private fun tanpaKomentar(kode: String): String = kode.split("\n")
        .filter { baris ->
            val t = baris.trimStart()
            !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
        }
        .joinToString("\n")

    @Test
    fun pemilihTanggalTidakMemakaiDialogBawaanAndroid() {
        val kode = tanpaKomentar(baca("src/main/java/com/cuciin/laundryops/ui/DateTimeFields.kt"))
        assertTrue(
            "Pemilih tanggal tidak boleh memakai dialog bawaan Android: warnanya tidak ikut " +
                "palet aplikasi dan selalu terang.",
            !kode.contains("android.app.DatePickerDialog") && !kode.contains("android.app.TimePickerDialog"),
        )
        assertTrue(
            "Pemilih tanggal harus memakai komponen Compose Material3",
            kode.contains("androidx.compose.material3.DatePickerDialog") &&
                kode.contains("androidx.compose.material3.TimePicker"),
        )
    }

    @Test
    fun tidakAdaDialogSistemYangMemakaiTemaBawaanAndroid() {
        val uiDir = File(appDir, "src/main/java/com/cuciin/laundryops/ui")
        val pelanggar = uiDir.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { tanpaKomentar(it.readText()).contains("android.R.style") }
            .map { it.name }
            .toList()
        assertTrue("Dialog sistem yang memakai tema bawaan Android: $pelanggar", pelanggar.isEmpty())
    }

    @Test
    fun tidakAdaTemaDialogKhususDiSumberDaya() {
        // Tema XML hanya perlu kalau memakai dialog bawaan Android. Dengan dialog Compose,
        // tema itu jadi kode mati yang membingungkan.
        val tema = File(appDir, "src/main/res/values/themes_picker.xml")
        assertTrue("themes_picker.xml tidak dipakai lagi dan tidak boleh ada", !tema.exists())
    }

    @Test
    fun warnaPemilihTidakDipakuDiSumberDaya() {
        // Warna dialog harus datang dari palet Compose, bukan dari nilai yang ditulis terpisah
        // di colors.xml. Kalau ditulis terpisah, tema Custom tidak akan ikut terpakai.
        val warna = baca("src/main/res/values/colors.xml")
        assertTrue(
            "Warna dialog tidak boleh dipaku di colors.xml",
            !warna.contains("cuciin_accent") && !warna.contains("cuciin_dialog_surface"),
        )
    }

    @Test
    fun konversiTanggalPemilihMemakaiTengahHariUtc() {
        // Pemilih Material3 memakai acuan UTC. Tengah malam bisa menggeser tanggal satu hari
        // di zona waktu tertentu, jadi konversinya harus lewat tengah hari.
        val kode = baca("src/main/java/com/cuciin/laundryops/ui/DateTimeFields.kt")
        assertTrue("konversi harus memakai ZoneOffset.UTC", kode.contains("ZoneOffset.UTC"))
        assertTrue("konversi harus memakai tengah hari", kode.contains("plusHours(12)"))
    }
}
