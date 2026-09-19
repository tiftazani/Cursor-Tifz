package com.cuciin.laundryops.ui

import android.content.Intent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import com.cuciin.laundryops.data.ServiceItem
import com.cuciin.laundryops.ui.components.*
import com.cuciin.laundryops.ui.theme.Mist
import com.cuciin.laundryops.ui.theme.Card
import com.cuciin.laundryops.ui.theme.Line
import java.time.LocalDateTime
import java.time.LocalDate

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.BuildConfig
import com.cuciin.laundryops.data.Clock
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.FileExports
import com.cuciin.laundryops.data.LaundryStatus
import com.cuciin.laundryops.data.Nota
import com.cuciin.laundryops.data.NotaLine
import com.cuciin.laundryops.data.PayMethod
import com.cuciin.laundryops.data.PayStatus
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.data.StockKind
import com.cuciin.laundryops.data.rp
import com.cuciin.laundryops.ui.components.CardBlock
import com.cuciin.laundryops.ui.components.Chip
import com.cuciin.laundryops.ui.components.ChipRow
import com.cuciin.laundryops.ui.components.EmptyHint
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.components.Hero
import com.cuciin.laundryops.ui.components.LaundryChip
import com.cuciin.laundryops.ui.components.PayChip
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.components.SectionLabel
import com.cuciin.laundryops.ui.components.SelectChip
import com.cuciin.laundryops.ui.theme.Amber
import com.cuciin.laundryops.ui.theme.Coral
import com.cuciin.laundryops.ui.theme.Gold
import com.cuciin.laundryops.ui.theme.Green
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Muted
import com.cuciin.laundryops.ui.theme.Teal
import com.cuciin.laundryops.ui.theme.OnPrim

private val store get() = CuciinStore

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun HomeScreen(nav: NavHostController) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    var period by rememberSaveable { mutableStateOf("hari") }
    var customRange by rememberSaveable { mutableStateOf(false) }
    var fromValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(0).withMinute(0))) }
    var untilValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(23).withMinute(59))) }
    var statusFilter by rememberSaveable { mutableStateOf("kerja") }
    var showPeriodSheet by rememberSaveable { mutableStateOf(false) }
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    store.revision.intValue
    val all = store.visibleNotas().map { it.copy() }
    val now = LocalDateTime.now(Clock.ZONE)
    val todayLabel = DisplayDates.date(now)
    val from = DisplayDates.parse(fromValue) ?: now.withHour(0).withMinute(0)
    val until = DisplayDates.parse(untilValue) ?: now.withHour(23).withMinute(59)
    val rangeValid = !until.isBefore(from)

    // Periode menyaring berdasarkan tanggal masuk Service. Rentang sendiri memakai tanggal
    // yang dipilih pengguna, jadi tanggal mana pun bisa dibandingkan tanpa mengubah nota.
    val periodStart = Clock.periodStartMs(period)
    val bid = if (s.role == Role.Owner) store.viewBranch.value else s.branchId
    val scoped = all.filter { nota ->
        val inRange = if (customRange) {
            rangeValid && DisplayDates.isInSelectedMinute(nota.createdAtMs, from, until)
        } else {
            nota.createdAtMs == 0L || nota.createdAtMs >= periodStart
        }
        (bid == "all" || nota.branchId == bid) && inRange
    }
    val working = scoped.filter { it.laundry != LaundryStatus.Selesai }
    // Telat: estimasi selesai sudah lewat, tetapi pengerjaan belum selesai.
    val late = working.filter { DisplayDates.parse(it.pickupAt)?.isBefore(now) == true }
    val done = scoped.filter { it.laundry == LaundryStatus.Selesai }
    val periodLabel = if (customRange) "Rentang sendiri" else when (period) {
        "hari" -> "Hari ini"
        "minggu" -> "7 hari terakhir"
        "bulan" -> "Bulan ini"
        "tahun" -> "Tahun ini"
        else -> "30 hari terakhir"
    }
    val periodDetail = when {
        customRange && rangeValid -> "${DisplayDates.date(from)} sampai ${DisplayDates.date(until)}"
        customRange -> "Waktu akhir harus setelah waktu mulai"
        period == "hari" -> todayLabel
        else -> periodRangeLabel(period, now)
    }

    // Daftar yang tampil mengikuti kartu status yang dipilih.
    val rows = when (statusFilter) {
        "telat" -> late.sortedBy { DisplayDates.parse(it.pickupAt) }
        "selesai" -> done.sortedByDescending { it.createdAtMs }
        else -> working.sortedBy { DisplayDates.parse(it.pickupAt) }
    }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            ScreenHeader("Antrian laundry", todayLabel) { BrandMark() }
        }
        item {
            FilterBarRow(
                left = {
                    FilterBar(label = "Periode", value = periodLabel, detail = periodDetail, icon = Icons.Outlined.CalendarMonth, onClick = { showPeriodSheet = true }, modifier = Modifier.fillMaxWidth())
                },
                right = {
                    FilterBar(label = "Cabang", value = if (bid == "all") "Semua cabang" else store.branch(bid).name.removePrefix("Cuciin "), detail = "${scoped.size} pesanan", icon = Icons.Outlined.Storefront, onClick = { showBranchSheet = true }, modifier = Modifier.fillMaxWidth())
                },
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusCard("Sedang dikerjakan", working.size, Teal, Icons.Outlined.PendingActions, statusFilter == "kerja", Modifier.weight(1f)) { statusFilter = "kerja" }
                StatusCard("Cucian telat", late.size, Coral, Icons.Outlined.Schedule, statusFilter == "telat", Modifier.weight(1f)) { statusFilter = "telat" }
                StatusCard("Selesai", done.size, Green, Icons.Outlined.CheckCircle, statusFilter == "selesai", Modifier.weight(1f)) { statusFilter = "selesai" }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        when (statusFilter) {
                            "telat" -> "Cucian telat"
                            "selesai" -> "Cucian selesai"
                            else -> "Sedang dikerjakan"
                        },
                        fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Ink,
                    )
                    Text("${rows.size} pesanan · $periodLabel", color = Muted, fontSize = 12.sp)
                }
                if (store.canCreateService()) {
                    PrimaryBtn("Service baru", Modifier.width(150.dp), icon = Icons.Outlined.Add) { nav.navigate("nota") }
                }
            }
        }
        item { SyncNotice() }
        if (rows.isEmpty()) item {
            EmptyHint(
                when (statusFilter) {
                    "telat" -> "Tidak ada cucian telat"
                    "selesai" -> "Belum ada cucian selesai"
                    else -> "Tidak ada cucian dikerjakan"
                },
                when (statusFilter) {
                    "telat" -> "Semua pesanan pada periode ini masih dalam estimasi."
                    "selesai" -> "Pesanan yang selesai akan tampil di sini."
                    else -> "Pesanan baru akan muncul setelah Anda membuat nota."
                },
            )
        }
        itemsIndexed(rows, key = { _, nota -> nota.id }) { index, nota ->
            // Baris menyusul masuk satu per satu dengan geser halus, dibatasi sampai 6 baris
            // pertama supaya daftar panjang tidak membuat semua baris beranimasi sekaligus.
            EnterOnce(index = index) {
                QueueRow(nota) { nav.navigate("queue/${nota.id}") }
            }
            RowDivider()
        }
    }
    if (showPeriodSheet) ModalBottomSheet(onDismissRequest = { showPeriodSheet = false }) {
        // Tinggi dibatasi dan isi digulir, jadi tombol Terapkan rentang tetap terjangkau
        // ketika panel tanggal ikut terbuka.
        Column(
            Modifier.fillMaxWidth().heightIn(max = 560.dp).padding(bottom = 24.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text("Pilih periode", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            Text("Tanggal masuk Service dipakai sebagai patokan periode.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp))
            listOf("hari" to "Hari ini", "minggu" to "7 hari terakhir", "bulan" to "Bulan ini", "tahun" to "Tahun ini").forEach { (id, label) ->
                FilterSheetRow(!customRange && period == id, label, if (id == "hari") todayLabel else periodRangeLabel(id, now)) {
                    period = id
                    customRange = false
                    showPeriodSheet = false
                }
            }
            // Rentang tanggal tertentu: dua tanggal dipilih langsung, bukan sekadar periode cepat.
            FilterSheetRow(customRange, "Pilih dua tanggal", if (customRange) periodDetail else "Tentukan tanggal mulai dan sampai") {
                customRange = true
            }
            if (customRange) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    DateTimeFields(from, { fromValue = DisplayDates.encode(it) }, "Mulai")
                    DateTimeFields(until, { untilValue = DisplayDates.encode(it) }, "Sampai")
                    if (!rangeValid) Text("Waktu akhir harus setelah waktu mulai.", color = Coral, fontSize = 12.sp)
                    PrimaryBtn("Terapkan rentang", enabled = rangeValid, icon = Icons.Outlined.Check) { showPeriodSheet = false }
                }
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            if (s.role == Role.Owner) {
                FilterSheetRow(bid == "all", "Semua cabang", "${store.branches.size} cabang") { store.viewBranch.value = "all"; store.touchStatus(); showBranchSheet = false }
                store.branches.forEach { branch ->
                    FilterSheetRow(bid == branch.id, branch.name, "${all.count { it.branchId == branch.id }} pesanan") { store.viewBranch.value = branch.id; store.touchStatus(); showBranchSheet = false }
                }
            } else {
                FilterSheetRow(true, store.branch(bid).name, "Cabang tugas Anda") { showBranchSheet = false }
            }
        }
    }
}

/** Kartu status di bawah filter: satu ketukan menyaring daftar di bawahnya. */
@Composable
private fun StatusCard(label: String, count: Int, tint: Color, icon: ImageVector, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    val source = remember { MutableInteractionSource() }
    // Angka menghitung naik saat berubah, jadi perubahan jumlah terlihat, bukan melompat.
    val shown by animateIntAsState(count, tween(Motion.ms(420), easing = Motion.easing), label = "jumlah kartu")
    // Warna latar dan garis ikut berubah lembut saat kartu dipilih.
    val bg by animateColorAsState(if (selected) tint.copy(alpha = .12f) else Card, tween(Motion.ms(180)), label = "latar kartu")
    val stroke by animateColorAsState(if (selected) tint else Line, tween(Motion.ms(180)), label = "garis kartu")
    val strokeWidth by animateFloatAsState(if (selected) 2f else 1f, tween(Motion.ms(180)), label = "tebal garis")
    Surface(
        onClick = { tap(); onClick() },
        interactionSource = source,
        modifier = modifier.heightIn(min = 84.dp).pressScale(source, 0.97f).semantics { this.selected = selected },
        shape = RoundedCornerShape(20.dp),
        color = bg,
        border = BorderStroke(strokeWidth.dp, stroke),
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(20.dp))
            Text(shown.toString(), color = Ink, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            Text(label, color = Muted, fontSize = 11.sp, lineHeight = 14.sp, maxLines = 2)
        }
    }
}

