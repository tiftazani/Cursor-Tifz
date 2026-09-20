package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog
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
        // Ukurannya FUNGSI, bukan nama peran: tab Service butuh `service.create` dan tab WA
        // butuh `whatsapp.send`, dan role bawaan Supervisor tidak memegang keduanya.
        val supervisor = AccessCatalog.builtInRoles().first { it.id == "role-supervisor" }
        val supervisorTabs = NavTabs.visibleFor { module, function ->
            module in supervisor.modules && (function == null || function in supervisor.functions)
        }.map { it.label }
        assertFalse("SPV tidak melihat Service", "Service" in supervisorTabs)
        assertFalse("SPV tidak melihat WA", "WA" in supervisorTabs)
        assertTrue("SPV tetap melihat Antrian", "Antrian" in supervisorTabs)
    }

    @Test
    fun tabMengikutiIzinAkses() {
        // Izin yang dicabut menyembunyikan tab, dan rute berbar tetap tidak berubah.
        val kasir = NavTabs.visibleFor { module, function ->
            module != "service" && (function == null || function != "service.create")
        }.map { it.label }
        assertFalse("Service tersembunyi saat izinnya dicabut", "Service" in kasir)
        assertTrue("WA tetap tampil", "WA" in kasir)
        assertTrue("Daftar rute berbar tidak terpengaruh", "nota" in NavTabs.routes)
    }

    /**
     * Tab dengan fungsi wajib memeriksa fungsinya, bukan hanya modulnya.
     *
     * Bug yang dikunci: memegang modul `service` tidak berarti boleh MEMBUAT Service. Tab yang
     * hanya memeriksa modul akan tampil untuk role yang tidak bisa memakainya.
     */
    @Test
    fun tabMemeriksaFungsiBukanHanyaModul() {
        // Tab yang punya fungsi WAJIB menyebut fungsinya di katalog, supaya pemanggilnya bisa
        // memeriksanya. Sebelumnya tab Service dan WA hanya membawa modul, sehingga role yang
        // memegang modul `service` tanpa `service.create` melihat tab yang tidak bisa dipakainya.
        assertEquals("service.create", NavTabs.routeOf("nota")?.function)
        assertEquals("whatsapp.send", NavTabs.routeOf("wa")?.function)
        assertEquals("queue.view", NavTabs.routeOf("home")?.function)
        assertEquals("stock.view", NavTabs.routeOf("stok")?.function)
        assertEquals("Tab Modul tidak punya fungsi", null, NavTabs.routeOf("more")?.function)

        // Bukti bahwa fungsinya benar-benar dipakai: modul service dimiliki, fungsinya tidak.
        val tanpaFungsiCreate = NavTabs.visibleFor { module, function ->
            module == "service" && function != "service.create"
        }.map { it.label }
        assertFalse(
            "Tab Service tidak boleh tampil bila fungsi create ditolak",
            "Service" in tanpaFungsiCreate,
        )
    }
}
