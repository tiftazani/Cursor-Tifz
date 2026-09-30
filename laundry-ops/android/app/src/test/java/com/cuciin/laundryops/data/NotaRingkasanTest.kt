package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Ringkasan pembayaran nota tidak boleh menimpa footer.
 *
 * Ditemukan 30 Sep 2026 saat uji JPEG di emulator: pada nota 6 layanan ke atas, kotak TOTAL dan
 * kotak status pengerjaan menimpa garis footer dan teks "Terima kasih..." (juga terbukti pada PDF
 * aslinya, jadi ini bug lama tata letak nota, bukan bug JPEG). Aturannya sekarang: bila sisa ruang
 * di atas garis footer tidak cukup, blok ringkasan pindah ke halaman baru.
 *
 * Angka `top` di bawah berasal dari tata letak nyata `ReportPdf.renderNota`:
 * kursor setelah baris layanan + jarak 18 point sebelum ringkasan.
 */
class NotaRingkasanTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    @Test
    fun ringkasanPindahHalamanSaatSisaRuangKurang() {
        // Nota 6 layanan: baris terakhir berakhir di 634, ringkasan mulai di 652.
        // 652 + 160 = 812, melewati garis footer 792, jadi harus pindah halaman.
        assertTrue(
            "Ringkasan nota 6 layanan (top=652) seharusnya pindah halaman",
            ringkasanButuhHalamanBaru(652f),
        )
        // Nota 7 layanan: baris terakhir berakhir di 684, ringkasan mulai di 702.
        assertTrue(
            "Ringkasan nota 7 layanan (top=702) seharusnya pindah halaman",
            ringkasanButuhHalamanBaru(702f),
        )
    }

    @Test
    fun ringkasanTetapDiHalamanYangSamaBilaMasihMuat() {
        // Nota 5 layanan: baris terakhir berakhir di 584, ringkasan mulai di 602.
        // 602 + 160 = 762, masih di atas garis footer 792.
        assertFalse(
            "Ringkasan nota 5 layanan (top=602) seharusnya tetap di halaman yang sama",
            ringkasanButuhHalamanBaru(602f),
        )
        assertFalse(ringkasanButuhHalamanBaru(0f))
    }

    @Test
    fun batasnyaTepatDiGarisFooter() {
        val pas = BATAS_FOOTER_NOTA - TINGGI_RINGKASAN_NOTA
        assertFalse("Tepat pas di batas footer masih boleh", ringkasanButuhHalamanBaru(pas))
        assertTrue("Satu point lebih rendah harus pindah halaman", ringkasanButuhHalamanBaru(pas + 1f))
    }

    @Test
    fun renderNotaMemakaiPenjagaRingkasan() {
        val sumber = File(appDir, "src/main/java/com/cuciin/laundryops/data/ReportPdf.kt").readText()
        assertTrue(
            "ReportPdf.renderNota harus memeriksa ringkasanButuhHalamanBaru sebelum mencetak " +
                "ringkasan; tanpa itu kotak TOTAL menimpa footer pada nota banyak layanan",
            sumber.contains("ringkasanButuhHalamanBaru(") && sumber.contains("fun halamanRingkasan("),
        )
    }
}
