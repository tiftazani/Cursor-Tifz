package com.cuciin.laundryops.ui

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontrak berbagi nota pelanggan.
 *
 * Permintaan pemilik (30 Sep 2026): keluaran berbagi nota selain Teks, Excel, dan PDF juga
 * tersedia JPEG. Aturannya:
 *
 *  1. Bagian "Bagikan nota" menawarkan EMPAT bentuk keluaran: Teks, Excel, PDF, JPEG.
 *  2. Setiap tombol memanggil fungsi ekspornya masing-masing di `FileExports`.
 *  3. JPEG memakai GAMBAR NOTA YANG SAMA dengan PDF: dirender dari `ReportPdf.nota`, bukan
 *     tata letak terpisah, supaya kedua berkas tidak pernah berbeda isi.
 *
 * Berkas ini memindai berkas sumber, jadi tombol atau sambungan yang hilang akan gagal di sini.
 */
class NotaJpegContractTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    private val ops = baca("src/main/java/com/cuciin/laundryops/ui/OpsScreens.kt")
    private val exports = baca("src/main/java/com/cuciin/laundryops/data/FileExports.kt")
    private val jpeg = baca("src/main/java/com/cuciin/laundryops/data/ReportJpeg.kt")

    /** Isi bagian "Bagikan nota" pada layar detail Service, dibatasi beberapa baris setelahnya. */
    private fun blokBagikanNota(): String {
        val baris = ops.lines()
        val mulai = baris.indexOfFirst { it.contains("\"Bagikan nota\"") }
        assertTrue("Bagian \"Bagikan nota\" tidak ditemukan di OpsScreens.kt", mulai >= 0)
        return baris.subList(mulai, (mulai + 25).coerceAtMost(baris.size)).joinToString("\n")
    }

    @Test
    fun bagianBagikanNotaMenawarkanEmpatBentukKeluaran() {
        val blok = blokBagikanNota()
        listOf("Teks", "Excel", "PDF", "JPEG").forEach { label ->
            assertTrue(
                "Tombol $label tidak ada di bagian Bagikan nota:\n$blok",
                blok.contains("GhostBtn(\"$label\""),
            )
        }
    }

    @Test
    fun setiapTombolMemanggilFungsiEkspornya() {
        val blok = blokBagikanNota()
        listOf("shareText", "shareCsv", "sharePdf", "shareJpeg").forEach { fungsi ->
            assertTrue(
                "FileExports.$fungsi tidak dipanggil dari bagian Bagikan nota:\n$blok",
                blok.contains("FileExports.$fungsi("),
            )
        }
    }

    @Test
    fun jpegMemakaiGambarNotaYangSamaDenganPdf() {
        assertTrue(
            "ReportJpeg harus merender dari ReportPdf.nota supaya gambarnya sama dengan PDF",
            jpeg.contains("ReportPdf.nota("),
        )
        assertTrue(
            "ReportJpeg harus meraster halaman PDF lewat PdfRenderer",
            jpeg.contains("PdfRenderer"),
        )
        assertTrue("shareJpeg harus memanggil ReportJpeg.nota", exports.contains("ReportJpeg.nota("))
        assertTrue("shareJpeg harus mengirim berkas bertipe image/jpeg", exports.contains("\"image/jpeg\""))
    }

    @Test
    fun halamanDirenderDenganMatriksSkala() {
        assertTrue(
            "PdfRenderer tidak menskalakan sendiri; ReportJpeg harus memakai Matrix.setScale " +
                "supaya nota 2x tidak tampak kecil di pojok bitmap",
            jpeg.contains("setScale(") && jpeg.contains("page.render(lembar, null, matriks"),
        )
    }

    @Test
    fun berkasDibagikanDenganIzinBacaLewatClipData() {
        assertTrue(
            "Lembar berbagi Android hanya menerima izin baca berkas lewat clipData. " +
                "Tanpa ClipData.newUri, pratinjau berkas di lembar berbagi gagal dibuka " +
                "(logcat: Permission Denial FileProvider).",
            exports.contains("ClipData.newUri(") &&
                exports.contains("import android.content.ClipData"),
        )
    }
}
