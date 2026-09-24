package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Sesi yang sedang terbuka harus ikut tersegarkan saat daftar cabang akun berubah di server.
 *
 * Kejadian nyata 24 Sep 2026: `aidanurita25@gmail.com` (Aida) ditambahkan Owner ke cabang kedua
 * (`bunayya`) pukul 13:19 WIB. Data di server sudah benar sejak saat itu, tetapi aplikasi Aida
 * masih menampilkan satu cabang. Sebabnya: sesi yang sudah login menyimpan daftar cabang pada saat
 * login dan tidak pernah disegarkan lagi, padahal `applyBusiness` menimpa seluruh daftar staf dari
 * server. Satu-satunya jalan keluar bagi kasir adalah keluar lalu masuk lagi.
 *
 * Aturan yang diuji di sini menjaga agar penambahan maupun pengurangan cabang langsung berlaku.
 */
class SessionBranchRefreshTest {

    private fun sesi(
        role: Role = Role.Kasir,
        branchId: String = "laupay-kirab",
        branchIds: List<String> = listOf("laupay-kirab"),
    ) = Session(role, "Aida", "aidanurita25@gmail.com", branchId, branchIds)

    private fun baris(
        role: Role = Role.Kasir,
        branchIds: List<String> = listOf("laupay-kirab"),
    ) = Staff("Aida", "aidanurita25@gmail.com", role, branchIds)

    @Test
    fun cabangKeduaDariServerLangsungMasukKeSesi() {
        // Inilah kasus Aida: server sudah menugaskan dua cabang, sesi masih memegang satu.
        val hasil = SessionScope.refreshed(
            aktif = sesi(branchIds = listOf("laupay-kirab")),
            baris = baris(branchIds = listOf("laupay-kirab", "bunayya")),
        )

        assertEquals(
            "sesi harus memuat cabang kedua tanpa perlu login ulang",
            listOf("laupay-kirab", "bunayya"),
            hasil.branchIds,
        )
        assertEquals("laupay-kirab", hasil.branchId)
        assertEquals("laupay-kirab", hasil.allowedBranchIds.first())
        assertTrue("bunayya harus boleh dipakai absen", "bunayya" in hasil.allowedBranchIds)
    }

    @Test
    fun cabangYangDicabangOwnerIkutTerlepas() {
        val hasil = SessionScope.refreshed(
            aktif = sesi(branchId = "bunayya", branchIds = listOf("bunayya", "laupay-kirab")),
            baris = baris(branchIds = listOf("laupay-kirab")),
        )

        assertEquals(listOf("laupay-kirab"), hasil.branchIds)
        assertEquals(
            "pilihan tidak boleh menunjuk cabang yang sudah dicabut",
            "laupay-kirab",
            hasil.branchId,
        )
    }

    @Test
    fun pilihanCabangYangMasihSahTidakDiubah() {
        val hasil = SessionScope.refreshed(
            aktif = sesi(branchId = "bunayya", branchIds = listOf("bunayya", "laupay-kirab")),
            baris = baris(branchIds = listOf("bunayya", "laupay-kirab", "shelly")),
        )

        assertEquals(
            "cabang yang sedang dipilih kasir harus dipertahankan bila masih termasuk penugasan",
            "bunayya",
            hasil.branchId,
        )
        assertEquals(3, hasil.branchIds.size)
    }

    @Test
    fun penurunanPeranDariServerIkutBerlaku() {
        // Sama seperti penyamaan hak akses pada tarikan bertahap: role yang diturunkan di server
        // tidak boleh menunggu login ulang.
        val hasil = SessionScope.refreshed(
            aktif = sesi(role = Role.Supervisor, branchIds = listOf("bunayya")),
            baris = baris(role = Role.Kasir, branchIds = listOf("bunayya")),
        )

        assertEquals(Role.Kasir, hasil.role)
    }

    @Test
    fun tanpaPerubahanSesiDikembalikanApaAdanya() {
        // Objek yang sama, bukan salinan: layar Compose tidak perlu digambar ulang tanpa sebab.
        val aktif = sesi(branchIds = listOf("laupay-kirab", "bunayya"))
        val hasil = SessionScope.refreshed(aktif, baris(branchIds = listOf("laupay-kirab", "bunayya")))

        assertSame(aktif, hasil)
    }

    @Test
    fun identitasSesiTidakIkutBerubah() {
        val hasil = SessionScope.refreshed(
            aktif = sesi(branchIds = listOf("laupay-kirab")),
            baris = Staff("Aida Nurita", "aidanurita25@gmail.com", Role.Kasir, listOf("laupay-kirab", "bunayya")),
        )

        assertEquals("nama di sesi tidak boleh berubah sendiri", "Aida", hasil.name)
        assertEquals("email di sesi tidak boleh berubah sendiri", "aidanurita25@gmail.com", hasil.email)
    }

    @Test
    fun daftarCabangKosongDariServerTidakMengosongkanSesi() {
        // Baris staf yang cabangnya belum tersinkron tidak boleh membuat akun kehilangan seluruh
        // cabangnya; perangkat versi lama pernah mengirim payload tanpa branchIds.
        val aktif = sesi(branchIds = listOf("laupay-kirab", "bunayya"))
        val hasil = SessionScope.refreshed(aktif, baris(branchIds = emptyList()))

        assertEquals(listOf("laupay-kirab", "bunayya"), hasil.branchIds)
        assertSame(aktif, hasil)
    }
}
