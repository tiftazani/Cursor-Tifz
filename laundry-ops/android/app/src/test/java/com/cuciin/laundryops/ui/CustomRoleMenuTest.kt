package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog
import com.cuciin.laundryops.data.AccessPolicy
import com.cuciin.laundryops.data.AccessRole
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.data.Staff
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Perilaku menu untuk role akses **custom** (bukan bawaan Owner/Supervisor/Kasir).
 *
 * Role `Gudang` dipakai sebagai wakilnya. Role ini sengaja tidak punya preset di
 * [AccessCatalog.presets] --- preset yang tersedia hanya owner, supervisor, kasir, viewer, dan
 * kosong --- jadi Gudang dibuat manual oleh Owner lewat Kontrol Akses Role, sama seperti data
 * yang benar-benar tersimpan di server.
 *
 * Isi role diambil dari katalog nyata: modul `stock` dan `inventory`, dengan fungsi `stock.view`,
 * `stock.write`, dan `inventory.view`. Fungsi katalog produk (`stock.product`,
 * `stock.productDelete`) sengaja TIDAK diberikan, supaya pemisahan baca dari tulis ikut teruji.
 *
 * Setiap rute diperiksa lewat [RouteAccess.gateOf], bukan hanya modulnya, karena rute yang punya
 * fungsi WAJIB memeriksa fungsinya juga.
 */
class CustomRoleMenuTest {

    private val roles = AccessCatalog.builtInRoles() + AccessRole(
        id = "role-gudang-uji",
        name = "Gudang",
        modules = setOf("stock", "inventory"),
        functions = setOf("stock.view", "stock.write", "inventory.view"),
    )

    private val gudang = Staff(
        name = "Gudang",
        email = "gudang@cuciin.test",
        role = Role.Supervisor,
        branchIds = listOf("b1"),
        accessRoleId = "role-gudang-uji",
    )

    private fun boleh(route: String): Boolean {
        val gate = RouteAccess.gateOf(route) ?: return true
        return AccessPolicy.can(gudang, roles, null, gate.module, gate.function)
    }

    @Test
    fun gudangMembukaMenuStokDanAset() {
        assertTrue("Gudang harus bisa membuka Daftar Aset Cabang", boleh("inventory"))
        assertTrue(
            "prasyarat: rute inventory memeriksa fungsi inventory.view",
            "inventory.view" in RouteAccess.functionsInUse,
        )
    }

    @Test
    fun gudangTidakBolehMengubahKatalogProduk() {
        // Menu Produk stok digerbangi fungsi `stock.product`, bukan sekadar modul `stock`.
        // Akun gudang tidak memegang fungsi itu, jadi menunya memang tertutup baginya.
        assertTrue(
            "prasyarat: rute products memeriksa fungsi stock.product",
            "stock.product" in RouteAccess.functionsInUse,
        )
        assertFalse("Gudang tidak boleh membuka Produk stok", boleh("products"))
        assertFalse(
            "Gudang tidak boleh mengubah katalog produk",
            AccessPolicy.can(gudang, roles, null, "stock", "stock.product"),
        )
        assertFalse(
            "Gudang tidak boleh menghapus produk",
            AccessPolicy.can(gudang, roles, null, "stock", "stock.productDelete"),
        )
    }

    @Test
    fun gudangTetapBolehMencatatPerubahanStok() {
        assertTrue(
            "Gudang harus bisa mencatat perubahan stok",
            AccessPolicy.can(gudang, roles, null, "stock", "stock.write"),
        )
        assertTrue(
            "Gudang harus bisa melihat saldo stok",
            AccessPolicy.can(gudang, roles, null, "stock", "stock.view"),
        )
    }

    @Test
    fun gudangTidakMelihatMenuDiLuarModulnya() {
        // Rute yang gerbangnya memakai modul/fungsi di luar `stock` dan `inventory` harus tetap
        // tertutup, walaupun peran akunnya ditulis Supervisor.
        listOf("queue", "service", "attendance", "analytics", "analyticsReport", "users", "branches")
            .forEach { route ->
                assertNotNull("prasyarat: rute $route terdaftar", RouteAccess.gateOf(route))
                assertFalse("Gudang tidak boleh melihat menu $route", boleh(route))
            }
    }

    @Test
    fun peranLamaTidakMenambahHakSaatRoleAksesDipakai() {
        // Akun Gudang ditulis berperan Supervisor supaya bisa masuk. Kalau penerapan izin keliru
        // memakai peran lama, modul bawaan Supervisor akan ikut terbuka.
        val spvBuiltIn = AccessCatalog.builtInRoles().first { it.name == "Supervisor" }
        assertTrue(
            "prasyarat: role bawaan Supervisor memang memuat attendance",
            "attendance" in spvBuiltIn.modules,
        )
        assertFalse(
            "peran lama tidak boleh membocorkan modul attendance",
            AccessPolicy.can(gudang, roles, null, "attendance"),
        )
    }
}
