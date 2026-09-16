package com.cuciin.laundryops.ui

import android.content.Intent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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

@Composable
internal fun HomeScreen(nav: NavHostController) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    var completed by rememberSaveable { mutableStateOf(false) }
    var unpaid by rememberSaveable { mutableStateOf(false) }
    var showFilters by rememberSaveable { mutableStateOf(false) }
    store.revision.intValue
    val all = store.visibleNotas().map { it.copy() }
    val working = all.count { it.laundry != LaundryStatus.Selesai }
    val ready = all.count { it.laundry == LaundryStatus.Selesai }
    val operations = operationalCounts(all)
    val now = LocalDateTime.now(Clock.ZONE)
    val rows = all.filter { (it.laundry == LaundryStatus.Selesai) == completed && (!unpaid || it.pay != PayStatus.Lunas) }
        .sortedWith(compareBy<Nota> {
            when {
                it.pickedUpAt != null -> 3
                it.laundry == LaundryStatus.Selesai -> 1
                DisplayDates.parse(it.pickupAt)?.isBefore(now) == true -> 0
                else -> 2
            }
        }.thenBy { DisplayDates.parse(it.pickupAt) })
    val bid = if (s.role == Role.Owner) store.viewBranch.value else s.branchId
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            ScreenHeader("Antrian laundry", DisplayDates.date(LocalDateTime.now(Clock.ZONE))) {
                BrandMark()
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SummaryTile("Masuk antrian", working.toString(), Icons.Outlined.LocalLaundryService, !completed, Modifier.weight(1f)) { completed = false }
                SummaryTile("Selesai", ready.toString(), Icons.Outlined.CheckCircle, completed, Modifier.weight(1f)) { completed = true }
            }
        }
        item {
            CardBlock {
                SectionLabel("Operasional hari ini")
                ChipRow {
                    if (operations.overdue > 0) Chip("${operations.overdue} terlambat", Coral)
                    Chip("${operations.dueToday} jatuh tempo", Amber)
                    Chip("${operations.readyForPickup} siap diambil", Green)
                    Chip("${operations.unpaid} belum lunas", Gold)
                }
                Text("Antrian diurutkan dari yang terlambat dan siap diserahkan.", color = Muted, fontSize = 12.sp)
            }
        }
        if (s.role != Role.Supervisor) {
            item {
                CardBlock {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.Outlined.AccountBalanceWallet, null, tint = Teal, modifier = Modifier.size(24.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Kas masuk hari ini", color = Muted, fontSize = 12.sp)
                            Text(rp(store.todayCollected(bid)), color = Ink, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                        }
                    }
                    PrimaryBtn("Buat Service baru", icon = Icons.Outlined.Add) { nav.navigate("nota") }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(if (bid == "all") "Semua cabang" else store.branch(bid).name, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text("${rows.size} pesanan${if (store.viewKasir.value != "all" && s.role == Role.Owner) " · ${store.viewKasir.value}" else ""}", color = Muted, fontSize = 12.sp)
                }
                if (s.role == Role.Owner) FilledTonalIconButton(onClick = { showFilters = !showFilters }) {
                    Icon(Icons.Outlined.Tune, "Filter cabang dan kasir", tint = Teal)
                }
            }
        }
        if (showFilters && s.role == Role.Owner) {
            item {
                CardBlock {
                    Text("Cabang", color = Muted, fontSize = 12.sp)
                    ChipRow {
                        SelectChip(bid == "all", "Semua") { store.viewBranch.value = "all"; store.touchStatus() }
                        store.branches.forEach { b -> SelectChip(bid == b.id, b.name.removePrefix("Cuciin ")) { store.viewBranch.value = b.id; store.touchStatus() } }
                    }
                    Text("Kasir", color = Muted, fontSize = 12.sp)
                    ChipRow {
                        SelectChip(store.viewKasir.value == "all", "Semua kasir") { store.viewKasir.value = "all"; store.touchStatus() }
                        store.staff.filter { it.role == Role.Kasir && it.approved }.forEach { k -> SelectChip(store.viewKasir.value == k.name, k.name) { store.viewKasir.value = k.name; store.touchStatus() } }
                    }
                }
            }
        }
        item { ChipRow { SelectChip(!unpaid, "Semua pembayaran") { unpaid = false }; SelectChip(unpaid, "Belum lunas") { unpaid = true } } }
        if (rows.isEmpty()) item { EmptyHint(if (completed) "Belum ada pesanan selesai" else "Antrian sudah tertangani", if (unpaid) "Tidak ada pesanan belum lunas pada pilihan ini." else if (s.role == Role.Supervisor) "Pesanan dari kasir akan muncul di sini." else "Pesanan baru akan muncul setelah Anda membuat nota.") }
        items(rows.chunked(if (ui.twoPane) 2 else 1), key = { chunk -> chunk.joinToString { it.id } }) { chunk ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                chunk.forEach { n -> Box(Modifier.weight(1f)) { NotaCard(n) { nav.navigate("queue/${n.id}") } } }
                if (ui.twoPane && chunk.size == 1) Spacer(Modifier.weight(1f))
            }
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
private fun NotaCard(n: Nota, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    Surface(onClick = { tap(); onClick() }, shape = RoundedCornerShape(20.dp), color = Card, border = BorderStroke(1.dp, Line), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AvatarMark(n.customer)
                Column(Modifier.weight(1f)) {
                    Text(n.customer, color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                    Text(n.id, color = Muted, fontSize = 11.sp)
                }
                Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = Teal, modifier = Modifier.size(18.dp))
            }
            Text(n.items, color = Muted, fontSize = 13.sp)
            InfoRow(Icons.Outlined.Schedule, "Estimasi Waktu Keluar", n.pickupAt)
            ListDivider()
            LaundryChip(n.laundry)
            if (n.laundry == LaundryStatus.Selesai) {
                Chip(if (n.pickedUpAt == null) "Siap diambil" else "Sudah diserahkan", if (n.pickedUpAt == null) Amber else Green)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(rp(n.total), color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                PayChip(n.pay)
            }
        }
    }
}

