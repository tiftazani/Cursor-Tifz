package com.cuciin.laundryops.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.PictureAsPdf
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.TableView
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.ChartPalette
import com.cuciin.laundryops.data.Clock
import com.cuciin.laundryops.data.FileExports
import com.cuciin.laundryops.data.LaundryStatus
import com.cuciin.laundryops.data.Nota
import com.cuciin.laundryops.data.PayMethod
import com.cuciin.laundryops.data.PayStatus
import com.cuciin.laundryops.data.rp
import com.cuciin.laundryops.data.staffDisplayName
import com.cuciin.laundryops.ui.components.FilterBar
import com.cuciin.laundryops.ui.components.FilterBarRow
import com.cuciin.laundryops.ui.components.FilterSheetRow
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.components.ListDivider
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.theme.Amber
import com.cuciin.laundryops.ui.theme.Card
import com.cuciin.laundryops.ui.theme.Coral
import com.cuciin.laundryops.ui.theme.CuciinShape
import com.cuciin.laundryops.ui.theme.Gold
import com.cuciin.laundryops.ui.theme.Green
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Line
import com.cuciin.laundryops.ui.theme.LineSoft
import com.cuciin.laundryops.ui.theme.Mist
import com.cuciin.laundryops.ui.theme.Muted
import com.cuciin.laundryops.ui.theme.Teal
import com.cuciin.laundryops.ui.theme.TealDeep
import java.time.Instant
import java.time.LocalDateTime
import java.time.Month
import java.time.format.TextStyle
import kotlin.math.max
import kotlin.math.roundToInt

private val store get() = CuciinStore

/**
 * Laporan analitik memakai seluruh riwayat yang terlihat akun, bukan hanya satu periode singkat.
 * Angka pada setiap diagram berasal dari daftar yang sama dengan kartu ringkasan di bawahnya,
 * jadi tidak ada dua versi kebenaran di satu layar.
 */
private val analyticsPeriods = listOf(
    "bulan" to "Bulan ini",
    "tahun" to "Tahun ini",
    "semua" to "Seluruh data",
)

internal data class AnalyticsSlice(val label: String, val value: Int, val count: Int)

