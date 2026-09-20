package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Setiap menu di layar Modul harus menunjuk rute yang benar-benar terdaftar di graf navigasi.
 *
 * Pernah terjadi: katalog menu memakai nama menunya sendiri (`queue` dan `service`), sedangkan
 * graf navigasi memakai `home` dan `nota`. `nav.navigate("queue")` melempar
 * `IllegalArgumentException` sehingga aplikasi langsung keluar saat menu itu diklik.
 *
 * Test ini membandingkan katalog menu dengan daftar `composable(...)` di `CuciinNav.kt`.
 * Kalau ada menu baru yang rutenya belum terdaftar, test ini gagal sebelum sampai ke pengguna.
 */
class MenuRouteTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    /** Rute yang terdaftar di graf navigasi, diambil dari kode sumber. */
    private fun ruteGraf(): Set<String> {
        val kode = baca("src/main/java/com/cuciin/laundryops/ui/CuciinNav.kt")
        return Regex("""composable\("([^"{]+)""")
            .findAll(kode)
            .map { it.groupValues[1] }
            .toSet()
    }

    @Test
    fun setiapMenuMenunjukRuteYangTerdaftarDiGraf() {
        val graf = ruteGraf()
        assertTrue("Daftar rute graf tidak terbaca", graf.size > 20)

        val hilang = MenuOrder.catalog
            .map { it.route to MenuOrder.destinationOf(it.route) }
            .filter { (_, tujuan) -> tujuan !in graf }

        assertTrue(
            "Menu ini menunjuk rute yang tidak ada di graf navigasi, dan akan membuat " +
                "aplikasi keluar saat diklik:\n" +
                hilang.joinToString("\n") { (menu, tujuan) -> "  menu '$menu' -> rute '$tujuan'" },
            hilang.isEmpty(),
        )
    }

    @Test
    fun ruteMenuYangSamaDenganTabTidakDiubah() {
        // Menu yang rutenya sudah sama dengan graf tidak boleh ikut dipetakan.
        assertEquals("attendance", MenuOrder.destinationOf("attendance"))
        assertEquals("theme", MenuOrder.destinationOf("theme"))
        assertEquals("versions", MenuOrder.destinationOf("versions"))
    }

    @Test
    fun antrianDanServiceMenunjukRuteTab() {
        // Dua menu yang dilaporkan Owner. Rutenya milik tab bawah, bukan nama menunya.
        assertEquals("home", MenuOrder.destinationOf("queue"))
        assertEquals("nota", MenuOrder.destinationOf("service"))
    }

    @Test
    fun setiapRuteTabTerdaftarDiGraf() {
        val graf = ruteGraf()
        NavTabs.all.forEach { tab ->
            assertTrue(
                "Tab '${tab.label}' menunjuk rute '${tab.route}' yang tidak ada di graf",
                tab.route in graf,
            )
        }
    }

    @Test
    fun semuaMenuKatalogMempunyaiTujuan() {
        // Setiap menu harus punya tujuan, bukan string kosong yang akan gagal saat diklik.
        MenuOrder.catalog.forEach { spec ->
            assertTrue(
                "Menu '${spec.label}' tidak punya tujuan navigasi",
                MenuOrder.destinationOf(spec.route).isNotBlank(),
            )
        }
    }

    @Test
    fun menuYangTabnyaTidakTerpakaiSpvIkutDisembunyikan() {
        // Aturan tampil menu harus sama dengan aturan tampil tab. Dulu SPV melihat "Service baru"
        // di menu Modul padahal tab dan layar Antrian menyembunyikannya, dan server menolak
        // pembuatan Service oleh SPV.
        //
        // Ukurannya sekarang FUNGSI, bukan nama peran: menu disembunyikan bila fungsi utama tab
        // itu tidak dimiliki akun. Untuk SPV hasilnya sama seperti sebelumnya, karena role
        // bawaan Supervisor memang tidak memegang `service.create` dan `whatsapp.send`.
        val supervisor = AccessCatalog.builtInRoles().first { it.id == "role-supervisor" }
        val boleh = { module: String, function: String? ->
            module in supervisor.modules && (function == null || function in supervisor.functions)
        }
        val disembunyikan = MenuOrder.catalog
            .filter { spec ->
                val tab = NavTabs.routeOf(MenuOrder.destinationOf(spec.route)) ?: return@filter false
                tab.module.isNotEmpty() && !boleh(tab.module, tab.function)
            }
            .map { it.label }

        assertTrue("Service baru harus disembunyikan untuk SPV", "Service baru" in disembunyikan)
        assertTrue("WA menunggu harus disembunyikan untuk SPV", "WA menunggu" in disembunyikan)
        // Menu yang tidak terkait tab tidak ikut terkena aturan ini.
        assertTrue("Antrian laundry tetap tampil untuk SPV", "Antrian laundry" !in disembunyikan)
    }
}
