package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.Branch
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kasir yang ditugaskan ke lebih dari satu cabang harus dapat berpindah cabang di semua layar.
 *
 * Laporan lapangan 27 Sep 2026: kasir multi-cabang hanya muncul dan hanya bisa bekerja di satu
 * cabang. Penyebabnya di lapisan layar: pemilih cabang di lima tempat dikunci oleh
 * `canViewAllBranches`, yang artinya "boleh melihat laporan semua cabang" (`analytics.view`).
 * Preset Kasir tidak memuat fungsi itu, sehingga kasir dua cabang terkunci di cabang pertama pada:
 *
 *  1. Antrian (lembar pemilih hanya menampilkan satu baris statis),
 *  2. Service baru (bilah pemilih cabang transaksi tidak pernah tampil),
 *  3. Tutup kas (bilah pemilih cabang tidak pernah tampil),
 *  4. Perubahan stok massal (bilah pemilih tidak tampil, dan daftar cabang di lembar memuat
 *     cabang yang bukan penugasannya),
 *  5. Laporan perubahan stok (sama seperti nomor 4).
 *
 * Lapisan data dan server sudah benar: `Session.branchIds` memuat seluruh penugasan,
 * `visibleNotas`/`visibleAttendance`/`notaReject`/`editStocks` memfilter dengan seluruh cabang,
 * dan `pullChanges` Worker menyaring jurnal per cabang pengguna. Yang bocor hanya lapisan layar.
 *
 * Dua lapis tes di bawah: aturan murni [BranchPicker], dan pemindai berkas sumber yang memastikan
 * kelima titik itu memakai syarat "punya lebih dari satu cabang", bukan "boleh melihat laporan".
 */
class BranchPickerTest {

    private fun cabang(id: String) = Branch(id, id.uppercase(), "Cuciin $id", "Jl. $id", "")

    // --- aturan murni ------------------------------------------------------

    @Test
    fun kasirSatuCabangTidakPerluPemilih() {
        assertFalse(
            "Satu cabang penugasan tidak perlu pemilih: tidak ada yang bisa dipilih",
            BranchPicker.visible(seesAllBranches = false, allowedBranchIds = listOf("bunayya")),
        )
    }

    @Test
    fun kasirDuaCabangWajibPunyaPemilih() {
        // Inti bug: syarat lama hanya `canViewAllBranches`, jadi kasir dua cabang tidak
        // mendapat pemilih sama sekali.
        assertTrue(
            "Dua cabang penugasan harus membuka pemilih cabang",
            BranchPicker.visible(seesAllBranches = false, allowedBranchIds = listOf("bunayya", "laupay-kirab")),
        )
    }

    @Test
    fun akunYangMelihatSemuaCabangSelaluPunyaPemilih() {
        assertTrue(BranchPicker.visible(seesAllBranches = true, allowedBranchIds = listOf("bunayya")))
    }

    @Test
    fun pilihanNonOwnerHanyaCabangPenugasan() {
        val semua = listOf(cabang("bunayya"), cabang("laupay-kirab"), cabang("shelly"))
        val hasil = BranchPicker.options(
            seesAllBranches = false,
            allowedBranchIds = listOf("bunayya", "laupay-kirab"),
            branches = semua,
        )
        assertEquals(
            "Kasir hanya boleh melihat cabang penugasannya, seluruhnya",
            listOf("bunayya", "laupay-kirab"),
            hasil.map { it.id },
        )
    }

    @Test
    fun pilihanAkunYangMelihatSemuaCabangMemuatSeluruhKatalog() {
        val semua = listOf(cabang("bunayya"), cabang("laupay-kirab"), cabang("shelly"))
        val hasil = BranchPicker.options(seesAllBranches = true, allowedBranchIds = listOf("bunayya"), branches = semua)
        assertEquals(3, hasil.size)
    }

    @Test
    fun targetTulisMassalDisaringKeCabangPenugasan() {
        // Pilihan datang dari layar; cabang di luar penugasan tidak boleh ikut tertulis.
        val hasil = BranchPicker.writeTargets(
            seesAllBranches = false,
            allowedBranchIds = listOf("bunayya", "laupay-kirab"),
            chosen = setOf("bunayya", "shelly"),
            fallback = "bunayya",
        )
        assertEquals(setOf("bunayya"), hasil)
    }

    @Test
    fun targetTulisMassalJatuhKeCabangTerkiniBilaPilihanKosong() {
        val hasil = BranchPicker.writeTargets(
            seesAllBranches = false,
            allowedBranchIds = listOf("bunayya", "laupay-kirab"),
            chosen = emptySet(),
            fallback = "laupay-kirab",
        )
        assertEquals(
            "Tanpa pilihan yang sah, cabang yang sedang dilihat yang dipakai",
            setOf("laupay-kirab"),
            hasil,
        )
    }

