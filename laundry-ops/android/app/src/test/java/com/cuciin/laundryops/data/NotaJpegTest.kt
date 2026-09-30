package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Aturan ukuran gambar JPEG nota: satu halaman penuh 2x, banyak halaman tetap di bawah batas
 * memori, dan notas dengan layanan banyak tetap menjadi satu gambar yang utuh.
 */
class NotaJpegTest {

    private val tinggiNota = 842

    @Test
    fun satuHalamanDirenderPadaSkalaPenuh() {
        assertEquals(2f, NotaJpeg.skalaEfektif(1, tinggiNota), 0.0001f)
        assertEquals(1190, NotaJpeg.lebar(1, 595, tinggiNota))
        assertEquals(1684, NotaJpeg.tinggiGabungan(1, tinggiNota))
    }

    @Test
    fun tinggiGabunganTidakPernahMelewatiBatas() {
        (1..40).forEach { halaman ->
            val tinggi = NotaJpeg.tinggiGabungan(halaman, tinggiNota)
            assertTrue("$halaman halaman menghasilkan tinggi $tinggi", tinggi <= NotaJpeg.TINGGI_MAKS)
        }
    }

    @Test
    fun halamanBertambahMenurunkanSkalaTetapiTidakNol() {
        assertTrue(NotaJpeg.skalaEfektif(3, tinggiNota) > NotaJpeg.skalaEfektif(9, tinggiNota))
        assertTrue(NotaJpeg.skalaEfektif(40, tinggiNota) > 0f)
        assertTrue(NotaJpeg.lebar(40, 595, tinggiNota) >= 1)
    }

    @Test
    fun notaEnamPuluhLayananTetapSatuGambarYangUtuh() {
        val halaman = receiptPageLineCounts(60).size
        assertTrue("Nota 60 layanan seharusnya lebih dari satu halaman", halaman > 1)
        assertTrue(NotaJpeg.tinggiGabungan(halaman, tinggiNota) <= NotaJpeg.TINGGI_MAKS)
        assertTrue(
            "Lebar gambar harus tetap terbaca walau halamannya banyak",
            NotaJpeg.lebar(halaman, 595, tinggiNota) >= 595,
        )
    }
}
