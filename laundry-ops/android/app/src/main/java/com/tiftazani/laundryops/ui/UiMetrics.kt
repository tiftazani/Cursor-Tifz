package com.tiftazani.laundryops.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class UiMetrics(
    val widthDp: Int,
    val heightDp: Int,
    val compact: Boolean,
    val useRail: Boolean,
    val pad: Dp,
    val gap: Dp,
    val radius: Dp,
    val titleSp: TextUnit,
    val heroSp: TextUnit,
    val twoPane: Boolean,
)

@Composable
fun rememberUi(): UiMetrics {
    val cfg = LocalConfiguration.current
    val w = cfg.screenWidthDp
    val h = cfg.screenHeightDp
    return remember(w, h) {
        UiMetrics(
            widthDp = w,
            heightDp = h,
            compact = w < 600,
            useRail = w >= 600,
            pad = when {
                w < 340 -> 12.dp
                w < 400 -> 16.dp
                w >= 840 -> 28.dp
                else -> 20.dp
            },
            gap = if (w < 360) 8.dp else 12.dp,
            radius = if (w < 360) 18.dp else 24.dp,
            titleSp = when {
                w < 340 -> 22.sp
                h < 640 -> 24.sp
                else -> 28.sp
            },
            heroSp = when {
                w < 340 -> 24.sp
                h < 640 -> 28.sp
                else -> 34.sp
            },
            twoPane = w >= 840,
        )
    }
}
