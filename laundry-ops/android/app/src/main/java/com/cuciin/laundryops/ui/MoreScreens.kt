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
import com.cuciin.laundryops.data.Staff
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
import com.cuciin.laundryops.ui.theme.OnPrim
import com.cuciin.laundryops.ui.theme.Mist
import com.cuciin.laundryops.ui.theme.LineSoft
import java.time.LocalDateTime

private val store get() = CuciinStore

@Composable
internal fun MoreScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val role = store.session.value?.role ?: Role.Kasir
    val tap = rememberTapFeedback()
    // Susunan diambil dari preferensi supaya urutan yang diubah pengguna ikut terpakai.
    val sections = MenuPrefs.layout.render { route -> routeAllowed(route) }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(16.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Kelola laundry", "${store.session.value?.name} · ${if (role == Role.Supervisor) "SPV" else role.name}") }
        item {
            Surface(
                onClick = { tap(); nav.navigate("menuOrder") },
                shape = CuciinShape.card,
                color = Card,
                border = BorderStroke(1.dp, LineSoft),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Surface(shape = CuciinShape.badge, color = Mist) {
                        Icon(Icons.Outlined.SwapVert, null, tint = Teal, modifier = Modifier.padding(10.dp).size(20.dp))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("Atur urutan menu", color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text("Geser menu dan pindahkan ke bagian lain", color = Muted, fontSize = 12.sp, lineHeight = 16.sp)
                    }
                    Icon(Icons.Outlined.ChevronRight, null, tint = Line, modifier = Modifier.size(20.dp))
                }
            }
        }
        sections.forEach { (title, entries) ->
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionLabel(title)
                    ListCard {
                        entries.forEachIndexed { index, entry ->
                            ModuleRow(entry.label, entry.summary, menuIcon(entry.icon)) { tap(); nav.navigate(MenuOrder.destinationOf(entry.route)) }
                            if (index < entries.lastIndex) RowDivider()
                        }
                    }
                }
            }
        }
        if (role == Role.Owner) item { GhostBtn("Ekspor semua data (JSON)", icon = Icons.Outlined.FileDownload) { FileExports.shareAllData(ctx, store.exportSnapshot()) } }
        item { GhostBtn("Keluar dari akun", icon = Icons.Outlined.Logout) { store.logout(); nav.navigate("login") { popUpTo(0) } } }
    }
}

/**
 * Izin satu rute.
 *
 * Modul yang diperiksa dibaca dari [RouteAccess] supaya setiap modul di katalog izin benar-benar
 * diperiksa di suatu tempat; rute yang tidak punya modul (akun, tema, versi) selalu boleh.
 *
 * Menu yang tabnya disembunyikan untuk SPV juga disembunyikan di sini. Aturannya dibaca dari
 * [NavTabs], sumber yang sama dengan bar navigasi, supaya menu Modul tidak pernah menampilkan
 * pintu yang tidak bisa dipakai. Sebelumnya SPV melihat "Service baru" di menu Modul padahal
 * layar Antrian dan tab bawah menyembunyikannya, dan server pun menolak pembuatan Service
 * oleh SPV, sehingga pesanannya gagal tersinkron tanpa penjelasan.
 */
internal fun routeAllowed(route: String): Boolean {
    val tab = NavTabs.routeOf(MenuOrder.destinationOf(route))
    if (tab?.hiddenForSupervisor == true && store.session.value?.role == Role.Supervisor) return false
    val module = RouteAccess.moduleOf(route) ?: return true
    return store.canAccess(module)
}

/** Nama ikon di katalog dipetakan ke ikon sungguhan di sini supaya katalognya tetap murni. */
internal fun menuIcon(name: String): ImageVector = when (name) {
    "ListAlt" -> Icons.Outlined.ListAlt
    "AddCircleOutline" -> Icons.Outlined.AddCircleOutline
    "Fingerprint" -> Icons.Outlined.Fingerprint
    "PrecisionManufacturing" -> Icons.Outlined.PrecisionManufacturing
    "ReceiptLong" -> Icons.Outlined.ReceiptLong
    "AccountBalanceWallet" -> Icons.Outlined.AccountBalanceWallet
    "PeopleOutline" -> Icons.Outlined.PeopleOutline
    "ScheduleSend" -> Icons.Outlined.ScheduleSend
    "Forum" -> Icons.Outlined.Forum
    "BarChart" -> Icons.Outlined.BarChart
    "Insights" -> Icons.Outlined.Insights
    "History" -> Icons.Outlined.History
    "Storefront" -> Icons.Outlined.Storefront
    "Badge" -> Icons.Outlined.Badge
    "LocalLaundryService" -> Icons.Outlined.LocalLaundryService
    "Inventory2" -> Icons.Outlined.Inventory2
    "AdminPanelSettings" -> Icons.Outlined.AdminPanelSettings
    "Settings" -> Icons.Outlined.Settings
    else -> Icons.Outlined.ChevronRight
}