internal object AnalyticsTrend {
    /** Tren bulanan sepanjang riwayat yang diberikan, diurutkan dari bulan terlama. */
    fun monthly(rows: List<Nota>): List<AnalyticsSlice> {
        val grouped = rows.filter { it.createdAtMs > 0 }.groupBy { nota ->
            val at = Instant.ofEpochMilli(nota.createdAtMs).atZone(Clock.ZONE)
            at.year * 100 + at.monthValue
        }
        return grouped.toSortedMap().entries.map { (key, monthRows) ->
            val label = Month.of(key % 100).getDisplayName(TextStyle.SHORT, DisplayDates.locale) + " " + (key / 100 % 100)
            AnalyticsSlice(label, monthRows.sumOf { it.total }, monthRows.size)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AnalyticsReportScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    var period by rememberSaveable { mutableStateOf("semua") }
    var customRange by rememberSaveable { mutableStateOf(false) }
    var fromValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(0).withMinute(0))) }
    var untilValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(23).withMinute(59))) }
    var selectedBranches by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var selectedKasir by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var showPeriodSheet by rememberSaveable { mutableStateOf(false) }
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    var showKasirSheet by rememberSaveable { mutableStateOf(false) }
    var showDataTypeSheet by rememberSaveable { mutableStateOf(false) }
    var payFilter by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var workFilter by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var methodFilter by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var pickupFilter by rememberSaveable { mutableStateOf(emptySet<String>()) }

    val from = DisplayDates.parse(fromValue) ?: LocalDateTime.now(Clock.ZONE).withHour(0).withMinute(0)
    val until = DisplayDates.parse(untilValue) ?: LocalDateTime.now(Clock.ZONE).withHour(23).withMinute(59)
    val scope = store.visibleNotas()
    val rangeStartMs = if (customRange) Long.MIN_VALUE else if (period == "semua") Long.MIN_VALUE else Clock.periodStartMs(period)

    fun inRange(atMs: Long): Boolean =
        if (customRange) DisplayDates.isInSelectedMinute(atMs, from, until) else atMs >= rangeStartMs

    // Jenis data mengikuti field yang benar-benar ada di Service: status bayar, status
    // pengerjaan, metode pembayaran, dan status pengambilan. Kosong berarti semua jenis.
    fun jenisMatch(nota: Nota): Boolean {
        val payOk = payFilter.isEmpty() ||
            (nota.pay == PayStatus.Lunas && "lunas" in payFilter) ||
            (nota.pay == PayStatus.Belum && "belum" in payFilter)
        val workOk = workFilter.isEmpty() || nota.laundry.name.lowercase() in workFilter
        val methodOk = methodFilter.isEmpty() || nota.payMethod.name.lowercase() in methodFilter
        val pickupOk = pickupFilter.isEmpty() ||
            (nota.pickedUpAt != null && "diambil" in pickupFilter) ||
            (nota.pickedUpAt == null && "belum" in pickupFilter)
        return payOk && workOk && methodOk && pickupOk
    }

    val rangeRows = scope.filter { nota ->
        inRange(nota.createdAtMs) &&
            (selectedBranches.isEmpty() || nota.branchId in selectedBranches) &&
            (selectedKasir.isEmpty() || nota.kasirEmail.ifBlank { nota.kasir } in selectedKasir) &&
            jenisMatch(nota)
    }
    val expenseRows = store.expenses.filter { expense ->
        inRange(expense.occurredAtMs) && (selectedBranches.isEmpty() || expense.branchId in selectedBranches)
    }
    val kasirOptions = scope.map { nota ->
        val email = nota.kasirEmail.ifBlank { nota.kasir }
        email to staffDisplayName(store.staff, email, nota.kasir)
    }.distinctBy { it.first }.sortedBy { it.second }

    val omzet = rangeRows.sumOf { it.total }
    val masuk = rangeRows.sumOf { it.paid }
    val piutang = rangeRows.sumOf { max(0, it.total - it.paid) }
    val biaya = expenseRows.sumOf { it.amount }
    val rataRata = if (rangeRows.isEmpty()) 0 else omzet / rangeRows.size
    val selesai = rangeRows.count { it.pickedUpAt != null }
    val belumLunas = rangeRows.count { it.pay != PayStatus.Lunas }

    val periodLabel = if (customRange) "Rentang sendiri" else analyticsPeriods.first { it.first == period }.second
    val rangeLabel = if (customRange) "${DisplayDates.date(from)} sampai ${DisplayDates.date(until)}" else if (period == "semua") "Seluruh riwayat tercatat" else periodRangeLabel(period)
    val branchLabel = if (selectedBranches.isEmpty()) "Semua cabang" else "${selectedBranches.size} cabang dipilih"
    val kasirLabel = if (selectedKasir.isEmpty()) "Semua kasir" else "${selectedKasir.size} kasir dipilih"
    val jenisCount = payFilter.size + workFilter.size + methodFilter.size + pickupFilter.size
    val jenisLabel = if (jenisCount == 0) "Semua jenis data" else "$jenisCount jenis data dipilih"

    val trend = AnalyticsTrend.monthly(
        scope.filter { nota ->
            (selectedBranches.isEmpty() || nota.branchId in selectedBranches) &&
                (selectedKasir.isEmpty() || nota.kasirEmail.ifBlank { nota.kasir } in selectedKasir) &&
                jenisMatch(nota)
        },
    )
    val perCabang = rangeRows.groupBy { it.branchId }.map { (branchId, rows) ->
        AnalyticsSlice(store.branches.firstOrNull { it.id == branchId }?.name ?: "Cabang $branchId", rows.sumOf { it.total }, rows.size)
    }.sortedByDescending { it.value }
    val perMetode = PayMethod.entries.map { method ->
        AnalyticsSlice(method.label, rangeRows.filter { it.payMethod == method }.sumOf { it.paid }, 0)
    }.filter { it.value > 0 }
    val perKasir = rangeRows.groupBy { it.kasirEmail.ifBlank { it.kasir } }.map { (email, rows) ->
        AnalyticsSlice(staffDisplayName(store.staff, email, rows.first().kasir), rows.sumOf { it.total }, rows.size)
    }.sortedByDescending { it.value }
    val filterSummary = listOf(
        periodLabel,
        if (selectedBranches.isEmpty()) "Semua cabang" else selectedBranches.joinToString { store.branches.firstOrNull { b -> b.id == it }?.name ?: it },
        if (selectedKasir.isEmpty()) "Semua kasir" else selectedKasir.joinToString { email -> kasirOptions.firstOrNull { it.first == email }?.second ?: email },
        if (jenisCount == 0) "Semua jenis data" else "Jenis data: ${(payFilter + workFilter + methodFilter + pickupFilter).sorted().joinToString()}",
    ).joinToString(" · ")

    Column(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ScreenHeader("Laporan analitik", "Seluruh data operasional", onBack = { nav.popBackStack() }) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GhostBtn("PDF", Modifier.width(78.dp), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.PictureAsPdf) {
                    FileExports.shareAnalyticsPdf(ctx, rangeRows, expenseRows, rangeLabel, trend.map { Triple(it.label, it.value, it.count) }, filterSummary)
                }
                GhostBtn("Excel", Modifier.width(84.dp), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.TableView) {
                    FileExports.shareAnalyticsCsv(ctx, rangeRows, expenseRows, rangeLabel, trend.map { Triple(it.label, it.value, it.count) }, filterSummary)
                }
            }
        }
        Text(rangeLabel, fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
        Text("${rangeRows.size} Service · $branchLabel · $kasirLabel · $jenisLabel", color = Muted, fontSize = 12.sp)
        FilterBarRow(
            left = {
                FilterBar(label = "Periode", value = periodLabel, detail = rangeLabel, icon = Icons.Outlined.CalendarMonth, onClick = { showPeriodSheet = true }, modifier = Modifier.fillMaxWidth())
            },
            right = {
                FilterBar(label = "Cabang", value = branchLabel, detail = "${store.branches.size} cabang tersedia", icon = Icons.Outlined.Storefront, onClick = { showBranchSheet = true }, modifier = Modifier.fillMaxWidth())
            },
        )
        FilterBarRow(
            left = {
                FilterBar(label = "Kasir", value = kasirLabel, detail = "${kasirOptions.size} kasir tercatat", icon = Icons.Outlined.Badge, onClick = { showKasirSheet = true }, modifier = Modifier.fillMaxWidth())
            },
            right = {
                FilterBar(label = "Jenis data", value = jenisLabel, detail = "Bayar, kerja, metode, ambil", icon = Icons.Outlined.Tune, onClick = { showDataTypeSheet = true }, modifier = Modifier.fillMaxWidth())
            },
        )
        if (customRange) {
            Surface(color = Card, shape = CuciinShape.card, border = androidx.compose.foundation.BorderStroke(1.dp, Line)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    DateTimeFields(from, { fromValue = DisplayDates.encode(it) }, "Mulai")
                    DateTimeFields(until, { untilValue = DisplayDates.encode(it) }, "Sampai")
                    if (until.isBefore(from)) Text("Waktu akhir harus setelah waktu mulai.", color = Coral, fontSize = 12.sp)
                }
            }
        }
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(16.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
            item {
                AnalyticsKpiRow(listOf("Omzet" to rp(omzet), "Kas diterima" to rp(masuk), "Piutang" to rp(piutang)))
            }
            item {
                AnalyticsKpiRow(listOf("Service" to rangeRows.size.toString(), "Rata-rata" to rp(rataRata), "Selesai" to "$selesai/${rangeRows.size}"))
            }
            item {
                AnalyticsCard("Tren omzet bulanan", "Batang gelap berarti omzet bulan itu di atas rata-rata seluruh bulan.") {
                    MonthlyBarChart(trend)
                }
            }
            item {
                AnalyticsCard("Omzet per cabang", "Donat memakai komposisi omzet pada filter yang aktif.") {
                    if (perCabang.isEmpty()) AnalyticsEmpty("Belum ada omzet pada filter ini.")
                    else DonutChart(perCabang)
                }
            }
            item {
                AnalyticsCard("Penerimaan per metode", "Dihitung dari uang yang benar-benar diterima, bukan tagihan.") {
                    if (perMetode.isEmpty()) AnalyticsEmpty("Belum ada penerimaan pada filter ini.")
                    else DonutChart(perMetode)
                }
            }
            item {
                AnalyticsCard("Peringkat kasir", "Diurutkan dari omzet terbesar pada filter ini.") {
                    if (perKasir.isEmpty()) AnalyticsEmpty("Belum ada kasir pada filter ini.")
                    else perKasir.forEachIndexed { index, slice ->
                        RankRow(index + 1, slice)
                        if (index < perKasir.lastIndex) ListDivider()
                    }
                }
            }
            item {
                AnalyticsCard("Rekonsiliasi kas", "Selisih kas diterima dan biaya tercatat menjadi hasil kas.") {
                    LedgerRow("Omzet Service", rp(omzet))
                    LedgerRow("Kas diterima", rp(masuk))
                    LedgerRow("Piutang berjalan", rp(piutang))
                    LedgerRow("Biaya tercatat", rp(biaya))
                    HorizontalDivider(color = LineSoft)
                    LedgerRow("Hasil kas", rp(masuk - biaya), strong = true)
                    LedgerRow("Service belum lunas", "$belumLunas dari ${rangeRows.size}")
                }
            }
        }
    }

    if (showPeriodSheet) ModalBottomSheet(onDismissRequest = { showPeriodSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih periode", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            analyticsPeriods.forEach { (id, label) ->
                FilterSheetRow(!customRange && period == id, label, if (id == "semua") "Seluruh riwayat yang terlihat akun ini" else periodRangeLabel(id)) {
                    period = id
                    customRange = false
                    showPeriodSheet = false
                }
            }
            FilterSheetRow(customRange, "Pilih tanggal dan jam", "Tentukan mulai dan sampai") {
                customRange = true
                showPeriodSheet = false
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Bisa pilih lebih dari satu. Kosong berarti semua cabang.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            FilterSheetRow(selectedBranches.isEmpty(), "Semua cabang", "${store.branches.size} cabang") { selectedBranches = emptySet() }
            ListDivider()
            store.branches.forEach { branch ->
                FilterSheetRow(branch.id in selectedBranches, branch.name, null) {
                    selectedBranches = if (branch.id in selectedBranches) selectedBranches - branch.id else selectedBranches + branch.id
                }
            }
            PrimaryBtn("Selesai", Modifier.padding(horizontal = 18.dp, vertical = 8.dp)) { showBranchSheet = false }
        }
    }
    if (showKasirSheet) ModalBottomSheet(onDismissRequest = { showKasirSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih kasir", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Bisa pilih lebih dari satu. Kosong berarti semua kasir.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            FilterSheetRow(selectedKasir.isEmpty(), "Semua kasir", "${kasirOptions.size} kasir") { selectedKasir = emptySet() }
            ListDivider()
            kasirOptions.forEach { (key, name) ->
                FilterSheetRow(key in selectedKasir, name, null) {
                    selectedKasir = if (key in selectedKasir) selectedKasir - key else selectedKasir + key
                }
            }
            PrimaryBtn("Selesai", Modifier.padding(horizontal = 18.dp, vertical = 8.dp)) { showKasirSheet = false }
        }
    }
    if (showDataTypeSheet) ModalBottomSheet(onDismissRequest = { showDataTypeSheet = false }) {
        // Daftar jenis data yang bisa disaring, dikelompokkan per field Service.
        val groups = listOf(
            "Status pembayaran" to listOf(
                Triple("pay", "lunas", "Lunas"),
                Triple("pay", "belum", "Belum lunas"),
            ),
            "Status pengerjaan" to listOf(
                Triple("work", "masuk", "Menunggu dikerjakan"),
                Triple("work", "progress", "Sedang dikerjakan"),
                Triple("work", "selesai", "Selesai"),
            ),
            "Metode pembayaran" to PayMethod.entries.map { Triple("method", it.name.lowercase(), it.label) },
            "Status pengambilan" to listOf(
                Triple("pickup", "diambil", "Sudah diambil"),
                Triple("pickup", "belum", "Belum diambil"),
            ),
        )
        fun selected(group: String, key: String): Boolean = when (group) {
            "pay" -> key in payFilter
            "work" -> key in workFilter
            "method" -> key in methodFilter
            else -> key in pickupFilter
        }
        fun toggle(group: String, key: String) {
            fun next(current: Set<String>) = if (key in current) current - key else current + key
            when (group) {
                "pay" -> payFilter = next(payFilter)
                "work" -> workFilter = next(workFilter)
                "method" -> methodFilter = next(methodFilter)
                else -> pickupFilter = next(pickupFilter)
            }
        }
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
            Text("Jenis data", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Pilih satu atau lebih. Kosong berarti semua jenis data.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 18.dp, end = 18.dp, bottom = 6.dp))
            FilterSheetRow(jenisCount == 0, "Semua jenis data", "Tanpa penyaringan") {
                payFilter = emptySet(); workFilter = emptySet(); methodFilter = emptySet(); pickupFilter = emptySet()
            }
            ListDivider()
            Column(Modifier.fillMaxWidth().heightIn(max = 380.dp).verticalScroll(rememberScrollState())) {
                groups.forEach { (title, options) ->
                    Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Muted, modifier = Modifier.padding(start = 18.dp, top = 12.dp, bottom = 4.dp))
                    options.forEach { (group, key, label) ->
                        FilterSheetRow(selected(group, key), label, null) { toggle(group, key) }
                    }
                }
            }
            PrimaryBtn("Terapkan", Modifier.padding(horizontal = 18.dp, vertical = 8.dp)) { showDataTypeSheet = false }
        }
    }
}

