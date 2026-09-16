package com.cuciin.laundryops.ui.components

import android.view.HapticFeedbackConstants
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cuciin.laundryops.R
import com.cuciin.laundryops.data.CloudSync
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.LaundryStatus
import com.cuciin.laundryops.data.PayStatus
import com.cuciin.laundryops.ui.rememberUi
import com.cuciin.laundryops.ui.theme.*
import com.cuciin.laundryops.ui.theme.OnPrim
import com.cuciin.laundryops.ui.theme.OnHero
import com.cuciin.laundryops.ui.theme.LineSoft
import com.cuciin.laundryops.ui.theme.Surface2

@Composable
fun rememberTapFeedback(): () -> Unit {
    val view = LocalView.current
    return remember(view) { { view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY); Unit } }
}

/**
 * Kepala layar: tombol kembali bulat abu, judul tebal dengan tracking negatif,
 * dan baris aksi di kanan.
 */
@Composable
fun ScreenHeader(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null, actions: @Composable RowScope.() -> Unit = {}) {
    val ui = rememberUi()
    val tap = rememberTapFeedback()
    Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        if (onBack != null) {
            Surface(
                onClick = { tap(); onBack() },
                modifier = Modifier.size(44.dp),
                shape = CircleShape,
                color = Surface2,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Kembali", tint = Ink, modifier = Modifier.size(19.dp))
                }
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                title,
                fontSize = ui.titleSp,
                lineHeight = ui.titleSp * 1.1f,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.4).sp,
                color = Ink,
                modifier = Modifier.semantics { heading() },
            )
            if (subtitle != null) Text(subtitle, color = Muted, fontSize = 13.sp, lineHeight = 18.sp)
        }
        Row(verticalAlignment = Alignment.CenterVertically, content = actions)
    }
}

/** Lencana status: radius 14px, teks 12sp. Titik penanda dihapus karena status sudah dibawa teks. */
@Composable
fun Chip(text: String, color: Color) {
    Surface(shape = CuciinShape.badge, color = color.copy(alpha = if (LocalCuciinPalette.current.dark) 0.22f else 0.10f)) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
            color = color,
            fontSize = 12.sp,
            lineHeight = 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
        )
    }
}

@Composable fun PayChip(status: PayStatus) { Chip(status.label, if (status == PayStatus.Lunas) Green else Amber) }
@Composable fun LaundryChip(status: LaundryStatus) { Chip(status.label, if (status == LaundryStatus.Selesai) Green else Teal) }

@Composable
fun ChipRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = content)
}

/**
 * Pilihan tunggal: isian navy saat terpilih, putih dengan garis tipis saat tidak.
 * Tinggi minimum 44dp supaya deretan sejajar rapi dan tetap nyaman disentuh.
 */
