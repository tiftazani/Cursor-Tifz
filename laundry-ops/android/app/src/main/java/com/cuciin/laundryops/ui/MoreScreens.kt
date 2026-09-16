package com.cuciin.laundryops.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.vector.ImageVector
import com.cuciin.laundryops.ui.components.*
import com.cuciin.laundryops.ui.theme.Card
import com.cuciin.laundryops.ui.theme.CuciinShape
import com.cuciin.laundryops.ui.theme.Line
import com.cuciin.laundryops.ui.theme.Mist
import com.cuciin.laundryops.data.FirebaseCloud
import com.cuciin.laundryops.data.FileExports

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.BuildConfig
import com.cuciin.laundryops.data.CloudSync
import com.cuciin.laundryops.data.Clock
import java.time.format.DateTimeFormatter
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.PayMethod
import com.cuciin.laundryops.data.PayStatus
import com.cuciin.laundryops.data.Nota
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.data.VersionHistory
import com.cuciin.laundryops.data.rp
import com.cuciin.laundryops.ui.components.CardBlock
import com.cuciin.laundryops.ui.components.Chip
import com.cuciin.laundryops.ui.components.ChipRow
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.components.Hero
import com.cuciin.laundryops.ui.components.PeriodRow
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.components.SelectChip
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Muted
import com.cuciin.laundryops.ui.theme.Teal
import com.cuciin.laundryops.ui.theme.Green
import com.cuciin.laundryops.ui.theme.Amber
import com.cuciin.laundryops.ui.theme.CuciinThemeMode
import com.cuciin.laundryops.ui.theme.OnPrim
import com.cuciin.laundryops.ui.theme.ThemePrefs
import com.cuciin.laundryops.ui.theme.LineSoft
import java.time.LocalDateTime

private val store get() = CuciinStore

