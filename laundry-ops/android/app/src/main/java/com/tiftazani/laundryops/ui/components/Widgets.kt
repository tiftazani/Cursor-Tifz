package com.tiftazani.laundryops.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tiftazani.laundryops.data.LaundryStatus
import com.tiftazani.laundryops.data.PayStatus
import com.tiftazani.laundryops.ui.theme.Amber
import com.tiftazani.laundryops.ui.theme.Foam
import com.tiftazani.laundryops.ui.theme.Green
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Navy
import com.tiftazani.laundryops.ui.theme.Pink

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CuciinTopBar(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null) {
    TopAppBar(
        title = {
            Column {
                if (subtitle != null) Text(subtitle, fontSize = 12.sp, color = Muted)
                Text(title)
            }
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = Foam, titleContentColor = Navy),
    )
}

@Composable
fun Chip(text: String, color: Color) {
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.16f)) {
        Text(text, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), color = color, fontSize = 11.sp)
    }
}

@Composable
fun PayChip(status: PayStatus) {
    Chip(status.label, if (status == PayStatus.Lunas) Green else Amber)
}

@Composable
fun LaundryChip(status: LaundryStatus) {
    val c = when (status) {
        LaundryStatus.Masuk -> Amber
        LaundryStatus.Progress -> Color(0xFF6366F1)
        LaundryStatus.Selesai -> Green
    }
    Chip(status.label, c)
}

@Composable
fun PeriodRow(selected: String, onPick: (String) -> Unit) {
    val items = listOf("hari" to "Harian", "minggu" to "Mingguan", "bulan" to "Bulanan", "tahun" to "Tahunan")
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        items.forEach { (id, label) ->
            FilterChip(selected = selected == id, onClick = { onPick(id) }, label = { Text(label, fontSize = 12.sp) })
        }
    }
}

@Composable
fun Hero(title: String, value: String, pills: List<String>) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Navy, RoundedCornerShape(24.dp))
            .padding(18.dp),
    ) {
        Text(title, color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp)
        Text(value, color = Color.White, fontSize = 26.sp)
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            pills.forEach {
                Surface(shape = RoundedCornerShape(50), color = Color.White.copy(alpha = 0.16f)) {
                    Text(it, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp), color = Color.White, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
fun CardBlock(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), color = Color.White, shadowElevation = 1.dp) {
        Column(Modifier.padding(14.dp), content = { content() })
    }
}