@Composable
fun SelectChip(selected: Boolean, label: String, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    val selectedFill = TealDeep
    Surface(
        onClick = { tap(); onClick() },
        shape = CuciinShape.field,
        color = if (selected) selectedFill else Card,
        border = if (selected) null else BorderStroke(1.dp, Line),
        modifier = Modifier.heightIn(min = 44.dp),
    ) {
        Row(
            Modifier.padding(horizontal = 15.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (selected) Icon(Icons.Outlined.Check, null, tint = OnHero, modifier = Modifier.size(15.dp))
            Text(
                label,
                fontSize = 13.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                color = if (selected) OnHero else Ink,
            )
        }
    }
}

/** Deretan periode cepat. Tetap ada untuk layar yang belum memakai bilah ringkas. */
@Composable fun PeriodRow(selected: String, onPick: (String) -> Unit) {
    ChipRow { listOf("hari" to "Hari", "minggu" to "Minggu", "bulan" to "Bulan", "tahun" to "Tahun").forEach { (id, label) -> SelectChip(selected == id, label) { onPick(id) } } }
}

/**
 * Bilah periode ringkas: satu kendali berisi label periode aktif dan pintasan
 * membuka daftar pilihan. Menggantikan deretan kartu periode yang memakan ruang.
 *
 * @param label nama periode yang sedang aktif, misalnya "30 hari terakhir"
 * @param detail rentang tanggal yang benar-benar diambil, misalnya "18 Agu - 16 Sep 2026"
 * @param trailingLabel keterangan tambahan, biasanya jumlah cabang
 */
@Composable
fun PeriodBar(
    label: String,
    detail: String? = null,
    trailingLabel: String? = null,
    onPickPeriod: () -> Unit,
    onPickTrailing: (() -> Unit)? = null,
) {
    val tap = rememberTapFeedback()
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = CuciinShape.field,
        color = Card,
        border = BorderStroke(1.dp, Line),
        shadowElevation = 1.dp,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(
                Modifier.weight(1f).clickable { tap(); onPickPeriod() }.padding(start = 18.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                Text("Periode", fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.4.sp, color = Muted)
                Text(label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (detail != null) Text(detail, fontSize = 11.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (trailingLabel != null) {
                Box(Modifier.width(1.dp).height(34.dp).background(LineSoft))
                Column(
                    Modifier.weight(1f).clickable(enabled = onPickTrailing != null) { tap(); onPickTrailing?.invoke() }.padding(start = 14.dp, end = 10.dp, top = 10.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(1.dp),
                ) {
                    Text("Cabang", fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.4.sp, color = Muted)
                    Text(trailingLabel, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Surface(
                onClick = { tap(); onPickPeriod() },
                modifier = Modifier.padding(end = 6.dp).size(44.dp),
                shape = CircleShape,
                color = Teal,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.Search, "Ubah periode", tint = OnPrim, modifier = Modifier.size(19.dp))
                }
            }
        }
    }
}

/**
 * Kotak angka utama: permukaan navy polos. Warna aksen tidak dipakai untuk bidang luas
 * supaya pink tetap menjadi penanda aksi, bukan latar.
 */
@Composable
fun Hero(title: String, value: String, pills: List<String>) {
    val ui = rememberUi()
    val heroRing = OnHero
    Box(Modifier.fillMaxWidth().clip(CuciinShape.hero).background(LocalCuciinPalette.current.heroA)) {
        Canvas(Modifier.matchParentSize()) {
            val center = Offset(size.width * .94f, size.height * .52f)
            drawCircle(heroRing.copy(alpha = .07f), size.height * .52f, center, style = Stroke(18.dp.toPx()))
            drawCircle(heroRing.copy(alpha = .06f), size.height * .76f, center, style = Stroke(1.dp.toPx()))
        }
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, color = OnHero.copy(alpha = .78f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(value, color = OnHero, fontSize = ui.heroSp, lineHeight = ui.heroSp * 1.12f, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.6).sp)
            if (pills.isNotEmpty()) Text(pills.joinToString("  ·  "), color = OnHero.copy(alpha = .82f), fontSize = 12.sp, lineHeight = 18.sp)
        }
    }
}

/**
 * Kartu isi: radius 20px dengan garis tipis sebagai pemisah utama.
 * Bayangan hanya dipakai saat kartu perlu benar-benar terangkat.
 */
@Composable
fun CardBlock(modifier: Modifier = Modifier, accent: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    val dark = LocalCuciinPalette.current.dark
    Surface(
        modifier.fillMaxWidth().shadow(if (dark) 0.dp else 2.dp, CuciinShape.card),
        shape = CuciinShape.card,
        color = Card,
        border = BorderStroke(1.dp, if (dark) LineSoft else LineSoft),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (accent != null) Box(Modifier.width(28.dp).height(3.dp).clip(CircleShape).background(accent))
            content()
        }
    }
}

@Composable
fun EmptyHint(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(shape = CircleShape, color = Surface2) { Icon(Icons.Outlined.LocalLaundryService, null, tint = Teal, modifier = Modifier.padding(18.dp).size(30.dp)) }
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.2).sp, color = Ink, textAlign = TextAlign.Center)
        Text(body, color = Muted, fontSize = 14.sp, lineHeight = 21.sp, textAlign = TextAlign.Center)
    }
}

/**
 * Pemberitahuan keadaan data: membedakan "belum ada data" dari "data belum tersinkron".
 * Hanya tampil saat server tidak terhubung atau masih ada perubahan tertahan, supaya
 * pengguna tidak menyangka layar kosong berarti tidak ada pesanan.
 */