@Composable
private fun AnalyticsKpiRow(items: List<Pair<String, String>>) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { (label, value) ->
            Surface(modifier = Modifier.weight(1f), color = Card, shape = CuciinShape.card, border = androidx.compose.foundation.BorderStroke(1.dp, Line)) {
                Column(Modifier.padding(11.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(label, color = Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(value, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun AnalyticsCard(title: String, hint: String, content: @Composable () -> Unit) {
    Surface(color = Card, shape = CuciinShape.card, border = androidx.compose.foundation.BorderStroke(1.dp, Line), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Ink)
            Text(hint, color = Muted, fontSize = 11.sp, lineHeight = 15.sp)
            content()
        }
    }
}

@Composable
private fun AnalyticsEmpty(text: String) {
    Text(text, color = Muted, fontSize = 12.sp)
}

@Composable
private fun LedgerRow(label: String, value: String, strong: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = if (strong) Ink else Muted, fontSize = if (strong) 14.sp else 13.sp, fontWeight = if (strong) FontWeight.Bold else FontWeight.Normal)
        Text(value, color = Ink, fontSize = if (strong) 15.sp else 13.sp, fontWeight = if (strong) FontWeight.Bold else FontWeight.Medium)
    }
}

@Composable
private fun RankRow(rank: Int, slice: AnalyticsSlice) {
    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(rank.toString(), color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(18.dp))
        Column(Modifier.weight(1f)) {
            Text(slice.label, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${slice.count} Service", color = Muted, fontSize = 11.sp)
        }
        Text(rp(slice.value), color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun MonthlyBarChart(rows: List<AnalyticsSlice>) {
    if (rows.isEmpty()) {
        AnalyticsEmpty("Belum ada transaksi untuk digambar.")
        return
    }
    val maxValue = rows.maxOf { it.value }.coerceAtLeast(1)
    val average = rows.sumOf { it.value } / rows.size
    val barHigh = ChartPalette.barHigh.let { (r, g, b) -> Color(r, g, b) }
    val barLow = ChartPalette.barLow.let { (r, g, b) -> Color(r, g, b) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Puncak ${rp(maxValue)} · rata-rata ${rp(average)}", color = Muted, fontSize = 11.sp)
        if (rows.size == 1) {
            val slice = rows.first()
            // Satu periode bukan deret waktu. Batang horizontal membuat nilai dan periodenya
            // terbaca tanpa menyisakan panel kosong seperti grafik kolom satu batang.
            Column(
                Modifier.fillMaxWidth().background(Mist, RoundedCornerShape(10.dp)).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(slice.label, color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(rp(slice.value), color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Box(Modifier.fillMaxWidth().height(10.dp).background(Line, RoundedCornerShape(5.dp))) {
                    Box(Modifier.fillMaxWidth().height(10.dp).background(barHigh, RoundedCornerShape(5.dp)))
                }
            }
        } else {
            Row(
                Modifier.fillMaxWidth().height(108.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.Bottom,
            ) {
                rows.forEach { slice ->
                    Column(
                        Modifier.weight(1f, fill = false).widthIn(max = 56.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Bottom,
                    ) {
                        Text(rp(slice.value).removePrefix("Rp "), color = Muted, fontSize = 9.sp, maxLines = 1)
                        Spacer(Modifier.height(4.dp))
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height((72f * slice.value / maxValue).coerceAtLeast(6f).dp)
                                .background(if (slice.value >= average) barHigh else barLow, RoundedCornerShape(topStart = 5.dp, topEnd = 5.dp)),
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(slice.label, color = Muted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        if (rows.size > 1) Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 2.dp)) {
            LegendDot(barHigh, "Di atas rata-rata")
            LegendDot(barLow, "Di bawah rata-rata")
        }
    }
}

@Composable
private fun DonutChart(slices: List<AnalyticsSlice>) {
    val total = slices.sumOf { it.value }.coerceAtLeast(1)
    val colors = ChartPalette.categorical.map { (r, g, b) -> Color(r, g, b) }
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(148.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val stroke = size.minDimension * 0.24f
                val diameter = size.minDimension - stroke
                val radius = diameter / 2f
                val center = Offset(size.width / 2f, size.height / 2f)
                var startAngle = -90f
                slices.forEachIndexed { index, slice ->
                    val sweep = 360f * slice.value / total
                    drawArc(
                        color = colors[index % colors.size],
                        startAngle = startAngle,
                        sweepAngle = (sweep - 1.6f).coerceAtLeast(0.6f),
                        useCenter = false,
                        topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f),
                        size = Size(diameter, diameter),
                        style = Stroke(width = stroke),
                    )
                    startAngle += sweep
                }
                // Label persen diletakkan pada titik tengah tiap bagian, tepat di tengah
                // ketebalan cincin, supaya setiap bagian dapat dibaca tanpa melihat legenda.
                var labelAngle = -90f
                slices.forEach { slice ->
                    val sweep = 360f * slice.value / total
                    val share = slice.value * 100f / total
                    if (share >= 6f) {
                        val mid = Math.toRadians((labelAngle + sweep / 2f).toDouble())
                        val x = center.x + (radius * Math.cos(mid)).toFloat()
                        val y = center.y + (radius * Math.sin(mid)).toFloat()
                        val text = "${share.roundToInt()}%"
                        val paint = android.graphics.Paint().apply {
                            color = android.graphics.Color.WHITE
                            textSize = size.minDimension * 0.085f
                            isAntiAlias = true
                            isFakeBoldText = true
                            textAlign = android.graphics.Paint.Align.CENTER
                        }
                        drawContext.canvas.nativeCanvas.drawText(text, x, y + paint.textSize / 3f, paint)
                    }
                    labelAngle += sweep
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(rp(total).removePrefix("Rp "), color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Black)
                Text("total", color = Muted, fontSize = 10.sp)
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            slices.take(6).forEachIndexed { index, slice ->
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(9.dp).background(colors[index % colors.size], RoundedCornerShape(3.dp)))
                    Column(Modifier.weight(1f)) {
                        Text(slice.label, color = Ink, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${rp(slice.value)} · ${(slice.value * 100f / total).roundToInt()}%", color = Muted, fontSize = 10.sp)
                    }
                }
            }
            if (slices.size > 6) Text("+${slices.size - 6} lainnya", color = Muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(9.dp).background(color, RoundedCornerShape(3.dp)))
        Text(label, color = Muted, fontSize = 11.sp)
    }
}