@Composable
private fun SummaryTile(label: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    Surface(onClick = { tap(); onClick() }, modifier = modifier.semantics { this.selected = selected }, shape = RoundedCornerShape(20.dp), color = if (selected) Teal else Card, border = BorderStroke(1.dp, if (selected) Teal else Line)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(value, color = if (selected) OnPrim else Ink, fontWeight = FontWeight.Bold, fontSize = 30.sp)
                Icon(icon, null, tint = if (selected) OnPrim.copy(alpha = .8f) else Teal, modifier = Modifier.size(24.dp))
            }
            Text(label, color = if (selected) OnPrim else Muted, fontSize = 12.sp, lineHeight = 17.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun QueueRow(nota: Nota, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    Surface(onClick = { tap(); onClick() }, color = Card, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AvatarMark(nota.customer)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(nota.customer, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(nota.items, color = Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${nota.id} · ${nota.pickupAt}", color = Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(rp(nota.total), color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                PayChip(nota.pay)
                Text(nota.laundry.label, color = if (nota.laundry == LaundryStatus.Selesai) Green else Teal, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
        }
    }
}

private fun quantity(qty: Double): String = if (qty % 1.0 == 0.0) qty.toInt().toString() else qty.toString().replace('.', ',')

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NotaScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    val tap = rememberTapFeedback()
    val allowedBranches = if (s.role == Role.Owner) store.branches.toList() else store.branches.filter { it.id == s.branchId }
    val defaultBranchId = if (s.role == Role.Owner && store.viewBranch.value != "all") store.viewBranch.value else s.branchId
    val selectedBranchId = store.notaBranchId.value?.takeIf { id -> allowedBranches.any { it.id == id } } ?: defaultBranchId
    LaunchedEffect(selectedBranchId) { if (store.notaBranchId.value != selectedBranchId) store.notaBranchId.value = selectedBranchId }
    store.revision.intValue
    val cart = store.cart.map { it.copy() }
    val cust = store.selectedCustomer.value
    var feedback by rememberSaveable { mutableStateOf("") }
    var selectedCategory by rememberSaveable { mutableStateOf("laundry") }
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    var serviceMenuOpen by remember { mutableStateOf(false) }
    var selectedServiceId by rememberSaveable { mutableStateOf("") }
    val total = cart.sumOf { (it.qty * it.unitPrice).toInt() }
    Column(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.weight(1f).padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
            item { ScreenHeader("Service baru", store.branch(selectedBranchId).name, onBack = { nav.popBackStack() }) }
            item { StepProgress(if (cust == null) 0 else 1) }
            if (s.role == Role.Owner) item {
                FilterBar(
                    label = "Cabang transaksi",
                    value = store.branch(selectedBranchId).name,
                    detail = "Service, stok retail, dan pesan WhatsApp mengikuti cabang ini.",
                    icon = Icons.Outlined.Storefront,
                    onClick = { showBranchSheet = true },
                )
            }
            item {
                Surface(onClick = { tap(); nav.navigate("customers") }, shape = RoundedCornerShape(18.dp), color = Card, border = BorderStroke(1.dp, if (cust == null) Line else Teal.copy(alpha = .3f))) {
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.Outlined.PersonOutline, null, tint = Teal, modifier = Modifier.size(26.dp))
                        Column(Modifier.weight(1f)) {
                            Text(cust?.name ?: "Pilih pelanggan", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Text(cust?.phone ?: "Tambahkan kontak untuk Service ini", color = Muted, fontSize = 12.sp)
                        }
                        Icon(if (cust == null) Icons.Outlined.Add else Icons.Outlined.Edit, "${if (cust == null) "Pilih" else "Ganti"} pelanggan", tint = Teal, modifier = Modifier.size(20.dp))
                    }
                }
            }
            item {
                SectionLabel("Pilih layanan")
                Text("Pilih jenis dan layanan dari filter, lalu atur jumlah serta harga transaksi.", color = Muted, fontSize = 12.sp)
                ChipRow {
                    SelectChip(selectedCategory == "laundry", "Full service") { selectedCategory = "laundry"; selectedServiceId = "" }
                    SelectChip(selectedCategory == "self", "Self-service") { selectedCategory = "self"; selectedServiceId = "" }
                    SelectChip(selectedCategory == "produk", "Produk") { selectedCategory = "produk"; selectedServiceId = "" }
                }
            }
            val services = store.services.filter {
                when (selectedCategory) {
                    "self" -> it.selfService
                    "produk" -> it.retail
                    else -> !it.retail && !it.selfService
                }
            }
            if (services.isEmpty()) item { EmptyHint("Layanan belum tersedia", "Owner dapat menambahkan layanan melalui menu Kelola.") }
            else item {
                val selected = services.firstOrNull { it.id == selectedServiceId }
                Box {
                    GhostBtn(selected?.let { "${it.name} · ${rp(it.price)} / ${it.unit}" } ?: "Pilih layanan", icon = Icons.Outlined.ArrowDropDown) { serviceMenuOpen = true }
                    DropdownMenu(expanded = serviceMenuOpen, onDismissRequest = { serviceMenuOpen = false }, modifier = Modifier.fillMaxWidth(.88f)) {
                        services.forEach { service ->
                            DropdownMenuItem(
                                text = { Column { Text(service.name, fontWeight = FontWeight.Bold); Text("${rp(service.price)} / ${service.unit}", color = Muted, fontSize = 12.sp) } },
                                onClick = { selectedServiceId = service.id; serviceMenuOpen = false },
                                leadingIcon = { Icon(serviceIcon(service), null) },
                            )
                        }
                    }
                }
            }
            items(services.filter { selected -> selected.id == selectedServiceId && cart.none { it.service.id == selected.id } }, key = { it.id }) { svc ->
                ServiceTile(svc, 0.0, svc.price, bolehUbahHarga = false, onAdd = {
                    tap(); store.addToCart(svc)
                    val added = store.cart.find { it.service.id == svc.id }?.qty ?: 0.0
                    feedback = "${svc.name} ditambahkan · ${quantity(added)} ${svc.unit}"
                }, onChange = {}, onPriceChange = {}, onRemove = {})
            }
            if (cart.isNotEmpty()) item {
                SectionLabel("Daftar Service dipilih")
                Text("Jumlah, harga per satuan, dan layanan dapat dikoreksi sebelum pembayaran.", color = Muted, fontSize = 12.sp)
            }
            items(cart, key = { it.service.id }) { line ->
                ServiceTile(line.service, line.qty, line.unitPrice, bolehUbahHarga = store.canChangePrice(), onAdd = {
                    tap(); store.addToCart(line.service)
                    feedback = "Jumlah ${line.service.name} ditambah"
                }, onChange = { target ->
                    tap(); store.cartDelta(line.service.id, target - line.qty)
                    feedback = "Jumlah ${line.service.name} diperbarui"
                }, onPriceChange = { price ->
                    tap()
                    feedback = if (store.setCartPrice(line.service.id, price)) {
                        "Harga ${line.service.name} menjadi ${rp(price)} / ${line.service.unit}"
                    } else {
                        "Hanya Owner yang dapat mengubah harga"
                    }
                }, onRemove = {
                    tap(); store.cartDelta(line.service.id, -line.qty)
                    feedback = "${line.service.name} dihapus dari Service"
                })
            }
        }
        val next = {
            if (cust == null) { toast("Pilih pelanggan untuk melanjutkan"); nav.navigate("customers") } else nav.navigate("preview")
        }
        Surface(shadowElevation = 10.dp, color = Card) {
            Column(Modifier.fillMaxWidth().padding(horizontal = ui.pad, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val shortScreen = ui.heightDp < 500
                if (feedback.isNotBlank() && !shortScreen) FeedbackBanner(feedback)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(if (shortScreen && feedback.isNotBlank()) feedback else "${cart.size} layanan dipilih", color = Muted, fontSize = 12.sp)
                        AnimatedContent(targetState = total, label = "total nota") { amount -> Text(rp(amount), fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink) }
                    }
                    if (shortScreen) PrimaryBtn("Periksa Service", Modifier.weight(1f), enabled = cart.isNotEmpty(), onClick = next)
                    else Icon(Icons.AutoMirrored.Outlined.ReceiptLong, null, tint = Teal, modifier = Modifier.size(28.dp))
                }
                if (!shortScreen) PrimaryBtn("Periksa Service", enabled = cart.isNotEmpty(), icon = Icons.AutoMirrored.Filled.ArrowForward, onClick = next)
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang transaksi", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Pilih satu cabang. Layanan, stok retail, dan pesan WhatsApp mengikuti cabang ini.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            allowedBranches.forEach { branch ->
                FilterSheetRow(selectedBranchId == branch.id, branch.name.removePrefix("Cuciin "), branch.code) {
                    store.notaBranchId.value = branch.id
                    showBranchSheet = false
                }
            }
        }
    }
}

