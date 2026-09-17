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
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

/**
 * Tema tampilan aplikasi: Light, Dark, atau Custom.
 *
 * Setiap tema memakai nama token yang sama supaya seluruh layar tidak perlu diubah.
 * Nilainya dijaga agar teks lolos WCAG AA 4.5:1 dan batas kontrol lolos 3:1.
 *
 * Bentuk visual mengikuti guideline Jemur: struktur navy, aksi utama pink,
 * aksen kuning untuk navigasi aktif, surface putih, serta sudut membulat terukur.
 * Pink terang tidak dipakai untuk teks kecil bila kontrasnya tidak memenuhi WCAG AA.
 *
 * Tema Custom dibentuk dari enam warna pilihan pengguna. Warna teks di atas tombol dan
 * header tidak ikut dipilih manual: nilainya dihitung dari terang gelapnya warna tersebut
 * supaya tulisan tetap terbaca berapa pun warna yang dipilih.
 */
enum class CuciinThemeMode(val label: String) {
    Terang("Light"),
    Gelap("Dark"),
    Custom("Custom"),
}

/** Enam warna yang boleh diubah pengguna pada tema Custom. Disimpan sebagai ARGB. */
data class CuciinCustomTheme(
    val primary: Int,
    val button: Int,
    val background: Int,
    val card: Int,
    val ink: Int,
    val hero: Int,
) {
    companion object {
        /** Titik awal tema Custom: sama dengan tema Light supaya langsung terpakai. */
        val Default = CuciinCustomTheme(
            primary = 0xFFC1358F.toInt(),
            button = 0xFFC1358F.toInt(),
            background = 0xFFF7F7F9.toInt(),
            card = 0xFFFFFFFF.toInt(),
            ink = 0xFF15151F.toInt(),
            hero = 0xFF0D164B.toInt(),
        )
    }
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
    /** Warna tombol aksi utama; pada Light dan Dark sama dengan aksen. */
    val button: Color = prim,
    /** Warna teks di atas tombol; dihitung, bukan dipilih manual. */
    val onButton: Color = onPrim,
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

/**
 * Tema gelap berlatar hitam. Header sedikit lebih terang dari latar supaya panel judul
 * tetap terbaca, tetapi keseluruhan tampilan tetap hitam.
 */
private val Gelap = CuciinPalette(
    dark = true,
    bg = Color(0xFF000000),
    card = Color(0xFF121212),
    line = Color(0xFF6E6E6E),
    lineSoft = Color(0xFF2A2A2A),
    ink = Color(0xFFF2F2F2),
    muted = Color(0xFFB8B8B8),
    prim = Color(0xFFF08AC8),
    primDeep = Color(0xFFFFB1DD),
    primSoft = Color(0xFF2A1A26),
    onPrim = Color(0xFF000000),
    coral = Color(0xFFFFB4AB),
    green = Color(0xFF70D6A0),
    amber = Color(0xFFFFD180),
    gold = Color(0xFFF7CA3A),
    heroA = Color(0xFF16181D),
    heroB = Color(0xFF23262E),
    onHero = Color(0xFFFFFFFF),
    navSelected = Color(0xFFF7CA3A),
    surface = Color(0xFF1E1E1E),
)

internal val LightPalette = Terang
internal val DarkPalette = Gelap

// ------------------------------------------------------------------ warna kustom

internal fun Color.luminance(): Float = 0.2126f * red + 0.7152f * green + 0.0722f * blue

/** Warna teks yang terbaca di atas [background], dihitung dari terang gelapnya. */
internal fun readableOn(background: Color): Color =
    if (background.luminance() > 0.55f) Color(0xFF11131A) else Color(0xFFFFFFFF)

internal fun blend(from: Color, to: Color, amount: Float): Color = Color(
    red = from.red + (to.red - from.red) * amount,
    green = from.green + (to.green - from.green) * amount,
    blue = from.blue + (to.blue - from.blue) * amount,
)

/**
 * Membentuk palet lengkap dari enam warna pilihan pengguna. Token turunan dihitung,
 * bukan disimpan, supaya tema tetap koheren walau warnanya digeser bebas.
 */
fun CuciinCustomTheme.toPalette(): CuciinPalette {
    val bgColor = Color(background)
    val cardColor = Color(card)
    val inkColor = Color(ink)
    val primColor = Color(primary)
    val buttonColor = Color(button)
    val heroColor = Color(hero)
    val dark = bgColor.luminance() < 0.5f

    return CuciinPalette(
        dark = dark,
        bg = bgColor,
        card = cardColor,
        // Batas kontrol harus lebih tegas daripada garis dekoratif.
        line = blend(inkColor, bgColor, if (dark) 0.55f else 0.45f),
        lineSoft = blend(inkColor, bgColor, 0.86f),
        ink = inkColor,
        muted = blend(inkColor, bgColor, 0.35f),
        prim = primColor,
        primDeep = if (dark) blend(primColor, Color.White, 0.35f) else blend(primColor, Color.Black, 0.35f),
        primSoft = blend(primColor, bgColor, if (dark) 0.72f else 0.88f),
        onPrim = readableOn(primColor),
        coral = if (dark) Color(0xFFFFB4AB) else Color(0xFFB3261E),
        green = if (dark) Color(0xFF70D6A0) else Color(0xFF1F7A4D),
        amber = if (dark) Color(0xFFFFD180) else Color(0xFF8A5A00),
        gold = Color(0xFFF7CA3A),
        heroA = heroColor,
        heroB = blend(heroColor, primColor, 0.18f),
        onHero = readableOn(heroColor),
        navSelected = Color(0xFFF7CA3A),
        surface = blend(cardColor, bgColor, 0.35f),
        button = buttonColor,
        onButton = readableOn(buttonColor),
    )
}

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
val ButtonFill: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.button
val OnButtonFill: Color @androidx.compose.runtime.Composable get() = LocalCuciinPalette.current.onButton

val LocalCuciinPalette = staticCompositionLocalOf { Terang }

/** Alias lama; beberapa layar masih menyebut Navy/Pink. */
val Navy: Color @androidx.compose.runtime.Composable get() = Ink
val Pink: Color @androidx.compose.runtime.Composable get() = Coral
val MintSoft: Color @androidx.compose.runtime.Composable get() = Mist

fun paletteFor(mode: CuciinThemeMode, systemDark: Boolean, custom: CuciinCustomTheme = CuciinCustomTheme.Default): CuciinPalette =
    when (mode) {
        CuciinThemeMode.Terang -> LightPalette
        CuciinThemeMode.Gelap -> DarkPalette
        CuciinThemeMode.Custom -> custom.toPalette()
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
    val custom = ThemePrefs.custom
    val palette = paletteFor(mode, systemDark, custom)
    val view = LocalView.current
    val context = LocalContext.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (context as? android.app.Activity)?.window ?: return@SideEffect
            // Bar sistem dibiarkan TEMBUS PANDANG, bukan diwarnai. Halaman login memakai
            // wallpaper penuh layar; mewarnai bar dengan warna palet membuat pita terang di
            // bawah dan wallpaper terlihat terpotong. Layar biasa sudah punya latar sendiri
            // di belakang bar, jadi transparan tetap aman di sana.
            window.statusBarColor = android.graphics.Color.TRANSPARENT
            window.navigationBarColor = android.graphics.Color.TRANSPARENT
            // Ikon bar harus kontras dengan isi di belakangnya.
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

/** Warna sistem bar untuk pratinjau tema di layar pengaturan. */
internal fun previewArgb(mode: CuciinThemeMode, custom: CuciinCustomTheme): Int =
    paletteFor(mode, systemDark = false, custom = custom).bg.toArgb()
