package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Ubah harga Service hanya untuk yang berhak.
 *
 * Harga adalah data uang, jadi izinnya dijaga berlapis:
 * 1. Katalog menandai fungsi `service.price` sebagai bawaan khusus Owner.
 * 2. Role bawaan Kasir dan Supervisor tidak memuat fungsi itu.
 * 3. Store menolak perubahannya, bukan hanya menyembunyikan tombolnya.
 *
 * Owner tetap boleh memberikan fungsi ini ke role lain lewat Kontrol Akses Role. Yang dikunci
 * di sini adalah nilai bawaannya.
 */
class ServicePriceAccessTest {

    @Test
    fun fungsiUbahHargaAdaDiKatalog() {
        assertTrue(
            "Fungsi service.price harus terdaftar di katalog",
            "service.price" in AccessCatalog.allFunctionKeys(),
        )
        assertEquals("service", AccessCatalog.moduleOf("service.price"))
    }

    @Test
    fun fungsiUbahHargaDitandaiKhususOwner() {
        assertTrue(
            "service.price harus ada di daftar bawaan khusus Owner",
            "service.price" in AccessCatalog.ownerOnlyByDefault,
        )
    }

    @Test
    fun roleKasirDanSupervisorTidakBolehUbahHarga() {
        val roles = AccessCatalog.builtInRoles().associateBy { it.id }
        val kasir = roles.getValue("role-kasir")
        val supervisor = roles.getValue("role-supervisor")

        assertFalse("Kasir tidak boleh punya service.price", "service.price" in kasir.functions)
        assertFalse("Supervisor tidak boleh punya service.price", "service.price" in supervisor.functions)
        // Modul service tetap boleh dimiliki; yang dibatasi hanya fungsi harganya.
        assertTrue("Kasir tetap boleh membuka modul Service", "service" in kasir.modules)
    }

    @Test
    fun roleOwnerSelaluPunyaSeluruhFungsi() {
        val owner = AccessCatalog.builtInRoles().single { it.id == "role-owner" }
        assertEquals(AccessCatalog.allFunctionKeys(), owner.functions)
        assertTrue("Owner harus punya service.price", "service.price" in owner.functions)
    }

    @Test
    fun ownerBolehMemberikanFungsiIniKeRoleLain() {
        // Kebijakan bawaan bukan larangan keras: Owner bisa mengubahnya lewat Kontrol Akses Role.
        val kasirDenganHarga = AccessRole(
            id = "role-kasir",
            name = "Kasir",
            builtIn = true,
            modules = setOf("service"),
            functions = setOf("service.create", "service.price"),
        )
        val staff = Staff("Kasir Uji", "kasir@contoh.com", Role.Kasir, listOf("b1"), accessRoleId = "role-kasir")
        assertTrue(
            "Kasir yang diberi fungsi ini harus boleh ubah harga",
            AccessPolicy.can(staff, listOf(kasirDenganHarga), null, "service", "service.price"),
        )
    }

    @Test
    fun kasirTanpaFungsiTidakBolehUbahHarga() {
        val kasir = AccessCatalog.builtInRoles().single { it.id == "role-kasir" }
        val staff = Staff("Kasir Uji", "kasir@contoh.com", Role.Kasir, listOf("b1"), accessRoleId = "role-kasir")
        assertFalse(
            "Kasir bawaan tidak boleh ubah harga",
            AccessPolicy.can(staff, listOf(kasir), null, "service", "service.price"),
        )
        // Tetapi tetap boleh membuat Service, supaya pembatasan ini tidak ikut mematikan
        // pekerjaan utamanya.
        assertTrue(
            "Kasir tetap boleh membuat Service",
            AccessPolicy.can(staff, listOf(kasir), null, "service", "service.create"),
        )
    }

    @Test
    fun ownerSelaluBolehUbahHarga() {
        val owner = Staff("Owner", "owner@contoh.com", Role.Owner, listOf("b1"))
        assertTrue(AccessPolicy.can(owner, emptyList(), null, "service", "service.price"))
    }

    @Test
    fun penambalanRoleBawaanTidakMenghidupkanFungsiYangDicabut() {
        // Role bawaan yang sudah tersimpan di server dibekukan isinya. Penambalan hanya boleh
        // menambahkan fungsi yang memang ditandai bawaan untuk role itu, dan hanya bila modulnya
        // sudah dimiliki. Untuk versi ini daftarnya kosong, jadi tidak ada yang ditambahkan.
        assertTrue(
            "Belum ada fungsi bawaan baru untuk Kasir",
            AccessCatalog.builtInFunctionsFor("role-kasir").isEmpty(),
        )
        assertTrue(
            "Belum ada fungsi bawaan baru untuk Supervisor",
            AccessCatalog.builtInFunctionsFor("role-supervisor").isEmpty(),
        )
    }
}
