package com.cuciin.laundryops.ui.components

import android.view.HapticFeedbackConstants
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cuciin.laundryops.R
import com.cuciin.laundryops.data.LaundryStatus
import com.cuciin.laundryops.data.PayStatus
import com.cuciin.laundryops.ui.rememberUi
import com.cuciin.laundryops.ui.theme.*
import com.cuciin.laundryops.ui.theme.OnPrim
import com.cuciin.laundryops.ui.theme.OnHero
import com.cuciin.laundryops.ui.theme.LineSoft

@Composable
fun rememberTapFeedback(): () -> Unit {
    val view = LocalView.current
    return remember(view) { { view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY); Unit } }
}

@Composable
fun ScreenHeader(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null, actions: @Composable RowScope.() -> Unit = {}) {
    val ui = rememberUi()
    val tap = rememberTapFeedback()
    Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (onBack != null) {
            FilledTonalIconButton(onClick = { tap(); onBack() }, modifier = Modifier.size(48.dp), shape = RoundedCornerShape(16.dp), colors = IconButtonDefaults.filledTonalIconButtonColors(containerColor = Card)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Kembali", tint = Ink)
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, fontSize = ui.titleSp, lineHeight = ui.titleSp * 1.15f, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.semantics { heading() })
            if (subtitle != null) Text(subtitle, color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
        }
        Row(verticalAlignment = Alignment.CenterVertically, content = actions)
    }
}

@Composable
fun Chip(text: String, color: Color) {
    Surface(shape = RoundedCornerShape(8.dp), color = color.copy(alpha = 0.09f)) {
        Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            Box(Modifier.size(5.dp).background(color, CircleShape))
            Text(text, color = color, fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable fun PayChip(status: PayStatus) { Chip(status.label, if (status == PayStatus.Lunas) Green else Amber) }
@Composable fun LaundryChip(status: LaundryStatus) { Chip(status.label, if (status == LaundryStatus.Selesai) Green else Teal) }

@Composable
fun ChipRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = content)
}

@Composable
fun SelectChip(selected: Boolean, label: String, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    FilterChip(modifier = Modifier.heightIn(min = 48.dp), selected = selected, onClick = { tap(); onClick() },
        shape = RoundedCornerShape(12.dp), label = { Text(label, fontSize = 13.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium) },
        leadingIcon = if (selected) ({ Icon(Icons.Outlined.Check, null, modifier = Modifier.size(16.dp)) }) else null,
        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Teal, selectedLabelColor = OnPrim, selectedLeadingIconColor = OnPrim, containerColor = Card, labelColor = Muted),
        border = FilterChipDefaults.filterChipBorder(enabled = true, selected = selected, borderColor = Line, selectedBorderColor = Teal))
}

@Composable fun PeriodRow(selected: String, onPick: (String) -> Unit) { ChipRow { listOf("hari" to "Hari", "minggu" to "Minggu", "bulan" to "Bulan", "tahun" to "Tahun").forEach { (id, label) -> SelectChip(selected == id, label) { onPick(id) } } } }

@Composable
fun Hero(title: String, value: String, pills: List<String>) {
    val ui = rememberUi()
    // Warna diambil di luar lambda Canvas: DrawScope bukan composable, jadi token tema tidak bisa dibaca di dalamnya.
    val heroRing = OnHero
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Brush.linearGradient(listOf(LocalCuciinPalette.current.heroA, LocalCuciinPalette.current.heroB)))) {
        Canvas(Modifier.matchParentSize()) {
            val center = Offset(size.width * .94f, size.height * .52f)
            drawCircle(heroRing.copy(alpha = .09f), size.height * .52f, center, style = Stroke(18.dp.toPx()))
            drawCircle(heroRing.copy(alpha = .08f), size.height * .76f, center, style = Stroke(1.dp.toPx()))
        }
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, color = OnHero.copy(alpha = .85f), fontSize = 13.sp, fontWeight = FontWeight.Medium)
            Text(value, color = OnHero, fontSize = ui.heroSp, lineHeight = ui.heroSp * 1.15f, fontWeight = FontWeight.Bold)
            if (pills.isNotEmpty()) Text(pills.joinToString("  ·  "), color = OnHero.copy(alpha = .9f), fontSize = 12.sp, lineHeight = 18.sp)
        }
    }
}