@Composable
fun SyncNotice(modifier: Modifier = Modifier) {
    val store = CuciinStore
    store.revision.intValue
    if (!CloudSync.started || CloudSync.online) return
    val pending = CloudSync.pendingCount
    val rejected = CloudSync.rejectedCount
    val title = when {
        rejected > 0 -> "$rejected perubahan perlu ditinjau"
        pending > 0 -> "$pending perubahan belum terkirim"
        else -> "Data belum tersinkron"
    }
    val body = when {
        rejected > 0 -> CloudSync.lastRejectedReason?.take(160) ?: "Buka Profil untuk melihat konflik yang ditolak server."
        pending > 0 -> "Perubahan aman di perangkat ini dan akan dikirim saat koneksi pulih. Angka di layar bisa belum sama dengan server."
        else -> CloudSync.lastStatus
    }
    Surface(
        modifier = modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        shape = CuciinShape.badge,
        color = Amber.copy(alpha = if (LocalCuciinPalette.current.dark) .22f else .12f),
    ) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CloudOff, null, tint = Amber, modifier = Modifier.size(18.dp))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(body, fontSize = 12.sp, lineHeight = 17.sp, color = Muted)
            }
        }
    }
}

/**
 * Tombol utama: isian navy dengan teks putih, radius 14px.
 * Pink dipakai untuk aksi paling utama, bukan untuk setiap tombol.
 */
@Composable
fun PrimaryBtn(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    Button(
        onClick = { tap(); onClick() },
        enabled = enabled,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = CuciinShape.button,
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp, pressedElevation = 0.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = OnPrim, disabledContainerColor = LineSoft, disabledContentColor = Muted),
        contentPadding = PaddingValues(16.dp, 12.dp),
    ) {
        if (icon != null) { Icon(icon, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(9.dp)) }
        Text(text, fontSize = 15.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}

/** Tombol pink: hanya untuk aksi paling utama, satu aksen per layar. */
@Composable
fun AccentBtn(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    Button(
        onClick = { tap(); onClick() },
        enabled = enabled,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = CuciinShape.button,
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp, pressedElevation = 0.dp),
        colors = ButtonDefaults.buttonColors(containerColor = TealDeep, contentColor = OnPrim, disabledContainerColor = LineSoft, disabledContentColor = Muted),
        contentPadding = PaddingValues(16.dp, 12.dp),
    ) {
        if (icon != null) { Icon(icon, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(9.dp)) }
        Text(text, fontSize = 15.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}

/** Tombol garis: radius 14px, garis navy tipis, isian putih. */
@Composable
fun GhostBtn(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    OutlinedButton(
        onClick = { tap(); onClick() },
        enabled = enabled,
        modifier = modifier.fillMaxWidth().heightIn(min = 50.dp),
        shape = CuciinShape.button,
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Card, contentColor = Ink),
        border = BorderStroke(1.dp, if (enabled) Ink else LineSoft),
        contentPadding = PaddingValues(12.dp, 12.dp),
    ) {
        if (icon != null) { Icon(icon, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)) }
        Text(text, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}

@Composable
fun DangerBtn(text: String, onClick: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    val tap = rememberTapFeedback()
    TextButton(onClick = { tap(); confirm = true }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
        Icon(Icons.Outlined.DeleteOutline, null, tint = Coral, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(text, color = Coral, fontWeight = FontWeight.SemiBold)
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        icon = { Icon(Icons.Outlined.DeleteOutline, null, tint = Coral) },
        title = { Text("$text?") },
        text = { Text("Periksa kembali data yang dipilih. Data yang dihapus tidak dapat dipulihkan melalui aplikasi.") },
        confirmButton = { TextButton(onClick = { confirm = false; tap(); onClick() }) { Text("Hapus", color = Coral, fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = { confirm = false }) { Text("Batal") } },
        shape = CuciinShape.card,
    )
}

@Composable fun SectionLabel(text: String) {
    Text(
        text,
        modifier = Modifier.padding(top = 8.dp, bottom = 2.dp).semantics { heading() },
        color = Ink,
        fontSize = 16.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-0.2).sp,
    )
}

/** Label konteks singkat di atas judul utama. */
@Composable fun Eyebrow(text: String) {
    Text(
        text,
        color = TealDeep,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
    )
}

@Composable fun ListDivider() { HorizontalDivider(color = LineSoft, thickness = 1.dp) }

/** Penanda kode di daftar: bulat, abu, teks tebal. */
@Composable fun AvatarMark(text: String, tint: Color = Teal) {
    Box(Modifier.size(42.dp).clip(CircleShape).background(tint.copy(alpha = if (LocalCuciinPalette.current.dark) .22f else .10f)), contentAlignment = Alignment.Center) {
        Text(text.take(3).uppercase(), color = tint, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = 0.3.sp)
    }
}

/**
 * Penanda merek: logo Cuciin tanpa plat latar supaya transparan di semua tema.
 * Logo sudah punya garis luar navy sendiri, jadi tidak perlu kotak di belakangnya.
 */
@Composable fun BrandMark(modifier: Modifier = Modifier, size: Dp = 44.dp) {
    Image(
        painter = painterResource(R.drawable.cuciin_logo),
        contentDescription = "Cuciin",
        modifier = modifier.size(size),
    )
}

@Composable
fun InfoRow(icon: ImageVector, label: String, value: String, tint: Color = Teal) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(20.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, fontSize = 11.sp, color = Muted)
            Text(value, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Ink)
        }
    }
}

