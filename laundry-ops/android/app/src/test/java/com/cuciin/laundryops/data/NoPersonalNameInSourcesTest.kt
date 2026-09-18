package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pemindai nama pribadi di seluruh berkas yang tampil ke pengguna.
 *
 * Test ini membaca berkas sumber langsung, bukan nilai di memori, supaya nama pribadi tidak
 * bisa masuk kembali lewat berkas baru, teks di `res/`, atau salin tempel dari versi lama.
 *
 * Aturan yang dijaga: kata "tiftazani" hanya boleh muncul sebagai bagian alamat email
 * `tiftazani.khara@gmail.com`, karena itu identitas akun Firebase yang tidak bisa diganti.
 */
class NoPersonalNameInSourcesTest {

    /** Akar sumber, naik dari folder kelas test ke akar modul `app`. */
    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private val berkasYangDipindai = listOf(
        "src/main/java",
        "src/main/res",
        "src/debug",
    )

    private val ekstensi = setOf("kt", "xml", "json", "txt", "html")

    private fun berkasSumber(): List<File> =
        berkasYangDipindai.map { File(appDir, it) }.filter { it.exists() }.flatMap { root ->
            root.walkTopDown().filter { it.isFile && it.extension.lowercase() in ekstensi }.toList()
        }

    @Test
    fun tidakAdaNamaPribadiSelainDiAlamatEmail() {
        val pelanggar = mutableListOf<String>()
        for (berkas in berkasSumber()) {
            val teks = berkas.readText()
            if (!teks.contains("tiftazani", ignoreCase = true)) continue
            // Buang kemunculan yang merupakan bagian alamat email, lalu periksa sisanya.
            val sisa = teks
                .replace("tiftazani.khara@gmail.com", "", ignoreCase = true)
                .replace("Tiftazani Khara", "", ignoreCase = true)
                .replace("tiftazani-cuciin", "", ignoreCase = true)
            if (sisa.contains("tiftazani", ignoreCase = true)) {
                val baris = teks.lines().withIndex()
                    .filter { (_, l) -> l.contains("tiftazani", ignoreCase = true) }
                    .map { (i, l) -> "${i + 1}: ${l.trim().take(90)}" }
                pelanggar += "${berkas.relativeTo(appDir)} -> ${baris.joinToString(" | ")}"
            }
        }
        assertTrue(
            "Nama pribadi ditemukan di berkas yang tampil ke pengguna:\n" + pelanggar.joinToString("\n"),
            pelanggar.isEmpty(),
        )
    }

    @Test
    fun pemindaiMenemukanBerkasSumber() {
        // Menjaga supaya test di atas tidak lulus palsu karena tidak menemukan berkas apa pun.
        assertTrue("Pemindai tidak menemukan berkas sumber", berkasSumber().size > 20)
    }
}
