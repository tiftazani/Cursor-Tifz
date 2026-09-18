package com.cuciin.laundryops.ui

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Dialog pemilih tanggal dan jam memakai warna aplikasi, bukan warna bawaan Android.
 *
 * Pernah terjadi: dialog memakai `android.R.style.Theme_Material_Light_Dialog_Alert` yang
 * dipaku mati, sehingga tombol "Pilih" dan "Batal" berwarna teal bawaan Android sementara
 * seluruh tombol aplikasi berwarna magenta. Dua warna itu bertabrakan dan terlihat sebagai
 * bug di layar pemilih tanggal.
 *
 * Test ini membaca berkas sumber langsung supaya pola itu tidak kembali masuk, termasuk lewat
 * penambahan dialog baru di masa depan.
 */
class PickerThemeTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    @Test
    fun dialogPemilihTidakMemakaiTemaBawaanAndroid() {
        val kode = baca("src/main/java/com/cuciin/laundryops/ui/DateTimeFields.kt")
        // Komentar dibuang dulu: penjelasan tentang tema lama memang menyebut namanya.
        val tanpaKomentar = kode.split("\n")
            .filter { !it.trimStart().startsWith("//") && !it.trimStart().startsWith("*") && !it.trimStart().startsWith("/*") }
            .joinToString("\n")
        assertTrue(
            "Dialog pemilih tidak boleh memakai tema bawaan Android karena membawa warna teal. " +
                "Pakai R.style.Theme_Cuciin_Picker.",
            !tanpaKomentar.contains("android.R.style"),
        )
        assertTrue(
            "Dialog pemilih harus memakai R.style.Theme_Cuciin_Picker",
            tanpaKomentar.contains("R.style.Theme_Cuciin_Picker"),
        )
    }

    @Test
    fun temaDialogAdaDanMemakaiAksenCuciin() {
        val tema = baca("src/main/res/values/themes_picker.xml")
        assertTrue("tema dialog harus ada", tema.contains("Theme.Cuciin.Picker"))
        assertTrue("aksen harus memakai warna Cuciin", tema.contains("cuciin_accent"))
    }

    @Test
    fun warnaAksenDialogSejalanDenganPaletCompose() {
        // Kalau salah satu berubah tanpa yang lain, dialog dan tombol aplikasi akan berbeda warna.
        val warna = baca("src/main/res/values/colors.xml")
        val tema = baca("src/main/java/com/cuciin/laundryops/ui/theme/Theme.kt")
        assertTrue("cuciin_accent harus #C1358F", warna.contains("""<color name="cuciin_accent">#C1358F</color>"""))
        assertTrue("palet Compose harus memuat prim #C1358F", tema.contains("Color(0xFFC1358F)"))
    }

    @Test
    fun tidakAdaDialogSistemLainYangMemakaiTemaBawaan() {
        val uiDir = File(appDir, "src/main/java/com/cuciin/laundryops/ui")
        val pelanggar = uiDir.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { berkas ->
                // Komentar dibuang dulu: penjelasan tentang tema lama memang menyebut namanya,
                // dan itu tidak boleh dianggap sebagai pemakaian.
                berkas.readText().split("\n")
                    .filter { baris ->
                        val t = baris.trimStart()
                        !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
                    }
                    .joinToString("\n")
                    .contains("android.R.style")
            }
            .map { it.name }
            .toList()
        assertTrue("Dialog sistem yang memakai tema bawaan Android: $pelanggar", pelanggar.isEmpty())
    }
}