@Composable
fun StepProgress(step: Int) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        listOf("Pelanggan", "Service", "Periksa", "Bayar").forEachIndexed { i, label ->
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Box(Modifier.size(22.dp).background(if (i <= step) Teal else LineSoft, CircleShape), contentAlignment = Alignment.Center) {
                    if (i < step) Icon(Icons.Outlined.Check, null, tint = OnPrim, modifier = Modifier.size(14.dp))
                    else Text("${i + 1}", color = if (i == step) OnPrim else Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Text(label, fontSize = 10.sp, maxLines = 1, color = if (i <= step) Ink else Muted, fontWeight = if (i == step) FontWeight.Bold else FontWeight.Normal)
            }
        }
    }
}

@Composable
fun FeedbackBanner(text: String) {
    Surface(color = Mist, shape = CuciinShape.badge, modifier = Modifier.fillMaxWidth().animateContentSize().semantics { liveRegion = LiveRegionMode.Polite }) {
        Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CheckCircle, null, tint = TealDeep, modifier = Modifier.size(18.dp))
            Text(text, fontSize = 12.sp, color = TealDeep, lineHeight = 16.sp)
        }
    }
}

/**
 * Baris daftar: satu baris per entitas dengan penanda, judul,
 * keterangan, dan tanda panah. Dipakai untuk daftar panjang seperti cabang
 * supaya puluhan baris tetap terbaca tanpa menggulir jauh.
 */
@Composable
fun ListRow(
    mark: String,
    title: String,
    detail: String? = null,
    trailing: @Composable (() -> Unit)? = null,
    showChevron: Boolean = true,
    onClick: (() -> Unit)? = null,
) {
    val tap = rememberTapFeedback()
    Surface(
        color = Card,
        modifier = Modifier.fillMaxWidth().let { if (onClick != null) it.clickable { tap(); onClick() } else it },
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            AvatarMark(mark)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.1).sp, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (detail != null) Text(detail, fontSize = 13.sp, color = Muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            trailing?.invoke()
            if (showChevron) Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = Line, modifier = Modifier.size(16.dp))
        }
    }
}

/** Pembungkus daftar: garis tipis di sekeliling kumpulan baris, radius 20px. */
@Composable
fun ListCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = CuciinShape.card,
        color = Card,
        border = BorderStroke(1.dp, LineSoft),
    ) {
        Column(content = content)
    }
}

/** Pemisah antar baris di dalam [ListCard]. */
@Composable fun RowDivider() { HorizontalDivider(color = LineSoft, thickness = 1.dp, modifier = Modifier.padding(start = 72.dp)) }

/** Kolom pencarian: radius penuh, garis tipis, ikon di kiri. */
@Composable
fun SearchField(value: String, onValueChange: (String) -> Unit, placeholder: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = CuciinShape.field,
        color = Card,
        border = BorderStroke(1.dp, Line),
        shadowElevation = 1.dp,
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Outlined.Search, null, tint = Muted, modifier = Modifier.size(18.dp))
            BasicField(value, onValueChange, placeholder)
        }
    }
}

@Composable
private fun BasicField(value: String, onValueChange: (String) -> Unit, placeholder: String) {
    androidx.compose.foundation.text.BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, color = Ink),
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search),
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = placeholder },
        decorationBox = { inner ->
            if (value.isEmpty()) Text(placeholder, fontSize = 14.sp, color = Muted)
            inner()
        },
    )
}
