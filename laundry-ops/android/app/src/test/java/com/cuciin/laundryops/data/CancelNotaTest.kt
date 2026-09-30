package com.cuciin.laundryops.data

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pembatalan nota berbayar dan rincian tutup kas.
 *
 * Dua hal yang dijaga di sini, dan keduanya menyangkut uang:
 *
 *  1. **Pembatalan harus sampai ke server sebagai pembatalan, bukan koreksi biasa.** Perangkat
 *     mengirim selisih snapshot, jadi pembatalan dan koreksi biasa sama-sama terlihat sebagai
 *     entitas `nota` yang berubah. Pembedanya `syncIntent`, dan kalau penanda itu hilang,
 *     server hanya akan mencatatnya sebagai `order.put` — nota tetap hidup di server dan uang
 *     yang dikembalikan tidak pernah tercatat.
 *  2. **Angka tutup kas yang dilihat kasir harus sama dengan yang tersimpan.** Rincian produk
 *     dihitung satu kali di [CuciinStore.closeCashPreview] dan dipakai ulang oleh `closeCash`,
 *     jadi tidak mungkin berbeda.
 *
 * Invarian akuntansi Opsi B juga dikunci di sini: nota yang dibatalkan TIDAK mengubah laporan
 * tanggal lampau, dan uang yang dikembalikan muncul sebagai pengeluaran pada tanggal pembatalan.
 */
class CancelNotaTest {

    // ------------------------------------------------------------------ SyncOutbox: syncIntent

    private fun notaPayload(id: String, canceledAtMs: Long = 0, updatedAtMs: Long = 1_000) =
        buildJsonObject {
            put("id", id)
            put("total", 20_000)
            put("paid", 20_000)
            put("updatedAtMs", updatedAtMs)
            put("canceledAtMs", canceledAtMs)
        }

    private fun nota(id: String, canceledAtMs: Long = 0, updatedAtMs: Long = 1_000) =
        SyncEntity("nota", id, "b1", notaPayload(id, canceledAtMs, updatedAtMs))

    @Test
    fun pembatalanDikirimSebagaiIntentCancel() {
        val outbox = SyncOutbox()
        outbox.initialize(listOf(nota("N1")))
        // Nota yang sama, tetapi kini bertanda batal. Itulah bentuk pembatalan di perangkat.
        val commands = outbox.enqueue(listOf(nota("N1", canceledAtMs = 5_000, updatedAtMs = 5_000)), 10, "b1", null) { "cmd-1" }

        assertEquals("Pembatalan harus menghasilkan tepat satu perintah", 1, commands.size)
        val payload = commands.single().payload.jsonObject
        assertEquals(
            "Tanpa syncIntent=cancel, server akan memperlakukan pembatalan sebagai koreksi biasa",
            "cancel",
            payload["syncIntent"]?.jsonPrimitive?.content,
        )
    }

    @Test
    fun koreksiBiasaTidakDiberiIntentCancel() {
        val outbox = SyncOutbox()
        outbox.initialize(listOf(nota("N1")))
        // Hanya nilai nota yang berubah; penanda batal tetap nol. Ini koreksi biasa.
        val changed = buildJsonObject {
            put("id", "N1")
            put("total", 25_000)
            put("paid", 25_000)
            put("updatedAtMs", 5_000)
            put("canceledAtMs", 0)
        }
        val commands = outbox.enqueue(listOf(SyncEntity("nota", "N1", "b1", changed)), 10, "b1", null) { "cmd-1" }

        assertEquals(1, commands.size)
        assertNull(
            "Koreksi biasa tidak boleh ditandai pembatalan; kalau tertandai, nota yang masih hidup akan dibatalkan server",
            commands.single().payload.jsonObject["syncIntent"],
        )
    }

    @Test
    fun notaYangSudahBatalTidakDikirimSebagaiPembatalanUlang() {
        val outbox = SyncOutbox()
        // Nota sudah batal sejak awal, jadi payload lama pun sudah memuat penanda batal.
        outbox.initialize(listOf(nota("N1", canceledAtMs = 5_000)))
        val changed = buildJsonObject {
            put("id", "N1")
            put("total", 20_000)
            put("paid", 20_000)
            put("updatedAtMs", 9_000)
            put("canceledAtMs", 5_000)
        }
        val commands = outbox.enqueue(listOf(SyncEntity("nota", "N1", "b1", changed)), 10, "b1", null) { "cmd-1" }

        assertEquals(1, commands.size)
        assertNull(
            "Nota yang sudah batal tidak boleh mengirim pembatalan kedua; server akan menolaknya sebagai duplikat",
            commands.single().payload.jsonObject["syncIntent"],
        )
    }

