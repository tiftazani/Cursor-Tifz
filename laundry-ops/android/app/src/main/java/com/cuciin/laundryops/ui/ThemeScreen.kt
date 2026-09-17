package com.cuciin.laundryops.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Colorize
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.RestartAlt
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.data.rp
import com.cuciin.laundryops.ui.components.CardBlock
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.components.SectionLabel
import com.cuciin.laundryops.ui.components.rememberTapFeedback
import com.cuciin.laundryops.ui.theme.CuciinCustomTheme
import com.cuciin.laundryops.ui.theme.CuciinShape
import com.cuciin.laundryops.ui.theme.CuciinThemeMode
import com.cuciin.laundryops.ui.theme.Card
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Line
import com.cuciin.laundryops.ui.theme.LineSoft
import com.cuciin.laundryops.ui.theme.Muted
import com.cuciin.laundryops.ui.theme.OnPrim
import com.cuciin.laundryops.ui.theme.Teal
import com.cuciin.laundryops.ui.theme.TealDeep
import com.cuciin.laundryops.ui.theme.ThemePrefs

/**
 * Layar pengaturan tema. Tiga pilihan: Light, Dark, dan Custom.
 *
 * Tema Custom dibentuk dari enam warna yang digeser lewat slider RGB. Setiap perubahan
 * langsung dipakai aplikasi, jadi pengguna melihat hasilnya tanpa perlu menyimpan dulu.
 */
@Composable
internal fun ThemeScreen(nav: NavHostController) {
    val ui = rememberUi()
    val context = LocalContext.current
    var mode by remember { mutableStateOf(ThemePrefs.mode) }
    var custom by remember { mutableStateOf(ThemePrefs.custom) }

    fun applyMode(value: CuciinThemeMode) {
        ThemePrefs.set(value)
        mode = ThemePrefs.mode
    }

    fun applyCustom(value: CuciinCustomTheme) {
        ThemePrefs.applyCustom(value)
        custom = ThemePrefs.custom
    }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader("Theme Aplikasi", "Warna tampilan di HP ini", onBack = { nav.popBackStack() }) }
        item {
            CardBlock {
                SectionLabel("Mode tema")
                Text(
                    "Light memakai latar terang dengan aksen pink, Dark memakai latar hitam, dan Custom membebaskan Anda memilih warnanya sendiri.",
                    color = Muted,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                )
                CuciinThemeMode.entries.forEach { option ->
                    ThemeModeRow(
                        label = option.label,
                        detail = themeModeDetail(option),
                        selected = mode == option,
                        onClick = { applyMode(option) },
                    )
                }
            }
        }
        item { ThemePreview() }
        if (mode == CuciinThemeMode.Custom) {
            item {
                CardBlock {
                    SectionLabel("Warna custom")
                    Text(
                        "Geser slider atau isi kode warna. Perubahan langsung terlihat di seluruh aplikasi.",
                        color = Muted,
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                    )
                    ColorField(
                        label = "Warna utama",
                        detail = "Aksen, ikon terpilih, dan garis sorot",
                        value = custom.primary,
                        onChange = { applyCustom(custom.copy(primary = it)) },
                    )
                    ColorField(
                        label = "Warna tombol",
                        detail = "Tombol aksi utama seperti Service baru",
                        value = custom.button,
                        onChange = { applyCustom(custom.copy(button = it)) },
                    )
                    ColorField(
                        label = "Warna latar",
                        detail = "Latar halaman di belakang kartu",
                        value = custom.background,
                        onChange = { applyCustom(custom.copy(background = it)) },
                    )
                    ColorField(
                        label = "Warna kartu",
                        detail = "Permukaan kartu dan kolom isian",
                        value = custom.card,
                        onChange = { applyCustom(custom.copy(card = it)) },
                    )
                    ColorField(
                        label = "Warna teks",
                        detail = "Tulisan utama dan angka",
                        value = custom.ink,
                        onChange = { applyCustom(custom.copy(ink = it)) },
                    )
                    ColorField(
                        label = "Warna header",
                        detail = "Panel judul dan header nota",
                        value = custom.hero,
                        onChange = { applyCustom(custom.copy(hero = it)) },
                    )
                    GhostBtn("Kembalikan warna awal", icon = Icons.Outlined.RestartAlt) {
                        applyCustom(CuciinCustomTheme.Default)
                    }
                }
            }
        }
        item {
            Text(
                "Pilihan tema hanya berlaku di HP ini dan tidak ikut tersinkron ke perangkat lain.",
                color = Muted,
                fontSize = 12.sp,
                lineHeight = 17.sp,
            )
        }
        if (mode == CuciinThemeMode.Custom) item {
            PrimaryBtn("Kembali ke Light", icon = Icons.Outlined.LightMode) { applyMode(CuciinThemeMode.Terang) }
        }
    }
}

