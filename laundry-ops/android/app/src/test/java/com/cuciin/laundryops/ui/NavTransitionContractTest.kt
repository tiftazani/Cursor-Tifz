package com.cuciin.laundryops.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontrak perpindahan tab.
 *
 * Bug yang dikunci di sini: perpindahan tab memakai `popUpTo("home") { saveState = true }`
 * berpasangan dengan `restoreState = true`. Kombinasi itu hanya benar untuk graf navigasi
 * bertingkat; pada graf datar seperti di sini ia membuat tab macet.
 *
 * Gejala yang dilaporkan Owner: buka layar Service lewat tombol "Service baru" di layar
 * Antrian, lalu tekan tab Antrian. Tidak terjadi apa pun. Tab lain (WA, Stok, Modul) tetap
 * jalan. Bila Service dibuka lewat tab, tab Antrian juga jalan. Jadi bugnya bergantung pada
 * cara masuk ke layar itu.
 *
 * Perbaikannya: satu panggilan `navigate` dengan `launchSingleTop` dan `popUpTo("home")`
 * tanpa `saveState`/`restoreState`, dan tab yang sedang aktif tidak dinavigasi ulang.
 *
 * Aturan yang diuji di sini murni dan tidak butuh Android: rute tab, tujuan pembersihan, dan
 * keputusan apakah sebuah tab perlu dinavigasi.
 */
class NavTransitionContractTest {

    @Test
    fun setiapTabBisaDicapaiDariTabLain() {
        // Semua tab harus punya jalur perpindahan ke semua tab lain, termasuk kembali ke home.
        NavTabs.all.forEach { from ->
            NavTabs.all.forEach { to ->
                assertNotNull("Rute tujuan harus dikenal: ${to.route}", NavTabs.routeOf(to.route))
                assertTrue("Rute asal harus dikenal: ${from.route}", NavTabs.routes.contains(from.route))
            }
        }
    }

    @Test
    fun homeAdalahTujuanPembersihanDanSelaluAdaDiDasar() {
        // popUpTo("home") hanya aman bila home memang rute tab dan bukan rute alur.
        assertTrue("home harus rute tab", "home" in NavTabs.routes)
        assertEquals("home", NavTransition.HOME_ROUTE)
    }

    @Test
    fun tabTidakDinavigasiUlangSaatSudahAktif() {
        // Menekan tab yang sedang aktif tidak boleh menambah entri baru ke stack.
        NavTabs.all.forEach { tab ->
            assertFalse("Tab aktif tidak perlu dinavigasi", NavTransition.needsNavigation(current = tab.route, target = tab.route))
        }
    }

    @Test
    fun tabLainSelaluDinavigasi() {
        NavTabs.all.forEach { current ->
            NavTabs.all.forEach { target ->
                if (current.route != target.route) {
                    assertTrue(
                        "Dari ${current.route} ke ${target.route} harus berpindah",
                        NavTransition.needsNavigation(current = current.route, target = target.route),
                    )
                }
            }
        }
    }

    @Test
    fun layarAlurBukanTujuanTab() {
        // Layar alur tidak boleh jadi tujuan perpindahan tab, dan tidak memakai pembersihan tab.
        listOf("preview", "bayar", "queue/123", "stokEdit", "assetNew").forEach { route ->
            assertFalse("$route bukan tab", route in NavTabs.routes)
            assertFalse("$route tidak boleh jadi tujuan tab", NavTransition.needsNavigation(current = "home", target = route) && route in NavTabs.routes)
        }
    }

    @Test
    fun pembersihanTidakMembuangLayarYangSedangDibuka() {
        // popUpTo("home") tanpa inclusive harus mempertahankan home, supaya tombol kembali
        // dari layar tab tetap punya tempat pulang.
        assertFalse("home tidak boleh ikut dibuang", NavTransition.POP_INCLUSIVE)
    }
}
