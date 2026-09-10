package com.tiftazani.laundryops.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextStyle
import androidx.compose.material3.Typography
import androidx.compose.ui.unit.sp

val Pink = Color(0xFFEC4899)
val Navy = Color(0xFF1E1A4A)
val Foam = Color(0xFFFFF4F8)
val MintSoft = Color(0xFFFCE7F3)
val Muted = Color(0xFF8B7A88)
val Green = Color(0xFF059669)
val Amber = Color(0xFFD97706)

private val Colors = lightColorScheme(
    primary = Pink,
    onPrimary = Color.White,
    secondary = Navy,
    onSecondary = Color.White,
    background = Foam,
    onBackground = Navy,
    surface = Color.White,
    onSurface = Navy,
    error = Color(0xFFE11D48),
)

private val Type = Typography(
    headlineLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, color = Navy),
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Navy),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 16.sp, color = Navy),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp, color = Muted),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 14.sp),
)

@Composable
fun CuciinTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, typography = Type, content = content)
}