private fun serviceIcon(service: ServiceItem): ImageVector {
    val label = "${service.id} ${service.name}".lowercase()
    return when {
        service.retail -> Icons.Outlined.Inventory2
        service.selfService -> Icons.Outlined.LocalLaundryService
        "setrika" in label || "iron" in label -> Icons.Outlined.Iron
        "dry" in label || "kering" in label || "curing" in label -> Icons.Outlined.DryCleaning
        "karpet" in label -> Icons.Outlined.Texture
        "kasur" in label -> Icons.Outlined.Bed
        "sepatu" in label || "tas" in label -> Icons.Outlined.Checkroom
        "lipat" in label -> Icons.Outlined.Checkroom
        else -> Icons.Outlined.LocalLaundryService
    }
}

@Composable
private fun ServiceTile(svc: ServiceItem, qty: Double, unitPrice: Int, bolehUbahHarga: Boolean, onAdd: () -> Unit, onChange: (Double) -> Unit, onPriceChange: (Int) -> Unit, onRemove: () -> Unit) {
    var editingQty by remember { mutableStateOf(false) }
    var editingPrice by remember { mutableStateOf(false) }
    var value by remember { mutableStateOf("") }
    var priceValue by remember { mutableStateOf("") }
    val border by animateColorAsState(if (qty > 0) Teal.copy(alpha = .5f) else Line, label = "layanan dipilih")
    Surface(shape = RoundedCornerShape(18.dp), color = Card, border = BorderStroke(1.dp, border), modifier = Modifier.fillMaxWidth().animateContentSize()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Surface(shape = RoundedCornerShape(13.dp), color = Mist) { Icon(serviceIcon(svc), null, tint = Teal, modifier = Modifier.padding(10.dp).size(24.dp)) }
                Column(Modifier.weight(1f)) {
                    Text(svc.name, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text("${rp(unitPrice)} / ${svc.unit}${if (unitPrice != svc.price) " · harga Service" else ""}", color = Muted, fontSize = 12.sp)
                }
            }
            if (qty == 0.0) GhostBtn("Tambah", icon = Icons.Outlined.Add, onClick = onAdd)
            else {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilledTonalIconButton(onClick = { onChange((qty - 1).coerceAtLeast(0.0)) }, modifier = Modifier.size(48.dp)) { Icon(Icons.Outlined.Remove, "Kurangi jumlah ${svc.name}", tint = Teal) }
                    TextButton(onClick = { value = quantity(qty); editingQty = true }, contentPadding = PaddingValues(4.dp), modifier = Modifier.weight(1f).heightIn(min = 48.dp).semantics { contentDescription = "Ubah jumlah ${svc.name}" }) {
                        Text("${quantity(qty)} ${svc.unit}", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                    FilledIconButton(onClick = onAdd, modifier = Modifier.size(48.dp), colors = IconButtonDefaults.filledIconButtonColors(containerColor = Teal)) { Icon(Icons.Outlined.Add, "Tambah jumlah ${svc.name}") }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Tombol ubah harga hanya muncul bila pengguna memang berhak. Menyembunyikan
                    // tombol saja tidak cukup sebagai pengaman; store tetap menolaknya.
                    if (bolehUbahHarga) {
                        GhostBtn("Ubah harga · ${rp(unitPrice)}", Modifier.weight(1f), icon = Icons.Outlined.Edit) {
                            priceValue = unitPrice.toString(); editingPrice = true
                        }
                    }
                    TextButton(onClick = onRemove, modifier = Modifier.heightIn(min = 50.dp)) {
                        Icon(Icons.Outlined.DeleteOutline, null, tint = Coral)
                        Spacer(Modifier.width(6.dp))
                        Text("Hapus", color = Coral, fontWeight = FontWeight.SemiBold)
                    }
                }
                Text("Subtotal ${rp((qty * unitPrice).toInt())}", color = Teal, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
    }
    if (editingQty) {
        val parsed = value.replace(',', '.').toDoubleOrNull()
        val valid = parsed != null && parsed.isFinite() && parsed > 0 && parsed <= 9999 && (svc.unit == "kg" || parsed % 1.0 == 0.0)
        AlertDialog(onDismissRequest = { editingQty = false }, title = { Text("Jumlah ${svc.name}") }, text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value, { value = it }, label = { Text("Jumlah (${svc.unit})") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                Text(if (svc.unit == "kg") "Boleh desimal, misalnya 2,5 kg." else "Gunakan jumlah satuan utuh.", fontSize = 12.sp, color = Muted)
            }
        }, confirmButton = { TextButton(enabled = valid, onClick = { onChange(parsed!!); editingQty = false }) { Text("Simpan jumlah") } }, dismissButton = { TextButton(onClick = { editingQty = false }) { Text("Batal") } })
    }
    if (editingPrice && bolehUbahHarga) {
        val parsed = priceValue.toIntOrNull()
        AlertDialog(onDismissRequest = { editingPrice = false }, title = { Text("Harga ${svc.name}") }, text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(priceValue, { priceValue = it.filter(Char::isDigit).take(9) }, label = { Text("Harga per ${svc.unit}") }, prefix = { Text("Rp ") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                Text("Perubahan hanya berlaku untuk Service ini dan otomatis tercatat di riwayat aktivitas.", color = Muted, fontSize = 12.sp)
            }
        }, confirmButton = { TextButton(enabled = parsed != null && parsed >= 0, onClick = { onPriceChange(parsed!!); editingPrice = false }) { Text("Gunakan harga") } }, dismissButton = { TextButton(onClick = { editingPrice = false }) { Text("Batal") } })
    }
}

@Composable
private fun HandlerPicker(
    branchId: String,
    selectedEmail: String,
    selectedName: String,
    commissionPerUnit: Int,
    unit: String,
    onSelected: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val candidates = store.staff.filter { it.approved && branchId in it.branchIds }
    Box {
        GhostBtn(
            text = "Ditangani: ${selectedName.ifBlank { "Pilih petugas" }}",
            icon = Icons.Outlined.Badge,
        ) { open = true }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            candidates.forEach { person ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(person.name, fontWeight = FontWeight.Bold)
                            Text("${if (person.role == Role.Supervisor) "SPV" else person.role.name} · ${person.email}", color = Muted, fontSize = 11.sp)
                        }
                    },
                    onClick = { onSelected(person.email); open = false },
                    leadingIcon = { Icon(Icons.Outlined.PersonOutline, null) },
                )
            }
        }
    }
    if (commissionPerUnit > 0) {
        Text("Komisi ${rp(commissionPerUnit)} / $unit untuk petugas terpilih", color = Green, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
internal fun PreviewScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val tap = rememberTapFeedback()
    store.revision.intValue
    val cart = store.cart.map { it.copy() }
    val customer = store.selectedCustomer.value
    val session = store.session.value ?: return
    val branchId = store.notaBranchId.value
        ?.takeIf { session.role == Role.Owner || it == session.branchId }
        ?: session.branchId
    val total = cart.sumOf { (it.qty * it.unitPrice).toInt() }
    var feedback by rememberSaveable { mutableStateOf("") }
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader("Periksa Service", store.branch(branchId).name, onBack = { nav.popBackStack() }) }
        item { StepProgress(2) }
        item {
            CardBlock(accent = Teal) {
                SectionLabel("Data pelanggan")
                InfoRow(Icons.Outlined.PersonOutline, "Pelanggan", customer?.name ?: "Belum dipilih")
                InfoRow(Icons.Outlined.Phone, "WhatsApp", customer?.phone ?: "Belum diisi")
                Text("Periksa layanan, jumlah, dan harga sebelum masuk ke pembayaran.", color = Muted, fontSize = 12.sp)
            }
        }
        if (feedback.isNotBlank()) item { FeedbackBanner(feedback) }
        item { SectionLabel("Rincian Service") }
        items(cart, key = { it.service.id }) { line ->
            ServiceTile(line.service, line.qty, line.unitPrice, bolehUbahHarga = store.canChangePrice(), onAdd = {
                tap(); store.addToCart(line.service); feedback = "Jumlah ${line.service.name} ditambah"
            }, onChange = { target ->
                tap(); store.cartDelta(line.service.id, target - line.qty); feedback = "Jumlah ${line.service.name} diperbarui"
            }, onPriceChange = { price ->
                tap()
                feedback = if (store.setCartPrice(line.service.id, price)) {
                    "Harga ${line.service.name} diperbarui"
                } else {
                    "Hanya Owner yang dapat mengubah harga"
                }
            }, onRemove = {
                tap(); store.cartDelta(line.service.id, -line.qty); feedback = "${line.service.name} dihapus dari Service"
            })
            if (session.role == Role.Owner) {
                HandlerPicker(
                    branchId = branchId,
                    selectedEmail = line.handledByEmail,
                    selectedName = line.handledByName,
                    commissionPerUnit = line.service.commissionPerUnit,
                    unit = line.service.unit,
                ) { email ->
                    tap(); store.setCartHandler(line.service.id, email)
                    feedback = "Petugas ${line.service.name} diperbarui"
                }
            } else {
                InfoRow(Icons.Outlined.Badge, "Ditangani oleh", session.name)
                Text("Petugas mengikuti akun yang sedang masuk.", color = Muted, fontSize = 12.sp)
            }
        }
        if (cart.isEmpty()) item { EmptyHint("Belum ada layanan", "Kembali dan tambahkan minimal satu layanan.") }
        item { Hero("Total Service", rp(total), listOf("${cart.size} layanan", store.branch(branchId).name)) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GhostBtn("Koreksi lagi", Modifier.weight(1f), icon = Icons.Outlined.Edit) { nav.popBackStack() }
                PrimaryBtn("Lanjut bayar", Modifier.weight(1f), enabled = cart.isNotEmpty() && customer != null, icon = Icons.AutoMirrored.Filled.ArrowForward) {
                    if (customer == null) toast("Pelanggan belum dipilih") else nav.navigate("bayar")
                }
            }
        }
    }
}

