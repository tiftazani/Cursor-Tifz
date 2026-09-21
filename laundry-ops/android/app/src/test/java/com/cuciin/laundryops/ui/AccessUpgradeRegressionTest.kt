package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog
import com.cuciin.laundryops.data.AccessRole
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Naik versi katalog tidak boleh menutup menu yang tadinya memang dijaga izin.
 *
 * Sebelum 1.10.30 gerbang rute hanya memeriksa MODUL, jadi memegang modul `queue` sudah cukup
 * untuk membuka layar Antrian. Versi ini menuntut fungsi `queue.view`. Tanpa penerjemahan kunci,
 * role tersimpan di server kehilangan hak baca: sapuan perangkat pertama menunjukkan Kasir turun
 * dari 11 menu menjadi 3.
 *
 * Isi role di test ini diambil APA ADANYA dari `cuciin-db` dan `cuciin-debug-db` sebelum 1.10.30.
 *
 * Dua kelompok rute diperlakukan berbeda, dan itu disengaja:
 *
 * 1. Rute yang SUDAH punya gerbang di 1.10.29 (`gateLama`). Menu ini tidak boleh tertutup setelah
 *    naik versi. Inilah regresi yang dikunci.
 * 2. Rute yang di 1.10.29 TIDAK punya gerbang sama sekali (`tanpaGerbangLama`), artinya terbuka
 *    untuk semua peran tanpa pemeriksaan apa pun. Sekarang rute itu mengikuti modulnya. Menu bisa
 *    tertutup bagi peran yang memang tidak memegang modul itu, dan itu PERBAIKAN, bukan regresi:
 *    sebelumnya layar aset cabang dan biaya operasional terbuka untuk peran yang tidak berhak.
 *    Daftar penutupan yang diharapkan ditulis eksplisit di [penutupanYangDisengaja] supaya
 *    perubahan perilaku ini terlihat, bukan tersembunyi.
 */
class AccessUpgradeRegressionTest {

    /**
     * Gerbang versi 1.10.29: rute -> MODUL saja.
     *
     * Disalin dari `RouteAccess.kt` pada `HEAD` sebelum perubahan. Sengaja tidak membaca berkas
     * sekarang: yang dibandingkan adalah perilaku versi lama.
     */
    private val gateLama: Map<String, String> = mapOf(
        "service" to "service",
        "cash" to "cash",
        "analytics" to "analytics",
        "analyticsReport" to "analytics",
        "audit" to "audit",
        "branches" to "owner",
        "users" to "owner",
        "services" to "owner",
        "products" to "owner",
        "accessRoles" to "owner",
        "ownerSettings" to "owner",
    )

    /** Rute yang di 1.10.29 tidak diperiksa sama sekali: terbuka untuk semua peran. */
    private val tanpaGerbangLama: Set<String> = setOf(
        "queue", "attendance", "inventory", "expenses", "customers",
        "wa", "waArchive", "profil", "theme", "versions",
    )

    /**
     * Menu yang memang TERTUTUP sesudah gerbangnya dipasang, per peran.
     *
     * Bukan daftar keinginan: ini akibat langsung dari peran yang tidak memegang modul terkait.
     * Dulu layar-layar ini tidak diperiksa sama sekali, jadi tertutupnya adalah perbaikan.
     */
    private val penutupanYangDisengaja: Map<String, Set<String>> = mapOf(
        // Kasir tidak memegang modul aset cabang: dulu bisa membukanya, sekarang tidak.
        "Kasir" to setOf("inventory"),
        // Supervisor tidak memegang modul pelanggan, biaya, maupun WhatsApp.
        "Supervisor" to setOf("customers", "expenses", "wa", "waArchive"),
        // Role kustom di bawah memegang seluruh modul terkait, jadi tidak ada yang tertutup.
        "Kustom" to emptySet(),
    )

    private val ruteMenu: List<String> = MenuOrder.catalog.map { it.route }

    /** Menu yang terbuka menurut aturan versi LAMA. */
    private fun terbukaLama(modules: Set<String>): List<String> = ruteMenu.filter { route ->
        route in tanpaGerbangLama || gateLama[route] in modules
    }

