package com.tiftazani.laundryops.ui

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
import com.tiftazani.laundryops.ui.components.*
import com.tiftazani.laundryops.ui.theme.Card
import com.tiftazani.laundryops.ui.theme.Line
import com.tiftazani.laundryops.ui.theme.Mist
import com.tiftazani.laundryops.data.FirebaseCloud
import com.tiftazani.laundryops.data.FileExports

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.tiftazani.laundryops.BuildConfig
import com.tiftazani.laundryops.data.CloudSync
import com.tiftazani.laundryops.data.Clock
import com.tiftazani.laundryops.data.CuciinStore
import com.tiftazani.laundryops.data.PayMethod
import com.tiftazani.laundryops.data.Nota
import com.tiftazani.laundryops.data.Role
import com.tiftazani.laundryops.data.VersionHistory
import com.tiftazani.laundryops.data.rp
import com.tiftazani.laundryops.ui.components.CardBlock
import com.tiftazani.laundryops.ui.components.Chip
import com.tiftazani.laundryops.ui.components.ChipRow
import com.tiftazani.laundryops.ui.components.GhostBtn
import com.tiftazani.laundryops.ui.components.Hero
import com.tiftazani.laundryops.ui.components.PeriodRow
import com.tiftazani.laundryops.ui.components.PrimaryBtn
import com.tiftazani.laundryops.ui.components.ScreenHeader
import com.tiftazani.laundryops.ui.components.SelectChip
import com.tiftazani.laundryops.ui.theme.Ink
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Teal
import com.tiftazani.laundryops.ui.theme.Green
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
            add("Pengguna · kasir · SPV" to "users")
            add("Layanan & harga" to "services")
            add("Produk stok" to "products")
            add("Riwayat aktivitas" to "audit")
        }
        add("Inventory cabang" to "inventory")
        add("Biaya operasional" to "expenses")
        if (role != Role.Supervisor) add("Pelanggan" to "customers")
        if (role != Role.Supervisor) {
            add("WA menunggu" to "wa")
            add("Arsip WA" to "waArchive")
            add("Tutup kas" to "cash")
        }
        add("Riwayat versi" to "versions")
        add("Profil" to "profil")
    }
    val tap = rememberTapFeedback()
    val columns = if (ui.widthDp < 360 || LocalDensity.current.fontScale > 1.3f) 1 else if (ui.twoPane) 3 else 2
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Kelola laundry", "${store.session.value?.name} · ${if (role == Role.Supervisor) "SPV" else role.name}") }
        item {
            Surface(onClick = { nav.navigate("profil") }, color = Teal, shape = RoundedCornerShape(20.dp)) {
                Row(Modifier.fillMaxWidth().padding(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.AccountCircle, null, tint = androidx.compose.ui.graphics.Color.White, modifier = Modifier.size(32.dp))
                    Column(Modifier.weight(1f)) { Text("Akun & profil", color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold); Text("Informasi akun dan kata sandi", color = androidx.compose.ui.graphics.Color.White.copy(alpha = .8f), fontSize = 12.sp) }
                    Icon(Icons.Outlined.ChevronRight, null, tint = androidx.compose.ui.graphics.Color.White)
                }
            }
        }
        items(items.filter { it.second != "profil" }.chunked(columns)) { group ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.height(IntrinsicSize.Min)) {
                group.forEach { (label, route) ->
                    Surface(onClick = { tap(); nav.navigate(route) }, modifier = Modifier.weight(1f).fillMaxHeight(), color = Card, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, Line)) {
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
        if (role == Role.Owner) item { GhostBtn("Export semua data (JSON)", icon = Icons.Outlined.FileDownload) { FileExports.shareAllData(ctx, store.exportSnapshot()) } }
        item { GhostBtn("Keluar dari akun", icon = Icons.Outlined.Logout) { store.logout(); nav.navigate("login") { popUpTo(0) } } }
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
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Laporan transaksi", "${rows.size} Service · ${store.ownerName}", onBack = { nav.popBackStack() }) }
        item {
            SectionLabel("Periode laporan")
            PeriodRow(if (customRange) "custom" else period) { customRange = false; store.reportPeriod.value = it; store.touchStatus() }
            ChipRow { SelectChip(customRange, "Pilih tanggal") { customRange = true } }
        }
        if (customRange) item {
            CardBlock {
                SectionLabel("Interval transaksi")
                DateTimeFields(from, { fromValue = DisplayDates.encode(it) }, "Mulai")
                DateTimeFields(until, { untilValue = DisplayDates.encode(it) }, "Sampai")
                if (until.isBefore(from)) Text("Waktu akhir harus setelah waktu mulai.", color = com.tiftazani.laundryops.ui.theme.Coral, fontSize = 12.sp)
            }
        }
        item {
            ChipRow {
                SelectChip(store.reportBranchIds.value.isEmpty(), "Semua cabang") { store.reportBranchIds.value = emptySet(); store.touchStatus() }
                store.branches.forEach { b ->
                    SelectChip(b.id in store.reportBranchIds.value, b.name.removePrefix("Cuciin ")) {
                        val current = store.reportBranchIds.value
                        store.reportBranchIds.value = if (b.id in current) current - b.id else current + b.id
                        store.touchStatus()
                    }
                }
            }
        }
        if (handlers.isNotEmpty()) item {
            CardBlock {
                SectionLabel("Filter petugas layanan")
                ChipRow {
                    SelectChip(handlerFilter == "all", "Semua petugas") { handlerFilter = "all" }
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
                Text("${operations.overdue} terlambat · ${operations.dueToday} jatuh tempo hari ini", color = if (operations.overdue > 0) com.tiftazani.laundryops.ui.theme.Coral else Muted)
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
        items(rows.groupBy { it.branchId }.toList(), key = { it.first }) { (branchId, branchRows) ->
            CardBlock {
                Text(branchName(branchId), fontWeight = FontWeight.Bold)
                Text("${branchRows.size} transaksi · omzet ${rp(branchRows.sumOf { it.total })} · masuk ${rp(branchRows.sumOf { it.paid })}", color = Muted, fontSize = 13.sp)
                val branchCost = expenseRows.filter { it.branchId == branchId }.sumOf { it.amount }
                Text("Biaya ${rp(branchCost)} · hasil kas ${rp(branchRows.sumOf { it.paid } - branchCost)}", color = Ink, fontWeight = FontWeight.SemiBold)
            }
        }
        item { SectionLabel("Ringkasan per kasir") }
        items(rows.groupBy { it.kasir }.toList(), key = { it.first }) { (kasir, kasirRows) ->
            CardBlock {
                Text(kasir, fontWeight = FontWeight.Bold)
                Text(kasirRows.map { branchName(it.branchId) }.distinct().joinToString(), color = Muted, fontSize = 12.sp)
                Text("${rp(store.omzet(kasirRows))} · ${kasirRows.size} transaksi", fontWeight = FontWeight.Black, color = Ink)
            }
        }
        item { SectionLabel("Komisi & layanan per petugas") }
        val handledRows = rows.flatMap { nota ->
            nota.lines.map { line -> Triple(nota, line, (line.qty * line.commissionPerUnit).toInt()) }
        }
        if (handledRows.isEmpty()) item { EmptyHint("Rincian petugas belum tersedia", "Service lama tetap masuk laporan transaksi, tetapi belum memiliki petugas per layanan.") }
        else items(
            handledRows.groupBy { (nota, line, _) -> "${nota.branchId}|${line.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir }}" }.toList(),
            key = { it.first },
        ) { (_, group) ->
            val first = group.first()
            val nota = first.first
            val handler = first.second.handledByName.ifBlank { nota.kasir }
            CardBlock {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text(handler, fontWeight = FontWeight.Bold)
                        Text(branchName(nota.branchId), color = Muted, fontSize = 12.sp)
                    }
                    Chip("Komisi ${rp(group.sumOf { it.third })}", Green)
                }
                group.groupBy { it.second.name }.forEach { (service, serviceRows) ->
                    val qty = serviceRows.sumOf { it.second.qty }
                    val unit = serviceRows.first().second.unit
                    Text("$service · ${if (qty % 1.0 == 0.0) qty.toInt() else qty} $unit · omzet ${rp(serviceRows.sumOf { (it.second.qty * it.second.unitPrice).toInt() })}", color = Ink, fontSize = 13.sp)
                }
                Text("${group.map { it.first.id }.distinct().size} Service ditangani", color = Muted, fontSize = 12.sp)
            }
        }
        item { SectionLabel("Rincian transaksi") }
        if (rows.isEmpty()) item { EmptyHint("Belum ada transaksi", "Tidak ada Service pada cabang dan periode yang dipilih.") }
        else item { TransactionReportTable(rows.sortedByDescending { it.createdAtMs }, ::branchName) { nav.navigate("queue/$it") } }
        item {
            val rangeLabel = if (customRange) "${DisplayDates.date(from)} — ${DisplayDates.date(until)}" else period.replaceFirstChar { it.uppercase() }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrimaryBtn("Export PDF", Modifier.weight(1f), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.PictureAsPdf) { FileExports.shareFinancialPdf(ctx, rows, expenseRows, rangeLabel) }
                GhostBtn("Export CSV", Modifier.weight(1f), enabled = !customRange || !until.isBefore(from), icon = Icons.Outlined.TableView) { FileExports.shareFinancial(ctx, rows, expenseRows) }
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
    val scroll = rememberScrollState()
    CardBlock {
        Text("Geser tabel ke samping untuk melihat seluruh kolom. Ketuk baris untuk membuka Service.", color = Muted, fontSize = 11.sp)
        Column(Modifier.horizontalScroll(scroll).width(1470.dp)) {
            Surface(color = Teal, shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)) {
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp).height(IntrinsicSize.Min)) {
                    ReportCell("No", 44.dp, true)
                    ReportCell("ID Service", 150.dp, true)
                    ReportCell("Waktu masuk", 145.dp, true)
                    ReportCell("Cabang", 130.dp, true)
                    ReportCell("Kasir", 110.dp, true)
                    ReportCell("Pelanggan", 130.dp, true)
                    ReportCell("Layanan ditangani", 190.dp, true)
                    ReportCell("Petugas", 120.dp, true)
                    ReportCell("Komisi", 100.dp, true)
                    ReportCell("Omzet", 100.dp, true)
                    ReportCell("Diterima", 100.dp, true)
                    ReportCell("Status", 145.dp, true)
                }
            }
            rows.forEachIndexed { index, nota ->
                Surface(
                    onClick = { onOpen(nota.id) },
                    color = if (index % 2 == 0) Card else Mist.copy(alpha = .55f),
                    border = BorderStroke(0.5.dp, Line),
                ) {
                    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp).height(IntrinsicSize.Min), verticalAlignment = Alignment.Top) {
                        ReportCell((index + 1).toString(), 44.dp)
                        ReportCell(nota.id, 150.dp)
                        ReportCell(nota.createdAt, 145.dp)
                        ReportCell(branchName(nota.branchId), 130.dp)
                        ReportCell(nota.kasir, 110.dp)
                        ReportCell(nota.customer, 130.dp)
                        ReportCell(nota.lines.joinToString { it.name }, 190.dp)
                        ReportCell(nota.lines.map { it.handledByName.ifBlank { nota.kasir } }.distinct().joinToString(), 120.dp)
                        ReportCell(rp(nota.lines.sumOf { (it.qty * it.commissionPerUnit).toInt() }), 100.dp)
                        ReportCell(rp(nota.total), 100.dp)
                        ReportCell(rp(nota.paid), 100.dp)
                        ReportCell("${nota.pay.label} · ${nota.laundry.label}", 145.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportCell(text: String, width: androidx.compose.ui.unit.Dp, header: Boolean = false) {
    Text(
        text,
        modifier = Modifier.width(width).fillMaxHeight().padding(horizontal = 8.dp, vertical = 8.dp),
        color = if (header) androidx.compose.ui.graphics.Color.White else Ink,
        fontSize = if (header) 11.sp else 10.sp,
        lineHeight = 14.sp,
        fontWeight = if (header) FontWeight.Bold else FontWeight.Normal,
        maxLines = if (header) 3 else 5,
        softWrap = true,
        overflow = androidx.compose.ui.text.style.TextOverflow.Clip,
    )
}

@Composable
internal fun AuditScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Riwayat aktivitas", "Semua transaksi", onBack = { nav.popBackStack() }) }
        item { GhostBtn("Export audit trail", icon = Icons.Outlined.FileDownload) { FileExports.shareAudit(ctx, store.audit.toList()) } }
        items(store.audit) { a ->
            CardBlock(Modifier.clickable { a.notaId?.let { nav.navigate("queue/$it") } }) {
                Text(a.action, fontWeight = FontWeight.Bold)
                Text("${a.at} · ${a.user}", color = Muted, fontSize = 12.sp)
            }
        }
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

@Composable
internal fun ProfilScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    val account = store.staff.firstOrNull { it.email.equals(s.email, true) }
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
                InfoRow(Icons.Outlined.Storefront, "Cabang", store.branch(s.branchId).name)
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
