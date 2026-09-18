package com.cuciin.laundryops.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontrak bar navigasi bawah.
 *
 * Bug yang dikunci di sini: daftar rute yang menampilkan bar pernah ditulis ulang sebagai
 * himpunan terpisah dari daftar tab, dan "nota" (layar Service) tertinggal di salinan itu.
 * Akibatnya bar menghilang hanya di layar Service, padahal muncul di empat tab lain.
 *
 * Aturannya sekarang: rute yang menampilkan bar selalu diturunkan dari daftar tab, tidak
 * pernah ditulis ulang.
 */
class NavBarContractTest {

    @Test
    fun barTampilDiSetiapTab() {
        assertEquals(
            "Bar harus tampil di semua tab, termasuk Service",
            setOf("home", "nota", "wa", "stok", "more"),
            NavTabs.routes,
        )
    }

    @Test
    fun serviceTermasukRuteBerbar() {
        assertTrue("Layar Service harus menampilkan bar", "nota" in NavTabs.routes)
    }

    @Test
    fun layarDiLuarTabTidakBerbar() {
        // Layar alur seperti nota baru, pembayaran, dan detail tidak menampilkan bar.
        listOf("preview", "bayar", "queue/123", "login", "register", "pending").forEach { route ->
            assertFalse("$route bukan tab, jadi tanpa bar", route in NavTabs.routes)
        }
    }

    @Test
    fun setiapTabPunyaLabelDanRuteUnik() {
        val labels = NavTabs.all.map { it.label }
        assertEquals("Label tab tidak boleh kembar", labels.size, labels.toSet().size)
        assertEquals("Rute tab tidak boleh kembar", NavTabs.all.size, NavTabs.routes.size)
    }

    @Test
    fun supervisorTidakMelihatTabServiceDanWa() {
        val supervisor = NavTabs.visibleFor(
            role = "Supervisor",
            canAccess = { true },
        ).map { it.label }
        assertFalse("SPV tidak melihat Service", "Service" in supervisor)
        assertFalse("SPV tidak melihat WA", "WA" in supervisor)
        assertTrue("SPV tetap melihat Antrian", "Antrian" in supervisor)
    }

    @Test
    fun tabMengikutiIzinAkses() {
        // Izin yang dicabut menyembunyikan tab, dan rute berbar tetap tidak berubah.
        val kasir = NavTabs.visibleFor(
            role = "Kasir",
            canAccess = { module -> module != "service" },
        ).map { it.label }
        assertFalse("Service tersembunyi saat izinnya dicabut", "Service" in kasir)
        assertTrue("WA tetap tampil", "WA" in kasir)
        assertTrue("Daftar rute berbar tidak terpengaruh", "nota" in NavTabs.routes)
    }
}
