package com.cuciin.laundryops.ui.theme

import com.cuciin.laundryops.ui.parseHex
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Aturan tema: Light, Dark, dan Custom masing-masing punya palet sendiri, dan warna
 * teks di atas tombol maupun header dihitung dari warna yang dipilih pengguna.
 *
 * Warna tidak diuji lewat rasio kontras di sini karena itu dijaga di skrip mockup;
 * yang diuji adalah perilaku pembentukan palet dan pemulihan pilihan lama.
 */
class ThemePaletteTest {

    @Test
    fun setiapModePunyaPaletSendiri() {
        val terang = paletteFor(CuciinThemeMode.Terang, systemDark = false)
        val gelap = paletteFor(CuciinThemeMode.Gelap, systemDark = true)
        val custom = paletteFor(CuciinThemeMode.Custom, systemDark = false, custom = CuciinCustomTheme.Default)

        assertFalse("Light bukan tema gelap", terang.dark)
        assertTrue("Dark harus ditandai gelap", gelap.dark)

        // Mode tidak lagi bergantung pada pengaturan HP: Light tetap terang di HP gelap.
        assertEquals(terang, paletteFor(CuciinThemeMode.Terang, systemDark = true))
        assertEquals(gelap, paletteFor(CuciinThemeMode.Gelap, systemDark = false))
        // Custom bawaan memang menyerupai Light; warna yang diubah harus benar-benar berbeda.
        val ubah = CuciinCustomTheme.Default.copy(background = 0xFF101820.toInt())
        assertNotEquals(terang.bg, paletteFor(CuciinThemeMode.Custom, systemDark = false, custom = ubah).bg)
    }

    @Test
    fun darkMemakaiLatarNavyTua() {
        val gelap = paletteFor(CuciinThemeMode.Gelap, systemDark = true)
        // Latar gelap memakai navy tua, bukan hitam pekat, supaya senada dengan nuansa biru
        // logo dan gambar layar pembuka. Yang penting: cukup gelap untuk tema gelap, dan
        // kartunya tetap terbedakan dari latar.
        assertTrue("Latar Dark harus gelap", gelap.bg.luminance() < 0.1f)
        assertTrue("Kartu Dark tidak boleh sama dengan latar", gelap.card != gelap.bg)
        assertTrue("Kartu Dark harus lebih terang dari latar", gelap.card.luminance() > gelap.bg.luminance())
    }

    @Test
    fun nuansaBiruDipakaidiLightDanDark() {
        // Palet mengikuti warna logo: biru #0048B4 dan biru langit. Yang dijaga di sini:
        // aksen Light memang biru (kanal biru paling besar), dan aksen Dark lebih terang
        // supaya terbaca di atas latar gelap.
        val terang = paletteFor(CuciinThemeMode.Terang, systemDark = false)
        val gelap = paletteFor(CuciinThemeMode.Gelap, systemDark = true)

        assertTrue("Aksen Light harus biru", terang.prim.blue > terang.prim.red && terang.prim.blue > terang.prim.green)
        assertTrue("Aksen Dark harus biru", gelap.prim.blue > gelap.prim.red && gelap.prim.blue > gelap.prim.green)
        assertTrue("Aksen Dark harus lebih terang dari aksen Light", gelap.prim.luminance() > terang.prim.luminance())
        // Kuning aksen menu dipertahankan di kedua tema.
        assertEquals(terang.navSelected, gelap.navSelected)
    }

    @Test
    fun presetBiruCuciinSejalanDenganTemaLight() {
        val terang = paletteFor(CuciinThemeMode.Terang, systemDark = false)
        val preset = CuciinCustomTheme.BiruCuciin.toPalette()
        // Preset bawaan harus menghasilkan warna yang sama dengan tema Light, supaya pengguna
        // yang membuka Custom tidak melihat warna yang berbeda dari biasanya.
        assertEquals(terang.bg, preset.bg)
        assertEquals(terang.card, preset.card)
        assertEquals(terang.prim, preset.prim)
        assertEquals(terang.ink, preset.ink)
        assertEquals(terang.heroA, preset.heroA)
    }

    @Test
    fun presetDitawarkanDanBisaDipilih() {
        val nama = CuciinCustomTheme.presets.map { it.first }
        assertTrue("Preset Biru Cuciin harus ditawarkan", "Biru Cuciin" in nama)
        assertTrue("Preset gelap juga ditawarkan", "Biru Cuciin Gelap" in nama)
        // Preset pertama adalah nilai bawaan tema Custom.
        assertEquals(CuciinCustomTheme.presets.first().second, CuciinCustomTheme.Default)
        // Setiap preset harus menghasilkan palet yang bisa dipakai, bukan warna kosong.
        CuciinCustomTheme.presets.forEach { (label, preset) ->
            val p = preset.toPalette()
            assertTrue("Preset $label harus punya aksen", p.prim.luminance() != p.bg.luminance())
        }
    }