@Composable
fun CardBlock(modifier: Modifier = Modifier, accent: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), color = Card, border = BorderStroke(1.dp, LineSoft)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (accent != null) Box(Modifier.width(28.dp).height(3.dp).clip(CircleShape).background(accent))
            content()
        }
    }
}

@Composable
fun EmptyHint(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(shape = CircleShape, color = Mist) { Icon(Icons.Outlined.LocalLaundryService, null, tint = Teal, modifier = Modifier.padding(18.dp).size(30.dp)) }
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink, textAlign = TextAlign.Center)
        Text(body, color = Muted, fontSize = 14.sp, lineHeight = 21.sp, textAlign = TextAlign.Center)
    }
}

@Composable
fun PrimaryBtn(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    Button(onClick = { tap(); onClick() }, enabled = enabled, modifier = modifier.fillMaxWidth().heightIn(min = 54.dp),
        shape = RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomEnd = 18.dp, bottomStart = 6.dp),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 3.dp, pressedElevation = 1.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = OnPrim), contentPadding = PaddingValues(16.dp, 12.dp)) {
        if (icon != null) {
            Surface(shape = RoundedCornerShape(10.dp), color = OnPrim.copy(alpha = .16f)) { Icon(icon, null, modifier = Modifier.padding(6.dp).size(18.dp)) }
            Spacer(Modifier.width(9.dp))
        }
        Text(text, color = if (enabled) OnPrim else Muted, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}

@Composable
fun GhostBtn(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    OutlinedButton(onClick = { tap(); onClick() }, enabled = enabled, modifier = modifier.fillMaxWidth().heightIn(min = 50.dp), shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Card, contentColor = Teal), border = BorderStroke(1.dp, Line), contentPadding = PaddingValues(12.dp, 12.dp)) {
        if (icon != null) { Icon(icon, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)) }
        Text(text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
    }
}

@Composable
fun DangerBtn(text: String, onClick: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    val tap = rememberTapFeedback()
    TextButton(onClick = { tap(); confirm = true }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
        Icon(Icons.Outlined.DeleteOutline, null, tint = Coral, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(text, color = Coral, fontWeight = FontWeight.SemiBold)
    }
    if (confirm) AlertDialog(onDismissRequest = { confirm = false }, icon = { Icon(Icons.Outlined.DeleteOutline, null, tint = Coral) }, title = { Text("$text?") }, text = { Text("Periksa kembali data yang dipilih. Data yang dihapus tidak dapat dipulihkan melalui aplikasi.") },
        confirmButton = { TextButton(onClick = { confirm = false; tap(); onClick() }) { Text("Hapus", color = Coral) } }, dismissButton = { TextButton(onClick = { confirm = false }) { Text("Batal") } })
}

@Composable fun SectionLabel(text: String) { Text(text, modifier = Modifier.padding(top = 6.dp, bottom = 2.dp).semantics { heading() }, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold) }
@Composable fun ListDivider() { HorizontalDivider(color = Line, thickness = 1.dp) }
@Composable fun AvatarMark(text: String, tint: Color = Teal) { Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(tint.copy(alpha = .09f)), contentAlignment = Alignment.Center) { Text(text.take(2).uppercase(), color = tint, fontWeight = FontWeight.Bold, fontSize = 14.sp) } }
@Composable fun BrandMark(modifier: Modifier = Modifier) { Surface(modifier.size(52.dp), shape = RoundedCornerShape(17.dp), color = Teal) { Icon(painterResource(R.drawable.cuciin_mark), null, tint = Color.Unspecified, modifier = Modifier.padding(3.dp)) } }

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
                Box(Modifier.size(22.dp).background(if (i <= step) Teal else Line, CircleShape), contentAlignment = Alignment.Center) {
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
    Surface(color = Mist, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth().animateContentSize().semantics { liveRegion = LiveRegionMode.Polite }) {
        Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CheckCircle, null, tint = Teal, modifier = Modifier.size(18.dp))
            Text(text, fontSize = 12.sp, color = Teal, lineHeight = 16.sp)
        }
    }
}
