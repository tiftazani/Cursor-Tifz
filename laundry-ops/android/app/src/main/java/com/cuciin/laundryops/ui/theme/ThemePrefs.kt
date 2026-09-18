package com.cuciin.laundryops.ui.theme

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Pilihan tema disimpan di preferensi aplikasi, terpisah dari data operasional.
 * Karena tidak ikut snapshot maupun sinkronisasi, tiap HP bebas memilih tampilannya sendiri.
 */
object ThemePrefs {
    private const val FILE = "cuciin-ui"
    private const val KEY_MODE = "themeMode"
    private const val KEY_PRIMARY = "customPrimary"
    private const val KEY_BUTTON = "customButton"
    private const val KEY_BACKGROUND = "customBackground"
    private const val KEY_CARD = "customCard"
    private const val KEY_INK = "customInk"
    private const val KEY_HERO = "customHero"

    var mode by mutableStateOf(CuciinThemeMode.Terang)
        private set

    var custom by mutableStateOf(CuciinCustomTheme.Default)
        private set

    private var store: android.content.SharedPreferences? = null

    fun attach(context: Context) {
        if (store != null) return
        val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        store = prefs
        mode = readMode(prefs.getString(KEY_MODE, null))
        custom = CuciinCustomTheme(
            primary = prefs.getInt(KEY_PRIMARY, CuciinCustomTheme.Default.primary),
            button = prefs.getInt(KEY_BUTTON, CuciinCustomTheme.Default.button),
            background = prefs.getInt(KEY_BACKGROUND, CuciinCustomTheme.Default.background),
            card = prefs.getInt(KEY_CARD, CuciinCustomTheme.Default.card),
            ink = prefs.getInt(KEY_INK, CuciinCustomTheme.Default.ink),
            hero = prefs.getInt(KEY_HERO, CuciinCustomTheme.Default.hero),
        )
    }

    fun set(value: CuciinThemeMode) {
        if (mode == value) return
        mode = value
        store?.edit()?.putString(KEY_MODE, value.name)?.apply()
    }

    /** Menyimpan tema kustom. Warnanya dipakai langsung, jadi pratinjau dan hasil akhir sama. */
    fun applyCustom(value: CuciinCustomTheme) {
        if (custom == value) return
        custom = value
        store?.edit()
            ?.putInt(KEY_PRIMARY, value.primary)
            ?.putInt(KEY_BUTTON, value.button)
            ?.putInt(KEY_BACKGROUND, value.background)
            ?.putInt(KEY_CARD, value.card)
            ?.putInt(KEY_INK, value.ink)
            ?.putInt(KEY_HERO, value.hero)
            ?.apply()
    }

    /** Mengembalikan tema kustom ke titik awal tanpa mengubah mode yang sedang dipakai. */
    fun resetCustom() = applyCustom(CuciinCustomTheme.Default)

    /**
     * Nilai lama yang tidak dikenal dipetakan ke tema terdekat, bukan dibiarkan gagal tampil.
     * "Sistem" dan "Warni" berasal dari versi sebelum tema Custom.
     */
    private fun readMode(raw: String?): CuciinThemeMode = when (raw) {
        CuciinThemeMode.Terang.name, "Sistem" -> CuciinThemeMode.Terang
        CuciinThemeMode.Gelap.name -> CuciinThemeMode.Gelap
        CuciinThemeMode.Custom.name, "Warni" -> CuciinThemeMode.Custom
        else -> CuciinThemeMode.Terang
    }

}
