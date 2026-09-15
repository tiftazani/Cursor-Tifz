package com.tiftazani.laundryops.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

/**
 * Tema pilihan pengguna: Terang, Gelap, Warna-warni, atau ikut sistem.
 *
 * Setiap tema memakai nama token yang sama supaya seluruh layar tidak perlu diubah.
 * Nilainya dijaga agar teks lolos WCAG AA 4.5:1 dan batas kontrol lolos 3:1.
 */
enum class CuciinThemeMode(val label: String) {
    Sistem("Ikut sistem"),
    Terang("Terang"),
    Gelap("Gelap"),
    Warni("Warna-warni"),
}

/**
 * Satu set warna. Anggota kelasnya adalah turunan nilai dasar, jadi token seperti
 * [TealDeep] selalu ikut berubah saat tema berganti.
 */
data class CuciinPalette(
    val dark: Boolean,
    val bg: Color,
    val card: Color,
    val line: Color,
    val lineSoft: Color,
    val ink: Color,
    val muted: Color,
    val prim: Color,
    val primDeep: Color,
    val primSoft: Color,
    val onPrim: Color,
    val coral: Color,
    val green: Color,
    val amber: Color,
    val gold: Color,
    val heroA: Color,
    val heroB: Color,
    val onHero: Color,
) {
    val foam: Color get() = bg
    val mist: Color get() = primSoft
    val teal: Color get() = prim
    val tealDeep: Color get() = primDeep
}

private val Terang = CuciinPalette(
    dark = false,
    bg = Color(0xFFF4F7FC),
    card = Color(0xFFFFFFFF),
    // Batas kontrol dinaikkan dari 0xE0E7F2 supaya chip dan kolom isian punya batas 3:1.
    line = Color(0xFF8090AE),
    lineSoft = Color(0xFFE0E7F2),
    ink = Color(0xFF172B4D),
    // Dinaikkan dari 0x60718D: teks redup di atas Mist tadinya hanya 4.30:1.
    muted = Color(0xFF5C6C88),
    prim = Color(0xFF2859DB),
    primDeep = Color(0xFF16327B),
    primSoft = Color(0xFFE9EFFF),
    onPrim = Color(0xFFFFFFFF),
    coral = Color(0xFFB83E32),
    green = Color(0xFF16734E),
    amber = Color(0xFF8F5A10),
    gold = Color(0xFF956414),
    heroA = Color(0xFF16327B),
    heroB = Color(0xFF2859DB),
    onHero = Color(0xFFFFFFFF),
)

private val Gelap = CuciinPalette(
    dark = true,
    bg = Color(0xFF0B1020),
    card = Color(0xFF161E33),
    line = Color(0xFF5C6A9C),
    lineSoft = Color(0xFF2E3A5C),
    ink = Color(0xFFE8EDF9),
    muted = Color(0xFF93A2C0),
    prim = Color(0xFF7C9BFF),
    primDeep = Color(0xFF16265C),
    primSoft = Color(0xFF1E2942),
    // Biru terang tidak bisa dipasangkan teks putih; pola Material 3 dark memakai teks gelap.
    onPrim = Color(0xFF0B1020),
    coral = Color(0xFFFF8F7D),
    green = Color(0xFF48C99B),
    amber = Color(0xFFEFB04F),
    gold = Color(0xFFEFB04F),
    heroA = Color(0xFF16265C),
    heroB = Color(0xFF2F4BA8),
    onHero = Color(0xFFFFFFFF),
)

private val Warni = CuciinPalette(
    dark = false,
    bg = Color(0xFFFFF5F9),
    card = Color(0xFFFFFFFF),
    line = Color(0xFFB87A9B),
    lineSoft = Color(0xFFEFD3E2),
    ink = Color(0xFF241447),
    muted = Color(0xFF6A5A80),
    prim = Color(0xFFC2185B),
    primDeep = Color(0xFF3B1E6E),
    primSoft = Color(0xFFFCE4EE),
    onPrim = Color(0xFFFFFFFF),
    coral = Color(0xFFB3261E),
    green = Color(0xFF0E7350),
    amber = Color(0xFF9A5B00),
    gold = Color(0xFF7A4A00),
    heroA = Color(0xFF3B1E6E),
    heroB = Color(0xFFC2185B),
    onHero = Color(0xFFFFFFFF),
)

