package com.tiftazani.laundryops.ui

import android.content.Intent
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
import com.tiftazani.laundryops.BuildConfig
import com.tiftazani.laundryops.data.Clock
import com.tiftazani.laundryops.data.CuciinStore
import com.tiftazani.laundryops.data.FileExports
import com.tiftazani.laundryops.data.LaundryStatus
import com.tiftazani.laundryops.data.Nota
import com.tiftazani.laundryops.data.PayMethod
import com.tiftazani.laundryops.data.PayStatus
import com.tiftazani.laundryops.data.Role
import com.tiftazani.laundryops.data.StockKind
import com.tiftazani.laundryops.data.rp
import com.tiftazani.laundryops.ui.components.CardBlock
import com.tiftazani.laundryops.ui.components.Chip
import com.tiftazani.laundryops.ui.components.ChipRow
import com.tiftazani.laundryops.ui.components.EmptyHint
import com.tiftazani.laundryops.ui.components.GhostBtn
import com.tiftazani.laundryops.ui.components.Hero
import com.tiftazani.laundryops.ui.components.LaundryChip
import com.tiftazani.laundryops.ui.components.PayChip
import com.tiftazani.laundryops.ui.components.PrimaryBtn
import com.tiftazani.laundryops.ui.components.ScreenHeader
import com.tiftazani.laundryops.ui.components.SectionLabel
import com.tiftazani.laundryops.ui.components.SelectChip
import com.tiftazani.laundryops.ui.theme.Amber
import com.tiftazani.laundryops.ui.theme.Coral
import com.tiftazani.laundryops.ui.theme.Gold
import com.tiftazani.laundryops.ui.theme.Green
import com.tiftazani.laundryops.ui.theme.Ink
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Teal

private val store get() = CuciinStore

@Composable
internal fun HomeScreen(nav: NavHostController) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    var filter by remember { mutableStateOf("gantung") }
    val all = store.visibleNotas()
    val list = when (filter) {
        "selesai" -> all.filter { !it.hanging }
        "do" -> all.filter { it.dropOut }
        else -> all.filter { it.hanging }
    }
    val waPend = all.count { !it.waSent }
    val bid = if (s.role == Role.Owner) store.viewBranch.value else s.branchId
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
    ) {
        item {
            ScreenHeader(
                "Antrian",
                "${s.name} · ${if (s.role == Role.Owner) "semua cabang" else store.branch(s.branchId).name}",
            )
        }
        if (s.role == Role.Owner) {
            item {
                ChipRow {
                    SelectChip(store.viewBranch.value == "all", "Semua") { store.viewBranch.value = "all"; store.touchStatus() }
                    store.branches.forEach { b ->
                        SelectChip(store.viewBranch.value == b.id, b.name.removePrefix("Cuciin ")) {
                            store.viewBranch.value = b.id
                            store.touchStatus()
                        }
                    }
                }
            }
            item {
                ChipRow {
                    SelectChip(store.viewKasir.value == "all", "Semua kasir") { store.viewKasir.value = "all"; store.touchStatus() }
                    store.staff.filter { it.role == Role.Kasir && it.approved }.forEach { k ->
                        SelectChip(store.viewKasir.value == k.name, k.name) {
                            store.viewKasir.value = k.name
                            store.touchStatus()
                        }
                    }
                }
            }
        }
        item {
            Hero(
                if (s.role == Role.Owner) "Kas masuk hari ini" else "Shift ${s.name}",
                rp(store.todayCollected(bid)),
                listOf("${all.count { it.hanging }} menggantung", "$waPend WA pending"),
            )
        }
        item {
            ChipRow {
                SelectChip(filter == "gantung", "Menggantung") { filter = "gantung" }
                SelectChip(filter == "selesai", "Selesai") { filter = "selesai" }
                SelectChip(filter == "do", "Drop-out") { filter = "do" }
            }
        }
        if (list.isEmpty()) {
            item { EmptyHint("Antrian sepi", "Buka Nota buat transaksi pertama. Datanya nyangkut di server + HP.") }
        }
        items(list, key = { it.id }) { n ->
            NotaCard(n) { nav.navigate("queue/${n.id}") }
        }
        item {
            TextButton({ nav.navigate("versions") }) { Text("Versi ${BuildConfig.VERSION_NAME}", color = Muted) }
        }
        item { Spacer(Modifier.height(12.dp)) }
    }
}