@Composable
internal fun BayarScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var pickupValue by rememberSaveable { mutableStateOf(Clock.defaultPickup()) }
    val pickup = DisplayDates.parse(pickupValue) ?: LocalDateTime.now(Clock.ZONE).plusDays(1)
    var paidText by rememberSaveable { mutableStateOf("") }
    val paid = paidText.toIntOrNull() ?: 0
    var method by rememberSaveable { mutableStateOf(PayMethod.Tunai) }
    var saving by remember { mutableStateOf(false) }
    val cust = store.selectedCustomer.value
    val s = store.session.value ?: return
    val branchId = store.notaBranchId.value
        ?.takeIf { id -> s.role == Role.Owner || id == s.branchId }
        ?: s.branchId
    val cart = store.cart.map { it.copy() }
    val total = cart.sumOf { (it.qty * it.unitPrice).toInt() }.coerceAtLeast(0)
    val stockShortages = store.retailStockShortages(cart, branchId)
    val ctx = LocalContext.current
    fun save(openWa: Boolean) {
        if (saving) return
        if (cust == null || cart.isEmpty()) { toast("Pelanggan dan layanan wajib diisi"); return }
        if (pickup.isBefore(LocalDateTime.now(Clock.ZONE))) { toast("Pilih janji selesai setelah waktu sekarang"); return }
        if (paid > total) { toast("Pembayaran melebihi total pesanan"); return }
        if (stockShortages.isNotEmpty()) { toast("Stok cabang tidak cukup: ${stockShortages.first()}"); return }
        // Semua penolakan lain (izin, cabang, jumlah, stok, batas bayar) diperiksa lewat satu
        // pintu yang sama dengan yang dipakai saveNota, supaya tidak ada lagi jalur yang
        // mematikan aplikasi alih-alih menampilkan pesan.
        store.notaReject(cart, paid, branchId)?.let { toast(it); return }
        saving = true
        val n = store.saveNota(cust, cart, paid, pickupValue, method, branchId, sendWa = false)
        if (openWa) {
            try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${store.waMe(n.phone)}?text=${Uri.encode(store.notaText(n))}"))); store.markWaSent(n.id)?.let(toast) }
            catch (_: android.content.ActivityNotFoundException) { toast("Service tersimpan. WhatsApp belum tersedia.") }
        } else toast("Service ${n.id} berhasil disimpan")
        nav.navigate("queue/${n.id}") { popUpTo("home") }
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Pembayaran & simpan", store.branch(branchId).name, onBack = { nav.popBackStack() }) }
        item { StepProgress(3) }
        item {
            CardBlock {
                InfoRow(Icons.Outlined.PersonOutline, "Pelanggan", cust?.name ?: "Belum dipilih")
                ListDivider()
                cart.forEach { line ->
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column(Modifier.weight(1f)) { Text(line.service.name, fontWeight = FontWeight.Medium); Text("${quantity(line.qty)} ${line.service.unit}", fontSize = 12.sp, color = Muted) }
                        Text("${rp((line.qty * line.unitPrice).toInt())}\n${rp(line.unitPrice)} / ${line.service.unit}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, textAlign = TextAlign.End)
                    }
                }
                ListDivider()
                Text("Total ${rp(total)}", fontSize = 23.sp, fontWeight = FontWeight.Bold, color = Teal)
            }
        }
        item { CardBlock { SectionLabel("Estimasi waktu selesai"); DateTimeFields(pickup, { pickupValue = DisplayDates.encode(it) }, "Pilih tanggal dan jam selesai") } }
        if (stockShortages.isNotEmpty()) item {
            CardBlock(accent = Coral) {
                SectionLabel("Stok cabang belum cukup")
                stockShortages.forEach { Text(it, color = Coral, fontSize = 13.sp) }
                Text("Perbarui stok ${store.branch(branchId).name} sebelum menyimpan Service.", color = Muted, fontSize = 12.sp)
            }
        }
        item {
            CardBlock {
                SectionLabel("Pembayaran")
                ChipRow { SelectChip(paid == 0, "Bayar nanti") { paidText = "" }; SelectChip(paid == total && total > 0, "Lunas") { paidText = total.toString() } }
                Field(paidText, { paidText = it.filter(Char::isDigit).take(9) }, "Nominal diterima (Rp)", number = true)
                Text(if (paid > total) "Nominal melebihi total pesanan." else "Sisa tagihan ${rp((total - paid).coerceAtLeast(0))}", color = if (paid > total) Coral else Muted, fontSize = 12.sp)
                ChipRow { PayMethod.entries.forEach { SelectChip(method == it, it.label) { method = it } } }
            }
        }
        item { PrimaryBtn(if (saving) "Menyimpan…" else "Simpan Service", enabled = !saving && cart.isNotEmpty() && paid <= total && stockShortages.isEmpty(), icon = Icons.Outlined.CheckCircle) { save(false) } }
        item { GhostBtn("Simpan & buka WhatsApp", enabled = !saving && cart.isNotEmpty() && paid <= total && stockShortages.isEmpty(), icon = Icons.Outlined.Send) { save(true) } }
    }
}