internal val LightPalette = Terang
internal val DarkPalette = Gelap
internal val WarniPalette = Warni

/**
 * Token warna untuk composable. Setiap nilai membaca palet tema yang sedang aktif,
 * jadi layar lama tetap memakai nama yang sama tanpa perlu diubah.
 */
val Ink: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.ink
val Muted: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.muted
val Teal: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.prim
val TealDeep: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.primDeep
val Mist: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.primSoft
val Foam: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.bg
val Card: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.card
val Line: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.line
val LineSoft: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.lineSoft
val Coral: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.coral
val Green: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.green
val Amber: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.amber
val Gold: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.gold
val OnPrim: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.onPrim
val OnHero: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.onHero

val LocalCuciinPalette = staticCompositionLocalOf { Terang }

/** Alias lama; beberapa layar masih menyebut Navy/Pink. */
val Navy: Color @androidx.compose.runtime.Composable get() = Ink
val Pink: Color @androidx.compose.runtime.Composable get() = Coral
val MintSoft: Color @androidx.compose.runtime.Composable get() = Mist

fun paletteFor(mode: CuciinThemeMode, systemDark: Boolean): CuciinPalette = when (mode) {
    CuciinThemeMode.Sistem -> if (systemDark) DarkPalette else LightPalette
    CuciinThemeMode.Terang -> LightPalette
    CuciinThemeMode.Gelap -> DarkPalette
    CuciinThemeMode.Warni -> WarniPalette
}

internal fun materialScheme(p: CuciinPalette) = if (p.dark) darkColorScheme(
    primary = p.prim,
    onPrimary = p.onPrim,
    secondary = p.coral,
    onSecondary = p.onPrim,
    secondaryContainer = p.primSoft,
    onSecondaryContainer = p.prim,
    surfaceTint = p.prim,
    tertiary = p.gold,
    background = p.bg,
    onBackground = p.ink,
    surface = p.card,
    onSurface = p.ink,
    surfaceVariant = p.primSoft,
    onSurfaceVariant = p.muted,
    primaryContainer = p.primSoft,
    onPrimaryContainer = p.prim,
    errorContainer = Color(0xFF3A1F22),
    onErrorContainer = p.coral,
    outline = p.line,
    outlineVariant = p.lineSoft,
    error = p.coral,
) else lightColorScheme(
    primary = p.prim,
    onPrimary = p.onPrim,
    secondary = p.coral,
    onSecondary = Color.White,
    secondaryContainer = p.primSoft,
    onSecondaryContainer = p.prim,
    surfaceTint = p.prim,
    tertiary = p.gold,
    background = p.bg,
    onBackground = p.ink,
    surface = p.card,
    onSurface = p.ink,
    surfaceVariant = p.primSoft,
    onSurfaceVariant = p.muted,
    primaryContainer = p.primSoft,
    onPrimaryContainer = p.primDeep,
    errorContainer = Color(0xFFFFE9E4),
    onErrorContainer = p.coral,
    outline = p.line,
    outlineVariant = p.lineSoft,
    error = p.coral,
)

internal val CuciinTypography = Typography(
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
    val systemDark = isSystemInDarkTheme()
    val mode = ThemePrefs.mode
    val palette = paletteFor(mode, systemDark)
    val view = LocalView.current
    val context = LocalContext.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (context as? android.app.Activity)?.window ?: return@SideEffect
            val (status, navigation) = ThemePrefs.systemBarColors(mode, systemDark)
            window.statusBarColor = status
            window.navigationBarColor = navigation
            // Ikon status bar harus kontras dengan latar yang baru dipasang.
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !palette.dark
                isAppearanceLightNavigationBars = !palette.dark
            }
        }
    }

    CompositionLocalProvider(LocalCuciinPalette provides palette) {
        MaterialTheme(colorScheme = materialScheme(palette), typography = CuciinTypography, content = content)
    }
}
