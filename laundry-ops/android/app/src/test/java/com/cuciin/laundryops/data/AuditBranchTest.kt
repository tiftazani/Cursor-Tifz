package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cabang yang dipakai catatan audit harus berasal dari data nyata.
 *
 * Pernah terjadi: dua tempat memakai cabang tetap `"melati"` yang sudah tidak ada di katalog
 * cabang. Entri audit dengan cabang itu tidak pernah lolos filter per-cabang di `pullChanges`
 * Worker (`branch_id IN (cabang pengguna)`), sehingga catatannya tidak sampai ke perangkat mana
 * pun dan Riwayat aktivitas tampak kosong untuk kejadian itu.
 *
 * Juga dikunci di sini: `branch()` tidak boleh melempar pengecualian. Katalog cabang bisa kosong
 * sesaat (basis data baru, impor belum jalan) atau memuat id yang belum tersinkron, dan ada 21
 * pemanggil di layar yang akan menutup aplikasi bila itu terjadi.
 */
class AuditBranchTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private val storeKode: String = File(
        appDir,
        "src/main/java/com/cuciin/laundryops/data/CuciinStore.kt",
    ).readText()

    @Test
    fun tidakAdaCabangMelatiYangDipakuDiStore() {
        // "melati" bukan cabang di katalog mana pun. Kalau muncul lagi di kode, catatan auditnya
        // tidak akan pernah tersinkron ke perangkat.
        val baris = storeKode.lines().withIndex()
            .filter { (_, teks) -> teks.contains("\"melati\"") && !teks.trimStart().startsWith("//") }
            .map { (i, teks) -> "  baris ${i + 1}: ${teks.trim()}" }

        assertTrue(
            "Cabang \"melati\" tidak ada di katalog, jadi catatan auditnya tidak pernah tersinkron:\n" +
                baris.joinToString("\n"),
            baris.isEmpty(),
        )
    }

    @Test
    fun katalogCabangBawaanTidakMemuatMelati() {
        // Penjaga arah sebaliknya: kalau kelak ada cabang bernama melati, test di atas harus
        // ditinjau ulang, bukan dihapus begitu saja.
        val seed = storeKode.substringAfter("private fun applySeed()").substringBefore("private fun")
        assertFalse("Katalog cabang bawaan tidak memuat melati", seed.contains("\"melati\""))
        assertTrue("Katalog cabang bawaan tetap memuat cabang nyata", seed.contains("\"bunayya\""))
    }

    @Test
    fun branchTidakPernahMelemparPengecualian() {
        // Versi lama memakai first() dan first { }, yang melempar NoSuchElementException.
        val badan = storeKode.substringAfter("fun branch(id: String").substringBefore("private fun ensureBranchStocks")
        assertFalse("branch() tidak boleh memakai first()", badan.contains("branches.first()"))
        assertFalse("branch() tidak boleh memakai first { }", badan.contains("branches.first {"))
        assertTrue("branch() harus memakai firstOrNull", badan.contains("firstOrNull"))
        assertTrue("branch() harus punya cabang pengganti", badan.contains("missingBranch"))
    }

    @Test
    fun cabangPenggantiTidakMenyesatkan() {
        // Nama penggantinya harus jelas menyatakan cabang belum tersedia, bukan nama cabang
        // palsu yang bisa dikira data nyata.
        val pengganti = storeKode.substringAfter("private val missingBranch").lineSequence().first()
        assertTrue(
            "Nama cabang pengganti harus menyatakan belum tersedia",
            pengganti.contains("belum tersedia"),
        )
        assertEquals(
            "Id cabang pengganti harus kosong supaya tidak bertabrakan dengan cabang nyata",
            true,
            pengganti.contains("Branch(\"\""),
        )
    }
}