private fun themeModeDetail(mode: CuciinThemeMode): String = when (mode) {
    CuciinThemeMode.Terang -> "Latar terang dengan aksen pink dan header navy"
    CuciinThemeMode.Gelap -> "Latar hitam dengan tulisan terang"
    CuciinThemeMode.Custom -> "Atur warna utama, tombol, latar, kartu, teks, dan header"
}

@Composable
private fun ThemeModeRow(label: String, detail: String, selected: Boolean, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    Row(
        Modifier
            .fillMaxWidth()
            .clip(CuciinShape.button)
            .background(if (selected) Teal.copy(alpha = .10f) else Color.Transparent)
            .clickable { tap(); onClick() }
            .padding(horizontal = 12.dp, vertical = 12.dp)
            .semantics { this.selected = selected },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            when (label) {
                "Dark" -> Icons.Outlined.DarkMode
                "Custom" -> Icons.Outlined.Colorize
                else -> Icons.Outlined.LightMode
            },
            null,
            tint = if (selected) Teal else Muted,
            modifier = Modifier.size(20.dp),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, color = Ink, fontSize = 15.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
            Text(detail, color = Muted, fontSize = 12.sp, lineHeight = 16.sp)
        }
        if (selected) Icon(Icons.Outlined.Check, "Dipilih", tint = Teal, modifier = Modifier.size(20.dp))
    }
}

/**
 * Satu warna yang dapat diubah: pratinjau, kode hex, dan tiga slider RGB.
 * Nilai disimpan sebagai komponen 0-255 supaya slider dan kode hex selalu sinkron.
 */
@Composable
private fun ColorField(label: String, detail: String, value: Int, onChange: (Int) -> Unit) {
    val color = Color(value)
    val red = (value shr 16) and 0xFF
    val green = (value shr 8) and 0xFF
    val blue = value and 0xFF
    var hexText by remember(value) { mutableStateOf(hexOf(value)) }

    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(color)
                    .border(BorderStroke(1.dp, Line), RoundedCornerShape(10.dp)),
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(label, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(detail, color = Muted, fontSize = 11.sp, lineHeight = 15.sp)
            }
            Text(hexOf(value), color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        RgbSlider("R", red, color, onChange = { onChange(compose(red = it, green = green, blue = blue)) })
        RgbSlider("G", green, color, onChange = { onChange(compose(red = red, green = it, blue = blue)) })
        RgbSlider("B", blue, color, onChange = { onChange(compose(red = red, green = green, blue = it)) })
        Field(hexText, { typed ->
            hexText = typed
            parseHex(typed)?.let(onChange)
        }, "Kode hex $label")
    }
}

@Composable
private fun RgbSlider(channel: String, value: Int, color: Color, onChange: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(channel, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(16.dp))
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toInt().coerceIn(0, 255)) },
            valueRange = 0f..255f,
            colors = SliderDefaults.colors(
                thumbColor = color,
                activeTrackColor = color,
                inactiveTrackColor = LineSoft,
            ),
            modifier = Modifier.weight(1f),
        )
        Text(value.toString(), color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(34.dp))
    }
}

/** Contoh potongan layar dengan warna yang sedang dipakai, supaya hasilnya terlihat langsung. */
@Composable
private fun ThemePreview() {
    CardBlock {
        SectionLabel("Pratinjau")
        Surface(
            color = com.cuciin.laundryops.ui.theme.Foam,
            shape = CuciinShape.card,
            border = BorderStroke(1.dp, LineSoft),
        ) {
            Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(color = TealDeep, shape = CuciinShape.card) {
                    Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("Header dan judul", color = OnPrim, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text("Periode: hari ini", color = OnPrim, fontSize = 11.sp)
                    }
                }
                Surface(color = Card, shape = CuciinShape.card, border = BorderStroke(1.dp, LineSoft)) {
                    Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Kartu data", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text("Tulisan kecil memakai warna teks yang sama.", color = Muted, fontSize = 11.sp)
                        Text(rp(46000), color = Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Surface(color = Teal, shape = CuciinShape.button) {
                    Text(
                        "Tombol aksi utama",
                        color = OnPrim,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
        }
    }
}

private fun compose(red: Int, green: Int, blue: Int): Int =
    (0xFF shl 24) or ((red and 0xFF) shl 16) or ((green and 0xFF) shl 8) or (blue and 0xFF)

private fun hexOf(value: Int): String = "#%06X".format(value and 0xFFFFFF)

/** Menerima "#RRGGBB" atau "RRGGBB"; nilai lain diabaikan supaya ketikan setengah jalan tidak merusak warna. */
internal fun parseHex(raw: String): Int? {
    val cleaned = raw.trim().removePrefix("#")
    if (cleaned.length != 6) return null
    if (!cleaned.all { it.isDigit() || it.lowercaseChar() in 'a'..'f' }) return null
    return cleaned.toLongOrNull(16)?.toInt()?.let { compose((it shr 16) and 0xFF, (it shr 8) and 0xFF, it and 0xFF) }
}
