package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog
import com.cuciin.laundryops.data.AccessPolicy
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.data.Staff
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Perilaku menu untuk Supervisor, diverifikasi di emulator dan dikunci di sini.
 *
 * Diuji pada perangkat dengan akun yang benar-benar berperan SPV (header layar Modul berbunyi
 * "alfin · SPV"), karena perbaikan izin di 1.10.23 justru menyangkut peran ini dan sebelumnya
 * perangkat debug tidak punya akun Supervisor sama sekali.
 *
 * Hasil di emulator:
 *
 * ```text
 * Laporan transaksi    TERBUKA
 * Laporan analitik     TERBUKA
 * Riwayat aktivitas    TIDAK TAMPIL
 * CRASH                0
 * ```
 *
 * "Riwayat aktivitas" memang tidak tampil karena role bawaan Supervisor tidak memuat modul
 * `audit`. Itu benar, bukan bug.
 */
class SupervisorMenuTest {

    private val roles = AccessCatalog.builtInRoles()
    private val supervisor = Staff(
        name = "SPV",
        email = "spv@cuciin.test",
        role = Role.Supervisor,
        branchIds = listOf("b1"),
    )

    private fun boleh(route: String): Boolean {
        val module = RouteAccess.moduleOf(route) ?: return true
        return AccessPolicy.can(supervisor, roles, null, module)
    }

    @Test
    fun spvDapatMembukaDuaMenuLaporan() {
        // Inilah yang diperbaiki 1.10.23: sebelumnya kedua menu ini memeriksa modul owner
        // sehingga terkunci untuk SPV walaupun role bawaannya memuat modul analytics.
        assertTrue("SPV harus bisa membuka Laporan transaksi", boleh("analytics"))
        assertTrue("SPV harus bisa membuka Laporan analitik", boleh("analyticsReport"))
    }

    @Test
    fun spvTidakMelihatRiwayatAktivitas() {
        // Role bawaan Supervisor tidak memuat modul audit, jadi menunya memang tidak tampil.
        assertFalse("SPV tidak boleh membuka Riwayat aktivitas", boleh("audit"))
    }

    @Test
    fun spvTidakMelihatMenuKhususOwner() {
        // Menu master data yang tidak diberikan ke role bawaan Supervisor.
        listOf("branches", "users", "services", "accessRoles", "ownerSettings").forEach { route ->
            assertFalse("SPV tidak boleh melihat menu $route", boleh(route))
        }
    }

    @Test
    fun spvTidakDapatMengubahProdukStokWalauBisaMelihatStok() {
        // Menu Produk stok memakai modul `stock` yang memang dimiliki SPV, jadi menunya tampil.
        // Yang menahan adalah FUNGSI-nya: role bawaan Supervisor hanya memegang `stock.view` dan
        // `stock.write`, bukan `stock.product`. Ini bentuk pemisahan baca dari tulis yang
        // ditambahkan 1.10.30: SPV melihat stok, tetapi tidak boleh mengubah katalog produknya.
        assertTrue("SPV melihat menu Produk stok", boleh("products"))
        assertFalse(
            "SPV tidak boleh mengubah katalog produk",
            AccessPolicy.can(supervisor, roles, null, "stock", "stock.product"),
        )
        assertTrue(
            "SPV tetap boleh mencatat perubahan stok",
            AccessPolicy.can(supervisor, roles, null, "stock", "stock.write"),
        )
    }

    @Test
    fun spvMasihBisaMenuOperasionalnya() {
        // Perbaikan izin tidak boleh mengunci menu yang memang haknya.
        listOf("attendance", "inventory", "queue").forEach { route ->
            assertTrue("SPV harus tetap bisa membuka $route", boleh(route))
        }
    }

    @Test
    fun kasirTetapTidakMelihatLaporan() {
        // Arah sebaliknya: Kasir tidak punya modul analytics, jadi perbaikan ini tidak
        // membuka laporan untuknya.
        val kasir = Staff("Kasir", "kasir@cuciin.test", Role.Kasir, listOf("b1"))
        val modulAnalytics = RouteAccess.moduleOf("analytics")!!
        assertFalse(
            "Kasir tidak boleh membuka laporan",
            AccessPolicy.can(kasir, roles, null, modulAnalytics),
        )
    }
}