@Composable
internal fun QueueEditScreen(nav: NavHostController, id: String, toast: (String) -> Unit) {
    val ui = rememberUi()
    val nota = store.notas.firstOrNull { it.id == id } ?: return
    val session = store.session.value ?: return
    var draft by remember(id) { mutableStateOf(nota.lines) }
    val total = draft.sumOf { (it.qty * it.unitPrice).toInt() }
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader("Koreksi Service", id, onBack = { nav.popBackStack() }) }
        item {
            CardBlock(accent = Amber) {
                SectionLabel("Perubahan tercatat")
                Text("Koreksi jumlah, harga, dan penghapusan layanan masuk ke audit trail. Stok barang jual di ${store.branch(nota.branchId).name} ikut disesuaikan.", color = Muted, fontSize = 12.sp)
            }
        }
        if (draft.isEmpty()) item {
            EmptyHint("Rincian lama tidak tersedia", "Service ini dibuat sebelum rincian per layanan disimpan. Service masih dapat dihapus dari halaman detail.")
        }
        items(draft, key = { it.serviceId }) { line ->
            val service = store.services.firstOrNull { it.id == line.serviceId }
                ?: ServiceItem(line.serviceId, line.name, line.unit, line.unitPrice, retail = false, dropOut = nota.dropOut)
            ServiceTile(service, line.qty, line.unitPrice, bolehUbahHarga = store.canChangePrice(), onAdd = {
                draft = draft.map { if (it.serviceId == line.serviceId) it.copy(qty = it.qty + 1.0) else it }
            }, onChange = { qty ->
                draft = draft.map { if (it.serviceId == line.serviceId) it.copy(qty = qty) else it }.filter { it.qty > 0.0 }
            }, onPriceChange = { price ->
                // Koreksi harga pada nota yang sudah dibuat juga dijaga izinnya. Tanpa ini,
                // kasir bisa mengubah harga lewat jalur koreksi walau tombolnya disembunyikan
                // di jalur pembuatan Service baru.
                if (store.canChangePrice()) {
                    draft = draft.map { if (it.serviceId == line.serviceId) it.copy(unitPrice = price) else it }
                }
            }, onRemove = {
                draft = draft.filterNot { it.serviceId == line.serviceId }
            })
            if (session.role == Role.Owner) {
                HandlerPicker(
                    branchId = nota.branchId,
                    selectedEmail = line.handledByEmail.ifBlank { nota.kasirEmail },
                    selectedName = line.handledByName.ifBlank { nota.kasir },
                    commissionPerUnit = line.commissionPerUnit,
                    unit = line.unit,
                ) { email ->
                    val person = store.staff.firstOrNull { it.email.equals(email, true) }
                    if (person != null) draft = draft.map {
                        if (it.serviceId == line.serviceId) it.copy(handledByEmail = person.email, handledByName = person.name) else it
                    }
                }
            } else {
                InfoRow(Icons.Outlined.Badge, "Ditangani oleh", session.name)
            }
        }
        item { Hero("Total setelah koreksi", rp(total), listOf("${draft.size} layanan", nota.customer)) }
        item {
            PrimaryBtn("Simpan koreksi", enabled = draft.isNotEmpty(), icon = Icons.Outlined.Save) {
                val error = store.updateNotaLines(id, draft)
                if (error == null) {
                    toast("Koreksi Service tersimpan dan masuk audit trail")
                    nav.popBackStack()
                } else toast(error)
            }
        }
    }
}

