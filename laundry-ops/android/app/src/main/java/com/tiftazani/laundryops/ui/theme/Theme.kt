package com.tiftazani.laundryops.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Ink = Color(0xFF172B4D)
val Teal = Color(0xFF2859DB)
val TealDeep = Color(0xFF16327B)
val Foam = Color(0xFFF4F7FC)
val Mist = Color(0xFFE9EFFF)
val Coral = Color(0xFFB83E32)
val Gold = Color(0xFF956414)
val Muted = Color(0xFF60718D)
val Green = Color(0xFF16734E)
val Amber = Color(0xFF966012)
val Line = Color(0xFFE0E7F2)
val Card = Color(0xFFFFFFFF)

/** Alias lama — beberapa layar masih nyebut Navy/Pink. */
val Navy = Ink
val Pink = Coral
val MintSoft = Mist

private val Colors = lightColorScheme(
    primary = Teal,
    onPrimary = Color.White,
    secondary = Coral,
    onSecondary = Color.White,
    secondaryContainer = Mist,
    onSecondaryContainer = Teal,
    surfaceTint = Teal,
    outlineVariant = Line,
    tertiary = Gold,
    background = Foam,
    onBackground = Ink,
    surface = Card,
    onSurface = Ink,
    surfaceVariant = Mist,
    onSurfaceVariant = Muted,
    primaryContainer = Mist,
    onPrimaryContainer = TealDeep,
    errorContainer = Color(0xFFFFE9E4),
    onErrorContainer = Coral,
    outline = Line,
    error = Coral,
)

private val Type = Typography(
    headlineLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Black,
        fontSize = 34.sp,
        lineHeight = 40.sp,
        letterSpacing = (-0.6).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 26.sp,
        letterSpacing = (-0.4).sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
    ),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 14.sp),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
        letterSpacing = 0.8.sp,
    ),
)

@Composable
fun CuciinTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, typography = Type, content = content)
}
