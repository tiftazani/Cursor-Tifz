package com.tiftazani.laundryops.ui

import android.content.Intent
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
    var editing by remember { mutableStateOf<Customer?>(null) }
    var creating by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    fun fill(c: Customer?) {
        name = c?.name.orEmpty()
        phone = c?.phone.orEmpty()
        address = c?.address.orEmpty()
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Pelanggan", if (pickMode) "Tap nama untuk pilih ke nota" else "Tambah · ubah · hapus", onBack = { nav.popBackStack() }) }
        item { PrimaryBtn("Pelanggan baru") { creating = true; editing = null; fill(null) } }
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
                    if (editing != null) {
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
        if (store.customers.isEmpty()) item { EmptyHint("Belum ada pelanggan", "Tambah dulu sebelum bikin nota.") }
        items(store.customers, key = { it.id }) { c ->
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
                Text(c.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("${c.phone} · ${c.address}", color = Muted, fontSize = 13.sp)
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
internal fun BranchesScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    var editing by remember { mutableStateOf<Branch?>(null) }
    var creating by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var maps by remember { mutableStateOf("") }
    fun fill(b: Branch?) {
        name = b?.name.orEmpty()
        code = b?.code.orEmpty()
        location = b?.location.orEmpty()
        maps = b?.mapsQuery.orEmpty()
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Cabang", "Nama · lokasi · Maps", onBack = { nav.popBackStack() }) }
        item { PrimaryBtn("Cabang baru") { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah cabang" else "Cabang baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    Field(code, { code = it }, "Kode nota (MEL)")
                    Field(location, { location = it }, "Lokasi")
                    Field(maps, { maps = it }, "Titik Maps / alamat")
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan") {
                        if (name.isBlank() || code.isBlank()) {
                            toast("Nama dan kode wajib")
                            return@PrimaryBtn
                        }
                        val e = editing
                        if (e == null) store.addBranch(name, code, location, maps)
                        else store.updateBranch(e.id, name, code, location, maps)
                        toast("Cabang tersimpan")
                        creating = false
                        editing = null
                    }
                    if (editing != null) {
                        DangerBtn("Hapus cabang") {
                            store.deleteBranch(editing!!.id)?.let { toast(it) } ?: run {
                                toast("Cabang dihapus")
                                creating = false
                                editing = null
                            }
                        }
                    }
                    GhostBtn("Batal") { creating = false; editing = null }
                }
            }
        }
        items(store.branches, key = { it.id }) { b ->
            val kasir = store.staff.filter { it.role == Role.Kasir && it.approved && b.id in it.branchIds }
            val spv = store.staff.filter { it.role == Role.Supervisor && it.approved && b.id in it.branchIds }
            CardBlock(Modifier.clickable { editing = b; creating = false; fill(b) }) {
                Text(b.name, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Text(b.location, color = Muted, fontSize = 13.sp)
                Text("Kasir: ${kasir.joinToString { it.name }.ifBlank { "—" }}", fontSize = 13.sp, color = Ink)
                Text("SPV: ${spv.joinToString { it.name }.ifBlank { "—" }}", fontSize = 13.sp, color = Ink)
                Chip("Kode ${b.code}", Teal)
                GhostBtn("Buka Google Maps") {
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(b.mapsQuery)} (${b.name})")))
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
    var creating by remember { mutableStateOf(false) }
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
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("User", "Kasir, SPV, Owner — tambah · ubah · hapus", onBack = { nav.popBackStack() }) }
        item { PrimaryBtn("User baru") { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah user" else "User baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    Field(email, { email = it }, "Email")
                    Field(pass, { pass = it }, if (editing != null) "Password baru (kosong = tetap)" else "Password (boleh kosong)", password = true)
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
                            store.updateStaff(editing!!.email, name, role, bids, pass.ifBlank { null })
                        }
                        if (err != null) toast(err) else {
                            toast("User tersimpan")
                            creating = false
                            editing = null
                        }
                    }
                    if (editing != null) {
                        DangerBtn("Hapus user") {
                            store.deleteStaff(editing!!.email)?.let { toast(it) } ?: run {
                                toast("User dihapus")
                                creating = false
                                editing = null
                            }
                        }
                    }
                    GhostBtn("Batal") { creating = false; editing = null }
                }
            }
        }
        items(store.staff.toList(), key = { it.email }) { u ->
            CardBlock(Modifier.clickable { editing = u; creating = false; fill(u) }) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AvatarMark(u.name)
                    Column(Modifier.weight(1f)) {
                        Text(u.name, fontWeight = FontWeight.Bold)
                        Text("${u.role} · ${u.email}", color = Muted, fontSize = 12.sp)
                        Text(u.branchIds.joinToString { id -> store.branches.find { it.id == id }?.name ?: id }, color = Muted, fontSize = 12.sp)
                        Chip(if (u.approved) "Aktif" else "Pending", if (u.approved) Green else Amber)
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
    var creating by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("kg") }
    var price by remember { mutableIntStateOf(0) }
    var retail by remember { mutableStateOf(false) }
    var dropOut by remember { mutableStateOf(false) }
    fun fill(s: ServiceItem?) {
        name = s?.name.orEmpty()
        unit = s?.unit ?: "kg"
        price = s?.price ?: 0
        retail = s?.retail ?: false
        dropOut = s?.dropOut ?: false
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Layanan & harga", "Katalog nota — tambah · ubah · hapus", onBack = { nav.popBackStack() }) }
        item { PrimaryBtn("Layanan baru") { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah layanan" else "Layanan baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    Field(unit, { unit = it }, "Satuan (kg / pcs)")
                    Field(price.toString(), { price = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Harga", number = true)
                    ChipRow {
                        SelectChip(retail, "Retail / potong stok") { retail = !retail }
                        SelectChip(dropOut, "Drop-out") { dropOut = !dropOut }
                    }
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan") {
                        if (name.isBlank()) {
                            toast("Nama wajib")
                            return@PrimaryBtn
                        }
                        val e = editing
                        if (e == null) store.addService(name, unit, price, retail, dropOut)
                        else store.updateService(e.id, name, unit, price, retail, dropOut)
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
        items(store.services, key = { it.id }) { s ->
            CardBlock(Modifier.clickable { editing = s; creating = false; fill(s) }) {
                Text(s.name, fontWeight = FontWeight.Bold)
                Text("${rp(s.price)} / ${s.unit}", color = Muted, fontSize = 13.sp)
                ChipRow {
                    if (s.retail) Chip("Retail", Teal)
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
    var creating by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var stock by remember { mutableIntStateOf(0) }
    var min by remember { mutableIntStateOf(0) }
    fun fill(p: Product?) {
        name = p?.name.orEmpty()
        stock = p?.stock ?: 0
        min = p?.min ?: 0
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Produk stok", "Sabun, softener, dll", onBack = { nav.popBackStack() }) }
        item { PrimaryBtn("Produk baru") { creating = true; editing = null; fill(null) } }
        if (creating || editing != null) {
            item {
                CardBlock(accent = Teal) {
                    Text(if (editing != null) "Ubah produk" else "Produk baru", fontWeight = FontWeight.Bold)
                    Field(name, { name = it }, "Nama")
                    if (creating) Field(stock.toString(), { stock = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Stok awal", number = true)
                    Field(min.toString(), { min = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, "Minimum", number = true)
                    Spacer(Modifier.height(8.dp))
                    PrimaryBtn("Simpan") {
                        if (name.isBlank()) {
                            toast("Nama wajib")
                            return@PrimaryBtn
                        }
                        val e = editing
                        if (e == null) store.addProduct(name, stock, min)
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
        items(store.products, key = { it.key }) { p ->
            CardBlock(Modifier.clickable { editing = p; creating = false; fill(p) }) {
                Text(p.name, fontWeight = FontWeight.Bold)
                Text("Sisa ${p.stock} · min ${p.min}", color = Muted, fontSize = 13.sp)
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}
