package com.cuciin.laundryops.ui

import android.content.Intent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.ui.Alignment
import com.cuciin.laundryops.ui.components.FeedbackBanner
import com.cuciin.laundryops.ui.components.InfoRow
import com.cuciin.laundryops.ui.components.rememberTapFeedback
import com.cuciin.laundryops.ui.components.Eyebrow
import com.cuciin.laundryops.ui.components.ListCard
import com.cuciin.laundryops.ui.components.ListRow
import com.cuciin.laundryops.ui.components.RowDivider
import com.cuciin.laundryops.ui.components.SearchField
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Surface2

import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import com.cuciin.laundryops.data.Branch
import com.cuciin.laundryops.data.Customer
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.Product
import com.cuciin.laundryops.data.ProductKind
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.data.ServiceItem
import com.cuciin.laundryops.data.Staff
import com.cuciin.laundryops.data.rp
import com.cuciin.laundryops.ui.components.AvatarMark
import com.cuciin.laundryops.ui.components.CardBlock
import com.cuciin.laundryops.ui.components.Chip
import com.cuciin.laundryops.ui.components.ChipRow
import com.cuciin.laundryops.ui.components.DangerBtn
import com.cuciin.laundryops.ui.components.EmptyHint
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.components.SectionLabel
import com.cuciin.laundryops.ui.components.SelectChip
import com.cuciin.laundryops.ui.theme.Amber
import com.cuciin.laundryops.ui.theme.Green
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Muted
import com.cuciin.laundryops.ui.theme.Teal

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
        if (!creating && editing == null) {
            val shown = store.customers.filter { it.name.contains(search, true) || it.phone.contains(search) }
            if (shown.isNotEmpty()) item {
                ListCard {
                    shown.forEachIndexed { index, c ->
                        ListRow(
                            mark = c.name,
                            title = c.name,
                            detail = listOf(c.phone, c.address).filter { it.isNotBlank() }.joinToString(" · "),
                            showChevron = !pickMode,
                            onClick = {
                                if (pickMode) {
                                    store.selectedCustomer.value = c
                                    nav.popBackStack()
                                } else {
                                    editing = c
                                    creating = false
                                    fill(c)
                                }
                            },
                        )
                        if (index < shown.lastIndex) RowDivider()
                    }
                }
            }
            if (shown.isEmpty() && search.isNotBlank()) item { EmptyHint("Pelanggan tidak ditemukan", "Tidak ada nama atau nomor yang cocok dengan \"$search\".") }
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
    var branchQuery by rememberSaveable { mutableStateOf("") }
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
        item {
            ScreenHeader("Cabang", null, onBack = { nav.popBackStack() }) {
                if (!creating && editing == null) {
                    Surface(onClick = { creating = true; editingId = null; fill(null) }, modifier = Modifier.size(44.dp), shape = CircleShape, color = Surface2) {
                        Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Add, "Cabang baru", tint = Ink, modifier = Modifier.size(20.dp)) }
                    }
                }
            }
        }
        if (!creating && editing == null) item {
            // Header menyebut jumlah cabang yang benar-benar ada, bukan angka tetap.
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Eyebrow("Master data")
                Text("${store.branches.size} cabang terdaftar", fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.4).sp, color = Ink)
            }
        }
        if (!creating && editing == null) item {
            SearchField(branchQuery, { branchQuery = it }, "Cari nama, kode, atau alamat")
        }
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
        if (!creating && editing == null) {
            val shown = store.branches.filter { b ->
                branchQuery.isBlank() ||
                    b.name.contains(branchQuery, true) ||
                    b.code.contains(branchQuery, true) ||
                    b.location.contains(branchQuery, true)
            }
            if (shown.isEmpty()) item {
                EmptyHint("Cabang tidak ditemukan", "Tidak ada cabang yang cocok dengan \"$branchQuery\". Ubah kata kunci atau kosongkan pencarian.")
            } else item {
                // Daftar baris, bukan tumpukan kartu: dengan puluhan cabang, satu baris
                // per cabang jauh lebih mudah dipindai dan digulir.
                ListCard {
                    shown.forEachIndexed { index, b ->
                        val kasir = store.staff.count { it.role == Role.Kasir && it.approved && b.id in it.branchIds }
                        val spv = store.staff.count { it.role == Role.Supervisor && it.approved && b.id in it.branchIds }
                        val kota = b.location.substringBefore(",").trim().ifBlank { "Alamat belum diisi" }
                        val petugas = buildString {
                            append("$kasir kasir")
                            append(" · ")
                            append(if (spv > 0) "$spv SPV" else "belum ada SPV")
                        }
                        ListRow(
                            mark = b.code,
                            title = b.name,
                            detail = "$kota · $petugas",
                            onClick = { editingId = b.id; creating = false; fill(b) },
                        )
                        if (index < shown.lastIndex) RowDivider()
                    }
                }
            }
            item {
                Text(
                    "${shown.size} dari ${store.branches.size} cabang ditampilkan",
                    color = Muted,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun UsersScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val session = store.session.value ?: return
    if (session.role != Role.Owner) { nav.popBackStack(); return }
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
    var userQuery by rememberSaveable { mutableStateOf("") }
    var roleFilter by rememberSaveable { mutableStateOf<Role?>(null) }
    fun fill(u: Staff?) {
        name = u?.name.orEmpty()
        email = u?.email.orEmpty()
        pass = ""
        role = u?.role ?: Role.Kasir
        branches = u?.branchIds?.toSet() ?: setOf(store.branches.first().id)
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), state = listState, verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Daftar User", "Owner, kasir, SPV, dan akses cabang", onBack = { nav.popBackStack() }) }
        if (!creating && editing == null) {
            item { PrimaryBtn("Tambah user", icon = Icons.Outlined.Add) { creating = true; editing = null; fill(null) } }
            item { SearchField(userQuery, { userQuery = it }, "Cari nama atau email") }
            item {
                ChipRow {
                    SelectChip(roleFilter == null, "Semua") { roleFilter = null }
                    SelectChip(roleFilter == Role.Owner, "Owner") { roleFilter = Role.Owner }
                    SelectChip(roleFilter == Role.Kasir, "Kasir") { roleFilter = Role.Kasir }
                    SelectChip(roleFilter == Role.Supervisor, "SPV") { roleFilter = Role.Supervisor }
                }
            }
        }
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
                    if (editing != null && !editing!!.approved) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            PrimaryBtn("Setujui", modifier = Modifier.weight(1f)) {
                                store.approve(editing!!.name, true)
                                toast("User disetujui")
                                editing = null
                            }
                            GhostBtn("Tolak", modifier = Modifier.weight(1f)) {
                                store.deleteStaff(editing!!.email)?.let { toast(it) } ?: toast("Permohonan ditolak")
                                editing = null
                            }
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
        if (!creating && editing == null) {
            val shown = store.staff
                .filter { user ->
                    (roleFilter == null || user.role == roleFilter) &&
                        (userQuery.isBlank() || user.name.contains(userQuery, true) || user.email.contains(userQuery, true))
                }
                .sortedWith(compareBy<Staff> { when (it.role) { Role.Owner -> 0; Role.Supervisor -> 1; Role.Kasir -> 2 } }.thenBy { it.name.lowercase() })
            if (shown.isEmpty()) {
                item { EmptyHint("User tidak ditemukan", "Ubah kata kunci atau pilih filter peran lain.") }
            } else {
                item {
                    ListCard {
                        shown.forEachIndexed { index, user ->
                            val roleLabel = if (user.role == Role.Supervisor) "SPV" else user.role.name
                            val branchLabel = user.branchIds.joinToString { id -> store.branches.find { it.id == id }?.name ?: id }
                            ListRow(
                                mark = user.name,
                                title = user.name,
                                detail = "$roleLabel · ${user.email}\n${branchLabel.ifBlank { "Belum ada cabang" }}",
                                trailing = { Chip(if (user.approved) "Aktif" else "Menunggu", if (user.approved) Green else Amber) },
                                onClick = { editing = user; creating = false; fill(user) },
                            )
                            if (index < shown.lastIndex) RowDivider()
                        }
                    }
                }
                item { Text("${shown.size} dari ${store.staff.size} user ditampilkan", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp)) }
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
    var productKey by remember { mutableStateOf("") }
    fun fill(s: ServiceItem?) {
        name = s?.name.orEmpty()
        unit = s?.unit ?: "kg"
        price = s?.price ?: 0
        commission = s?.commissionPerUnit ?: 0
        retail = s?.retail ?: false
        dropOut = s?.dropOut ?: false
        selfService = s?.selfService ?: false
        productKey = s?.productKey.orEmpty()
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
                    if (retail) {
                        SectionLabel("Produk stok yang terjual")
                        Text("Pilih satu item Produk stok. Jumlah pada Service akan mengurangi stok cabang transaksi.", color = Muted, fontSize = 12.sp)
                        ChipRow {
                            store.products.filter { it.kind == ProductKind.BarangJual }.forEach { product ->
                                SelectChip(productKey == product.key, product.name) { productKey = product.key; if (name.isBlank()) name = product.name; unit = product.unit }
                            }
                        }
                        if (store.products.none { it.kind == ProductKind.BarangJual }) FeedbackBanner("Tambahkan barang dijual di Produk stok terlebih dahulu.")
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
                        if (retail && productKey.isBlank()) { toast("Pilih produk stok untuk layanan retail"); return@PrimaryBtn }
                        if (e == null) store.addService(name, unit, price, retail, dropOut, selfService, commission, productKey)
                        else store.updateService(e.id, name, unit, price, retail, dropOut, selfService, commission, productKey)
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
        if (!creating && editing == null && store.services.isEmpty()) item { EmptyHint("Belum ada layanan", "Tambahkan layanan dan tarifnya supaya kasir bisa membuat nota.") }
        if (!creating && editing == null) item {
            ListCard {
                store.services.forEachIndexed { index, s ->
                    val flags = buildList {
                        add("${rp(s.price)} / ${s.unit}")
                        if (s.commissionPerUnit > 0) add("komisi ${rp(s.commissionPerUnit)}")
                        if (s.retail) add("retail")
                        if (s.selfService) add("mandiri")
                        if (s.dropOut) add("DO")
                    }.joinToString(" · ")
                    ListRow(
                        mark = s.name,
                        title = s.name,
                        detail = flags,
                        onClick = { editing = s; creating = false; fill(s) },
                    )
                    if (index < store.services.lastIndex) RowDivider()
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
    var kind by remember { mutableStateOf(ProductKind.BahanHabisPakai) }
    var unit by remember { mutableStateOf("pcs") }
    var initialBranchIds by remember { mutableStateOf(setOf(store.branches.firstOrNull()?.id.orEmpty()).filter(String::isNotBlank).toSet()) }
    fun fill(p: Product?) {
        name = p?.name.orEmpty()
        stock = p?.stock ?: 0
        min = p?.min ?: 0
        kind = p?.kind ?: ProductKind.BahanHabisPakai
        unit = p?.unit ?: "pcs"
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), state = listState, verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Produk stok & bahan", "Barang dijual dan bahan habis pakai per cabang", onBack = { nav.popBackStack() }) }
        if (!creating && editing == null) item { GhostBtn("Kelola aset & mesin cabang", icon = Icons.Outlined.Build) { nav.navigate("inventory") } }
        if (!creating && editing == null) item { PrimaryBtn("Produk baru", icon = Icons.Outlined.Add) { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah produk" else "Produk baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    SectionLabel("Jenis item")
                    ChipRow { ProductKind.entries.forEach { value -> SelectChip(kind == value, value.label) { kind = value } } }
                    Field(unit, { unit = it.take(20) }, "Satuan stok (pcs, botol, sachet)")
                    if (creating) {
                        SectionLabel("Cabang penyimpanan awal")
                        ChipRow {
                            store.branches.forEach { branch ->
                                SelectChip(branch.id in initialBranchIds, branch.name.removePrefix("Cuciin ")) {
                                    initialBranchIds = if (branch.id in initialBranchIds) initialBranchIds - branch.id else initialBranchIds + branch.id
                                }
                            }
                        }
                        Field(stock.toString(), { stock = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Stok awal untuk setiap cabang terpilih", number = true)
                        Text("Pilih lebih dari satu cabang bila item tersedia di beberapa lokasi. Cabang lain dimulai dari 0.", color = Muted, fontSize = 12.sp)
                    }
                    Field(min.toString(), { min = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Minimum", number = true)
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan") {
                        if (name.isBlank()) {
                            toast("Nama wajib")
                            return@PrimaryBtn
                        }
                        val e = editing
                        if (e == null) store.addProduct(name, stock, min, initialBranchIds, kind, unit)
                        else store.updateProduct(e.key, name, min, kind, unit)
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
        if (!creating && editing == null && store.products.isEmpty()) item { EmptyHint("Belum ada produk", "Tambahkan bahan habis pakai atau barang jual supaya stok bisa dilacak.") }
        if (!creating && editing == null) item {
            ListCard {
                store.products.forEachIndexed { index, p ->
                    val perBranch = store.branches.joinToString(" · ") { branch -> "${branch.code} ${store.stockOf(p.key, branch.id)}" }
                    ListRow(
                        mark = p.name,
                        title = p.name,
                        detail = "${p.kind.label} · ${p.unit} · minimum ${p.min}\n$perBranch",
                        onClick = { editing = p; creating = false; fill(p) },
                    )
                    if (index < store.products.lastIndex) RowDivider()
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}