private fun quantity(qty: Double): String = if (qty % 1.0 == 0.0) qty.toInt().toString() else qty.toString().replace('.', ',')

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
    var serviceMenuOpen by remember { mutableStateOf(false) }
    var selectedServiceId by rememberSaveable { mutableStateOf("") }
    val total = cart.sumOf { (it.qty * it.unitPrice).toInt() }
    Column(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.weight(1f).padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
            item { ScreenHeader("Service baru", store.branch(selectedBranchId).name, onBack = { nav.popBackStack() }) }
            item { StepProgress(if (cust == null) 0 else 1) }
            if (s.role == Role.Owner) item {
                CardBlock {
                    SectionLabel("Cabang transaksi")
                    Text("Service, stok retail, dan pesan WhatsApp akan mengikuti cabang ini.", color = Muted, fontSize = 12.sp)
                    ChipRow {
                        allowedBranches.forEach { branch ->
                            SelectChip(selectedBranchId == branch.id, branch.name.removePrefix("Cuciin ")) {
                                store.notaBranchId.value = branch.id
                            }
                        }
                    }
                }
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
                                leadingIcon = { Icon(if (service.selfService) Icons.Outlined.LocalLaundryService else if (service.retail) Icons.Outlined.Inventory2 else Icons.Outlined.DryCleaning, null) },
                            )
                        }
                    }
                }
            }
            items(services.filter { selected -> selected.id == selectedServiceId && cart.none { it.service.id == selected.id } }, key = { it.id }) { svc ->
                ServiceTile(svc, 0.0, svc.price, onAdd = {
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
                ServiceTile(line.service, line.qty, line.unitPrice, onAdd = {
                    tap(); store.addToCart(line.service)
                    feedback = "Jumlah ${line.service.name} ditambah"
                }, onChange = { target ->
                    tap(); store.cartDelta(line.service.id, target - line.qty)
                    feedback = "Jumlah ${line.service.name} diperbarui"
                }, onPriceChange = { price ->
                    tap(); store.setCartPrice(line.service.id, price)
                    feedback = "Harga ${line.service.name} menjadi ${rp(price)} / ${line.service.unit}"
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
}

@Composable
private fun ServiceTile(svc: ServiceItem, qty: Double, unitPrice: Int, onAdd: () -> Unit, onChange: (Double) -> Unit, onPriceChange: (Int) -> Unit, onRemove: () -> Unit) {
    var editingQty by remember { mutableStateOf(false) }
    var editingPrice by remember { mutableStateOf(false) }
    var value by remember { mutableStateOf("") }
    var priceValue by remember { mutableStateOf("") }
    val border by animateColorAsState(if (qty > 0) Teal.copy(alpha = .5f) else Line, label = "layanan dipilih")
    Surface(shape = RoundedCornerShape(18.dp), color = Card, border = BorderStroke(1.dp, border), modifier = Modifier.fillMaxWidth().animateContentSize()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Surface(shape = RoundedCornerShape(13.dp), color = Mist) { Icon(if (svc.retail) Icons.Outlined.Inventory2 else Icons.Outlined.LocalLaundryService, null, tint = Teal, modifier = Modifier.padding(10.dp).size(24.dp)) }
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
                    GhostBtn("Ubah harga · ${rp(unitPrice)}", Modifier.weight(1f), icon = Icons.Outlined.Edit) {
                        priceValue = unitPrice.toString(); editingPrice = true
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
    if (editingPrice) {
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
            ServiceTile(line.service, line.qty, line.unitPrice, onAdd = {
                tap(); store.addToCart(line.service); feedback = "Jumlah ${line.service.name} ditambah"
            }, onChange = { target ->
                tap(); store.cartDelta(line.service.id, target - line.qty); feedback = "Jumlah ${line.service.name} diperbarui"
            }, onPriceChange = { price ->
                tap(); store.setCartPrice(line.service.id, price); feedback = "Harga ${line.service.name} diperbarui"
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
        saving = true
        val n = store.saveNota(cust, cart, paid, pickupValue, method, branchId, sendWa = false)
        if (openWa) {
            try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${store.waMe(n.phone)}?text=${Uri.encode(store.notaText(n))}"))); store.markWaSent(n.id) }
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
            ServiceTile(service, line.qty, line.unitPrice, onAdd = {
                draft = draft.map { if (it.serviceId == line.serviceId) it.copy(qty = it.qty + 1.0) else it }
            }, onChange = { qty ->
                draft = draft.map { if (it.serviceId == line.serviceId) it.copy(qty = qty) else it }.filter { it.qty > 0.0 }
            }, onPriceChange = { price ->
                draft = draft.map { if (it.serviceId == line.serviceId) it.copy(unitPrice = price) else it }
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
                    if (s?.role != Role.Supervisor) GhostBtn("Catat pelunasan", icon = Icons.Outlined.Payments) { paidConfirm = true }
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
                if (s?.role != Role.Supervisor) GhostBtn("Tambah foto dari galeri", icon = Icons.Outlined.AddPhotoAlternate) { pick.launch("image/*") }
            }
        }
        if (s?.role != Role.Supervisor) {
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
                            store.markWaSent(id); toast("WhatsApp dibuka untuk nota ini")
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
    if (finishConfirm) AlertDialog(onDismissRequest = { finishConfirm = false }, icon = { Icon(Icons.Outlined.CheckCircle, null, tint = Teal) }, title = { Text("Selesaikan pesanan?") }, text = { Text("Pastikan cucian ${n.customer} sudah selesai ditangani. Status pembayaran tetap dicatat terpisah.") }, confirmButton = { TextButton(onClick = { finishConfirm = false; store.advanceLaundry(id); toast("Pesanan ditandai selesai") }) { Text("Ya, selesai") } }, dismissButton = { TextButton(onClick = { finishConfirm = false }) { Text("Kembali") } })
    if (paidConfirm) AlertDialog(onDismissRequest = { paidConfirm = false }, title = { Text("Catat pelunasan?") }, text = { Text("Pastikan sisa ${rp((n.total - n.paid).coerceAtLeast(0))} telah diterima melalui ${n.payMethod.label}.") }, confirmButton = { TextButton(onClick = { paidConfirm = false; store.markLunas(id, n.payMethod); toast("Pembayaran tercatat lunas") }) { Text("Sudah diterima") } }, dismissButton = { TextButton(onClick = { paidConfirm = false }) { Text("Kembali") } })
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
            CardBlock(Modifier.clickable { nav.navigate("queue/${n.id}") }) {
                Text("${n.id} · ${n.customer}", fontWeight = FontWeight.Bold)
                Text(if (archive) "Terkirim ${n.waAt}" else n.phone, color = Muted, fontSize = 12.sp)
            }
        }
        if (rows.isEmpty()) item { EmptyHint(if (archive) "Arsip masih kosong" else "Tidak ada WA menunggu", "Nota baru muncul di sini sampai WA dikirim.") }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun StockScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    store.revision.intValue
    val products = store.products.map { it.copy() }
    val branchId = store.selectedStockBranch()
    val low = products.count { store.stockOf(it.key, branchId) <= it.min }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Persediaan", "${store.branch(branchId).name} · ${DisplayDates.date(LocalDateTime.now(Clock.ZONE))}") }
        if (s.role == Role.Owner) item {
            CardBlock {
                SectionLabel("Stok cabang")
                ChipRow {
                    store.branches.forEach { branch ->
                        SelectChip(branchId == branch.id, branch.name.removePrefix("Cuciin ")) {
                            store.stockBranchId.value = branch.id
                            store.touchStatus()
                        }
                    }
                }
            }
        }
        item {
            Hero("Pantau kebutuhan laundry", "${products.size} produk", listOf(if (low == 0) "Stok di atas batas minimum" else "$low produk perlu diisi"))
        }
        if (s.role != Role.Supervisor) item { PrimaryBtn("Catat perubahan stok", icon = Icons.Outlined.Add) { nav.navigate("stokEdit") } }
        item { GhostBtn("Riwayat perubahan stok", icon = Icons.Outlined.History) { nav.navigate("stokHistory") } }
        if (products.isEmpty()) item { EmptyHint("Belum ada produk", "Tambahkan produk untuk mulai memantau persediaan laundry.") }
        items(products, key = { it.key }) { p ->
            val balance = store.stockOf(p.key, branchId)
            CardBlock {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Outlined.Inventory2, null, tint = Teal, modifier = Modifier.size(28.dp))
                    Column(Modifier.weight(1f)) { Text(p.name, fontWeight = FontWeight.Bold, fontSize = 16.sp); Text("Batas minimum ${p.min}", color = Muted, fontSize = 12.sp) }
                    Text(balance.toString(), color = if (balance <= p.min) Coral else Ink, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                }
                if (balance <= p.min) Chip("Perlu diisi kembali", Coral)
                val last = store.stockMoves.firstOrNull { it.branchId == branchId && (it.product == p.name || it.product == p.key) }
                if (last != null) Text("Terakhir diperbarui\n${if (last.atMs > 0) DisplayDates.full(last.atMs) else last.at}", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
            }
        }
        if (s.role == Role.Owner) item { GhostBtn("Kelola produk", icon = Icons.Outlined.Edit) { nav.navigate("products") } }
    }
}

@Composable
internal fun StockEditScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
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
            CardBlock {
                SectionLabel("Cabang yang diperbarui")
                ChipRow {
                    store.branches.forEach { branch ->
                        SelectChip(branch.id in targetBranches, branch.name.removePrefix("Cuciin ")) {
                            targetBranches = if (branch.id in targetBranches) targetBranches - branch.id else targetBranches + branch.id
                        }
                    }
                }
                Text("Nilai yang diisi diterapkan ke setiap cabang terpilih dan tercatat sebagai mutasi terpisah.", color = Muted, fontSize = 12.sp)
            }
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
                toast("$saved perubahan stok berhasil dicatat")
                nav.navigate("stokHistory") { popUpTo("stok") }
            }
        }
    }
}

@Composable
internal fun StockHistoryScreen(nav: NavHostController) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val session = store.session.value ?: return
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
            CardBlock { SectionLabel("Cabang"); ChipRow {
                SelectChip(branchIds.isEmpty(), "Semua cabang") { branchIds = emptySet() }
                store.branches.forEach { b -> SelectChip(b.id in branchIds, b.name.removePrefix("Cuciin ")) { branchIds = if (b.id in branchIds) branchIds - b.id else branchIds + b.id } }
            } }
        }
        if (actors.isNotEmpty()) item { CardBlock { SectionLabel("Akun pelaksana"); ChipRow { SelectChip(actor == "all", "Semua akun") { actor = "all" }; actors.forEach { name -> SelectChip(actor == name, name) { actor = name } } } } }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PrimaryBtn("Export PDF", Modifier.weight(1f), enabled = allDates || !until.isBefore(from), icon = Icons.Outlined.PictureAsPdf) { FileExports.shareStockPdf(ctx, rows, if (allDates) "Semua tanggal" else "${DisplayDates.date(from)} — ${DisplayDates.date(until)}") }
            GhostBtn("Export CSV", Modifier.weight(1f), enabled = allDates || !until.isBefore(from), icon = Icons.Outlined.TableView) { FileExports.shareStock(ctx, rows) }
        } }
        if (rows.isEmpty()) item { EmptyHint("Belum ada perubahan stok", "Barang masuk dan keluar akan tampil di sini lengkap dengan hari, tanggal, dan petugas.") }
        groups.forEach { (day, moves) ->
            item { SectionLabel(day) }
            items(moves) { m ->
                val product = store.products.find { it.key == m.product || it.name == m.product }?.name ?: m.product
                CardBlock {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(if (m.kind == StockKind.Tambah) Icons.Outlined.SouthWest else if (m.kind == StockKind.Update) Icons.Outlined.Sync else Icons.Outlined.NorthEast, null, tint = if (m.kind == StockKind.Tambah) Green else Teal)
                        Column(Modifier.weight(1f)) { Text(product, fontWeight = FontWeight.Bold); Text(m.kind.label, fontSize = 12.sp, color = Muted) }
                        Text(if (m.kind == StockKind.Update) "= ${m.qty}" else if (m.qty > 0) "+${m.qty}" else "${m.qty}", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = if (m.qty > 0) Green else Ink)
                    }
                    Text("${store.branch(m.branchId).name} · ${if (m.atMs > 0) DisplayDates.time(DisplayDates.fromMillis(m.atMs)) + " WIB" else m.at}", color = Muted, fontSize = 12.sp)
                    Text("Oleh ${m.by} · ${m.note}", color = Muted, fontSize = 12.sp)
                    m.balanceAfter?.let { Text("Saldo setelah perubahan: $it", color = Ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
                }
            }
        }
    }
}