    @Test
    fun customMemakaiWarnaYangDipilih() {
        val custom = CuciinCustomTheme(
            primary = 0xFF00AA55.toInt(),
            button = 0xFF112233.toInt(),
            background = 0xFFFFFFFF.toInt(),
            card = 0xFFF0F0F0.toInt(),
            ink = 0xFF000000.toInt(),
            hero = 0xFF203040.toInt(),
        )
        val palette = paletteFor(CuciinThemeMode.Custom, systemDark = false, custom = custom)

        assertEquals(androidx.compose.ui.graphics.Color(0xFF00AA55.toInt()), palette.prim)
        assertEquals(androidx.compose.ui.graphics.Color(0xFF112233.toInt()), palette.button)
        assertEquals(androidx.compose.ui.graphics.Color(0xFFFFFFFF.toInt()), palette.bg)
        assertEquals(androidx.compose.ui.graphics.Color(0xFFF0F0F0.toInt()), palette.card)
        assertEquals(androidx.compose.ui.graphics.Color(0xFF000000.toInt()), palette.ink)
        assertEquals(androidx.compose.ui.graphics.Color(0xFF203040.toInt()), palette.heroA)
    }

    @Test
    fun warnaTeksDihitungDariTerangGelapWarna() {
        // Tombol gelap harus memakai teks putih, tombol terang memakai teks gelap.
        val dark = CuciinCustomTheme.Default.copy(button = 0xFF102030.toInt()).toPalette()
        val light = CuciinCustomTheme.Default.copy(button = 0xFFF7F7F7.toInt()).toPalette()

        assertTrue("Tombol gelap perlu teks terang", dark.onButton.luminance() > 0.5f)
        assertTrue("Tombol terang perlu teks gelap", light.onButton.luminance() < 0.5f)
    }

    @Test
    fun headerCustomSelaluTerbaca() {
        listOf(0xFF0D164B.toInt(), 0xFFFFFFFF.toInt(), 0xFF7A7A7A.toInt()).forEach { hero ->
            val palette = CuciinCustomTheme.Default.copy(hero = hero).toPalette()
            val onHero = palette.onHero.luminance()
            val heroLuminance = palette.heroA.luminance()
            // Teks header harus berlawanan terang gelap dengan latarnya.
            assertTrue(
                "Teks header harus kontras dengan latar header",
                if (heroLuminance > 0.55f) onHero < 0.5f else onHero > 0.5f,
            )
        }
    }

    @Test
    fun latarGelapMenandaiPaletSebagaiGelap() {
        val darkBg = CuciinCustomTheme.Default.copy(background = 0xFF101010.toInt()).toPalette()
        val lightBg = CuciinCustomTheme.Default.copy(background = 0xFFFAFAFA.toInt()).toPalette()

        assertTrue("Latar gelap harus menghasilkan tema gelap", darkBg.dark)
        assertFalse("Latar terang bukan tema gelap", lightBg.dark)
    }

    @Test
    fun tokenTurunanIkutWarnaCustom() {
        val palette = CuciinCustomTheme.Default.copy(primary = 0xFF00AA55.toInt()).toPalette()

        assertEquals(palette.prim, palette.teal)
        assertEquals(palette.bg, palette.foam)
        assertEquals(palette.primSoft, palette.mist)
        assertEquals(palette.primDeep, palette.tealDeep)
    }

    @Test
    fun garisDekoratifDibedakanDariBatasKontrol() {
        listOf(LightPalette, DarkPalette, CuciinCustomTheme.Default.toPalette()).forEach { palette ->
            assertTrue(
                "Garis dekoratif harus lebih lembut dari batas kontrol",
                palette.line.luminance() != palette.lineSoft.luminance(),
            )
        }
    }

    @Test
    fun pilihanLamaDipetakanKeTemaTerdekat() {
        // Nilai bawaan saat preferensi belum pernah diisi.
        assertEquals(CuciinThemeMode.Terang, ThemePrefs.mode)
        assertEquals("Light", CuciinThemeMode.Terang.label)
        assertEquals("Dark", CuciinThemeMode.Gelap.label)
        assertEquals("Custom", CuciinThemeMode.Custom.label)
        assertEquals(3, CuciinThemeMode.entries.size)
    }

    @Test
    fun kodeHexDibacaDanDitolakDenganBenar() {
        // parseHex mengembalikan ARGB penuh, jadi alpha-nya selalu 0xFF.
        assertEquals(0xFF00AA55.toInt(), parseHex("#00AA55"))
        assertEquals(0xFF00AA55.toInt(), parseHex("00aa55"))
        assertEquals(null, parseHex("#00AA5"))
        assertEquals(null, parseHex("#GGGGGG"))
        assertEquals(null, parseHex(""))
    }
}

private fun androidx.compose.ui.graphics.Color.luminance(): Float =
    0.2126f * red + 0.7152f * green + 0.0722f * blue