@Composable
internal fun MoreScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val role = store.session.value?.role ?: Role.Kasir
    val items = buildList {
        add("Absensi karyawan" to "attendance")
        if (role == Role.Owner) {
            add("Laporan transaksi" to "analytics")
            add("Cabang" to "branches")
            add("Daftar User" to "users")
            add("Layanan & harga" to "services")
            add("Produk stok" to "products")
            add("Pengaturan Owner" to "ownerSettings")
            add("Riwayat aktivitas" to "audit")
        }
        if (role == Role.Owner) add("Aset & mesin cabang" to "inventory")
        add("Biaya operasional" to "expenses")
        if (role != Role.Supervisor) add("Pelanggan" to "customers")
        if (role != Role.Supervisor) {
            add("WA menunggu" to "wa")
            add("Arsip WA" to "waArchive")
            add("Tutup kas" to "cash")
        }
        add("Riwayat versi" to "versions")
        add("Profil" to "profil")
    }.filter { (_, route) ->
        when (route) {
            "attendance" -> store.canAccess("attendance")
            "analytics", "branches", "users", "services", "products", "audit", "ownerSettings" -> store.canAccess("owner")
            "inventory" -> store.canAccess("inventory")
            "expenses" -> store.canAccess("expense")
            "customers" -> store.canAccess("customer")
            "wa", "waArchive" -> store.canAccess("whatsapp")
            "cash" -> store.canAccess("cash")
            else -> true
        }
    }
    val tap = rememberTapFeedback()
    val columns = if (ui.widthDp < 360 || LocalDensity.current.fontScale > 1.3f) 1 else if (ui.twoPane) 3 else 2
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Kelola laundry", "${store.session.value?.name} · ${if (role == Role.Supervisor) "SPV" else role.name}") }
        item {
            Surface(onClick = { nav.navigate("profil") }, color = Teal, shape = RoundedCornerShape(20.dp)) {
                Row(Modifier.fillMaxWidth().padding(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.AccountCircle, null, tint = OnPrim, modifier = Modifier.size(32.dp))
                    Column(Modifier.weight(1f)) { Text("Akun & profil", color = OnPrim, fontWeight = FontWeight.Bold); Text("Informasi akun dan kata sandi", color = OnPrim.copy(alpha = .85f), fontSize = 12.sp) }
                    Icon(Icons.Outlined.ChevronRight, null, tint = OnPrim)
                }
            }
        }
        items(items.filter { it.second != "profil" }.chunked(columns)) { group ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.height(IntrinsicSize.Min)) {
                group.forEach { (label, route) ->
                    Surface(onClick = { tap(); nav.navigate(route) }, modifier = Modifier.weight(1f).fillMaxHeight(), color = Card, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, LineSoft)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Icon(when (route) {
                                "analytics" -> Icons.Outlined.BarChart
                                "branches" -> Icons.Outlined.Storefront
                                "users" -> Icons.Outlined.Badge
                                "services" -> Icons.Outlined.LocalLaundryService
                                "products" -> Icons.Outlined.Inventory2
                                "inventory" -> Icons.Outlined.PrecisionManufacturing
                                "expenses" -> Icons.Outlined.ReceiptLong
                                "attendance" -> Icons.Outlined.Fingerprint
                                "customers" -> Icons.Outlined.PeopleOutline
                                "cash" -> Icons.Outlined.AccountBalanceWallet
                                "audit" -> Icons.Outlined.History
                                "versions" -> Icons.Outlined.Info
                                else -> Icons.Outlined.Forum
                            }, null, tint = Teal, modifier = Modifier.size(28.dp))
                            Text(label, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text(when (route) {
                                "analytics" -> "Periode, rincian, dan keuangan"
                                "branches" -> "Lokasi dan tim cabang"
                                "users" -> "Peran dan persetujuan"
                                "services" -> "Layanan dan tarif"
                                "products" -> "Katalog persediaan"
                                "inventory" -> "Mesin, alat, dan barang"
                                "expenses" -> "Pengeluaran per cabang"
                                "attendance" -> "Jam masuk dan pulang per cabang"
                                "customers" -> "Kontak pelanggan"
                                "cash" -> "Rekap akhir giliran"
                                "audit" -> "Aktivitas operasional"
                                "versions" -> "Pembaruan Cuciin"
                                else -> "Pengiriman nota"
                            }, fontSize = 12.sp, color = Muted, lineHeight = 17.sp)
                        }
                    }
                }
                repeat(columns - group.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        if (role == Role.Owner) item { GhostBtn("Ekspor semua data (JSON)", icon = Icons.Outlined.FileDownload) { FileExports.shareAllData(ctx, store.exportSnapshot()) } }
        item { GhostBtn("Keluar dari akun", icon = Icons.Outlined.Logout) { store.logout(); nav.navigate("login") { popUpTo(0) } } }
    }
}

/**
 * Rentang tanggal yang benar-benar diambil untuk tiap periode cepat. Dipakai header
 * laporan supaya pembaca tahu angkanya berasal dari rentang mana, bukan hanya namanya.
 */
internal fun periodRangeLabel(period: String, now: LocalDateTime = LocalDateTime.now(Clock.ZONE)): String {
    val end = now.toLocalDate()
    val start = when (period) {
        "hari" -> end
        "minggu" -> end.minusDays(6)
        "bulan" -> end.withDayOfMonth(1)
        "tahun" -> end.withDayOfYear(1)
        else -> end.minusDays(29)
    }
    val fmt = DateTimeFormatter.ofPattern("d MMM yyyy", DisplayDates.locale)
    return if (start == end) start.format(fmt) else "${start.format(fmt)} sampai ${end.format(fmt)}"
}