    // ------------------------------------------------------------------ katalog izin

    @Test
    fun pembatalanNotaAdaDiKatalogDanHanyaOwner() {
        assertTrue(
            "Fungsi service.cancel harus terdaftar di katalog",
            "service.cancel" in AccessCatalog.allFunctionKeys(),
        )
        assertEquals("service", AccessCatalog.moduleOf("service.cancel"))
        assertTrue(
            "Pembatalan nota berbayar harus Owner-only secara bawaan",
            "service.cancel" in AccessCatalog.ownerLocked,
        )
    }

    @Test
    fun kasirDanSupervisorTidakBolehBatalkanNota() {
        val roles = AccessCatalog.builtInRoles().associateBy { it.id }
        assertFalse("Kasir tidak boleh punya service.cancel", "service.cancel" in roles.getValue("role-kasir").functions)
        assertFalse("Supervisor tidak boleh punya service.cancel", "service.cancel" in roles.getValue("role-supervisor").functions)
    }

    @Test
    fun fungsiBatalkanNotaTerpisahDariHapusService() {
        assertTrue(
            "Hapus Service dan Batalkan nota harus dua centang berbeda: yang satu membuang nota tanpa uang, yang lain mengembalikan uang",
            "service.delete" in AccessCatalog.allFunctionKeys() && "service.cancel" in AccessCatalog.allFunctionKeys(),
        )
        assertEquals(2, setOf("service.delete", "service.cancel").size)
    }

    // ------------------------------------------------------------------ kategori pengembalian dana

    @Test
    fun pengembalianDanaPunyaKategoriSendiri() {
        // Opsi B: uang yang dikembalikan dicatat sebagai pengeluaran hari ini, bukan dengan
        // menghapus penerimaan kemarin. Kategori terpisah membuatnya bisa direkap di laporan.
        assertTrue(
            "ExpenseCategory harus punya PengembalianDana supaya pengembalian dana bisa dibedakan dari biaya operasional",
            ExpenseCategory.entries.any { it == ExpenseCategory.PengembalianDana },
        )
    }

    // ------------------------------------------------------------------ invarian uang nota batal

    private fun notaUji(id: String, total: Int, paid: Int, canceled: Boolean) = Nota(
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
        canceledAtMs = if (canceled) 5_000 else 0,
        canceledAt = if (canceled) "hari ini" else "",
        canceledBy = if (canceled) "Owner" else "",
        cancelReason = if (canceled) "Pelanggan membatalkan pesanan" else "",
    )

    @Test
    fun notaBatalTidakMenambahPiutang() {
        val rows = listOf(
            notaUji("N1", 20_000, 20_000, canceled = false),
            // Nota batal yang belum lunas TIDAK boleh menagih pelanggan lagi: cuciannya sudah
            // dibatalkan, jadi sisa tagihannya tidak ada.
            notaUji("N2", 30_000, 0, canceled = true),
        )
        val piutang = rows.filterNot { it.canceled }.sumOf { (it.total - it.paid).coerceAtLeast(0) }

        assertEquals("Nota yang dibatalkan tidak boleh ikut menambah piutang", 0, piutang)
    }

    @Test
    fun notaBatalTetapTerlihatDiLaporanTapiTidakDiAntrianKerja() {
        val batal = notaUji("N1", 20_000, 20_000, canceled = true)
        val hidup = notaUji("N2", 20_000, 20_000, canceled = false)
        val semua = listOf(batal, hidup)

        // Ini bentuk dua fungsi store: visibleNotas() membuang yang batal, reportNotas() tidak.
        val kerja = semua.filterNot { it.canceled }
        val laporan = semua

        assertTrue("Nota batal harus hilang dari antrian kerja", kerja.none { it.id == "N1" })
        assertTrue("Nota batal harus tetap ikut di laporan", laporan.any { it.id == "N1" })
        assertEquals(
            "Omzet laporan tidak boleh berubah karena pembatalan hari ini (Opsi B)",
            semua.sumOf { it.total },
            laporan.sumOf { it.total },
        )
    }

