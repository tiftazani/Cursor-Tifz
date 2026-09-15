package com.tiftazani.laundryops.ui

import android.content.Intent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.TextButton
import androidx.compose.ui.Alignment
import com.tiftazani.laundryops.ui.components.FeedbackBanner
import com.tiftazani.laundryops.ui.components.InfoRow
import com.tiftazani.laundryops.ui.components.rememberTapFeedback

import android.net.Uri
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.tiftazani.laundryops.data.Branch
import com.tiftazani.laundryops.data.Customer
import com.tiftazani.laundryops.data.CuciinStore
import com.tiftazani.laundryops.data.Product
import com.tiftazani.laundryops.data.Role
import com.tiftazani.laundryops.data.ServiceItem
import com.tiftazani.laundryops.data.Staff
import com.tiftazani.laundryops.data.rp
import com.tiftazani.laundryops.ui.components.AvatarMark
import com.tiftazani.laundryops.ui.components.CardBlock
import com.tiftazani.laundryops.ui.components.Chip
import com.tiftazani.laundryops.ui.components.ChipRow
import com.tiftazani.laundryops.ui.components.DangerBtn
import com.tiftazani.laundryops.ui.components.EmptyHint
import com.tiftazani.laundryops.ui.components.GhostBtn
import com.tiftazani.laundryops.ui.components.PrimaryBtn
import com.tiftazani.laundryops.ui.components.ScreenHeader
import com.tiftazani.laundryops.ui.components.SectionLabel
import com.tiftazani.laundryops.ui.components.SelectChip
import com.tiftazani.laundryops.ui.theme.Amber
import com.tiftazani.laundryops.ui.theme.Green
import com.tiftazani.laundryops.ui.theme.Ink
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Teal

private val store get() = CuciinStore