    /**
     * Menu yang terbuka SESUDAH naik versi katalog.
     *
     * Gerbang tanpa fungsi hanya memeriksa modulnya, sama seperti `CuciinStore.canAccess(module,
     * null)`. Tanpa cabang ini, rute ber-gerbang modul-saja terlihat tertutup padahal terbuka.
     */
    private fun terbukaBaru(role: AccessRole): List<String> {
        val naik = AccessCatalog.upgrade(role)
        return ruteMenu.filter { route ->
            val gate = RouteAccess.gateOf(route) ?: return@filter true
            gate.module in naik.modules && (gate.function == null || gate.function in naik.functions)
        }
    }

    private fun periksa(nama: String, modules: Set<String>, functions: Set<String>) {
        val role = AccessRole(
            id = "role-uji-${nama.lowercase()}",
            name = nama,
            builtIn = false,
            modules = modules,
            functions = functions,
        )
        val baru = terbukaBaru(role).toSet()
        // Hanya rute yang SUDAH dijaga di 1.10.29 yang wajib tetap terbuka.
        val hilang = terbukaLama(modules).filter { it in gateLama }.toSet() - baru
        assertTrue(
            "Naik versi katalog menutup menu $nama yang tadinya dijaga izin: $hilang",
            hilang.isEmpty(),
        )
        val tertutup = ruteMenu.filter { it in tanpaGerbangLama }.toSet() - baru
        assertEquals(
            "Penutupan menu $nama berbeda dari yang disengaja",
            penutupanYangDisengaja[nama].orEmpty(),
            tertutup,
        )
    }

    @Test
    fun kasirTersimpanTidakKehilanganMenuYangDijaga() {
        // Isi role Kasir apa adanya dari `cuciin-debug-db` sebelum 1.10.30.
        periksa(
            "Kasir",
            setOf("queue", "service", "stock", "attendance", "cash", "customer", "expense", "whatsapp"),
            setOf(
                "queue.status", "queue.handover", "service.create", "service.payment",
                "stock.write", "attendance.write", "cash.close", "customer.write",
                "expense.write", "whatsapp.send",
            ),
        )
    }

    @Test
    fun supervisorTersimpanTidakKehilanganMenuYangDijaga() {
        // Isi role Supervisor apa adanya dari kedua server.
        periksa(
            "Supervisor",
            setOf("queue", "service", "stock", "inventory", "attendance", "analytics"),
            setOf(
                "queue.status", "queue.handover", "service.create", "stock.write",
                "inventory.write", "attendance.write", "analytics.view",
            ),
        )
    }

    @Test
    fun ownerTersimpanSelaluPenuh() {
        // Catatan role Owner di produksi sempat tertinggal 16 dari 17 fungsi. Owner tetap harus
        // mendapat seluruh menu, dan role-nya ditulis penuh supaya layar Kontrol Akses Role
        // menampilkan centang yang sesuai dengan haknya.
        val owner = AccessCatalog.builtInRoles().first { it.id == "role-owner" }
        val naik = AccessCatalog.upgrade(owner.copy(catalogVersion = 0))
        assertTrue(
            "Owner harus penuh sesudah naik versi",
            naik.functions.containsAll(AccessCatalog.allFunctionKeys()),
        )
        assertEquals("Owner harus penuh modulnya", AccessCatalog.moduleKeys, naik.modules)
        assertEquals("Owner tidak boleh kehilangan satu menu pun", ruteMenu.size, terbukaBaru(naik).size)
    }

    @Test
    fun roleKustomDenganKunciLamaTidakKehilanganHakBaca() {
        // Role buatan sendiri yang dipakai sebelum versi ini: modul lengkap, fungsi hanya yang
        // dulu dituntut.
        periksa(
            "Kustom",
            setOf("queue", "customer", "stock", "inventory", "whatsapp", "expense", "attendance"),
            setOf("queue.status", "customer.write", "stock.write", "inventory.write", "whatsapp.send"),
        )
    }
}