@Composable
private fun NotaCard(n: Nota, onClick: () -> Unit) {
    val accent = when {
        n.hanging && n.pay == PayStatus.Belum -> Amber
        n.hanging -> Gold
        else -> Green
    }
    CardBlock(Modifier.clickable(onClick = onClick), accent = accent) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(n.id, color = Teal, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text(rp(n.total), fontWeight = FontWeight.Black, color = Ink)
        }
        Text(n.customer, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Ink)
        Text("${n.kasir} · ${n.items}", color = Muted, fontSize = 12.sp, maxLines = 2)
        Text("${n.createdAt} · pickup ${n.pickupAt}", color = Muted, fontSize = 12.sp)
        Spacer(Modifier.height(8.dp))
        ChipRow {
            PayChip(n.pay)
            LaundryChip(n.laundry)
            if (n.hanging) Chip("Menggantung", Amber) else Chip("Beres", Green)
            if (!n.waSent) Chip("WA pending", Coral)
        }
    }
}

@Composable
internal fun NotaScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    val cust = store.selectedCustomer.value
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
    ) {
        item { ScreenHeader("Nota baru", "${store.branch(s.branchId).name} · ${store.nextNotaId(s.branchId)}", onBack = { nav.navigate("home") }) }
        item {
            CardBlock(Modifier.clickable { nav.navigate("customers") }, accent = Teal) {
                if (cust == null) {
                    Text("Pilih pelanggan", fontWeight = FontWeight.Bold)
                    Text("Wajib sebelum simpan nota", color = Muted, fontSize = 13.sp)
                } else {
                    Text(cust.name, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Text("${cust.phone} · ${cust.address}", color = Muted, fontSize = 13.sp)
                }
            }
        }
        item { SectionLabel("Layanan") }
        items(store.services, key = { it.id }) { svc ->
            CardBlock(Modifier.clickable { store.addToCart(svc) }) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text(svc.name, fontWeight = FontWeight.Bold)
                        Text(
                            buildString {
                                append("${rp(svc.price)} / ${svc.unit}")
                                if (svc.retail) append(" · potong stok")
                                if (svc.dropOut) append(" · DO")
                            },
                            color = Muted,
                            fontSize = 12.sp,
                        )
                    }
                    Text("+", color = Teal, fontWeight = FontWeight.Black, fontSize = 22.sp)
                }
            }
        }
        item {
            SectionLabel("Keranjang")
            if (store.cart.isEmpty()) Text("Tap layanan di atas", color = Muted, fontSize = 13.sp)
            store.cart.forEach { line ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("${line.service.name}  ${line.qty}${line.service.unit}", modifier = Modifier.weight(1f), maxLines = 2)
                    Text(rp((line.qty * line.service.price).toInt()), fontWeight = FontWeight.Bold)
                    TextButton({ store.cartDelta(line.service.id, -1.0) }) { Text("−", fontSize = 18.sp) }
                    TextButton({ store.addToCart(line.service) }) { Text("+", fontSize = 18.sp) }
                }
            }
            val total = store.cart.sumOf { (it.qty * it.service.price).toInt() }
            if (store.cart.isNotEmpty()) {
                PrimaryBtn("Lanjut janji & bayar · ${rp(total)}") {
                    if (cust == null) {
                        toast("Pilih pelanggan dulu")
                        nav.navigate("customers")
                    } else nav.navigate("bayar")
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun BayarScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var pickup by remember { mutableStateOf(Clock.defaultPickup()) }
    var paid by remember { mutableIntStateOf(0) }
    var method by remember { mutableStateOf(PayMethod.Tunai) }
    val cust = store.selectedCustomer.value
    val total = store.cart.sumOf { (it.qty * it.service.price).toInt() }.coerceAtLeast(0)
    val ctx = LocalContext.current
    fun save(openWa: Boolean) {
        if (cust == null) {
            toast("Pilih pelanggan")
            nav.navigate("customers")
            return
        }
        if (store.cart.isEmpty()) {
            toast("Keranjang kosong")
            return
        }
        val n = store.saveNota(cust, store.cart.toList(), paid, pickup, method, sendWa = false)
        if (openWa) {
            val url = "${store.waMe(n.phone)}?text=${Uri.encode(store.notaText(n))}"
            try {
                ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                store.markWaSent(n.id)
            } catch (_: Exception) {
                toast("WA tidak kebuka, nota tetap tersimpan")
            }
        } else toast("Nota ${n.id} tersimpan, WA pending")
        nav.navigate("queue/${n.id}") { popUpTo("home") }
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Janji & bayar", onBack = { nav.popBackStack() }) }
        item {
            Text(rp(total), fontSize = ui.heroSp, fontWeight = FontWeight.Black, color = Ink)
            PayChip(if (paid >= total && total > 0) PayStatus.Lunas else PayStatus.Belum)
        }
        item { Field(pickup, { pickup = it }, "Kapan selesai / pickup") }
        item {
            Field(paid.toString(), { paid = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Dibayar sekarang", number = true)
        }
        item {
            ChipRow {
                SelectChip(paid == 0, "Belum lunas") { paid = 0 }
                SelectChip(paid == total && total > 0, "Lunas") { paid = total }
            }
        }
        item {
            SectionLabel("Metode (catat, bukan gateway)")
            ChipRow {
                PayMethod.entries.forEach { SelectChip(method == it, it.label) { method = it } }
            }
        }
        item { PrimaryBtn("Simpan, WA nanti") { save(false) } }
        item { GhostBtn("Simpan & buka WA") { save(true) } }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun QueueDetailScreen(nav: NavHostController, id: String, toast: (String) -> Unit) {
    val ui = rememberUi()
    val n = store.notas.find { it.id == id } ?: return
    val ctx = LocalContext.current
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val path = store.addLocalProof(id, uri)
        toast(if (path != null) "Foto disalin ke penyimpanan app" else "Gagal salin foto")
    }
    val s = store.session.value
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader(n.id, store.branch(n.branchId).name, onBack = { nav.popBackStack() }) }
        item {
            CardBlock(accent = if (n.hanging) Amber else Green) {
                Text(n.customer, fontWeight = FontWeight.Black, fontSize = 20.sp)
                Text("${n.phone} · kasir ${n.kasir}", color = Muted, fontSize = 13.sp)
                Text(n.items, color = Ink, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
                Text("Dibuat ${n.createdAt}", color = Muted, fontSize = 12.sp)
                Text("Pickup ${n.pickupAt}", fontWeight = FontWeight.SemiBold)
                Text("${n.payMethod.label} · ${rp(n.paid)} / ${rp(n.total)}", color = Muted, fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                ChipRow {
                    PayChip(n.pay)
                    LaundryChip(n.laundry)
                    if (n.hanging) Chip("Menggantung", Amber)
                }
            }
        }
        item {
            SectionLabel("Status laundry")
            ChipRow {
                LaundryStatus.entries.forEach { st ->
                    SelectChip(n.laundry == st, st.label.replace("Laundry ", "")) {}
                }
            }
            if (n.laundry != LaundryStatus.Selesai) {
                PrimaryBtn("Lanjut status laundry") { store.advanceLaundry(id); toast(n.laundry.label) }
            }
            if (n.pay != PayStatus.Lunas && s?.role != Role.Supervisor) {
                GhostBtn("Tandai lunas") { store.markLunas(id); toast("Lunas") }
            }
        }
        item {
            SectionLabel("Bukti di HP")
            n.photos.forEach { Text("📷 ${it.substringAfterLast('/')}", fontSize = 13.sp) }
            if (s?.role != Role.Supervisor) GhostBtn("Salin foto dari galeri") { pick.launch("image/*") }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                GhostBtn("Teks", modifier = Modifier.weight(1f)) { FileExports.shareText(ctx, store.notaText(n)) }
                GhostBtn("Excel", modifier = Modifier.weight(1f)) { FileExports.shareCsv(ctx, n) }
                GhostBtn("PDF", modifier = Modifier.weight(1f)) { FileExports.sharePdf(ctx, n) }
            }
        }
        item {
            val url = "${store.waMe(n.phone)}?text=${Uri.encode(store.notaText(n))}"
            PrimaryBtn(if (n.waSent) "Kirim ulang WA" else "Kirim WA nota") {
                try {
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    store.markWaSent(id)
                    toast("Masuk archive WA")
                } catch (_: Exception) {
                    toast("WA tidak kebuka")
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun WaListScreen(nav: NavHostController, archive: Boolean) {
    val ui = rememberUi()
    val rows = store.visibleNotas().filter { it.waSent == archive }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader(if (archive) "WA archive" else "WA pending", if (archive) "Sudah dikirim" else "Tetap di list sampai dikirim", onBack = { nav.navigate("home") }) }
        item {
            ChipRow {
                SelectChip(!archive, "Pending") { nav.navigate("wa") }
                SelectChip(archive, "Archive") { nav.navigate("waArchive") }
            }
        }
        items(rows, key = { it.id }) { n ->
            CardBlock(Modifier.clickable { nav.navigate("queue/${n.id}") }) {
                Text("${n.id} · ${n.customer}", fontWeight = FontWeight.Bold)
                Text(if (archive) "Terkirim ${n.waAt}" else n.phone, color = Muted, fontSize = 12.sp)
            }
        }
        if (rows.isEmpty()) item { EmptyHint(if (archive) "Archive kosong" else "Belum ada pending", "Nota baru muncul di sini sampai WA dikirim.") }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun StockScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Stok", "Mutasi per tanggal", onBack = { nav.navigate("home") }) }
        items(store.products, key = { it.key }) { p0 ->
            CardBlock(accent = if (p0.stock <= p0.min) Coral else Teal) {
                Text(p0.name, fontWeight = FontWeight.Bold)
                Text("Sisa ${p0.stock} · minimum ${p0.min}${if (p0.stock <= p0.min) " · rendah" else ""}", color = Muted, fontSize = 13.sp)
            }
        }
        if (store.products.isEmpty()) item { EmptyHint("Belum ada produk", "Owner bisa tambah di menu Produk.") }
        item { GhostBtn("Lihat mutasi tanggal") { nav.navigate("stokHistory") } }
        if (s.role != Role.Supervisor) item { PrimaryBtn("Ubah stok manual") { nav.navigate("stokEdit") } }
        if (s.role == Role.Owner) item { GhostBtn("Kelola produk") { nav.navigate("products") } }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun StockEditScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var product by remember { mutableStateOf(store.products.firstOrNull()?.name.orEmpty()) }
    var kind by remember { mutableStateOf(StockKind.Tambah) }
    var qty by remember { mutableIntStateOf(12) }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
    ) {
        ScreenHeader("Ubah stok", onBack = { nav.popBackStack() })
        Text("Jual retail via nota potong otomatis. Kasir juga bisa tambah/kurang/update di sini.", color = Muted, fontSize = 13.sp)
        ChipRow {
            store.products.forEach { SelectChip(product == it.name, it.name) { product = it.name } }
        }
        ChipRow {
            listOf(StockKind.Tambah, StockKind.Kurang, StockKind.Update).forEach {
                SelectChip(kind == it, it.label) { kind = it }
            }
        }
        Field(qty.toString(), { qty = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Jumlah", number = true)
        PrimaryBtn("Simpan mutasi") {
            store.editStock(product, kind, qty)
            toast("Mutasi tersimpan")
            nav.navigate("stokHistory")
        }
    }
}

@Composable
internal fun StockHistoryScreen(nav: NavHostController) {
    val ui = rememberUi()
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Mutasi stok", "Perubahan per tanggal", onBack = { nav.popBackStack() }) }
        if (store.stockMoves.isEmpty()) item { EmptyHint("Belum ada mutasi", "Ubah stok atau jual retail lewat nota.") }
        items(store.stockMoves) { m ->
            CardBlock {
                Text("${m.product} · ${m.kind.label} ${m.qty}", fontWeight = FontWeight.Bold)
                Text("${m.at} · ${m.by}", color = Muted, fontSize = 12.sp)
                Text(m.notaId ?: m.note, color = Muted, fontSize = 12.sp)
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}
