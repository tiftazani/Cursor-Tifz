package com.cuciin.laundryops.ui.theme

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.toArgb

/**
 * Pilihan tema disimpan di preferensi aplikasi, terpisah dari data operasional.
 * Karena tidak ikut snapshot maupun sinkronisasi, tiap HP bebas memilih tampilannya sendiri.
 */
object ThemePrefs {
    private const val FILE = "cuciin-ui"
    private const val KEY = "themeMode"

    var mode by mutableStateOf(CuciinThemeMode.Sistem)
        private set

    private var store: android.content.SharedPreferences? = null

    fun attach(context: Context) {
        if (store != null) return
        val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        store = prefs
        mode = read(prefs.getString(KEY, null))
    }

    fun set(value: CuciinThemeMode) {
        if (mode == value) return
        mode = value
        store?.edit()?.putString(KEY, value.name)?.apply()
    }

    /** Nilai tidak dikenal dianggap "ikut sistem", bukan pilihan yang gagal tampil. */
    private fun read(raw: String?): CuciinThemeMode =
        CuciinThemeMode.entries.firstOrNull { it.name == raw } ?: CuciinThemeMode.Sistem

    /** Warna sistem untuk status bar dan navigation bar pada tema ini. */
    internal fun systemBarColors(mode: CuciinThemeMode, systemDark: Boolean): Pair<Int, Int> {
        val palette = paletteFor(mode, systemDark)
        return palette.bg.toArgb() to palette.card.toArgb()
    }
}