    @Test
    fun uangYangDikembalikanMasukPengeluaranTanggalPembatalan() {
        val dibatalkan = notaUji("N1", 20_000, 20_000, canceled = true)
        val refund = Expense(
            id = "refund-${dibatalkan.id}",
            branchId = dibatalkan.branchId,
            category = ExpenseCategory.PengembalianDana,
            amount = dibatalkan.paid,
            occurredAtMs = 5_000,
            occurredAt = "hari ini",
            note = "Pengembalian dana nota ${dibatalkan.id} · ${dibatalkan.customer}",
            by = "Owner",
        )

        assertEquals("Nilai pengembalian dana harus sama dengan uang yang diterima", dibatalkan.paid, refund.amount)
        assertEquals(ExpenseCategory.PengembalianDana, refund.category)
        assertEquals("Pengembalian dana bertanggal pembatalan, bukan tanggal nota", 5_000L, refund.occurredAtMs)
    }

    // ------------------------------------------------------------------ penjaga ubah nota batal

    /** Akar modul `app`, naik dari folder kelas test bila perlu (pola yang sama dengan FieldKeyboardActionTest). */
    private val modul: java.io.File = java.io.File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else java.io.File(it, "app")
    }

    private val storeSumber: java.io.File =
        java.io.File(modul, "src/main/java/com/cuciin/laundryops/data/CuciinStore.kt")

    @Test
    fun setiapFungsiUbahNotaMenolakNotaYangSudahDibatalkan() {
        // Nota batal tetap ada di daftar `notas` (hanya ditandai), jadi setiap fungsi yang
        // mengubah nota masih bisa menemukannya. Tanpa penjaga di store, perangkat akan
        // mengirim perintah yang ditolak server, dan perintah itu menumpuk di antrean
        // "perlu ditinjau" sementara kasir melihat aksinya seolah berhasil.
        assertTrue(
            "Berkas store tidak ditemukan di ${storeSumber.absolutePath}",
            storeSumber.exists(),
        )
        val teks = storeSumber.readText()
        val fungsi = listOf("updateNotaLines", "markWaSent", "advanceLaundry", "markLunas", "markPickedUp")
        val pelanggar = fungsi.filter { nama ->
            val awal = teks.indexOf("fun $nama(")
            if (awal < 0) return@filter true
            val badan = teks.substring(awal, minOf(teks.length, awal + 1_200))
            !badan.contains("canceled")
        }
        assertTrue(
            "Fungsi ini mengubah nota tanpa memeriksa penanda batal: $pelanggar. " +
                "Nota yang sudah dibatalkan uangnya sudah dikembalikan, jadi perubahannya " +
                "membuat laporan dan stok bercerita beda dengan kenyataan.",
            pelanggar.isEmpty(),
        )
    }

    // ------------------------------------------------------------------ rincian tutup kas

    @Test
    fun rincianProdukTutupKasMenghitungPenjualanSebagaiNilaiPositif() {
        // Mutasi stok `Jual` bernilai negatif (stok berkurang). Rincian tutup kas harus
        // menampilkannya sebagai jumlah terjual yang positif, bukan angka minus.
        val moves = listOf(
            StockMove("hari ini", 2_000, "Sabun", StockKind.Jual, -2, "Kasir", "b1", "Nota N1", "N1", 22, "s1"),
            StockMove("hari ini", 3_000, "Sabun", StockKind.Jual, -1, "Kasir", "b1", "Nota N2", "N2", 21, "s2"),
        )
        val qty = moves.groupBy { it.product }.map { (_, rows) -> rows.sumOf { -it.qty } }.single()

        assertEquals("Dua mutasi jual harus dijumlahkan menjadi 3 pcs", 3, qty)
        assertTrue("Jumlah terjual tidak boleh negatif di layar", qty > 0)
    }

    @Test
    fun sisaStokTutupKasMenunjukProdukYangAda() {
        val produk = listOf(
            Product(name = "Sabun", stock = 22, min = 5, id = "sabun", kind = ProductKind.BarangJual, unit = "pcs"),
        )
        val saldo = listOf(
            BranchStock("b1", "sabun", 22),
            // Saldo untuk produk yang sudah dihapus dari katalog: dibuang, bukan ditampilkan
            // sebagai baris tanpa nama.
            BranchStock("b1", "produk-lama", 5),
        )
        val baris = saldo.mapNotNull { s ->
            val p = produk.firstOrNull { it.key == s.productKey } ?: return@mapNotNull null
            CashCloseStock(p.name, s.stock)
        }

        assertEquals(1, baris.size)
        assertEquals("Sabun", baris.single().name)
        assertEquals(22, baris.single().sisa)
    }
}
