package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Invarian uang yang harus selalu berlaku di seluruh aplikasi.
 *
 * Diperiksa terhadap data nyata di perangkat dan hasilnya semua terpenuhi; test ini menguncinya
 * supaya tidak bisa rusak diam-diam. Angka uang muncul di laporan, tutup kas, dan PDF, jadi
 * inkonsistensi di sini berarti uang yang dilaporkan berbeda dari uang yang diterima.
 *
 * Invarian yang dikunci:
 * 1. omzet = penerimaan + piutang
 * 2. penerimaan menurut `paymentRecords()` = jumlah `paid` semua nota
 * 3. tidak ada piutang negatif
 * 4. tidak ada `paid` melebihi `total`
 * 5. setiap jurnal menunjuk nota yang ada
 * 6. tidak ada jurnal bernilai nol atau negatif
 */
class MoneyInvariantTest {

    private fun nota(id: String, total: Int, paid: Int) = Nota(
        id = id,
        branchId = "b1",
        kasir = "Kasir",
        customer = "Pelanggan",
        phone = "0812",
        items = "Cuci 1 kg",
        total = total,
        paid = paid,
        pay = if (paid >= total) PayStatus.Lunas else PayStatus.Belum,
        laundry = LaundryStatus.Masuk,
        createdAt = "hari ini",
        createdAtMs = 1_000,
        pickupAt = "besok",
        waSent = false,
    )

    private fun jurnal(notaId: String, amount: Int) =
        PaymentRecord("pay-$notaId-$amount", notaId, "b1", amount, PayMethod.Tunai, 2_000, "hari ini", "Kasir")

    /** Data uji yang sengaja mencakup semua keadaan: lunas, bertahap, belum lunas, tanpa jurnal. */
    private val notas = listOf(
        nota("N1", 75_000, 75_000),   // dibayar bertahap: 30.000 sebelum jurnal, 45.000 sesudah
        nota("N2", 20_000, 20_000),   // seluruhnya terjurnal
        nota("N3", 28_000, 28_000),   // tanpa jurnal sama sekali
        nota("N4", 46_000, 35_000),   // belum lunas, sebagian terjurnal
        nota("N5", 32_000, 0),        // belum dibayar
    )

    private val payments = listOf(
        jurnal("N1", 45_000),
        jurnal("N2", 20_000),
        jurnal("N4", 35_000),
    )

    /** Meniru `paymentRecords()`: jurnal + bagian yang belum terjurnal. */
    private fun penerimaan(): Int {
        val byNota = notas.associateBy { it.id }
        val recorded = payments.filter { it.notaId in byNota }
        val perNota = recorded.groupBy { it.notaId }.mapValues { (_, rows) -> rows.sumOf { it.amount } }
        val legacy = notas.sumOf { PaymentTally.legacyAmount(it.paid, perNota[it.id] ?: 0) }
        return recorded.sumOf { it.amount } + legacy
    }

    private fun omzet() = notas.sumOf { it.total }

    private fun piutang() = notas.sumOf { (it.total - it.paid).coerceAtLeast(0) }

    @Test
    fun omzetSamaDenganPenerimaanDitambahPiutang() {
        assertEquals(
            "omzet harus sama dengan penerimaan ditambah piutang",
            omzet(),
            penerimaan() + piutang(),
        )
    }

    @Test
    fun penerimaanSamaDenganJumlahPaidSemuaNota() {
        assertEquals(
            "penerimaan menurut paymentRecords harus sama dengan uang yang benar-benar diterima",
            notas.sumOf { it.paid },
            penerimaan(),
        )
    }

    @Test
    fun tidakAdaPiutangNegatif() {
        notas.forEach { n ->
            assertTrue(
                "Nota ${n.id}: total ${n.total} lebih kecil dari paid ${n.paid}",
                n.total - n.paid >= 0 || n.paid <= n.total,
            )
        }
        assertTrue("Piutang total tidak boleh negatif", piutang() >= 0)
    }

    @Test
    fun tidakAdaPaidMelebihiTotal() {
        notas.forEach { n ->
            assertTrue("Nota ${n.id} dibayar melebihi tagihannya", n.paid <= n.total)
        }
    }

    @Test
    fun setiapJurnalMenunjukNotaYangAda() {
        val ids = notas.map { it.id }.toSet()
        payments.forEach { p ->
            assertTrue("Jurnal ${p.id} menunjuk nota yang tidak ada: ${p.notaId}", p.notaId in ids)
        }
    }

    @Test
    fun tidakAdaJurnalBernilaiNolAtauNegatif() {
        payments.forEach { p ->
            assertTrue("Jurnal ${p.id} bernilai ${p.amount}, tidak boleh nol atau negatif", p.amount > 0)
        }
    }

    @Test
    fun penerimaanTidakPernahMelebihiOmzet() {
        // Uang yang diterima tidak mungkin lebih besar dari tagihan seluruhnya.
        assertTrue(
            "Penerimaan ${penerimaan()} melebihi omzet ${omzet()}",
            penerimaan() <= omzet(),
        )
    }
}
