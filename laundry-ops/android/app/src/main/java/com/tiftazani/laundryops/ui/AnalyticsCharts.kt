package com.tiftazani.laundryops.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tiftazani.laundryops.data.Clock
import com.tiftazani.laundryops.data.Nota
import com.tiftazani.laundryops.data.rp
import com.tiftazani.laundryops.ui.components.CardBlock
import com.tiftazani.laundryops.ui.components.EmptyHint
import com.tiftazani.laundryops.ui.components.SectionLabel
import com.tiftazani.laundryops.ui.theme.*
import java.time.Instant
import java.time.LocalDate

internal data class AnalyticsPoint(val label: String, val omzet: Int, val collected: Int, val orders: Int)

internal object AnalyticsSeries {
    fun build(rows: List<Nota>, period: String, nowMs: Long = Clock.nowMs()): List<AnalyticsPoint> {
        val now = Instant.ofEpochMilli(nowMs).atZone(Clock.ZONE)
        val labels = when (period) {
            "hari" -> listOf("00", "04", "08", "12", "16", "20")
            "minggu" -> listOf("Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min")
            "bulan" -> listOf("1–7", "8–14", "15–21", "22–28", "29+")
            else -> listOf("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des")
        }
        val buckets = labels.map { mutableListOf<Nota>() }
        rows.filter { it.createdAtMs > 0 }.forEach { nota ->
            val time = Instant.ofEpochMilli(nota.createdAtMs).atZone(Clock.ZONE)
            val index = when (period) {
                "hari" -> if (time.toLocalDate() == now.toLocalDate()) time.hour / 4 else -1
                "minggu" -> time.dayOfWeek.value - 1
                "bulan" -> ((time.dayOfMonth - 1) / 7).coerceAtMost(4)
                else -> time.monthValue - 1
            }
            if (index in buckets.indices) buckets[index].add(nota)
        }
        return labels.mapIndexed { index, label ->
            AnalyticsPoint(label, buckets[index].sumOf { it.total }, buckets[index].sumOf { it.paid }, buckets[index].size)
        }
    }
}

internal data class OperationalCounts(val overdue: Int, val dueToday: Int, val readyForPickup: Int, val unpaid: Int)

internal fun operationalCounts(rows: List<Nota>, nowMs: Long = Clock.nowMs()): OperationalCounts {
    val now = Instant.ofEpochMilli(nowMs).atZone(Clock.ZONE).toLocalDateTime()
    val today: LocalDate = now.toLocalDate()
    val active = rows.filter { it.pickedUpAt == null }
    return OperationalCounts(
        overdue = active.count { it.laundry != com.tiftazani.laundryops.data.LaundryStatus.Selesai && DisplayDates.parse(it.pickupAt)?.isBefore(now) == true },
        dueToday = active.count { it.laundry != com.tiftazani.laundryops.data.LaundryStatus.Selesai && DisplayDates.parse(it.pickupAt)?.toLocalDate() == today },
        readyForPickup = active.count { it.laundry == com.tiftazani.laundryops.data.LaundryStatus.Selesai },
        unpaid = active.count { it.pay != com.tiftazani.laundryops.data.PayStatus.Lunas },
    )
}

@Composable
internal fun RevenueChart(points: List<AnalyticsPoint>) {
    val maxValue = points.maxOfOrNull { maxOf(it.omzet, it.collected) } ?: 0
    CardBlock {
        SectionLabel("Grafik omzet dan kas masuk")
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            ChartLegend(Teal, "Omzet")
            ChartLegend(Green, "Kas masuk")
        }
        if (maxValue == 0) {
            EmptyHint("Belum ada transaksi", "Grafik akan terisi saat nota pada periode ini tersimpan.")
        } else {
            Text("Puncak ${rp(maxValue)}", color = Muted, fontSize = 11.sp)
            Row(Modifier.fillMaxWidth().height(166.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Bottom) {
                points.forEach { point ->
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.fillMaxWidth().height(138.dp), contentAlignment = Alignment.BottomCenter) {
                            Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
                                ChartBar(point.omzet, maxValue, Teal)
                                ChartBar(point.collected, maxValue, Green)
                            }
                        }
                        Text(point.label, color = Muted, fontSize = 9.sp, maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable
private fun ChartBar(value: Int, maxValue: Int, color: androidx.compose.ui.graphics.Color) {
    val height = if (value == 0 || maxValue == 0) 3.dp else (132f * value / maxValue).coerceAtLeast(6f).dp
    Box(Modifier.width(7.dp).height(height).background(if (value == 0) Line else color, RoundedCornerShape(topStart = 5.dp, topEnd = 5.dp)))
}

@Composable
private fun ChartLegend(color: androidx.compose.ui.graphics.Color, label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(9.dp).background(color, RoundedCornerShape(3.dp)))
        Text(label, color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}
