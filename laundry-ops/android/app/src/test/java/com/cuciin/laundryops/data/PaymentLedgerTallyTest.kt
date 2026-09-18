package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penerimaan uang tidak boleh hilang saat nota dibayar bertahap.
 *
 * Bug yang dikunci: `paymentRecords()` membuang SELURUH `paid` sebuah nota begitu nota itu punya
 * SATU entri jurnal. Nota yang dibayar sebagian SEBELUM jurnal pembayaran ada, lalu dilunasi
 * setelahnya, kehilangan bagian lamanya dari laporan kas dan tutup kas.
 *
 * Contoh nyata: nota `LPD-2609-0001-E4AF2` sudah dibayar 35.000 dengan satu entri jurnal. Begitu
 * nota itu dilunasi, 35.000 akan hilang dari laporan kalau aturannya salah.
 *
 * Test ini menguji `PaymentTally.legacyAmount`, fungsi yang benar-benar dipakai `CuciinStore`.
 * Versi pertama test ini menyalin ulang logikanya di dalam test sehingga tetap lulus walaupun
 * bug-nya dikembalikan; itu tidak mengunci apa pun dan sudah diperbaiki.
 */
class PaymentLedgerTallyTest {

    @Test
    fun dibayarSebagianSebelumJurnalLaluDilunasiTidakKehilanganUang() {
        // 30.000 dibayar sebelum jurnal ada, 45.000 sesudahnya. Jurnal memuat 45.000.
        // Bagian lama yang harus tetap terhitung: 30.000.
        assertEquals(
            "Bagian yang dibayar sebelum jurnal ada harus tetap terhitung",
            30_000,
            PaymentTally.legacyAmount(paid = 75_000, jurnal = 45_000),
        )
    }

    @Test
    fun notaTanpaJurnalTerhitungPenuh() {
        assertEquals(55_000, PaymentTally.legacyAmount(paid = 55_000, jurnal = 0))
    }

    @Test
    fun notaYangSeluruhnyaTerjurnalTidakDihitungDuaKali() {
        assertEquals(0, PaymentTally.legacyAmount(paid = 20_000, jurnal = 20_000))
    }

    @Test
    fun jurnalLebihBesarDariPaidTidakMenghasilkanNilaiNegatif() {
        // Bisa terjadi saat koreksi. Jangan sampai menambah penerimaan palsu atau negatif.
        assertEquals(0, PaymentTally.legacyAmount(paid = 20_000, jurnal = 25_000))
    }

    @Test
    fun penerimaanTotalSamaDenganUangYangBenarBenarDiterima() {
        // Sifat yang harus selalu berlaku, dihitung seperti di paymentRecords():
        //   recorded + legacy = jumlah paid semua nota
        data class Kasus(val paid: Int, val jurnal: List<Int>)

        val kasus = listOf(
            Kasus(75_000, listOf(45_000)),   // bertahap: sebagian sebelum jurnal
            Kasus(20_000, listOf(20_000)),   // seluruhnya terjurnal
            Kasus(28_000, emptyList()),      // tanpa jurnal
            Kasus(46_000, listOf(35_000)),   // belum lunas, sebagian terjurnal
            Kasus(0, emptyList()),           // belum dibayar
        )

        val dilaporkan = kasus.sumOf { k ->
            k.jurnal.sum() + PaymentTally.legacyAmount(k.paid, k.jurnal.sum())
        }
        val uangSebenarnya = kasus.sumOf { it.paid }

        assertEquals(
            "Penerimaan yang dilaporkan harus sama dengan uang yang benar-benar diterima",
            uangSebenarnya,
            dilaporkan,
        )
    }

    @Test
    fun tidakPernahMenghasilkanNilaiNegatif() {
        // Penjaga umum: fungsi ini dipakai untuk uang, jadi tidak boleh negatif dalam keadaan apa pun.
        listOf(
            0 to 0, 0 to 100, 100 to 0, 100 to 100, 100 to 200, 50_000 to 75_000,
        ).forEach { (paid, jurnal) ->
            val hasil = PaymentTally.legacyAmount(paid, jurnal)
            assertTrue("legacyAmount($paid, $jurnal) = $hasil, tidak boleh negatif", hasil >= 0)
        }
    }
}
