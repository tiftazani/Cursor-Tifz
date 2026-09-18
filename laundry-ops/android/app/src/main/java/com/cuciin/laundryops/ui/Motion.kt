package com.cuciin.laundryops.ui

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FastOutSlowInEasing

/**
 * Token gerak aplikasi.
 *
 * Semua durasi animasi diambil dari sini supaya gerak seragam dan bisa dimatikan sekaligus.
 * Pengguna yang mematikan animasi di pengaturan Android ("Hapus animasi") otomatis mendapat
 * durasi 0, jadi layar berpindah seketika tanpa gerak yang tidak diinginkan.
 *
 * Durasi sengaja pendek dan hanya memakai alpha, geser, dan skala. Ketiganya dikerjakan GPU
 * lewat graphicsLayer tanpa menghitung ulang tata letak, sehingga tetap mulus di HP kelas
 * bawah: tidak ada permintaan ukur ulang dan tidak ada bayangan yang harus dihitung ulang.
 */
object Motion {

    private var scale: Float = 1f

    /**
     * Membaca pengaturan animasi sistem. `ANIMATOR_DURATION_SCALE` bernilai 0 saat pengguna
     * memilih "Hapus animasi" di menu pengembang atau aksesibilitas.
     */
    fun attach(context: Context) {
        scale = runCatching {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
        }.getOrDefault(1f).coerceAtLeast(0f)
    }

    /** False bila pengguna mematikan animasi di pengaturan sistem. */
    val enabled: Boolean get() = scale > 0.01f

    /**
     * Durasi dasar dalam milidetik, sudah mengikuti pengaturan sistem.
     * Bernilai 0 saat animasi dimatikan, sehingga perpindahan terjadi seketika.
     */
    fun ms(base: Int): Int = if (enabled) (base * scale).toInt().coerceAtLeast(1) else 0

    val easing: Easing = FastOutSlowInEasing
}
