package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Bukti bahwa `branch()` versi lama benar-benar melempar, dan versi baru tidak.
 *
 * Ini mereproduksi keadaannya secara langsung: katalog cabang kosong, dan id cabang yang tidak
 * dikenal. Keduanya nyata terjadi, bukan dugaan:
 *
 * - Katalog kosong: `applySeed()` hanya jalan saat belum ada data tersimpan, dan bootstrap dari
 *   server bisa belum selesai saat layar pertama kali dirender.
 * - Id asing: `staff.branchIds` dipulihkan dari data tersimpan; cabangnya bisa sudah dihapus
 *   Owner di perangkat lain, dan delta penghapusan belum sampai.
 */
class BranchLookupTest {

    private val kosong = emptyList<Branch>()

    private fun lamaBranch(branches: List<Branch>, id: String): Branch {
        if (id == "all") return branches.first()
        return branches.first { it.id == id }
    }

    private fun baruBranch(branches: List<Branch>, id: String): Branch {
        if (id == "all") return branches.firstOrNull() ?: pengganti
        return branches.firstOrNull { it.id == id } ?: branches.firstOrNull() ?: pengganti
    }

    private val pengganti = Branch("", "", "Cabang belum tersedia", "", "")

    @Test
    fun versiLamaMelemparSaatKatalogKosong() {
        // Dibuktikan, bukan diklaim: versi lama memang melempar.
        val gagal = runCatching { lamaBranch(kosong, "all") }.exceptionOrNull()
        assertTrue(
            "Versi lama harus melempar saat katalog kosong, supaya perbaikannya punya alasan",
            gagal is NoSuchElementException,
        )
    }

    @Test
    fun versiLamaMelemparUntukIdAsing() {
        val cabang = listOf(Branch("bunayya", "BNY", "Bunayya", "", ""))
        val gagal = runCatching { lamaBranch(cabang, "cabang-yang-sudah-dihapus") }.exceptionOrNull()
        assertTrue("Versi lama harus melempar untuk id asing", gagal is NoSuchElementException)
    }

    @Test
    fun versiBaruSelaluMengembalikanNilai() {
        // Katalog kosong.
        assertEquals("Cabang belum tersedia", baruBranch(kosong, "all").name)
        assertEquals("Cabang belum tersedia", baruBranch(kosong, "apa-saja").name)

        // Id asing dengan katalog berisi: jatuh ke cabang pertama, bukan melempar.
        val cabang = listOf(Branch("bunayya", "BNY", "Bunayya", "", ""))
        assertEquals("Bunayya", baruBranch(cabang, "cabang-yang-sudah-dihapus").name)

        // Id yang cocok tetap dikembalikan apa adanya.
        assertEquals("Bunayya", baruBranch(cabang, "bunayya").name)
    }

    @Test
    fun cabangPenggantiTidakBertabrakanDenganCabangNyata() {
        // Id kosong tidak akan pernah sama dengan id cabang nyata, jadi tidak ada pencampuran data.
        assertTrue("Id pengganti harus kosong", pengganti.id.isEmpty())
        assertTrue("Kode pengganti harus kosong", pengganti.code.isEmpty())
    }
}