@Composable
internal fun QueueDetailScreen(nav: NavHostController, id: String, toast: (String) -> Unit) {
    val ui = rememberUi()
    store.revision.intValue
    val n = store.notas.find { it.id == id }?.let { it.copy(photos = it.photos.toMutableList()) } ?: return
    val ctx = LocalContext.current
    var finishConfirm by remember { mutableStateOf(false) }
    var paidConfirm by remember { mutableStateOf(false) }
    var handoverConfirm by remember { mutableStateOf(false) }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) toast(if (store.addLocalProof(id, uri) != null) "Bukti tersimpan di perangkat" else "Bukti belum berhasil disimpan")
    }
    val s = store.session.value
    val done = n.laundry == LaundryStatus.Selesai
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Detail Service", n.id, onBack = { nav.popBackStack() }) }
        item {
            Surface(color = if (done) Green.copy(alpha = .08f) else Mist, shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(if (done) Icons.Outlined.CheckCircle else Icons.Outlined.LocalLaundryService, null, tint = if (done) Green else Teal, modifier = Modifier.size(32.dp))
                    Text(n.laundry.label, color = if (done) Green else Teal, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    Text(if (done) "Cucian telah selesai ditangani." else "Service masuk antrian dan akan dikerjakan.", color = Muted, fontSize = 13.sp)
                    if (!done) PrimaryBtn("Tandai selesai", icon = Icons.Outlined.Check) { finishConfirm = true }
                }
            }
        }
        item {
            CardBlock {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AvatarMark(n.customer)
                    Column { Text(n.customer, fontWeight = FontWeight.Bold, fontSize = 18.sp); Text(n.phone, color = Muted, fontSize = 13.sp) }
                }
                ListDivider()
                Text(n.items, color = Ink, fontSize = 14.sp)
                InfoRow(Icons.Outlined.CalendarMonth, "Waktu Masuk", n.createdAt)
                InfoRow(Icons.Outlined.Schedule, "Estimasi Waktu Keluar", n.pickupAt)
                InfoRow(Icons.Outlined.LocalLaundryService, "Status Pengerjaan", n.laundry.label)
                if (n.completedAt != null) InfoRow(Icons.Outlined.CheckCircle, "Pengerjaan selesai pada", n.completedAt!!)
                if (n.pickedUpAt != null) InfoRow(Icons.Outlined.Handshake, "Service ditutup", n.pickedUpAt!!)
                InfoRow(Icons.Outlined.Storefront, "Cabang", store.branch(n.branchId).name)
                InfoRow(Icons.Outlined.Schedule, "Diterima oleh ${n.kasir}", n.createdAt)
            }
        }
        item {
            CardBlock {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Pembayaran", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    PayChip(n.pay)
                }
                Text(rp(n.total), fontWeight = FontWeight.Bold, fontSize = 28.sp)
                Text("${n.payMethod.label} · diterima ${rp(n.paid)}", color = Muted, fontSize = 13.sp)
                if (n.pay != PayStatus.Lunas) {
                    Text("Sisa tagihan ${rp((n.total - n.paid).coerceAtLeast(0))}", color = Amber, fontWeight = FontWeight.SemiBold)
                    if (store.canTakePayment()) GhostBtn("Catat pelunasan", icon = Icons.Outlined.Payments) { paidConfirm = true }
                }
            }
        }
        if (done) item {
            CardBlock {
                SectionLabel("Serah terima pelanggan")
                if (n.pickedUpAt != null) {
                    FeedbackBanner("Sudah diserahkan · ${n.pickedUpAt}")
                } else {
                    Text(
                        if (n.pay == PayStatus.Lunas) "Pesanan siap diserahkan kepada pelanggan."
                        else "Selesaikan pembayaran sebelum mencatat serah terima.",
                        color = Muted,
                        fontSize = 13.sp,
                    )
                    PrimaryBtn("Tutup Service · sudah diambil", enabled = n.pay == PayStatus.Lunas, icon = Icons.Outlined.Handshake) {
                        handoverConfirm = true
                    }
                }
            }
        }
        item {
            CardBlock {
                SectionLabel("Bukti cucian")
                if (n.photos.isEmpty()) Text("Belum ada foto bukti untuk nota ini.", color = Muted, fontSize = 13.sp)
                n.photos.forEach { InfoRow(Icons.Outlined.Image, "Bukti di perangkat", it.substringAfterLast('/')) }
                if (store.canTakePayment()) GhostBtn("Tambah foto dari galeri", icon = Icons.Outlined.AddPhotoAlternate) { pick.launch("image/*") }
            }
        }
        if (store.canAccess("service", "service.correct")) {
            item {
                CardBlock {
                    SectionLabel("Koreksi Service")
                    if (n.waSent && s?.role != Role.Owner) {
                        Text("Service sudah dikirim ke pelanggan. Hanya Owner yang dapat mengoreksi atau menghapusnya.", color = Muted, fontSize = 12.sp)
                    } else {
                        Text("Ubah layanan, jumlah, atau harga. Semua perubahan tercatat di audit trail.", color = Muted, fontSize = 12.sp)
                        GhostBtn("Edit rincian Service", enabled = n.lines.isNotEmpty(), icon = Icons.Outlined.Edit) { nav.navigate("queueEdit/$id") }
                        DangerBtn("Hapus Service") {
                            store.deleteNota(id)?.let(toast) ?: run {
                                toast("Service $id dihapus")
                                nav.navigate("home") { popUpTo("home") { inclusive = true } }
                            }
                        }
                    }
                }
            }
            item {
                CardBlock {
                    SectionLabel("Bagikan nota")
                    PrimaryBtn(if (n.waSent) "Buka kembali WhatsApp" else "Kirim melalui WhatsApp", icon = Icons.Outlined.Send) {
                        try {
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${store.waMe(n.phone)}?text=${Uri.encode(store.notaText(n))}")))
                            store.markWaSent(id)?.let { toast(it) } ?: toast("WhatsApp dibuka untuk nota ini")
                        } catch (_: android.content.ActivityNotFoundException) { toast("WhatsApp belum tersedia di perangkat ini") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        GhostBtn("Teks", Modifier.weight(1f)) { FileExports.shareText(ctx, store.notaText(n)) }
                        GhostBtn("Excel", Modifier.weight(1f)) { FileExports.shareCsv(ctx, n) }
                        GhostBtn("PDF", Modifier.weight(1f)) { FileExports.sharePdf(ctx, n) }
                    }
                }
            }
        }
    }
    if (finishConfirm) AlertDialog(onDismissRequest = { finishConfirm = false }, icon = { Icon(Icons.Outlined.CheckCircle, null, tint = Teal) }, title = { Text(if (n.laundry == LaundryStatus.Masuk) "Mulai pengerjaan?" else "Selesaikan pesanan?") }, text = { Text(if (n.laundry == LaundryStatus.Masuk) "Status akan berubah menjadi sedang dikerjakan." else "Pastikan cucian ${n.customer} sudah selesai ditangani. Status pembayaran tetap dicatat terpisah.") }, confirmButton = { TextButton(onClick = { finishConfirm = false; store.advanceLaundry(id)?.let(toast) ?: toast(if (n.laundry == LaundryStatus.Masuk) "Pengerjaan dimulai" else "Pesanan ditandai selesai") }) { Text(if (n.laundry == LaundryStatus.Masuk) "Mulai" else "Ya, selesai") } }, dismissButton = { TextButton(onClick = { finishConfirm = false }) { Text("Kembali") } })
    if (paidConfirm) AlertDialog(onDismissRequest = { paidConfirm = false }, title = { Text("Catat pelunasan?") }, text = { Text("Pastikan sisa ${rp((n.total - n.paid).coerceAtLeast(0))} telah diterima melalui ${n.payMethod.label}.") }, confirmButton = { TextButton(onClick = { paidConfirm = false; store.markLunas(id, n.payMethod)?.let(toast) ?: toast("Pembayaran tercatat lunas") }) { Text("Sudah diterima") } }, dismissButton = { TextButton(onClick = { paidConfirm = false }) { Text("Kembali") } })
    if (handoverConfirm) AlertDialog(onDismissRequest = { handoverConfirm = false }, title = { Text("Tutup Service ini?") }, text = { Text("Tutup Service hanya setelah cucian diterima pelanggan. Waktu penutupan disimpan di sistem dan tidak dicetak pada nota.") }, confirmButton = { TextButton(onClick = { handoverConfirm = false; store.markPickedUp(id)?.let(toast) ?: toast("Service berhasil ditutup") }) { Text("Ya, tutup Service") } }, dismissButton = { TextButton(onClick = { handoverConfirm = false }) { Text("Kembali") } })
}

