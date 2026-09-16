package com.cuciin.laundryops.ui.theme

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

/**
 * Tema pilihan pengguna: Terang, Gelap, Warna-warni, atau ikut sistem.
 *
 * Setiap tema memakai nama token yang sama supaya seluruh layar tidak perlu diubah.
 * Nilainya dijaga agar teks lolos WCAG AA 4.5:1 dan batas kontrol lolos 3:1.
 *
 * Bentuk visual mengikuti guideline Jemur: struktur navy, aksi utama pink,
 * aksen kuning untuk navigasi aktif, surface putih, serta sudut membulat terukur.
 * Pink terang tidak dipakai untuk teks kecil bila kontrasnya tidak memenuhi WCAG AA.
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
    val navSelected: Color,
    /** Latar abu untuk elemen sekunder. */
    val surface: Color = card,
    /** Latar halaman utama. */
    val canvas: Color = bg,
) {
    val foam: Color get() = bg
    val mist: Color get() = primSoft
    val teal: Color get() = prim
    val tealDeep: Color get() = primDeep
}

private val Terang = CuciinPalette(
    dark = false,
    bg = Color(0xFFF7F7F9),
    card = Color(0xFFFFFFFF),
    line = Color(0xFF757784),
    lineSoft = Color(0xFFECECF1),
    ink = Color(0xFF15151F),
    muted = Color(0xFF5F6373),
    prim = Color(0xFFC1358F),
    primDeep = Color(0xFF0D164B),
    primSoft = Color(0xFFFBEAF5),
    onPrim = Color(0xFFFFFFFF),
    coral = Color(0xFFB3261E),
    green = Color(0xFF1F7A4D),
    amber = Color(0xFF8A5A00),
    gold = Color(0xFFF7CA3A),
    heroA = Color(0xFF0D164B),
    heroB = Color(0xFF19245F),
    onHero = Color(0xFFFFFFFF),
    navSelected = Color(0xFFF7CA3A),
    surface = Color(0xFFFBEAF5),
)

private val Gelap = CuciinPalette(
    dark = true,
    bg = Color(0xFF10132A),
    card = Color(0xFF171B38),
    line = Color(0xFF8A8D9B),
    lineSoft = Color(0xFF303653),
    ink = Color(0xFFF4F3FA),
    muted = Color(0xFFC4C5CE),
    prim = Color(0xFFF08AC8),
    primDeep = Color(0xFFFFB1DD),
    primSoft = Color(0xFF3D2340),
    onPrim = Color(0xFF0D164B),
    coral = Color(0xFFFFB4AB),
    green = Color(0xFF70D6A0),
    amber = Color(0xFFFFD180),
    gold = Color(0xFFF7CA3A),
    heroA = Color(0xFF0D164B),
    heroB = Color(0xFF232F70),
    onHero = Color(0xFFFFFFFF),
    navSelected = Color(0xFFF7CA3A),
    surface = Color(0xFF242947),
)

private val Warni = CuciinPalette(
    dark = false,
    bg = Color(0xFFFFF5F9),
    card = Color(0xFFFFFFFF),
    line = Color(0xFF9E6A86),
    lineSoft = Color(0xFFEFD3E2),
    ink = Color(0xFF241447),
    muted = Color(0xFF5D4F73),
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
    navSelected = Color(0xFFF7CA3A),
    surface = Color(0xFFFCE4EE),
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
val Surface2: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.surface

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

/**
 * Skala huruf mengikuti guideline Jemur: judul memakai tracking negatif supaya
 * terasa rapat dan ramah, bobot 600 sampai 800 pada judul, dan teks badan 14 sampai 16.
 */
internal val CuciinTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 28.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.44).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = (-0.36).sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = (-0.3).sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        letterSpacing = (-0.18).sp,
    ),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 15.sp),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
        letterSpacing = 0.5.sp,
    ),
)

/**
 * Ukuran bentuk dan bayangan. Dipakai bersama oleh komponen supaya seluruh layar
 * memakai bahasa bentuk yang sama: tombol 8, kartu 20, dan bayangan berlapis tiga.
 */
object CuciinShape {
    val button = androidx.compose.foundation.shape.RoundedCornerShape(14.dp)
    val field = androidx.compose.foundation.shape.RoundedCornerShape(14.dp)
    val badge = androidx.compose.foundation.shape.RoundedCornerShape(14.dp)
    val card = androidx.compose.foundation.shape.RoundedCornerShape(20.dp)
    val hero = androidx.compose.foundation.shape.RoundedCornerShape(32.dp)
    val pill = androidx.compose.foundation.shape.RoundedCornerShape(9999.dp)
}

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