/**
 * Lembar pilihan periode: daftar pilihan cepat, rentang sendiri, lalu pilihan cabang.
 * Menggantikan deretan chip yang memakan ruang dan sulit dibaca saat pilihannya banyak.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PeriodSheet(
    currentPeriod: String,
    customRange: Boolean,
    branches: List<com.cuciin.laundryops.data.Branch>,
    selectedBranches: Set<String>,
    onDismiss: () -> Unit,
    onPickPeriod: (String) -> Unit,
    onPickCustom: () -> Unit,
    onToggleBranch: (String) -> Unit,
    onClearBranches: () -> Unit,
) {
    val quick = listOf("hari" to "Hari ini", "minggu" to "7 hari terakhir", "bulan" to "Bulan ini", "tahun" to "Tahun ini")
    ModalBottomSheet(onDismissRequest = onDismiss, shape = CuciinShape.hero) {
        Column(Modifier.fillMaxWidth().padding(bottom = 28.dp)) {
            Text("Pilih periode", modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 10.dp), fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.3).sp, color = Ink)
            Eyebrow("Cepat").also { }
            Column(Modifier.padding(horizontal = 8.dp)) {
                quick.forEach { (id, label) ->
                    val chosen = !customRange && currentPeriod == id
                    Surface(onClick = { onPickPeriod(id) }, color = Color.Transparent, modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column(Modifier.weight(1f)) {
                                Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                Text(periodRangeLabel(id), fontSize = 12.sp, color = Muted)
                            }
                            if (chosen) Icon(Icons.Outlined.Check, null, tint = Teal, modifier = Modifier.size(20.dp))
                        }
                    }
                }
                Surface(onClick = onPickCustom, color = Color.Transparent, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text("Pilih tanggal dan jam", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                            Text("Tentukan mulai dan sampai", fontSize = 12.sp, color = Muted)
                        }
                        if (customRange) Icon(Icons.Outlined.Check, null, tint = Teal, modifier = Modifier.size(20.dp))
                    }
                }
            }
            HorizontalDivider(color = LineSoft, modifier = Modifier.padding(vertical = 8.dp))
            Text("Cabang", modifier = Modifier.padding(start = 20.dp, bottom = 6.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = Muted)
            Column(Modifier.padding(horizontal = 8.dp)) {
                Surface(onClick = onClearBranches, color = Color.Transparent, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Semua cabang", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink, modifier = Modifier.weight(1f))
                        if (selectedBranches.isEmpty()) Icon(Icons.Outlined.Check, null, tint = Teal, modifier = Modifier.size(20.dp))
                    }
                }
                branches.forEach { b ->
                    val chosen = b.id in selectedBranches
                    Surface(onClick = { onToggleBranch(b.id) }, color = Color.Transparent, modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column(Modifier.weight(1f)) {
                                Text(b.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                Text(b.location, fontSize = 12.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            if (chosen) Icon(Icons.Outlined.Check, null, tint = Teal, modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun AnalyticsScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val period = store.reportPeriod.value
    var customRange by rememberSaveable { mutableStateOf(false) }
    var fromValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(0).withMinute(0))) }
    var untilValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(23).withMinute(59))) }
    var handlerFilter by rememberSaveable { mutableStateOf("all") }
    var showPeriodSheet by rememberSaveable { mutableStateOf(false) }
    val from = DisplayDates.parse(fromValue) ?: LocalDateTime.now(Clock.ZONE).withHour(0).withMinute(0)
    val until = DisplayDates.parse(untilValue) ?: LocalDateTime.now(Clock.ZONE).withHour(23).withMinute(59)
    val selectedBranches = store.reportBranchIds.value
    val baseRows = if (customRange) store.notas.filter { DisplayDates.isInSelectedMinute(it.createdAtMs, from, until) && (selectedBranches.isEmpty() || it.branchId in selectedBranches) } else store.periodNotas()
    val handlers = baseRows.flatMap { nota -> nota.lines.map { it.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir } to it.handledByName.ifBlank { nota.kasir } } }.distinctBy { it.first }
    val rows = baseRows.filter { nota -> handlerFilter == "all" || nota.lines.any { it.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir } == handlerFilter } }
    val expenseRows = if (customRange) store.expenses.filter { DisplayDates.isInSelectedMinute(it.occurredAtMs, from, until) && (selectedBranches.isEmpty() || it.branchId in selectedBranches) } else store.periodExpenses()
    val omzet = store.omzet(rows)
    val masuk = store.collected(rows)
    val biaya = expenseRows.sumOf { it.amount }
    val labaKas = masuk - biaya
    val points = AnalyticsSeries.build(rows, period)
    val operations = operationalCounts(rows)
    fun branchName(id: String): String = store.branches.firstOrNull { it.id == id }?.name ?: "Cabang $id"
    // Label yang dipakai header dan bilah periode, supaya angkanya jelas asalnya.
    val rangeLabel = if (customRange) "${DisplayDates.date(from)} sampai ${DisplayDates.date(until)}" else periodRangeLabel(period)
    val periodLabel = if (customRange) "Rentang sendiri" else period.replaceFirstChar { it.uppercase() }
    val summaryLine = buildString {
        append("${rows.size} Service")
        append(" · ")
        append(if (selectedBranches.isEmpty()) "${store.branches.size} cabang" else "${selectedBranches.size} cabang dipilih")
        if (handlerFilter != "all") {
            val nama = handlers.firstOrNull { it.first == handlerFilter }?.second ?: handlerFilter
            append(" · petugas $nama")
        }
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item {
            ScreenHeader("Laporan transaksi", null, onBack = { nav.popBackStack() }) {
                GhostBtn("PDF", Modifier.width(96.dp), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.PictureAsPdf) { FileExports.shareFinancialPdf(ctx, rows, expenseRows, rangeLabel) }
            }
        }
        item {
            // Header menyebut data yang benar-benar diambil, bukan hanya judul.
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Eyebrow("Ringkasan keuangan")
                Text(rangeLabel, fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.4).sp, color = Ink)
                Text(summaryLine, color = Muted, fontSize = 13.sp, lineHeight = 18.sp)
            }
        }
        item {
            PeriodBar(
                label = if (customRange) "Rentang sendiri" else periodLabel,
                detail = rangeLabel,
                trailingLabel = if (selectedBranches.isEmpty()) "Semua cabang" else "${selectedBranches.size} dipilih",
                onPickPeriod = { showPeriodSheet = true },
                onPickTrailing = { showPeriodSheet = true },
            )
        }
        if (showPeriodSheet) item {
            PeriodSheet(
                currentPeriod = period,
                customRange = customRange,
                branches = store.branches,
                selectedBranches = store.reportBranchIds.value,
                onDismiss = { showPeriodSheet = false },
                onPickPeriod = { id -> customRange = false; store.reportPeriod.value = id; store.touchStatus(); showPeriodSheet = false },
                onPickCustom = { customRange = true; showPeriodSheet = false },
                onToggleBranch = { id ->
                    val current = store.reportBranchIds.value
                    store.reportBranchIds.value = if (id in current) current - id else current + id
                    store.touchStatus()
                },
                onClearBranches = { store.reportBranchIds.value = emptySet(); store.touchStatus() },
            )
        }
        if (customRange) item {
            CardBlock {
                SectionLabel("Interval transaksi")
                DateTimeFields(from, { fromValue = DisplayDates.encode(it) }, "Mulai")
                DateTimeFields(until, { untilValue = DisplayDates.encode(it) }, "Sampai")
                if (until.isBefore(from)) Text("Waktu akhir harus setelah waktu mulai.", color = com.cuciin.laundryops.ui.theme.Coral, fontSize = 12.sp)
            }
        }
        if (handlers.isNotEmpty()) item {
            // Petugas tetap memakai chip karena jumlahnya sedikit dan sering diganti.
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionLabel("Petugas layanan")
                ChipRow {
                    SelectChip(handlerFilter == "all", "Semua") { handlerFilter = "all" }
                    handlers.forEach { (key, name) -> SelectChip(handlerFilter == key, name) { handlerFilter = key } }
                }
            }
        }
        item { Hero("Omzet Service", rp(omzet), listOf("masuk kas ${rp(masuk)}", "biaya ${rp(biaya)}", "hasil kas ${rp(labaKas)}")) }
        item { RevenueChart(points) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AnalyticsKpi("Rata-rata transaksi", if (rows.isEmpty()) "Rp 0" else rp(omzet / rows.size), Modifier.weight(1f))
                AnalyticsKpi("Kas tertagih", if (omzet == 0) "0%" else "${(masuk.toLong() * 100 / omzet).coerceIn(0, 100)}%", Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AnalyticsKpi("Biaya operasional", rp(biaya), Modifier.weight(1f))
                AnalyticsKpi("Hasil kas", rp(labaKas), Modifier.weight(1f))
            }
        }
        item {
            CardBlock {
                SectionLabel("Kondisi operasional")
                Text("${operations.overdue} terlambat · ${operations.dueToday} jatuh tempo hari ini", color = if (operations.overdue > 0) com.cuciin.laundryops.ui.theme.Coral else Muted)
                Text("${operations.readyForPickup} siap diambil · ${operations.unpaid} belum lunas", color = Muted)
            }
        }
        item {
            CardBlock {
                SectionLabel("Penerimaan per metode")
                PayMethod.entries.forEach { method ->
                    val amount = rows.filter { it.payMethod == method }.sumOf { it.paid }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(method.label, color = Muted)
                        Text(rp(amount), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        item { SectionLabel("Ringkasan per cabang") }
        item {
            // Daftar baris, bukan tumpukan kartu, supaya puluhan cabang tetap terbaca.
            ListCard {
                val groups = rows.groupBy { it.branchId }.toList()
                groups.forEachIndexed { index, (branchId, branchRows) ->
                    val branchCost = expenseRows.filter { it.branchId == branchId }.sumOf { it.amount }
                    val branchName = store.branches.firstOrNull { it.id == branchId }?.name ?: "Cabang $branchId"
                    ListRow(
                        mark = branchName.removePrefix("Cuciin ").take(3),
                        title = branchName,
                        detail = "${branchRows.size} Service · omzet ${rp(branchRows.sumOf { it.total })} · masuk ${rp(branchRows.sumOf { it.paid })}",
                        trailing = {
                            Column(horizontalAlignment = Alignment.End) {
                                Text(rp(branchRows.sumOf { it.paid } - branchCost), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Ink)
                                Text("hasil kas", color = Muted, fontSize = 11.sp)
                            }
                        },
                        showChevron = false,
                    )
                    if (index < groups.lastIndex) RowDivider()
                }
            }
        }
        item { SectionLabel("Ringkasan per kasir") }
        item {
            ListCard {
                val kasirGroups = rows.groupBy { it.kasir }.toList()
                kasirGroups.forEachIndexed { index, (kasir, kasirRows) ->
                    ListRow(
                        mark = kasir,
                        title = kasir,
                        detail = "${kasirRows.size} Service · ${kasirRows.map { branchName(it.branchId) }.distinct().joinToString()}",
                        trailing = { Text(rp(store.omzet(kasirRows)), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Ink) },
                        showChevron = false,
                    )
                    if (index < kasirGroups.lastIndex) RowDivider()
                }
            }
        }
        item { SectionLabel("Komisi & layanan per petugas") }
        val handledRows = rows.flatMap { nota ->
            nota.lines.map { line -> Triple(nota, line, (line.qty * line.commissionPerUnit).toInt()) }
        }
        if (handledRows.isEmpty()) item { EmptyHint("Rincian petugas belum tersedia", "Service lama tetap masuk laporan transaksi, tetapi belum memiliki petugas per layanan.") }
        else item {
            val handlerGroups = handledRows.groupBy { (nota, line, _) -> "${nota.branchId}|${line.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir }}" }.toList()
            ListCard {
                handlerGroups.forEachIndexed { index, (_, group) ->
                    val first = group.first()
                    val nota = first.first
                    val handler = first.second.handledByName.ifBlank { nota.kasir }
                    val services = group.groupBy { it.second.name }.map { (service, serviceRows) ->
                        val qty = serviceRows.sumOf { it.second.qty }
                        val unit = serviceRows.first().second.unit
                        val omzet = serviceRows.sumOf { (it.second.qty * it.second.unitPrice).toInt() }
                        "$service ${if (qty % 1.0 == 0.0) qty.toInt() else qty} $unit (${rp(omzet)})"
                    }.joinToString(", ")
                    ListRow(
                        mark = handler,
                        title = handler,
                        detail = listOf(
                            branchName(nota.branchId),
                            services,
                            "${group.map { it.first.id }.distinct().size} Service ditangani",
                        ).filter { it.isNotBlank() }.joinToString(" · "),
                        showChevron = false,
                        trailing = { Chip("Komisi ${rp(group.sumOf { it.third })}", Green) },
                    )
                    if (index < handlerGroups.lastIndex) RowDivider()
                }
            }
        }
        item { SectionLabel("Rincian transaksi") }
        if (rows.isEmpty()) item { EmptyHint("Belum ada transaksi", "Tidak ada Service pada cabang dan periode yang dipilih.") }
        else item { TransactionReportTable(rows.sortedByDescending { it.createdAtMs }, ::branchName) { nav.navigate("queue/$it") } }
        item {
            val rangeLabel = if (customRange) "${DisplayDates.date(from)} sampai ${DisplayDates.date(until)}" else period.replaceFirstChar { it.uppercase() }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrimaryBtn("Ekspor PDF", Modifier.weight(1f), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.PictureAsPdf) { FileExports.shareFinancialPdf(ctx, rows, expenseRows, rangeLabel) }
                GhostBtn("Ekspor CSV", Modifier.weight(1f), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.TableView) { FileExports.shareFinancial(ctx, rows, expenseRows) }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun AnalyticsKpi(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier = modifier, color = Card, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Line)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, color = Muted, fontSize = 11.sp)
            Text(value, color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun TransactionReportTable(rows: List<Nota>, branchName: (String) -> String, onOpen: (String) -> Unit) {
    // Tabel 12 kolom tidak layak di layar sempit dan font besar. Setiap Service
    // ditampilkan sebagai kartu bertingkat supaya semua angka tetap terbaca.
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { nota ->
            CardBlock(Modifier.clickable { onOpen(nota.id) }) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(nota.id, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Ink, modifier = Modifier.weight(1f))
                    Chip(nota.pay.label, if (nota.pay == PayStatus.Lunas) Green else Amber)
                }
                Text(nota.customer, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Ink)
                Text(
                    listOf(nota.createdAt, branchName(nota.branchId), nota.kasir).filter { it.isNotBlank() }.joinToString(" · "),
                    color = Muted,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                )
                if (nota.lines.isNotEmpty()) {
                    Text(nota.lines.joinToString { "${it.name} ${if (it.qty % 1.0 == 0.0) it.qty.toInt() else it.qty} ${it.unit}" }, color = Ink, fontSize = 13.sp, lineHeight = 18.sp)
                    val handlers = nota.lines.map { it.handledByName.ifBlank { nota.kasir } }.distinct().joinToString()
                    val commission = nota.lines.sumOf { (it.qty * it.commissionPerUnit).toInt() }
                    Text("Petugas $handlers · komisi ${rp(commission)}", color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
                }
                Text("Omzet ${rp(nota.total)} · diterima ${rp(nota.paid)} · ${nota.laundry.label}", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, lineHeight = 18.sp)
            }
        }
    }
}

@Composable
internal fun AuditScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Riwayat aktivitas", "Semua transaksi", onBack = { nav.popBackStack() }) }
        item { SyncNotice() }
        item { GhostBtn("Ekspor riwayat perubahan", icon = Icons.Outlined.FileDownload) { FileExports.shareAudit(ctx, store.audit.toList()) } }
        items(store.audit) { a ->
            ListRow(
                mark = a.user,
                title = a.action,
                detail = "${a.at} · ${a.user}",
                onClick = a.notaId?.let { id -> { nav.navigate("queue/$id") } },
            )
        }
        if (store.audit.isEmpty()) item { EmptyHint("Belum ada aktivitas", "Setiap perubahan pesanan, stok, dan kas akan tercatat di sini.") }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun CashScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    val bid = if (s.role == Role.Owner) store.viewBranch.value else s.branchId
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item {
            ScreenHeader(
                "Tutup kas",
                "${s.name} · ${if (bid == "all") "semua cabang" else store.branch(bid).name}",
                onBack = { nav.popBackStack() },
            )
        }
        item {
            CardBlock {
                Text("Tunai hari ini", color = Muted, fontSize = 12.sp)
                Text(rp(store.todayByMethod(PayMethod.Tunai, bid)), fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text("QRIS  ${rp(store.todayByMethod(PayMethod.Qris, bid))}", modifier = Modifier.padding(top = 8.dp))
                Text("Transfer  ${rp(store.todayByMethod(PayMethod.Transfer, bid))}")
                Text("Piutang  ${rp(store.piutang(store.notas.filter { bid == "all" || it.branchId == bid }))}")
            }
        }
        item {
            PrimaryBtn("Tutup shift") {
                val row = store.closeCash()
                toast("Kas ditutup ${row.at}")
                nav.popBackStack()
            }
        }
        if (store.cashCloses.isNotEmpty()) {
            item { Text("Riwayat", fontWeight = FontWeight.Bold) }
            items(store.cashCloses.take(12), key = { it.id }) { c ->
                Text("${c.at} · ${c.by} · tunai ${rp(c.tunai)}", color = Muted, fontSize = 13.sp)
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
internal fun ProfilScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    val account = store.staff.firstOrNull { it.email.equals(s.email, true) }
    val assignedBranches = account?.branchIds.orEmpty().mapNotNull { id -> store.branches.firstOrNull { it.id == id }?.name }
    var themeMode by remember { mutableStateOf(ThemePrefs.mode) }
    var changePassword by remember { mutableStateOf(false) }
    var changeEmail by remember { mutableStateOf(false) }
    var newEmail by remember { mutableStateOf(s.email) }
    var emailPassword by remember { mutableStateOf("") }
    var oldPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Akun & profil", onBack = { nav.popBackStack() }) }
        item {
            CardBlock {
                AvatarMark(s.name)
                Text(s.name, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Text(s.email, color = Muted)
                Chip(if (s.role == Role.Supervisor) "SPV" else s.role.name, Teal)
                InfoRow(Icons.Outlined.Storefront, "Cabang penugasan", assignedBranches.joinToString().ifBlank { "Belum ada cabang" })
                if (s.role == Role.Owner) InfoRow(Icons.Outlined.Visibility, "Tampilan data", if (store.viewBranch.value == "all") "Semua cabang" else store.branch(store.viewBranch.value).name)
            }
        }
        if (account != null) {
            item { GhostBtn("Ubah email", icon = Icons.Outlined.AlternateEmail) { changeEmail = !changeEmail; newEmail = s.email } }
            if (changeEmail) item {
                CardBlock {
                    SectionLabel("Email akun")
                    Field(newEmail, { newEmail = it }, "Email baru")
                    Field(emailPassword, { emailPassword = it }, "Kata sandi saat ini", password = true)
                    PrimaryBtn("Simpan email", enabled = newEmail.contains('@') && emailPassword.isNotBlank(), icon = Icons.Outlined.Check) {
                        fun finish(error: String?) {
                            if (error != null) toast(error) else {
                                newEmail = s.email; emailPassword = ""; changeEmail = false
                                toast("Email akun berhasil diubah")
                            }
                        }
                        if (FirebaseCloud.enabled) FirebaseCloud.changeEmail(emailPassword, newEmail) { cloudError ->
                            if (cloudError != null) finish(cloudError) else finish(store.changeMyEmail(newEmail, emailPassword))
                        } else finish(store.changeMyEmail(newEmail, emailPassword))
                    }
                    GhostBtn("Batal") { changeEmail = false; emailPassword = ""; newEmail = s.email }
                }
            }
            item { GhostBtn(if (account.passwordHash.isBlank()) "Atur kata sandi" else "Ubah kata sandi", icon = Icons.Outlined.Lock) { changePassword = !changePassword } }
            if (changePassword) item {
                CardBlock {
                    SectionLabel("Keamanan akun")
                    if (account.passwordHash.isNotBlank()) Field(oldPassword, { oldPassword = it }, "Kata sandi saat ini", password = true)
                    Field(newPassword, { newPassword = it }, "Kata sandi baru", password = true)
                    Field(confirmation, { confirmation = it }, "Ulangi kata sandi baru", password = true)
                    Text("Minimal 8 karakter. Kata sandi tidak ditampilkan kembali setelah disimpan.", color = Muted, fontSize = 12.sp)
                    PrimaryBtn("Simpan kata sandi", enabled = newPassword.length >= 8 && newPassword == confirmation, icon = Icons.Outlined.Check) {
                        fun finish(error: String?) {
                            if (error != null) toast(error) else { oldPassword = ""; newPassword = ""; confirmation = ""; changePassword = false; toast("Kata sandi akun berhasil disimpan") }
                        }
                        if (FirebaseCloud.enabled) FirebaseCloud.changePassword(oldPassword, newPassword) { cloudError ->
                            if (cloudError != null) finish(cloudError) else finish(store.changeMyPassword(oldPassword, newPassword))
                        } else finish(store.changeMyPassword(oldPassword, newPassword))
                    }
                    GhostBtn("Batal") { oldPassword = ""; newPassword = ""; confirmation = ""; changePassword = false }
                }
            }
        }
        item {
            CardBlock {
                SectionLabel("Tema tampilan")
                Text("Berlaku untuk akun ini di HP ini saja, tidak ikut tersinkron ke perangkat lain.", color = Muted, fontSize = 12.sp)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CuciinThemeMode.entries.forEach { option ->
                        SelectChip(themeMode == option, option.label) { ThemePrefs.set(option); themeMode = ThemePrefs.mode }
                    }
                }
                Text("Contoh teks dan kartu memakai warna tema ini: ${paletteSampleLabel(themeMode)}.", color = Muted, fontSize = 12.sp)
            }
        }
        item { CardBlock { InfoRow(Icons.Outlined.CloudSync, "Sinkronisasi", CloudSync.lastStatus); InfoRow(Icons.Outlined.Info, "Versi aplikasi", "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})") } }
        item { GhostBtn("Riwayat versi", icon = Icons.Outlined.History) { nav.navigate("versions") } }
        if (s.role != Role.Owner) item { DangerBtn("Hapus akun saya") { if (store.deleteMyAccount()) { toast("Akun dihapus"); nav.navigate("login") { popUpTo(0) } } } }
    }
}

@Composable
internal fun VersionScreen(nav: NavHostController) {
    val ui = rememberUi()
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Riwayat versi", "Sekarang ${BuildConfig.VERSION_NAME}", onBack = { nav.popBackStack() }) }
        item {
            CardBlock(accent = Teal) {
                Text("Cuciin Android", fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text("v${BuildConfig.VERSION_NAME} · build ${BuildConfig.VERSION_CODE}", color = Muted, fontSize = 13.sp)
            }
        }
        items(VersionHistory.releases) { r ->
            CardBlock {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("v${r.name}", fontWeight = FontWeight.Black, color = Ink, fontSize = 18.sp)
                    Chip("build ${r.code}", Teal)
                }
                Text(r.date, color = Muted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                r.notes.forEach { Text("• $it", fontSize = 13.sp, modifier = Modifier.padding(bottom = 4.dp), color = Ink) }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

/** Kalimat contoh supaya pengguna melihat tema mana yang sedang aktif tanpa menebak. */
private fun paletteSampleLabel(mode: CuciinThemeMode): String = when (mode) {
    CuciinThemeMode.Sistem -> "mengikuti pengaturan gelap/terang HP"
    CuciinThemeMode.Terang -> "latar terang dengan aksen pink dan navy"
    CuciinThemeMode.Gelap -> "latar gelap dengan aksen pink muda"
    CuciinThemeMode.Warni -> "latar merah muda dengan aksen ungu"
}