@Composable
private fun ModuleRow(title: String, detail: String, icon: ImageVector, onClick: () -> Unit) {
    Surface(onClick = onClick, color = Card, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(shape = CuciinShape.badge, color = Mist) {
                Icon(icon, null, tint = Teal, modifier = Modifier.padding(10.dp).size(20.dp))
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(detail, color = Muted, fontSize = 12.sp, lineHeight = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = Line, modifier = Modifier.size(20.dp))
        }
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
            Eyebrow("Cepat", Modifier.padding(start = 20.dp, end = 20.dp))
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AnalyticsScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val period = store.reportPeriod.value
    var customRange by rememberSaveable { mutableStateOf(false) }
    var fromValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(0).withMinute(0))) }
    var untilValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(23).withMinute(59))) }
    var selectedHandlerIds by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var selectedSections by rememberSaveable { mutableStateOf(setOf("ringkasan")) }
    var showPeriodSheet by rememberSaveable { mutableStateOf(false) }
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    var showHandlerSheet by rememberSaveable { mutableStateOf(false) }
    var showReportSheet by rememberSaveable { mutableStateOf(false) }
    val from = DisplayDates.parse(fromValue) ?: LocalDateTime.now(Clock.ZONE).withHour(0).withMinute(0)
    val until = DisplayDates.parse(untilValue) ?: LocalDateTime.now(Clock.ZONE).withHour(23).withMinute(59)
    val selectedBranches = store.reportBranchIds.value
    fun reportName(email: String, snapshotName: String): String = reportStaffDisplayName(store.staff, email, snapshotName)
    val baseRows = if (customRange) store.notas.filter { DisplayDates.isInSelectedMinute(it.createdAtMs, from, until) && (selectedBranches.isEmpty() || it.branchId in selectedBranches) } else store.periodNotas()
    val handlers = baseRows.flatMap { nota -> nota.lines.map { line ->
        val email = line.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir }
        email to reportName(email, line.handledByName.ifBlank { nota.kasir })
    } }.distinctBy { it.first }
    val rows = baseRows.filter { nota ->
        selectedHandlerIds.isEmpty() || nota.lines.any { it.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir } in selectedHandlerIds }
    }
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
        if (selectedHandlerIds.isNotEmpty()) {
            append(" · ")
            append("${selectedHandlerIds.size} petugas dipilih")
        }
    }
    // Laporan dipecah per bagian supaya pengguna tidak menggulir seluruh isi
    // ketika transaksinya ribuan. Satu bagian tampil pada satu waktu.
    val sections = listOf(
        "ringkasan" to "Ringkasan",
        "cabang" to "Per cabang",
        "kasir" to "Per kasir",
        "petugas" to "Komisi petugas",
        "rincian" to "Rincian",
    )
    val selectedSectionLabels = sections.filter { it.first in selectedSections }.map { it.second }
    Column(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ScreenHeader("Laporan transaksi", null, onBack = { nav.popBackStack() }) {
            GhostBtn("PDF", Modifier.width(96.dp), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.PictureAsPdf) { FileExports.shareFinancialPdf(ctx, rows, expenseRows, rangeLabel, selectedSections) }
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(rangeLabel, fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
            Text(summaryLine, color = Muted, fontSize = 12.sp, lineHeight = 16.sp)
        }
        FilterBarRow(
            left = {
                FilterBar(label = "Periode", value = if (customRange) "Rentang sendiri" else periodLabel, detail = rangeLabel, icon = Icons.Outlined.CalendarMonth, onClick = { showPeriodSheet = true }, modifier = Modifier.fillMaxWidth())
            },
            right = {
                FilterBar(
                    label = "Cabang",
                    value = if (selectedBranches.isEmpty()) "Semua cabang" else "${selectedBranches.size} dipilih",
                    detail = if (selectedBranches.isEmpty()) "${store.branches.size} cabang" else selectedBranches.joinToString { branchName(it) },
                    icon = Icons.Outlined.Storefront,
                    onClick = { showBranchSheet = true },
                    modifier = Modifier.fillMaxWidth(),
                )
            },
        )
        FilterBarRow(
            left = {
                if (handlers.size > 1) FilterBar(
                    label = "Petugas",
                    value = if (selectedHandlerIds.isEmpty()) "Semua petugas" else "${selectedHandlerIds.size} dipilih",
                    detail = "${handlers.size} petugas menangani periode ini",
                    icon = Icons.Outlined.Badge,
                    onClick = { showHandlerSheet = true },
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            right = {
                FilterBar(
                    label = "Tampilan",
                    value = selectedSectionLabels.joinToString().ifBlank { "Pilih tampilan" },
                    detail = "Bisa pilih lebih dari satu",
                    icon = Icons.Outlined.ViewList,
                    onClick = { showReportSheet = true },
                    modifier = Modifier.fillMaxWidth(),
                )
            },
        )
        if (customRange) {
            Surface(color = Card, shape = CuciinShape.card, border = BorderStroke(1.dp, Line)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    DateTimeFields(from, { fromValue = DisplayDates.encode(it) }, "Mulai")
                    DateTimeFields(until, { untilValue = DisplayDates.encode(it) }, "Sampai")
                    if (until.isBefore(from)) Text("Waktu akhir harus setelah waktu mulai.", color = com.cuciin.laundryops.ui.theme.Coral, fontSize = 12.sp)
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(selectedSectionLabels.joinToString().ifBlank { "Hasil laporan" }, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text("${rows.size} Service", color = Muted, fontSize = 12.sp)
        }
        ReportListBox(
            modifier = Modifier.weight(1f),
            sections = selectedSections,
            rows = rows,
            expenseRows = expenseRows,
            staff = store.staff,
            branchName = ::branchName,
            omzet = omzet,
            masuk = masuk,
            biaya = biaya,
            operations = operations,
            onOpen = { nav.navigate("queue/$it") },
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PrimaryBtn("Ekspor PDF", Modifier.weight(1f), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.PictureAsPdf) { FileExports.shareFinancialPdf(ctx, rows, expenseRows, rangeLabel, selectedSections) }
            GhostBtn("CSV", Modifier.weight(1f), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.TableView) { FileExports.shareFinancial(ctx, rows, expenseRows, selectedSections) }
        }
    }
    if (showPeriodSheet) {
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
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Bisa pilih lebih dari satu. Kosong berarti semua cabang.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            FilterSheetRow(selectedBranches.isEmpty(), "Semua cabang", "${store.branches.size} cabang") { store.reportBranchIds.value = emptySet(); store.touchStatus(); showBranchSheet = false }
            ListDivider()
            store.branches.forEach { b ->
                val jumlah = store.notas.count { it.branchId == b.id }
                FilterSheetRow(b.id in selectedBranches, b.name, "$jumlah Service tercatat") {
                    val current = store.reportBranchIds.value
                    store.reportBranchIds.value = if (b.id in current) current - b.id else current + b.id
                    store.touchStatus()
                }
            }
            PrimaryBtn("Selesai", Modifier.padding(horizontal = 18.dp, vertical = 8.dp)) { showBranchSheet = false }
        }
    }
    if (showHandlerSheet) ModalBottomSheet(onDismissRequest = { showHandlerSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih petugas", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Bisa pilih lebih dari satu. Kosong berarti semua petugas.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            FilterSheetRow(selectedHandlerIds.isEmpty(), "Semua petugas", "${handlers.size} petugas") { selectedHandlerIds = emptySet(); store.touchStatus() }
            ListDivider()
            handlers.forEach { (key, name) ->
                FilterSheetRow(key in selectedHandlerIds, name, null) {
                    selectedHandlerIds = if (key in selectedHandlerIds) selectedHandlerIds - key else selectedHandlerIds + key
                    store.touchStatus()
                }
            }
            PrimaryBtn("Selesai", Modifier.padding(horizontal = 18.dp, vertical = 8.dp)) { showHandlerSheet = false }
        }
    }
    if (showReportSheet) ModalBottomSheet(onDismissRequest = { showReportSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Tampilan laporan", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Pilih satu atau lebih bagian yang ingin dibaca dalam box laporan.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            sections.forEach { (id, label) ->
                FilterSheetRow(id in selectedSections, label, null) {
                    selectedSections = if (id in selectedSections) selectedSections - id else selectedSections + id
                }
            }
            PrimaryBtn("Terapkan", Modifier.padding(horizontal = 18.dp, vertical = 8.dp), enabled = selectedSections.isNotEmpty()) { showReportSheet = false }
        }
    }
}

@Composable
private fun ReportListBox(
    modifier: Modifier,
    sections: Set<String>,
    rows: List<Nota>,
    expenseRows: List<com.cuciin.laundryops.data.Expense>,
    staff: List<Staff>,
    branchName: (String) -> String,
    omzet: Int,
    masuk: Int,
    biaya: Int,
    operations: OperationalCounts,
    onOpen: (String) -> Unit,
) {
    Surface(modifier = modifier.fillMaxWidth(), color = Card, shape = CuciinShape.card, border = BorderStroke(1.dp, Line)) {
        if (sections.isEmpty()) {
            EmptyHint("Pilih tampilan laporan", "Pilih minimal satu bagian melalui filter Tampilan laporan.")
        } else LazyColumn(contentPadding = PaddingValues(vertical = 4.dp)) {
            fun heading(text: String) = item { Text(text, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Ink, modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) }
            if ("ringkasan" in sections) {
                heading("Ringkasan")
                item { ListRow("OMZ", "Omzet Service", "${rows.size} Service", trailing = { Text(rp(omzet), fontWeight = FontWeight.Bold, color = Ink) }, showChevron = false) }
                item { ListRow("KAS", "Kas diterima", "Biaya ${rp(biaya)} · hasil kas ${rp(masuk - biaya)}", trailing = { Text(rp(masuk), fontWeight = FontWeight.Bold, color = Ink) }, showChevron = false) }
                item { ListRow("OPS", "Kondisi operasional", "${operations.overdue} terlambat · ${operations.readyForPickup} siap diambil · ${operations.unpaid} belum lunas", showChevron = false) }
                item { ListDivider() }
            }
            if ("cabang" in sections) {
                heading("Per cabang")
                val groups = rows.groupBy { it.branchId }.toList()
                if (groups.isEmpty()) item { EmptyHint("Belum ada transaksi", "Tidak ada Service pada cabang dan periode yang dipilih.") }
                else items(groups, key = { it.first }) { (branchId, branchRows) ->
                    val branchCost = expenseRows.filter { it.branchId == branchId }.sumOf { it.amount }
                    val name = branchName(branchId)
                    ListRow(name.take(3), name, "${branchRows.size} Service · masuk ${rp(branchRows.sumOf { it.paid })} · biaya ${rp(branchCost)}", trailing = { Text(rp(branchRows.sumOf { it.paid } - branchCost), fontWeight = FontWeight.Bold, color = Ink) }, showChevron = false)
                    ListDivider()
                }
            }
            if ("kasir" in sections) {
                heading("Per kasir")
                val groups = rows.groupBy { it.kasirEmail.ifBlank { it.kasir } }.toList()
                if (groups.isEmpty()) item { EmptyHint("Belum ada transaksi", "Tidak ada Service pada kasir dan periode yang dipilih.") }
                else items(groups, key = { it.first }) { (email, kasirRows) ->
                    val name = reportStaffDisplayName(staff, email, kasirRows.first().kasir)
                    ListRow(name, name, "${kasirRows.size} Service · ${kasirRows.map { branchName(it.branchId) }.distinct().joinToString()} · masuk ${rp(kasirRows.sumOf { it.paid })}", trailing = { Text(rp(kasirRows.sumOf { it.total }), fontWeight = FontWeight.Bold, color = Ink) }, showChevron = false)
                    ListDivider()
                }
            }
            if ("petugas" in sections) {
                heading("Komisi petugas")
                val groups = rows.flatMap { nota -> nota.lines.map { line -> Triple(nota, line, (line.qty * line.commissionPerUnit).toInt()) } }
                    .groupBy { (nota, line, _) -> "${nota.branchId}|${line.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir }}" }.toList()
                if (groups.isEmpty()) item { EmptyHint("Rincian petugas belum tersedia", "Service lama belum memiliki petugas per layanan.") }
                else items(groups, key = { it.first }) { (_, group) ->
                    val first = group.first()
                    val email = first.second.handledByEmail.ifBlank { first.first.kasirEmail }.ifBlank { first.first.kasir }
                    val name = reportStaffDisplayName(staff, email, first.second.handledByName.ifBlank { first.first.kasir })
                    ListRow(name, name, "${branchName(first.first.branchId)} · ${group.map { it.first.id }.distinct().size} Service ditangani", trailing = { Text(rp(group.sumOf { it.third }), fontWeight = FontWeight.Bold, color = Ink) }, showChevron = false)
                    ListDivider()
                }
            }
            if ("rincian" in sections) {
                heading("Rincian transaksi")
                if (rows.isEmpty()) item { EmptyHint("Belum ada transaksi", "Tidak ada Service pada filter yang dipilih.") }
                else items(rows.sortedByDescending { it.createdAtMs }, key = { it.id }) { nota ->
                    ReportTransactionListRow(nota, branchName, staff) { onOpen(nota.id) }
                    ListDivider()
                }
            }
        }
    }
}

@Composable
private fun ReportTransactionListRow(nota: Nota, branchName: (String) -> String, staff: List<Staff>, onOpen: () -> Unit) {
    val kasir = reportStaffDisplayName(staff, nota.kasirEmail.ifBlank { nota.kasir }, nota.kasir)
    ListRow(
        mark = nota.id.takeLast(4),
        title = nota.customer,
        detail = "${nota.id} · ${branchName(nota.branchId)} · $kasir · ${nota.pay.label}",
        trailing = { Text(rp(nota.total), fontWeight = FontWeight.Bold, color = Ink, fontSize = 13.sp) },
        onClick = onOpen,
    )
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

internal fun reportStaffDisplayName(staff: List<Staff>, email: String, snapshotName: String): String =
    com.cuciin.laundryops.data.staffDisplayName(staff, email, snapshotName)

@Composable
private fun TransactionReportRow(nota: Nota, branchName: (String) -> String, staff: List<Staff>, onOpen: (String) -> Unit) {
    val kasir = reportStaffDisplayName(staff, nota.kasirEmail.ifBlank { nota.kasir }, nota.kasir)
    CardBlock(Modifier.clickable { onOpen(nota.id) }) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(nota.id, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Ink, modifier = Modifier.weight(1f))
            Chip(nota.pay.label, if (nota.pay == PayStatus.Lunas) Green else Amber)
        }
        Text(nota.customer, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Ink)
        Text(
            listOf(nota.createdAt, branchName(nota.branchId), kasir).filter { it.isNotBlank() }.joinToString(" · "),
            color = Muted,
            fontSize = 12.sp,
            lineHeight = 17.sp,
        )
        if (nota.lines.isNotEmpty()) {
            Text(nota.lines.joinToString { "${it.name} ${if (it.qty % 1.0 == 0.0) it.qty.toInt() else it.qty} ${it.unit}" }, color = Ink, fontSize = 13.sp, lineHeight = 18.sp)
            val handlers = nota.lines.map { line ->
                reportStaffDisplayName(staff, line.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir }, line.handledByName.ifBlank { kasir })
            }.distinct().joinToString()
            val commission = nota.lines.sumOf { (it.qty * it.commissionPerUnit).toInt() }
            Text("Petugas $handlers · komisi ${rp(commission)}", color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
        }
        Text("Omzet ${rp(nota.total)} · diterima ${rp(nota.paid)} · ${nota.laundry.label}", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, lineHeight = 18.sp)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CashScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    val bid = if (s.role == Role.Owner) store.viewBranch.value else s.branchId
    var showBranchSheet by remember { mutableStateOf(false) }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            if (s.role == Role.Owner) {
                store.branches.forEach { branch ->
                    FilterSheetRow(bid == branch.id, branch.name, "Tutup kas per cabang") {
                        store.viewBranch.value = branch.id
                        store.touchStatus()
                        showBranchSheet = false
                    }
                }
            } else {
                FilterSheetRow(true, store.branch(bid).name, "Cabang tugas Anda") { showBranchSheet = false }
            }
        }
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item {
            ScreenHeader(
                "Tutup kas",
                "${s.name} · ${if (bid == "all") "semua cabang" else store.branch(bid).name}",
                onBack = { nav.popBackStack() },
            )
        }
        if (s.role == Role.Owner) {
            // Pemilih cabang harus ada di layar ini. Sebelumnya layar hanya meminta "Pilih satu
            // cabang" tanpa menyediakan pemilihnya, sehingga Owner yang melihat semua cabang
            // menemui jalan buntu dan harus memilih cabang di tab Antrian lebih dulu.
            item {
                FilterBar(
                    label = "Cabang",
                    value = if (bid == "all") "Belum dipilih" else store.branch(bid).name,
                    detail = "Tutup kas dibuat per cabang",
                    icon = Icons.Outlined.Storefront,
                    onClick = { showBranchSheet = true },
                )
            }
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
        if (bid == "all") {
            item { EmptyHint("Pilih satu cabang", "Tutup kas dibuat per cabang agar penerimaan dan piutang tidak tercampur.") }
        } else {
            item {
                PrimaryBtn("Tutup kas hari ini") {
                    val row = store.closeCash()
                    if (row == null) toast("Kas cabang ini sudah ditutup hari ini")
                    else {
                        toast("Kas ditutup ${row.at}")
                        nav.popBackStack()
                    }
                }
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
        item { GhostBtn("Theme Aplikasi", icon = Icons.Outlined.Colorize) { nav.navigate("theme") } }
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
