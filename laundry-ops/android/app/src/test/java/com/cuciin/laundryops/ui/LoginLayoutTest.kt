package com.cuciin.laundryops.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Tata letak layar login.
 *
 * Bug yang dikunci di sini: layar login dirancang muat satu layar tanpa gulir sama sekali.
 * Saat keyboard terbuka ruang tersisa menyusut jauh, sehingga bagian bawah kartu terpotong:
 * tulisan "Lupa kata sandi?" hilang dan tombol "Daftar akun" tidak terjangkau.
 *
 * Aturannya sekarang: saat ruang sempit isi dipadatkan dan boleh digulir; saat ruang lega
 * layar tetap satu layar penuh tanpa gulir seperti desain aslinya.
 */
class LoginLayoutTest {

    @Test
    fun ruangLegaTetapSatuLayarPenuh() {
        val spec = LoginLayout.forRoom(heightDp = 800, keyboardOpen = false)
        assertTrue("Ruang lega harus dianggap lega", spec.roomy)
        assertFalse("Ruang lega tidak boleh digulir", spec.scrollable)
        assertEquals("Logo ukuran penuh saat lega", 104, spec.brandSize)
    }

    @Test
    fun keyboardTerbukaMembuatIsiDipadatkanDanBolehDigulir() {
        // Layar tinggi pun jadi sempit saat keyboard terbuka, karena ruang benar-benar tersisa
        // hanya sebagian. Inset keyboard adalah tanda yang dapat dipercaya.
        val spec = LoginLayout.forRoom(heightDp = 800, keyboardOpen = true)
        assertFalse("Saat keyboard terbuka tidak dianggap lega", spec.roomy)
        assertTrue("Saat keyboard terbuka isi boleh digulir", spec.scrollable)
        assertTrue("Logo mengecil supaya hemat ruang", spec.brandSize < 104)
        assertTrue("Jarak antar elemen dipadatkan", spec.gap < 10)
    }

    @Test
    fun layarPendekTanpaKeyboardJugaDipadatkan() {
        val spec = LoginLayout.forRoom(heightDp = 560, keyboardOpen = false)
        assertFalse("Layar pendek tidak lega", spec.roomy)
        assertTrue("Layar pendek boleh digulir", spec.scrollable)
    }

    @Test
    fun batasRuangLegaSesuaiAmbang() {
        assertEquals(
            "Di ambang harus lega",
            true,
            LoginLayout.forRoom(LoginLayout.ROOMY_MIN_HEIGHT_DP, keyboardOpen = false).roomy,
        )
        assertEquals(
            "Di bawah ambang tidak lega",
            false,
            LoginLayout.forRoom(LoginLayout.ROOMY_MIN_HEIGHT_DP - 1, keyboardOpen = false).roomy,
        )
    }

    @Test
    fun keadaanSempitSelaluBolehDigulir() {
        // Tidak boleh ada keadaan di mana isi tidak muat tetapi tidak bisa digulir: itulah
        // yang membuat tulisan terpotong tanpa cara menjangkaunya.
        listOf(400, 500, 560, 639).forEach { h ->
            listOf(true, false).forEach { kb ->
                val spec = LoginLayout.forRoom(h, kb)
                if (!spec.roomy) {
                    assertTrue("Ruang sempit harus bisa digulir (h=$h, keyboard=$kb)", spec.scrollable)
                }
            }
        }
    }
}
