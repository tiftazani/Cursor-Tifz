package com.cuciin.laundryops.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import com.cuciin.laundryops.ui.Motion

/**
 * Animasi masuk sekali jalan untuk baris daftar.
 *
 * Baris menyusul muncul sambil bergeser sedikit dari bawah. Dipakai hanya untuk beberapa
 * baris pertama: [maxAnimated] dibatasi supaya daftar panjang tidak memicu puluhan animasi
 * sekaligus, dan baris yang di luar batas langsung tampil tanpa gerak.
 *
 * Hanya alpha dan translasi yang berubah, keduanya digambar lewat `graphicsLayer` sehingga
 * tidak ada pengukuran ulang tata letak: tetap mulus di HP kelas bawah. Saat pengguna
 * mematikan animasi di pengaturan sistem, baris langsung tampil.
 */
@Composable
fun EnterOnce(
    index: Int,
    maxAnimated: Int = 6,
    stepMs: Int = 28,
    offsetDp: Float = 14f,
    content: @Composable () -> Unit,
) {
    if (!Motion.enabled || index >= maxAnimated) {
        content()
        return
    }

    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }

    // Tiap baris diberi jeda kecil berurutan supaya munculnya terasa mengalir, bukan serentak.
    val delay = index * stepMs
    val alpha by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        animationSpec = tween(durationMillis = Motion.ms(220), delayMillis = Motion.ms(delay), easing = Motion.easing),
        label = "baris alpha",
    )
    val shift by animateFloatAsState(
        targetValue = if (shown) 0f else offsetDp,
        animationSpec = tween(durationMillis = Motion.ms(240), delayMillis = Motion.ms(delay), easing = Motion.easing),
        label = "baris geser",
    )

    Box(Modifier.graphicsLayer { this.alpha = alpha; translationY = shift * density }) { content() }
}
