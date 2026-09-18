package com.cuciin.laundryops.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Spring
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.scale
import com.cuciin.laundryops.ui.Motion

/**
 * Efek tekan: elemen mengecil sedikit saat ditekan, lalu kembali dengan pegas.
 *
 * Dipakai pada tombol dan baris yang dapat diklik supaya sentuhan terasa dijawab. Hanya skala
 * yang berubah dan digambar lewat `graphicsLayer`, jadi tidak ada pengukuran ulang tata letak
 * maupun perhitungan ulang bayangan: aman untuk HP kelas bawah.
 *
 * Saat pengguna mematikan animasi di pengaturan sistem, skala tetap 1 dan tidak ada gerak.
 */
fun Modifier.pressScale(
    interactionSource: MutableInteractionSource,
    pressed: Float = 0.96f,
): Modifier = composed {
    val isPressed by interactionSource.collectIsPressedAsState()
    val target = if (isPressed && Motion.enabled) pressed else 1f
    val scale by animateFloatAsState(
        targetValue = target,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessHigh),
        label = "tekan",
    )
    scale(scale)
}

/** Sumber interaksi dan efek tekan sekaligus, untuk elemen yang belum punya interaksi sendiri. */
@Composable
fun rememberPressScale(pressed: Float = 0.96f): Pair<MutableInteractionSource, Modifier> {
    val source = remember { MutableInteractionSource() }
    return source to Modifier.pressScale(source, pressed)
}
