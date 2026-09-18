package com.cuciin.laundryops.ui

import android.content.Context

/**
 * Penanda apakah layar pembuka sudah pernah ditampilkan.
 *
 * Layar pembuka muncul sekali setelah aplikasi dipasang, lalu tidak muncul lagi supaya
 * pengguna yang sudah tahu tidak perlu melewatinya setiap membuka aplikasi. Pengguna tetap
 * bisa membukanya lagi lewat tautan "Tentang aplikasi" di halaman masuk.
 *
 * Disimpan di preferensi aplikasi, terpisah dari data operasional dan tidak ikut sinkronisasi.
 */
internal object OnboardingPrefs {
    private const val FILE = "cuciin-ui"
    private const val KEY_SEEN = "onboardingSeen"

    private var store: android.content.SharedPreferences? = null
    private var seen: Boolean = false

    fun attach(context: Context) {
        if (store != null) return
        val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        store = prefs
        seen = prefs.getBoolean(KEY_SEEN, false)
    }

    /** True bila layar pembuka sudah pernah ditampilkan. */
    val alreadySeen: Boolean get() = seen

    /** Tandai sudah dilihat, dipanggil saat pengguna menekan tombol selesai atau lewati. */
    fun markSeen() {
        if (seen) return
        seen = true
        store?.edit()?.putBoolean(KEY_SEEN, true)?.apply()
    }

    /** Dipakai pengujian dan tombol "Tentang aplikasi": paksa tampil lagi. */
    fun reset() {
        seen = false
        store?.edit()?.putBoolean(KEY_SEEN, false)?.apply()
    }
}