    @Test
    fun targetTulisMassalOwnerMemakaiPilihanApaAdanya() {
        val hasil = BranchPicker.writeTargets(
            seesAllBranches = true,
            allowedBranchIds = emptyList(),
            chosen = setOf("shelly"),
            fallback = "",
        )
        assertEquals(setOf("shelly"), hasil)
    }

    // --- pemindai berkas sumber -------------------------------------------

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    private val ops = baca("src/main/java/com/cuciin/laundryops/ui/OpsScreens.kt")
    private val more = baca("src/main/java/com/cuciin/laundryops/ui/MoreScreens.kt")

    /**
     * Memeriksa bahwa baris penanda berada di dalam blok yang memakai syarat "punya lebih dari
     * satu cabang". Syaratnya boleh berupa `BranchPicker.visible(...)` atau
     * `allowedBranchIds.size > 1`; yang tidak boleh adalah `canViewAllBranches` sendirian.
     */
    private fun periksaTerbuka(nama: String, sumber: String, penanda: String) {
        val baris = sumber.lines()
        val posisi = baris.indexOfFirst { it.contains(penanda) }
        assertTrue("Penanda '$penanda' tidak ditemukan di $nama", posisi >= 0)
        val jendela = baris.subList((posisi - 20).coerceAtLeast(0), posisi + 1).joinToString("\n")
        assertTrue(
            "Pemilih cabang di $nama ('$penanda') masih dikunci hanya oleh canViewAllBranches. " +
                "Kasir multi-cabang tidak akan menemukan pemilihnya:\n$jendela",
            jendela.contains("BranchPicker.visible") || jendela.contains("allowedBranchIds.size > 1"),
        )
    }

    @Test
    fun serviceBaruTerbukaUntukKasirMultiCabang() {
        periksaTerbuka("OpsScreens.kt", ops, "label = \"Cabang transaksi\"")
    }

    @Test
    fun tutupKasTerbukaUntukKasirMultiCabang() {
        periksaTerbuka("MoreScreens.kt", more, "\"Tutup kas dibuat per cabang\"")
    }

    @Test
    fun stokMassalTerbukaUntukKasirMultiCabang() {
        periksaTerbuka("OpsScreens.kt", ops, "label = \"Cabang yang diperbarui\"")
    }

    @Test
    fun riwayatStokTerbukaUntukKasirMultiCabang() {
        periksaTerbuka("OpsScreens.kt", ops, "Pilih satu atau beberapa cabang untuk laporan ini")
    }

    @Test
    fun antrianPunyaDaftarCabangPenugasanBukanSatuBarisStatis() {
        assertTrue(
            "Lembar pemilih cabang di Antrian harus memuat pilihan cabang penugasan; " +
                "sebelumnya hanya ada satu baris statis \"Cabang tugas Anda\" yang tidak bisa ditekan.",
            ops.contains("\"Semua cabang saya\""),
        )
        // Baris statis itu masih sah untuk kasir SATU cabang: tidak ada yang bisa dipilih.
        // Yang tidak boleh, ia menjadi satu-satunya isi lembar untuk kasir multi-cabang.
        val baris = ops.lines()
        val posisi = baris.indexOfFirst { it.contains("\"Cabang tugas Anda\"") }
        assertTrue("Baris cadangan untuk kasir satu cabang tidak ditemukan", posisi >= 0)
        val sebelum = baris.subList((posisi - 12).coerceAtLeast(0), posisi).joinToString("\n")
        assertTrue(
            "Baris statis \"Cabang tugas Anda\" harus berada di cabang cadangan setelah " +
                "pemeriksaan cabang penugasan, bukan menjadi seluruh isi lembar:\n$sebelum",
            sebelum.contains("bolehPilihCabang") || sebelum.contains("BranchPicker.visible"),
        )
    }

    @Test
    fun lembarPemilihTidakMenawarkanCabangLuarPenugasan() {
        // Daftar cabang di lembar pemilih stok massal dan riwayat stok harus lewat
        // BranchPicker.options, bukan seluruh katalog.
        val baris = ops.lines()
        val penanda = listOf("showTargetBranchSheet", "showBranchSheet")
        assertTrue("Penanda lembar tidak ditemukan", penanda.any { ops.contains(it) })
        assertTrue(
            "Lembar pemilih cabang stok harus memakai BranchPicker.options",
            baris.count { it.contains("BranchPicker.options") } >= 2,
        )
    }
}
