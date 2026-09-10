package com.tiftazani.laundryops.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tiftazani.laundryops.data.LaundryStatus
import com.tiftazani.laundryops.data.PayStatus
import com.tiftazani.laundryops.ui.rememberUi
import com.tiftazani.laundryops.ui.theme.Amber
import com.tiftazani.laundryops.ui.theme.Card
import com.tiftazani.laundryops.ui.theme.Coral
import com.tiftazani.laundryops.ui.theme.Foam
import com.tiftazani.laundryops.ui.theme.Gold
import com.tiftazani.laundryops.ui.theme.Green
import com.tiftazani.laundryops.ui.theme.Ink
import com.tiftazani.laundryops.ui.theme.Line
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Teal
import com.tiftazani.laundryops.ui.theme.TealDeep

@Composable
fun ScreenHeader(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null, actions: @Composable RowScope.() -> Unit = {}) {
    val ui = rememberUi()
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali", tint = Ink)
            }
        }
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = ui.titleSp, fontWeight = FontWeight.Black, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) {
                Text(subtitle, color = Muted, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, content = actions)
    }
}

@Composable
fun Chip(text: String, color: Color) {
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.14f)) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
    }
}

@Composable
fun PayChip(status: PayStatus) {
    Chip(status.label, if (status == PayStatus.Lunas) Green else Amber)
}

@Composable
fun LaundryChip(status: LaundryStatus) {
    val c = when (status) {
        LaundryStatus.Masuk -> Gold
        LaundryStatus.Progress -> Teal
        LaundryStatus.Selesai -> Green
    }
    Chip(status.label, c)
}

@Composable
fun ChipRow(content: @Composable RowScope.() -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

@Composable
fun SelectChip(selected: Boolean, label: String, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label, fontSize = 13.sp, maxLines = 1) },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = Teal,
            selectedLabelColor = Color.White,
            containerColor = Card,
            labelColor = Ink,
        ),
        border = FilterChipDefaults.filterChipBorder(enabled = true, selected = selected, borderColor = Line, selectedBorderColor = Teal),
    )
}

@Composable
fun PeriodRow(selected: String, onPick: (String) -> Unit) {
    ChipRow {
        listOf("hari" to "Hari", "minggu" to "Minggu", "bulan" to "Bulan", "tahun" to "Tahun").forEach { (id, label) ->
            SelectChip(selected == id, label) { onPick(id) }
        }
    }
}

@Composable
fun Hero(title: String, value: String, pills: List<String>) {
    val ui = rememberUi()
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ui.radius))
            .background(Brush.linearGradient(listOf(TealDeep, Teal))),
    ) {
        Canvas(Modifier.matchParentSize()) {
            drawCircle(Color.White.copy(alpha = 0.08f), radius = size.minDimension * 0.55f, center = Offset(size.width * 0.92f, size.height * 0.1f))
            drawCircle(Color.White.copy(alpha = 0.06f), radius = size.minDimension * 0.4f, center = Offset(size.width * 0.05f, size.height * 1.05f))
        }
        Column(Modifier.padding(horizontal = 18.dp, vertical = 18.dp)) {
            Text(title.uppercase(), color = Color.White.copy(alpha = 0.72f), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.1.sp)
            Text(value, color = Color.White, fontSize = ui.heroSp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (pills.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                ChipRow {
                    pills.forEach {
                        Surface(shape = RoundedCornerShape(50), color = Color.White.copy(alpha = 0.14f)) {
                            Text(it, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = Color.White, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CardBlock(modifier: Modifier = Modifier, accent: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    val ui = rememberUi()
    Surface(
        modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ui.radius - 4.dp),
        color = Card,
        shadowElevation = 0.dp,
        tonalElevation = 0.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, Line.copy(alpha = 0.9f)),
    ) {
        Row {
            if (accent != null) {
                Box(Modifier.width(5.dp).background(accent))
            }
            Column(Modifier.padding(16.dp).weight(1f, fill = true), content = content)
        }
    }
}

@Composable
fun EmptyHint(title: String, body: String) {
    CardBlock {
        Text(title, fontWeight = FontWeight.Bold, color = Ink)
        Text(body, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun PrimaryBtn(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val ui = rememberUi()
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(ui.radius - 8.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = Color.White),
        contentPadding = PaddingValues(horizontal = 16.dp),
    ) { Text(text, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis) }
}

@Composable
fun GhostBtn(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val ui = rememberUi()
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(ui.radius - 8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Line),
    ) { Text(text, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis) }
}

@Composable
fun DangerBtn(text: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Text(text, color = Coral, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        modifier = Modifier.padding(top = 4.dp, bottom = 2.dp),
        color = Teal,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.sp,
    )
}

@Composable
fun ListDivider() {
    HorizontalDivider(color = Line.copy(alpha = 0.6f), thickness = 1.dp)
}

@Composable
fun AvatarMark(text: String, tint: Color = Teal) {
    Box(
        Modifier.size(42.dp).clip(CircleShape).background(tint.copy(alpha = 0.16f)),
        contentAlignment = Alignment.Center,
    ) {
        Text(text.take(1).uppercase(), color = tint, fontWeight = FontWeight.Black)
    }
}
