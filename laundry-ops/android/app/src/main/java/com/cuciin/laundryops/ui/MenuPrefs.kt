package com.cuciin.laundryops.ui

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Susunan menu yang disimpan di preferensi aplikasi, terpisah dari data operasional.
 *
 * Sama seperti pilihan tema, susunan ini tidak ikut snapshot maupun sinkronisasi: tiap HP
 * menyusun menunya sendiri. Yang disimpan hanya rute, bukan label, supaya penggantian nama
 * menu di pembaruan berikutnya tetap terbaca.
 *
 * Format simpan:
 *
 * - `sectionOrder`: urutan bagian, dipisah tanda hubung tegak.
 * - `routeOrder`: urutan menu, dipisah tanda hubung tegak.
 * - `routeSection`: pasangan `rute=bagian`, hanya untuk menu yang dipindah pengguna.
 */
internal object MenuPrefs {
    private const val FILE = "cuciin-ui"
    private const val KEY_SECTIONS = "menuSectionOrder"
    private const val KEY_ROUTES = "menuRouteOrder"
    private const val KEY_PLACEMENT = "menuRouteSection"

    var layout by mutableStateOf(MenuOrder.defaultLayout())
        private set

    private var store: android.content.SharedPreferences? = null

    fun attach(context: Context) {
        if (store != null) return
        val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        store = prefs
        layout = MenuOrder.layoutOf(
            sectionOrder = readList(prefs.getString(KEY_SECTIONS, null)),
            routeOrder = readList(prefs.getString(KEY_ROUTES, null)),
            routeSection = readPlacement(prefs.getString(KEY_PLACEMENT, null)),
        )
    }

    fun apply(next: MenuLayout) {
        if (next == layout) return
        layout = next
        store?.edit()
            ?.putString(KEY_SECTIONS, next.storedSectionOrder().joinToString("|"))
            ?.putString(KEY_ROUTES, next.storedRouteOrder().joinToString("|"))
            ?.putString(KEY_PLACEMENT, next.storedSections().entries.joinToString("|") { "${it.key}=${it.value}" })
            ?.apply()
    }

    /** Kembali ke susunan bawaan tanpa mengubah data lain. */
    fun reset() {
        layout = MenuOrder.defaultLayout()
        store?.edit()?.remove(KEY_SECTIONS)?.remove(KEY_ROUTES)?.remove(KEY_PLACEMENT)?.apply()
    }

    /** Susunan tersimpan bisa saja rusak atau kosong; keduanya jatuh ke susunan bawaan. */
    private fun readList(raw: String?): List<String> =
        raw?.split('|')?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()

    private fun readPlacement(raw: String?): Map<String, String> =
        readList(raw)
            .mapNotNull { entry ->
                val parts = entry.split('=')
                if (parts.size == 2 && parts[0].isNotBlank() && parts[1].isNotBlank()) parts[0] to parts[1] else null
            }
            .toMap()
}