@Composable
internal fun WaListScreen(nav: NavHostController, archive: Boolean) {
    val ui = rememberUi()
    val rows = store.visibleNotas().filter { it.waSent == archive }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader(if (archive) "Arsip WA" else "WA menunggu", if (archive) "Sudah dikirim" else "Tetap di list sampai dikirim", onBack = { nav.navigate("home") }) }
        item {
            ChipRow {
                SelectChip(!archive, "Menunggu") { nav.navigate("wa") }
                SelectChip(archive, "Arsip") { nav.navigate("waArchive") }
            }
        }
        items(rows, key = { it.id }) { n ->
            ListRow(
                mark = n.customer,
                title = "${n.id} · ${n.customer}",
                detail = if (archive) "Terkirim ${n.waAt}" else n.phone,
                onClick = { nav.navigate("queue/${n.id}") },
            )
        }
        if (rows.isEmpty()) item { EmptyHint(if (archive) "Arsip masih kosong" else "Tidak ada WA menunggu", "Nota baru muncul di sini sampai WA dikirim.") }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun StockScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    store.revision.intValue
    val products = store.products.map { it.copy() }
    val branchId = store.selectedStockBranch()
    val low = products.count { store.stockOf(it.key, branchId) <= it.min }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Persediaan", "${store.branch(branchId).name} · ${DisplayDates.date(LocalDateTime.now(Clock.ZONE))}") }
        if (s.role == Role.Owner) item {
            FilterBar(
                label = "Cabang",
                value = store.branch(branchId).name.removePrefix("Cuciin "),
                detail = "Pilih satu cabang untuk melihat saldo dan mutasi stok",
                icon = Icons.Outlined.Storefront,
                onClick = { showBranchSheet = true },
            )
        }
        item {
            Hero("Pantau kebutuhan laundry", "${products.size} produk", listOf(if (low == 0) "Stok di atas batas minimum" else "$low produk perlu diisi"))
        }
        if (store.canWriteStock()) item { PrimaryBtn("Catat perubahan stok", icon = Icons.Outlined.Add) { nav.navigate("stokEdit") } }
        item { GhostBtn("Riwayat perubahan stok", icon = Icons.Outlined.History) { nav.navigate("stokHistory") } }
        if (products.isEmpty()) item { EmptyHint("Belum ada produk", "Tambahkan produk untuk mulai memantau persediaan laundry.") }
        if (products.isNotEmpty()) item {
            ListCard {
                products.forEachIndexed { index, p ->
                    val balance = store.stockOf(p.key, branchId)
                    val last = store.stockMoves.firstOrNull { it.branchId == branchId && (it.product == p.name || it.product == p.key) }
                    ListRow(
                        mark = p.name,
                        title = p.name,
                        detail = listOf(
                            "minimum ${p.min}",
                            if (last != null) "terakhir ${if (last.atMs > 0) DisplayDates.full(last.atMs) else last.at}" else "",
                        ).filter { it.isNotBlank() }.joinToString(" · "),
                        showChevron = false,
                        trailing = {
                            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(balance.toString(), color = if (balance <= p.min) Coral else Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                if (balance <= p.min) Chip("Perlu diisi", Coral)
                            }
                        },
                    )
                    if (index < products.lastIndex) RowDivider()
                }
            }
        }
        if (s.role == Role.Owner) item { GhostBtn("Kelola produk", icon = Icons.Outlined.Edit) { nav.navigate("products") } }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            store.branches.forEach { branch ->
                FilterSheetRow(branch.id == branchId, branch.name, "${store.stockMoves.count { it.branchId == branch.id }} perubahan stok") {
                    store.stockBranchId.value = branch.id
                    store.touchStatus()
                    showBranchSheet = false
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun StockEditScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var showTargetBranchSheet by rememberSaveable { mutableStateOf(false) }
    var kind by rememberSaveable { mutableStateOf(StockKind.Tambah) }
    var amounts by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var occurredAt by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE))) }
    val date = DisplayDates.parse(occurredAt) ?: LocalDateTime.now(Clock.ZONE)
    val branchId = store.selectedStockBranch()
    val session = store.session.value ?: return
    var targetBranches by remember { mutableStateOf(setOf(branchId)) }
    val changes = amounts.mapNotNull { (key, value) -> value.toIntOrNull()?.let { key to it } }.toMap()
    val validChanges = changes.filter { (key, qty) ->
        val current = store.stockOf(key, branchId)
        qty >= 0 && (qty > 0 || kind == StockKind.Update) && (kind != StockKind.Kurang || qty <= current)
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Perubahan stok massal", store.branch(branchId).name, onBack = { nav.popBackStack() }) }
        if (session.role == Role.Owner) item {
            FilterBar(
                label = "Cabang yang diperbarui",
                value = if (targetBranches.size == 1) store.branch(targetBranches.first()).name.removePrefix("Cuciin ") else "${targetBranches.size} cabang dipilih",
                detail = "Pilih satu atau beberapa cabang. Mutasi dicatat terpisah per cabang.",
                icon = Icons.Outlined.Storefront,
                onClick = { showTargetBranchSheet = true },
            )
        }
        item {
            CardBlock {
                SectionLabel("1. Jenis perubahan")
                ChipRow {
                    SelectChip(kind == StockKind.Tambah, "Barang masuk") { kind = StockKind.Tambah; amounts = emptyMap() }
                    SelectChip(kind == StockKind.Kurang, "Barang keluar") { kind = StockKind.Kurang; amounts = emptyMap() }
                    SelectChip(kind == StockKind.Update, "Hitung fisik") { kind = StockKind.Update; amounts = emptyMap() }
                }
                Text(when (kind) { StockKind.Tambah -> "Isi beberapa produk sekaligus. Jumlah ditambahkan ke saldo saat ini."; StockKind.Kurang -> "Isi jumlah barang keluar. Nilai tidak boleh melebihi saldo."; else -> "Isi saldo hasil hitung fisik untuk setiap produk yang diperiksa." }, color = Muted, fontSize = 12.sp)
            }
        }
        item { SectionLabel("2. Produk yang diperbarui") }
        if (store.products.isEmpty()) item { EmptyHint("Belum ada produk", "Minta Owner menambahkan produk terlebih dahulu.") }
        items(store.products, key = { it.key }) { product ->
            val current = store.stockOf(product.key, branchId)
            val typed = amounts[product.key].orEmpty()
            val qty = typed.toIntOrNull()
            val after = qty?.let { when (kind) { StockKind.Tambah -> current + it; StockKind.Kurang -> current - it; else -> it } }
            CardBlock(accent = if (typed.isNotBlank()) Teal else null) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) { Text(product.name, fontWeight = FontWeight.Bold); Text("Saldo saat ini $current", color = Muted, fontSize = 12.sp) }
                    if (after != null) Text("→ $after", color = if (after < 0) Coral else Teal, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Field(typed, { value -> amounts = amounts + (product.key to value.filter(Char::isDigit).take(9)) }, if (kind == StockKind.Update) "Saldo hasil hitung" else "Jumlah", number = true)
                if (after != null && after < 0) Text("Jumlah keluar melebihi saldo.", color = Coral, fontSize = 12.sp)
            }
        }
        item { CardBlock { SectionLabel("3. Waktu perubahan"); DateTimeFields(date, { occurredAt = DisplayDates.encode(it) }, "Tanggal dan jam kejadian") } }
        item {
            PrimaryBtn("Simpan ${validChanges.size} perubahan", enabled = validChanges.isNotEmpty() && validChanges.size == changes.size, icon = Icons.Outlined.Check) {
                if (date.isAfter(LocalDateTime.now(Clock.ZONE))) { toast("Waktu perubahan tidak boleh di masa depan"); return@PrimaryBtn }
                val targets = if (session.role == Role.Owner) targetBranches else setOf(branchId)
                if (targets.isEmpty()) { toast("Pilih minimal satu cabang"); return@PrimaryBtn }
                val saved = store.editStocks(validChanges, targets, kind, date.atZone(Clock.ZONE).toInstant().toEpochMilli())
                if (saved == CuciinStore.TOLAK_STOK) { toast("Akses Catat stok dicabut untuk role akun ini"); return@PrimaryBtn }
                toast("$saved perubahan stok berhasil dicatat")
                nav.navigate("stokHistory") { popUpTo("stok") }
            }
        }
    }
    if (showTargetBranchSheet) ModalBottomSheet(onDismissRequest = { showTargetBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Bisa memilih lebih dari satu. Setiap cabang akan menerima mutasi sendiri.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            store.branches.forEach { branch ->
                FilterSheetRow(branch.id in targetBranches, branch.name, null) {
                    targetBranches = if (branch.id in targetBranches) targetBranches - branch.id else targetBranches + branch.id
                }
            }
            PrimaryBtn("Selesai", Modifier.padding(horizontal = 18.dp, vertical = 8.dp)) { showTargetBranchSheet = false }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun StockHistoryScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val session = store.session.value ?: return
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    var showActorSheet by rememberSaveable { mutableStateOf(false) }
    var fromValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).minusDays(30).withHour(0).withMinute(0))) }
    var untilValue by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE).withHour(23).withMinute(59))) }
    var branchIds by remember { mutableStateOf(if (session.role == Role.Owner) emptySet<String>() else setOf(session.branchId)) }
    var actor by rememberSaveable { mutableStateOf("all") }
    var allDates by rememberSaveable { mutableStateOf(false) }
    store.revision.intValue
    val from = DisplayDates.parse(fromValue) ?: LocalDateTime.now(Clock.ZONE).minusDays(30)
    val until = DisplayDates.parse(untilValue) ?: LocalDateTime.now(Clock.ZONE)
    val actors = store.stockMoves.map { it.by }.filter(String::isNotBlank).distinct().sorted()
    val rows = store.stockMoves.filter { move ->
        val timestamp = DisplayDates.reportTimestamp(move.atMs, move.at)
        (branchIds.isEmpty() || move.branchId in branchIds) &&
            (allDates || timestamp?.let { DisplayDates.isInSelectedMinute(it, from, until) } == true) &&
            (actor == "all" || move.by == actor)
    }.sortedByDescending { DisplayDates.reportTimestamp(it.atMs, it.at) ?: Long.MIN_VALUE }
    val groups = rows.groupBy { if (it.atMs > 0) DisplayDates.date(DisplayDates.fromMillis(it.atMs)) else it.at.substringBefore(',') }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Laporan perubahan stok", "${rows.size} transaksi stok", onBack = { nav.popBackStack() }) }
        item {
            CardBlock {
                SectionLabel("Periode laporan")
                ChipRow { SelectChip(allDates, "Semua tanggal") { allDates = !allDates } }
                if (!allDates) {
                    DateTimeFields(from, { fromValue = DisplayDates.encode(it) }, "Mulai")
                    DateTimeFields(until, { untilValue = DisplayDates.encode(it) }, "Sampai")
                }
            }
        }
        if (session.role == Role.Owner) item {
            FilterBar(
                label = "Cabang",
                value = if (branchIds.isEmpty()) "Semua cabang" else "${branchIds.size} cabang dipilih",
                detail = "Pilih satu atau beberapa cabang untuk laporan ini",
                icon = Icons.Outlined.Storefront,
                onClick = { showBranchSheet = true },
            )
        }
        if (actors.isNotEmpty()) item {
            FilterBar(
                label = "Akun pelaksana",
                value = if (actor == "all") "Semua akun" else actor,
                detail = "Saring riwayat berdasarkan akun yang mencatat perubahan",
                icon = Icons.Outlined.Person,
                onClick = { showActorSheet = true },
            )
        }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PrimaryBtn("Ekspor PDF", Modifier.weight(1f), enabled = allDates || !until.isBefore(from), icon = Icons.Outlined.PictureAsPdf) { FileExports.shareStockPdf(ctx, rows, if (allDates) "Semua tanggal" else "${DisplayDates.date(from)} sampai ${DisplayDates.date(until)}") }
            GhostBtn("Ekspor CSV", Modifier.weight(1f), enabled = allDates || !until.isBefore(from), icon = Icons.Outlined.TableView) { FileExports.shareStock(ctx, rows) }
        } }
        if (rows.isEmpty()) item { EmptyHint("Belum ada perubahan stok", "Barang masuk dan keluar akan tampil di sini lengkap dengan hari, tanggal, dan petugas.") }
        groups.forEach { (day, moves) ->
            item { SectionLabel(day) }
            item {
                ListCard {
                    moves.forEachIndexed { index, m ->
                        val product = store.products.find { it.key == m.product || it.name == m.product }?.name ?: m.product
                        ListRow(
                            mark = product,
                            title = product,
                            detail = listOf(
                                m.kind.label,
                                store.branch(m.branchId).name,
                                if (m.atMs > 0) DisplayDates.time(DisplayDates.fromMillis(m.atMs)) + " WIB" else m.at,
                                "oleh ${m.by}",
                                m.note,
                                m.balanceAfter?.let { "saldo $it" }.orEmpty(),
                            ).filter { it.isNotBlank() }.joinToString(" · "),
                            showChevron = false,
                            trailing = {
                                Text(
                                    if (m.kind == StockKind.Update) "= ${m.qty}" else if (m.qty > 0) "+${m.qty}" else "${m.qty}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                    color = if (m.qty > 0) Green else Ink,
                                )
                            },
                        )
                        if (index < moves.lastIndex) RowDivider()
                    }
                }
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            FilterSheetRow(branchIds.isEmpty(), "Semua cabang", "${store.branches.size} cabang") { branchIds = emptySet(); showBranchSheet = false }
            store.branches.forEach { branch ->
                FilterSheetRow(branch.id in branchIds, branch.name, null) { branchIds = if (branch.id in branchIds) branchIds - branch.id else branchIds + branch.id }
            }
            PrimaryBtn("Selesai", Modifier.padding(horizontal = 18.dp, vertical = 8.dp)) { showBranchSheet = false }
        }
    }
    if (showActorSheet) ModalBottomSheet(onDismissRequest = { showActorSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih akun pelaksana", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            FilterSheetRow(actor == "all", "Semua akun", null) { actor = "all"; showActorSheet = false }
            actors.forEach { name -> FilterSheetRow(actor == name, name, null) { actor = name; showActorSheet = false } }
        }
    }
}