@Composable
internal fun CustomersScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val pickMode = nav.previousBackStackEntry?.destination?.route == "nota"
    var search by rememberSaveable { mutableStateOf("") }
    var editing by remember { mutableStateOf<Customer?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val tap = rememberTapFeedback()
    LaunchedEffect(creating, editing) { if (creating || editing != null) { tap(); listState.animateScrollToItem(0) } }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    fun fill(c: Customer?) {
        name = c?.name.orEmpty()
        phone = c?.phone.orEmpty()
        address = c?.address.orEmpty()
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), state = listState, verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Pelanggan", if (pickMode) "Ketuk nama untuk memilih pelanggan" else "Kontak pelanggan laundry Anda", onBack = { nav.popBackStack() }) }
        if (!creating && editing == null) item { PrimaryBtn("Pelanggan baru", icon = Icons.Outlined.Add) { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah pelanggan" else "Pelanggan baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    Field(phone, { phone = it }, "WA / telepon", phone = true)
                    Field(address, { address = it }, "Alamat")
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan") {
                        if (name.isBlank() || phone.isBlank()) {
                            toast("Nama dan telepon wajib")
                            return@PrimaryBtn
                        }
                        val e = editing
                        if (e == null) {
                            store.addCustomer(name, phone, address)
                            toast("Pelanggan disimpan")
                            if (pickMode) nav.popBackStack()
                        } else {
                            store.updateCustomer(e.id, name, phone, address)
                            toast("Perubahan disimpan")
                        }
                        creating = false
                        editing = null
                    }
                    if (editing != null && store.session.value?.role == Role.Owner) {
                        DangerBtn("Hapus pelanggan") {
                            store.deleteCustomer(editing!!.id)?.let { toast(it) } ?: toast("Dihapus")
                            creating = false
                            editing = null
                        }
                    }
                    GhostBtn("Batal") { creating = false; editing = null }
                }
            }
        }
        if (!creating && editing == null && store.customers.isEmpty()) item { EmptyHint("Belum ada pelanggan", "Tambahkan kontak pelanggan sebelum membuat nota pertama.") }
        if (!creating && editing == null) item { Field(search, { search = it }, "Cari nama atau nomor telepon") }
        if (!creating && editing == null) items(store.customers.filter { it.name.contains(search, true) || it.phone.contains(search) }, key = { it.id }) { c ->
            CardBlock(
                Modifier.clickable {
                    if (pickMode && !creating && editing == null) {
                        store.selectedCustomer.value = c
                        nav.popBackStack()
                    } else {
                        editing = c
                        creating = false
                        fill(c)
                    }
                },
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AvatarMark(c.name)
                    Column(Modifier.weight(1f)) {
                        Text(c.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(c.phone, color = Muted, fontSize = 13.sp)
                    }
                    Icon(if (pickMode) Icons.Outlined.CheckCircle else Icons.Outlined.Edit, if (pickMode) "Pilih pelanggan" else "Ubah pelanggan", tint = Teal, modifier = Modifier.size(20.dp))
                }
                if (c.address.isNotBlank()) Text(c.address, color = Muted, fontSize = 12.sp)
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun BranchesScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val focus = androidx.compose.ui.platform.LocalFocusManager.current
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    val editing = store.branches.find { it.id == editingId }
    var creating by rememberSaveable { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val tap = rememberTapFeedback()
    LaunchedEffect(creating, editing) { if (creating || editing != null) { tap(); listState.animateScrollToItem(0) } }
    var name by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var location by rememberSaveable { mutableStateOf("") }
    var maps by rememberSaveable { mutableStateOf("") }
    val incomingMap = MapSelection.pendingLink.value
    LaunchedEffect(incomingMap) {
        if (incomingMap != null) {
            focus.clearFocus()
            maps = incomingMap
            if (editing == null) {
                creating = true
                toast("Lokasi dari peta berhasil dipilih")
            } else {
                store.updateBranchMap(editing.id, incomingMap)
                toast("Lokasi peta ${editing.name} berhasil disimpan")
            }
            MapSelection.pendingLink.value = null
        }
    }
    fun fill(b: Branch?) {
        name = b?.name.orEmpty()
        code = b?.code.orEmpty()
        location = b?.location.orEmpty()
        maps = b?.mapsQuery.orEmpty()
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), state = listState, verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Cabang", "Nama · lokasi · Maps", onBack = { nav.popBackStack() }) }
        if (!creating && editing == null) item { PrimaryBtn("Cabang baru", icon = Icons.Outlined.Add) { creating = true; editingId = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah cabang" else "Cabang baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    Field(code, { code = it }, "Kode nota (MEL)")
                    Field(location, { location = it }, "Alamat cabang")
                    SectionLabel("Lokasi di peta")
                    Text("Buka peta, pilih pin cabang, lalu Bagikan → Cuciin. Lokasi akan terisi otomatis saat kembali.", color = Muted, fontSize = 12.sp)
                    if (maps.isNotBlank()) {
                        FeedbackBanner("Lokasi cabang sudah dipilih")
                        Text(maps, color = Teal, fontSize = 12.sp, maxLines = 2)
                    }
                    GhostBtn(if (maps.isBlank()) "Pilih lokasi di peta" else "Lihat / ganti lokasi", icon = Icons.Outlined.Map) {
                        focus.clearFocus()
                        MapSelection.open(ctx, maps.ifBlank { location.ifBlank { name } }, toast)
                    }
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan cabang", icon = Icons.Outlined.Check) {
                        if (name.isBlank() || code.isBlank()) {
                            toast("Nama dan kode wajib")
                            return@PrimaryBtn
                        }
                        val e = editing
                        if (store.branches.any { it.id != e?.id && it.code.equals(code.trim(), true) }) {
                            toast("Kode cabang sudah dipakai. Gunakan kode unik agar ID Service tidak bertabrakan.")
                            return@PrimaryBtn
                        }
                        if (e == null) store.addBranch(name, code, location, maps)
                        else store.updateBranch(e.id, name, code, location, maps)
                        toast("Cabang tersimpan")
                        creating = false
                        editingId = null
                    }
                    if (editing != null) {
                        DangerBtn("Hapus cabang") {
                            store.deleteBranch(editing!!.id)?.let { toast(it) } ?: run {
                                toast("Cabang dihapus")
                                creating = false
                                editingId = null
                            }
                        }
                    }
                    GhostBtn("Batal") { creating = false; editingId = null }
                }
            }
        }
        if (!creating && editing == null) items(store.branches, key = { it.id }) { b ->
            val kasir = store.staff.filter { it.role == Role.Kasir && it.approved && b.id in it.branchIds }
            val spv = store.staff.filter { it.role == Role.Supervisor && it.approved && b.id in it.branchIds }
            CardBlock(Modifier.clickable { editingId = b.id; creating = false; fill(b) }) {
                Text(b.name, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Text(b.location, color = Muted, fontSize = 13.sp)
                Text("Kasir: ${kasir.joinToString { it.name }.ifBlank { "—" }}", fontSize = 13.sp, color = Ink)
                Text("SPV: ${spv.joinToString { it.name }.ifBlank { "—" }}", fontSize = 13.sp, color = Ink)
                Chip("Kode ${b.code}", Teal)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GhostBtn("Buka peta", Modifier.weight(1f), icon = Icons.Outlined.Map) { MapSelection.open(ctx, b.mapsQuery.ifBlank { b.location }, toast) }
                    GhostBtn("Ubah", Modifier.weight(1f), icon = Icons.Outlined.Edit) { editingId = b.id; creating = false; fill(b) }
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun UsersScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var editing by remember { mutableStateOf<Staff?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val tap = rememberTapFeedback()
    LaunchedEffect(creating, editing) { if (creating || editing != null) { tap(); listState.animateScrollToItem(0) } }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(Role.Kasir) }
    var branches by remember { mutableStateOf(setOf<String>()) }
    fun fill(u: Staff?) {
        name = u?.name.orEmpty()
        email = u?.email.orEmpty()
        pass = ""
        role = u?.role ?: Role.Kasir
        branches = u?.branchIds?.toSet() ?: setOf(store.branches.first().id)
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), state = listState, verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Pengguna", "Akun, peran, dan akses cabang", onBack = { nav.popBackStack() }) }
        if (!creating && editing == null) item { PrimaryBtn("Pengguna baru", icon = Icons.Outlined.Add) { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah pengguna" else "Pengguna baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    Field(email, { email = it }, "Email")
                    Field(pass, { pass = it }, if (editing != null) "Kata sandi baru (boleh kosong)" else "Kata sandi awal (kosong = test1234)", password = true)
                    SectionLabel("Peran")
                    ChipRow {
                        SelectChip(role == Role.Kasir, "Kasir") { role = Role.Kasir }
                        SelectChip(role == Role.Supervisor, "SPV") { role = Role.Supervisor }
                        SelectChip(role == Role.Owner, "Owner") { role = Role.Owner }
                    }
                    SectionLabel("Cabang")
                    ChipRow {
                        store.branches.forEach { b ->
                            SelectChip(b.id in branches, b.name.removePrefix("Cuciin ")) {
                                branches = if (b.id in branches) branches - b.id else branches + b.id
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan") {
                        val bids = branches.toList().ifEmpty { listOf(store.branches.first().id) }
                        val err = if (editing == null) {
                            store.addStaff(name, email, role, bids, pass, approved = true)
                        } else {
                            store.updateStaff(editing!!.email, name, role, bids, pass.ifBlank { null }, newEmail = email)
                        }
                        if (err != null) toast(err) else {
                            toast("Pengguna tersimpan")
                            creating = false
                            editing = null
                        }
                    }
                    if (editing != null) {
                        DangerBtn("Hapus pengguna") {
                            store.deleteStaff(editing!!.email)?.let { toast(it) } ?: run {
                                toast("Pengguna dihapus")
                                creating = false
                                editing = null
                            }
                        }
                    }
                    GhostBtn("Batal") { creating = false; editing = null }
                }
            }
        }
        if (!creating && editing == null) items(store.staff.toList(), key = { it.email }) { u ->
            CardBlock(Modifier.clickable { editing = u; creating = false; fill(u) }) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AvatarMark(u.name)
                    Column(Modifier.weight(1f)) {
                        Text(u.name, fontWeight = FontWeight.Bold)
                        Text("${u.role} · ${u.email}", color = Muted, fontSize = 12.sp)
                        Text(u.branchIds.joinToString { id -> store.branches.find { it.id == id }?.name ?: id }, color = Muted, fontSize = 12.sp)
                        Chip(if (u.approved) "Aktif" else "Menunggu", if (u.approved) Green else Amber)
                    }
                }
                if (!u.approved) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp).fillMaxWidth()) {
                        PrimaryBtn("Setujui", modifier = Modifier.weight(1f)) { store.approve(u.name, true); toast("Disetujui") }
                        GhostBtn("Tolak", modifier = Modifier.weight(1f)) { store.approve(u.name, false); toast("Ditolak") }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun ServicesScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var editing by remember { mutableStateOf<ServiceItem?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val tap = rememberTapFeedback()
    LaunchedEffect(creating, editing) { if (creating || editing != null) { tap(); listState.animateScrollToItem(0) } }
    var name by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("kg") }
    var price by remember { mutableIntStateOf(0) }
    var commission by remember { mutableIntStateOf(0) }
    var retail by remember { mutableStateOf(false) }
    var dropOut by remember { mutableStateOf(false) }
    var selfService by remember { mutableStateOf(false) }
    fun fill(s: ServiceItem?) {
        name = s?.name.orEmpty()
        unit = s?.unit ?: "kg"
        price = s?.price ?: 0
        commission = s?.commissionPerUnit ?: 0
        retail = s?.retail ?: false
        dropOut = s?.dropOut ?: false
        selfService = s?.selfService ?: false
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), state = listState, verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Layanan & harga", "Atur layanan dan tarif laundry", onBack = { nav.popBackStack() }) }
        if (!creating && editing == null) item { PrimaryBtn("Layanan baru", icon = Icons.Outlined.Add) { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah layanan" else "Layanan baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    SectionLabel("Jenis layanan")
                    ChipRow {
                        SelectChip(!retail && !selfService, "Full service") { retail = false; selfService = false }
                        SelectChip(selfService, "Self-service") { selfService = true; retail = false; dropOut = false; unit = "Load" }
                        SelectChip(retail, "Produk retail") { retail = true; selfService = false; unit = "pcs" }
                    }
                    SectionLabel("Satuan layanan")
                    if (selfService) FeedbackBanner("Self-service dihitung per 1 mesin cuci dengan satuan Load.")
                    else {
                        ChipRow { SelectChip(unit == "kg", "Kilogram (kg)") { unit = "kg" }; SelectChip(unit == "pcs", "Satuan (pcs)") { unit = "pcs" }; SelectChip(unit !in listOf("kg", "pcs"), "Lainnya") { unit = "" } }
                        if (unit !in listOf("kg", "pcs")) Field(unit, { unit = it }, "Satuan khusus")
                    }
                    Field(price.toString(), { price = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Harga", number = true)
                    Field(commission.toString(), { commission = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Komisi petugas per ${if (selfService) "Load" else unit.ifBlank { "satuan" }}", number = true)
                    Text("Komisi disalin ke rincian Service saat transaksi dibuat, sehingga perubahan tarif berikutnya tidak mengubah laporan lama.", color = Muted, fontSize = 12.sp)
                    ChipRow {
                        if (!selfService) SelectChip(dropOut, "Drop-out") { dropOut = !dropOut }
                    }
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan") {
                        if (name.isBlank()) {
                            toast("Nama wajib")
                            return@PrimaryBtn
                        }
                        val e = editing
                        if (e == null) store.addService(name, unit, price, retail, dropOut, selfService, commission)
                        else store.updateService(e.id, name, unit, price, retail, dropOut, selfService, commission)
                        toast("Layanan tersimpan")
                        creating = false
                        editing = null
                    }
                    if (editing != null) {
                        DangerBtn("Hapus layanan") {
                            store.deleteService(editing!!.id)?.let { toast(it) } ?: run {
                                toast("Dihapus")
                                creating = false
                                editing = null
                            }
                        }
                    }
                    GhostBtn("Batal") { creating = false; editing = null }
                }
            }
        }
        if (!creating && editing == null) items(store.services, key = { it.id }) { s ->
            CardBlock(Modifier.clickable { editing = s; creating = false; fill(s) }) {
                Text(s.name, fontWeight = FontWeight.Bold)
                Text("${rp(s.price)} / ${s.unit}", color = Muted, fontSize = 13.sp)
                ChipRow {
                    if (s.commissionPerUnit > 0) Chip("Komisi ${rp(s.commissionPerUnit)} / ${s.unit}", Green)
                    if (s.retail) Chip("Retail", Teal)
                    if (s.selfService) Chip("Self-service · Load", Teal)
                    if (s.dropOut) Chip("DO", Amber)
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun ProductsScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var editing by remember { mutableStateOf<Product?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val tap = rememberTapFeedback()
    LaunchedEffect(creating, editing) { if (creating || editing != null) { tap(); listState.animateScrollToItem(0) } }
    var name by remember { mutableStateOf("") }
    var stock by remember { mutableIntStateOf(0) }
    var min by remember { mutableIntStateOf(0) }
    var initialBranchId by rememberSaveable { mutableStateOf(store.branches.firstOrNull()?.id.orEmpty()) }
    fun fill(p: Product?) {
        name = p?.name.orEmpty()
        stock = p?.stock ?: 0
        min = p?.min ?: 0
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), state = listState, verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Produk stok", "Sabun, softener, dll", onBack = { nav.popBackStack() }) }
        if (!creating && editing == null) item { PrimaryBtn("Produk baru", icon = Icons.Outlined.Add) { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah produk" else "Produk baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    if (creating) {
                        SectionLabel("Stok awal cabang")
                        ChipRow {
                            store.branches.forEach { branch ->
                                SelectChip(initialBranchId == branch.id, branch.name.removePrefix("Cuciin ")) { initialBranchId = branch.id }
                            }
                        }
                        Field(stock.toString(), { stock = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Stok awal di cabang terpilih", number = true)
                        Text("Cabang lain dimulai dari 0 dan dapat diisi melalui menu Stok.", color = Muted, fontSize = 12.sp)
                    }
                    Field(min.toString(), { min = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Minimum", number = true)
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan") {
                        if (name.isBlank()) {
                            toast("Nama wajib")
                            return@PrimaryBtn
                        }
                        val e = editing
                        if (e == null) store.addProduct(name, stock, min, initialBranchId)
                        else store.updateProduct(e.key, name, min)
                        toast("Produk tersimpan")
                        creating = false
                        editing = null
                    }
                    if (editing != null) {
                        DangerBtn("Hapus produk") {
                            store.deleteProduct(editing!!.key)?.let { toast(it) } ?: run {
                                toast("Dihapus")
                                creating = false
                                editing = null
                            }
                        }
                    }
                    GhostBtn("Batal") { creating = false; editing = null }
                }
            }
        }
        if (!creating && editing == null) items(store.products, key = { it.key }) { p ->
            CardBlock(Modifier.clickable { editing = p; creating = false; fill(p) }) {
                Text(p.name, fontWeight = FontWeight.Bold)
                Text("Batas minimum ${p.min}", color = Muted, fontSize = 13.sp)
                store.branches.forEach { branch ->
                    Text("${branch.name}: ${store.stockOf(p.key, branch.id)}", color = Ink, fontSize = 13.sp)
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}
