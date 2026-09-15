package com.tiftazani.laundryops.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Aturan tema: pilihan tersimpan, tiap tema punya palet sendiri, dan "ikut sistem"
 * mengikuti gelap/terang HP. Warna tidak diuji lewat rasio kontras di sini karena
 * itu dijaga di skrip mockup; yang diuji adalah perilaku pemilihannya.
 */
class ThemePaletteTest {

    @Test
    fun setiapTemaPunyaPaletSendiri() {
        val terang = paletteFor(CuciinThemeMode.Terang, systemDark = false)
        val gelap = paletteFor(CuciinThemeMode.Gelap, systemDark = true)
        val warni = paletteFor(CuciinThemeMode.Warni, systemDark = false)

        assertFalse("Tema terang tidak boleh dianggap gelap", terang.dark)
        assertTrue("Tema gelap harus ditandai gelap", gelap.dark)
        assertFalse("Tema warna-warni adalah tema terang", warni.dark)

        assertEquals(terang, paletteFor(CuciinThemeMode.Terang, systemDark = true))
        assertEquals(gelap, paletteFor(CuciinThemeMode.Gelap, systemDark = false))
        assertEquals(warni, paletteFor(CuciinThemeMode.Warni, systemDark = true))
    }

    @Test
    fun ikutSistemMengikutiPengaturanHp() {
        assertEquals(LightPalette, paletteFor(CuciinThemeMode.Sistem, systemDark = false))
        assertEquals(DarkPalette, paletteFor(CuciinThemeMode.Sistem, systemDark = true))
    }

    @Test
    fun temaGelapMemakaiTeksTerangDiAtasTombol() {
        val gelap = paletteFor(CuciinThemeMode.Gelap, systemDark = true)
        val terang = paletteFor(CuciinThemeMode.Terang, systemDark = false)

        // Biru terang tidak bisa dipasangkan teks putih, jadi tema gelap memakai teks gelap.
        assertTrue("Tema gelap harus memakai onPrimary gelap", gelap.onPrim.luminance() < 0.5f)
        assertTrue("Tema terang tetap memakai teks putih", terang.onPrim.luminance() > 0.5f)
    }

    @Test
    fun warnaWarniMemakaiAksenPlumDanTidakSamaDenganTerang() {
        val warni = paletteFor(CuciinThemeMode.Warni, systemDark = false)
        val terang = paletteFor(CuciinThemeMode.Terang, systemDark = false)

        assertTrue("Aksen warna-warni harus berbeda dari tema terang", warni.prim != terang.prim)
        assertTrue("Latar warna-warni harus berbeda dari tema terang", warni.bg != terang.bg)
        // Semua token turunan ikut paletnya, bukan nilai tetap dari tema terang.
        assertEquals(warni.prim, warni.teal)
        assertEquals(warni.bg, warni.foam)
        assertEquals(warni.primSoft, warni.mist)
    }

    @Test
    fun garisDekoratifDibedakanDariBatasKontrol() {
        // Batas kontrol harus lebih tegas daripada garis pemisah dekoratif di setiap tema.
        listOf(LightPalette, DarkPalette, WarniPalette).forEach { palette ->
            assertTrue(
                "Garis dekoratif harus lebih lembut dari batas kontrol",
                palette.line.luminance() != palette.lineSoft.luminance(),
            )
        }
    }

    @Test
    fun pilihanTemaTidakDikenalKembaliKeIkutSistem() {
        // Nilai yang tidak dikenal tidak boleh membuat aplikasi gagal tampil.
        assertEquals(CuciinThemeMode.Sistem, ThemePrefs.mode)
        assertEquals("Ikut sistem", CuciinThemeMode.Sistem.label)
        assertEquals(4, CuciinThemeMode.entries.size)
    }
}

private fun androidx.compose.ui.graphics.Color.luminance(): Float =
    0.2126f * red + 0.7152f * green + 0.0722f * blue
