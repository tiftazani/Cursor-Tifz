package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog
import com.cuciin.laundryops.data.AccessPolicy
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.data.Staff
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Setiap modul di katalog izin harus benar-benar diperiksa di suatu tempat.
 *
 * Katalog `AccessCatalog` menyatakan dirinya sebagai satu sumber untuk layar Kontrol Akses Role
 * dan untuk pemeriksaan izin. Pernah terjadi dua modul, `analytics` dan `audit`, terdaftar di
 * katalog dan bisa dicentang di layar, tetapi tidak pernah diperiksa saat menu dibuka. Akibatnya:
 *
 * 1. Mencentang modul itu tidak mengubah apa pun, dan mengosongkannya juga tidak.
 * 2. Role bawaan Supervisor sudah memuat modul `analytics` beserta fungsi `analytics.view`,
 *    tetapi menu Laporan transaksi dan Laporan analitik tetap terkunci untuknya karena menu
 *    memeriksa modul `owner`. Izin yang diberikan katalog tidak pernah berlaku.
 *
 * Test ini membandingkan modul di katalog dengan modul yang dipakai rute menu, supaya
 * ketidakcocokan itu ketahuan sebelum sampai ke pengguna.
 */
class RouteAccessTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    private val katalog: Set<String> = AccessCatalog.moduleKeys

    @Test
    fun setiapModulKatalogDiperiksaDiSuatuTempat() {
        // `stock` diperiksa lewat katalog tab (NavTabs), bukan lewat rute menu, karena tab Stok
        // bukan salah satu menu di layar Modul.
        val lewatTab = setOf("stock")
        val diperiksa = RouteAccess.modulesInUse + lewatTab

        val mati = katalog - diperiksa
        assertTrue(
            "Modul ini ada di katalog izin tetapi tidak pernah diperiksa, sehingga mencentangnya " +
                "di Kontrol Akses Role tidak berpengaruh apa pun:\n" +
                mati.sorted().joinToString("\n") { "  $it" },
            mati.isEmpty(),
        )
    }

    @Test
    fun ruteLaporanMemakaiModulLaporanBukanModulOwner() {
        // Inti bug yang dikunci: dua menu laporan memakai modul `analytics`, bukan `owner`.
        assertEquals("analytics", RouteAccess.moduleOf("analytics"))
        assertEquals("analytics", RouteAccess.moduleOf("analyticsReport"))
        assertEquals("audit", RouteAccess.moduleOf("audit"))
    }

    @Test
    fun supervisorBolehMembukaLaporanSesuaiRoleBawaannya() {
        // Role bawaan Supervisor memuat modul analytics dan fungsi analytics.view. Menu laporan
        // harus mengikuti itu, bukan modul owner yang tidak dimilikinya.
        val supervisor = AccessCatalog.builtInRoles().first { it.id == "role-supervisor" }
        assertTrue("Supervisor memuat modul analytics", "analytics" in supervisor.modules)
        assertTrue("Supervisor memuat fungsi analytics.view", "analytics.view" in supervisor.functions)

        val modulLaporan = listOf("analytics", "analyticsReport").mapNotNull { RouteAccess.moduleOf(it) }
        assertTrue(
            "Supervisor harus lolos untuk menu laporan",
            modulLaporan.all { it in supervisor.modules },
        )
    }

    @Test
    fun ruteMasterDataTetapModulOwner() {
        // Yang tidak boleh berubah: master data memang khusus Owner.
        listOf("branches", "users", "services", "products", "accessRoles", "ownerSettings").forEach { route ->
            assertEquals("Rute $route harus memakai modul owner", "owner", RouteAccess.moduleOf(route))
        }
    }

    @Test
    fun ruteTanpaModulSelaluBoleh() {
        // Akun, tema, dan riwayat versi tidak butuh izin modul.
        listOf("profil", "theme", "versions", "menuOrder").forEach { route ->
            assertEquals("Rute $route tidak punya modul", null, RouteAccess.moduleOf(route))
        }
    }

    @Test
    fun setiapModulYangDipakaiRuteAdaDiKatalog() {
        val asing = RouteAccess.modulesInUse - katalog
        assertTrue(
            "Rute memakai modul yang tidak ada di katalog, sehingga izinnya tidak dapat diatur:\n" +
                asing.sorted().joinToString("\n") { "  $it" },
            asing.isEmpty(),
        )
    }

    @Test
    fun setiapRuteMenuPunyaKeputusanIzin() {
        // Setiap menu di katalog layar Modul harus punya modul, kecuali yang memang selalu boleh.
        val selaluBoleh = setOf("profil", "theme", "versions")
        val tanpaKeputusan = MenuOrder.allRoutes.filter { route ->
            RouteAccess.moduleOf(route) == null && route !in selaluBoleh
        }
        assertTrue(
            "Menu ini tidak punya modul izin dan tidak terdaftar sebagai selalu boleh:\n" +
                tanpaKeputusan.joinToString("\n") { "  $it" },
            tanpaKeputusan.isEmpty(),
        )
    }

    @Test
    fun layarMemakaiRouteAccessBukanDaftarSendiri() {
        // Layar harus membaca pemetaan ini, bukan menyimpan daftar izinnya sendiri.
        val kode = baca("src/main/java/com/cuciin/laundryops/ui/MoreScreens.kt")
        assertTrue(
            "MoreScreens harus memakai RouteAccess.gateOf",
            kode.contains("RouteAccess.gateOf"),
        )
        assertNotNull(RouteAccess.gateOf("analytics"))
    }

    @Test
    fun tidakAdaModulGandaDiPemetaan() {
        // Satu modul boleh dipakai beberapa rute (analytics untuk dua menu laporan,
        // whatsapp untuk dua menu WA), tetapi pemetaannya harus lengkap dan konsisten.
        val semuaRute = MenuOrder.allRoutes
        val tanpaModul = semuaRute.filter { RouteAccess.moduleOf(it) == null }
        assertFalse(
            "Tidak boleh ada rute menu yang tidak dikenal pemetaan",
            tanpaModul.any { it !in setOf("profil", "theme", "versions") },
        )
    }

    /**
     * Gerbang rute tidak boleh lebih longgar dari penjaga yang dipanggil saat menyimpan.
     *
     * Bug yang dikunci: rute "Service baru" hanya memeriksa modul `service`, sedangkan
     * `saveNota` memeriksa fungsi `service.create`. Role kustom dengan modul `service` tanpa
     * fungsi `service.create` melihat menunya, mengisi formulirnya, lalu aplikasi MATI saat
     * menekan Simpan karena `saveNota` memakai `require`.
     *
     * Aturan yang diuji: setiap fungsi yang diperiksa store pada alur utama sebuah rute harus
     * juga diperiksa gerbang rute itu.
     */
    @Test
    fun gerbangRuteTidakLebihLonggarDariPenjagaStore() {
        // Fungsi yang diperiksa saat menyimpan pada alur utama rute.
        val penjagaAlurUtama = mapOf(
            "service" to "service.create",      // saveNota
            "branches" to "owner.manage",        // addBranch + updateBranch
            "users" to "owner.manage",           // addStaff + updateStaff
            "services" to "owner.manage",        // addService + updateService
            "products" to "owner.manage",        // addProduct + updateProduct
            "ownerSettings" to "owner.manage",   // saveWhatsAppTemplate
            "accessRoles" to "owner.access",     // assignAccessRole
        )
        val longgar = penjagaAlurUtama.filter { (rute, fungsi) ->
            RouteAccess.gateOf(rute)?.function != fungsi
        }
        assertTrue(
            "Gerbang rute ini lebih longgar dari penjaga saat menyimpan, sehingga pengguna bisa " +
                "membuka layarnya lalu gagal atau aplikasi mati saat menekan Simpan:\n" +
                longgar.entries.joinToString("\n") { "  ${it.key} harus memeriksa ${it.value}" },
            longgar.isEmpty(),
        )
    }

    /**
     * Supervisor bawaan tidak boleh lolos gerbang "Service baru".
     *
     * Role bawaan Supervisor memuat MODUL `service` tetapi TIDAK memuat fungsi `service.create`.
     * Kalau gerbangnya hanya memeriksa modul, Supervisor akan melihat menu yang membuatnya
     * menabrak penjaga saat menyimpan. Menu itu memang sudah disembunyikan lewat
     * `hiddenForSupervisor`, tetapi aturan izin tidak boleh bergantung pada pengecualian nama
     * peran: role kustom dengan bentuk izin yang sama akan tetap terkena.
     */
    @Test
    fun supervisorBawaanTidakLolosGerbangServiceBaru() {
        val supervisor = AccessCatalog.builtInRoles().first { it.id == "role-supervisor" }
        assertTrue("Supervisor memuat modul service", "service" in supervisor.modules)
        assertFalse("Supervisor tidak memuat fungsi service.create", "service.create" in supervisor.functions)

        val gerbang = RouteAccess.gateOf("service")
        assertNotNull("Rute service harus punya gerbang", gerbang)
        val lolos = AccessPolicy.can(
            staff = Staff("Uji", "uji@contoh.com", Role.Supervisor, listOf("b1"), accessRoleId = "role-supervisor"),
            roles = listOf(supervisor),
            policy = null,
            module = gerbang!!.module,
            function = gerbang.function,
        )
        assertFalse("Supervisor tidak boleh lolos gerbang Service baru", lolos)
    }

    @Test
    fun ownerTetapLolosSeluruhGerbangRute() {
        // Perbaikan ini tidak boleh mengunci Owner dari menunya sendiri.
        val owner = Staff("Owner", "owner@contoh.com", Role.Owner, listOf("b1"))
        val terkunci = MenuOrder.allRoutes.filter { rute ->
            val g = RouteAccess.gateOf(rute) ?: return@filter false
            !AccessPolicy.can(owner, emptyList(), null, g.module, g.function)
        }
        assertTrue(
            "Owner terkunci dari menu ini oleh gerbang rutenya sendiri:\n" +
                terkunci.joinToString("\n") { "  $it" },
            terkunci.isEmpty(),
        )
    }
}
