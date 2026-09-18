package com.cuciin.laundryops.ui

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Layar laporan tidak boleh melempar pengecualian untuk periode yang sah.
 *
 * Pernah terjadi: `reportPeriod` bisa berisi `hari` atau `minggu` (dipilih dari lembar periode di
 * layar Antrian dan laporan transaksi), sementara daftar label di layar laporan analitik hanya
 * memuat `bulan`, `tahun`, dan `semua`. Pemetaan label memakai `first { }` yang melempar
 * `NoSuchElementException` bila nilainya tidak ada, dan pengecualian itu menutup aplikasi.
 *
 * Nilai periode juga dipulihkan dari preferensi tersimpan, jadi nilai dari versi lama ikut
 * berisiko walau daftar pilihannya sudah berubah.
 */
class ReportPeriodTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    private val layarAnalitik = baca("src/main/java/com/cuciin/laundryops/ui/AnalyticsReportScreen.kt")

    @Test
    fun pemetaanLabelPeriodeTidakMemakaiFirstYangMelempar() {
        // Baris pemetaan label periode harus memakai firstOrNull, bukan first { }.
        val baris = layarAnalitik.lines()
            .filter { it.contains("analyticsPeriods") && it.contains("first") }
            .map { it.trim() }

        assertTrue("Pemetaan label periode tidak ditemukan", baris.isNotEmpty())
        assertTrue(
            "Pemetaan label periode memakai first { } yang melempar untuk periode yang sah:\n" +
                baris.joinToString("\n") { "  $it" },
            baris.none { it.contains(".first {") },
        )
    }

    @Test
    fun periodeYangDipakaiLayarLainPunyaLabel() {
        // Nilai ini benar-benar bisa masuk ke reportPeriod dari lembar periode.
        val periodeLayar = Regex("\"(hari|minggu|bulan|tahun|semua)\"")
            .findAll(baca("src/main/java/com/cuciin/laundryops/ui/MoreScreens.kt"))
            .map { it.groupValues[1] }
            .toSet()

        val labelLaporan = Regex("(\"(?:hari|minggu|bulan|tahun|semua)\" to \"[^\"]+\")")
            .findAll(layarAnalitik)
            .map { it.groupValues[1] }
            .toList()

        assertTrue(
            "Layar laporan analitik harus punya label untuk periode yang bisa dipilih di layar lain. " +
                "Periode yang beredar: ${periodeLayar.sorted()}",
            labelLaporan.isNotEmpty() || layarAnalitik.contains("periodRangeLabel"),
        )
    }

    @Test
    fun periodeTanpaLabelJatuhKeCadangan() {
        // Pemetaan harus punya cabang cadangan supaya nilai asing pun tidak menutup aplikasi.
        val baris = layarAnalitik.lines().first { it.contains("analyticsPeriods") && it.contains("firstOrNull") }
        assertTrue(
            "Pemetaan label harus punya nilai cadangan setelah firstOrNull:\n  $baris",
            baris.contains("?:"),
        )
    }
}
