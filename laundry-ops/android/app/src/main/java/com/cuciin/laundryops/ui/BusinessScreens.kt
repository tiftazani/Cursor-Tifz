package com.cuciin.laundryops.ui

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.data.*
import com.cuciin.laundryops.ui.components.*
import com.cuciin.laundryops.ui.theme.*
import java.time.LocalDateTime
import java.io.File

private val businessStore get() = CuciinStore

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun InventoryScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val session = businessStore.session.value ?: return
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    businessStore.revision.intValue
    val allowedBranches = if (session.role == Role.Owner) businessStore.branches.toList() else businessStore.branches.filter { it.id == session.branchId }
    var branchId by rememberSaveable { mutableStateOf(session.branchId) }
    var editing by remember { mutableStateOf<InventoryItem?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(InventoryCategory.MesinCuci) }
    var brand by remember { mutableStateOf("") }
    var serial by remember { mutableStateOf("") }
    var quantity by remember { mutableStateOf("1") }
    var unit by remember { mutableStateOf("unit") }
    var status by remember { mutableStateOf(InventoryStatus.Normal) }
    var purchaseAt by remember { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE))) }
    var notes by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf<InventoryCategory?>(null) }

    fun fill(row: InventoryItem?) {
        editing = row
        name = row?.name.orEmpty(); category = row?.category ?: InventoryCategory.MesinCuci
        brand = row?.brand.orEmpty(); serial = row?.serialNumber.orEmpty(); quantity = row?.quantity?.toString() ?: "1"
        unit = row?.unit ?: "unit"; status = row?.status ?: InventoryStatus.Normal
        purchaseAt = row?.purchaseAt?.takeIf { DisplayDates.parse(it) != null } ?: DisplayDates.encode(LocalDateTime.now(Clock.ZONE)); notes = row?.notes.orEmpty()
        if (row != null) branchId = row.branchId
    }

    val assetCategories = InventoryCategory.entries.filter { it !in setOf(InventoryCategory.BarangJual, InventoryCategory.BahanHabisPakai) }
    val rows = businessStore.inventory.filter { it.branchId == branchId && it.category in assetCategories && (filter == null || it.category == filter) }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { ScreenHeader("Aset & mesin cabang", "Mesin dan peralatan operasional; produk dan bahan ada di Produk stok", onBack = { nav.popBackStack() }) }
        if (allowedBranches.size > 1) item {
            FilterBar(
                label = "Cabang",
                value = businessStore.branch(branchId).name.removePrefix("Cuciin "),
                detail = "Saring aset dan mesin berdasarkan satu cabang",
                icon = Icons.Outlined.Storefront,
                onClick = { showBranchSheet = true },
            )
        }
        item {
            CardBlock {
                SectionLabel("Filter kategori")
                ChipRow {
                    SelectChip(filter == null, "Semua") { filter = null }
                    assetCategories.forEach { value -> SelectChip(filter == value, value.label) { filter = value } }
                }
            }
        }
        if (!creating && editing == null) item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrimaryBtn("Tambah aset", Modifier.weight(1f), icon = Icons.Outlined.Add) { creating = true; fill(null) }
                GhostBtn("Ekspor", Modifier.weight(.65f), icon = Icons.Outlined.FileDownload) { FileExports.shareInventory(ctx, rows) }
            }
        }
        if (creating || editing != null) item {
            CardBlock(accent = Teal) {
                SectionLabel(if (editing == null) "Aset baru" else "Ubah aset")
                Field(name, { name = it }, "Nama aset")
                SectionLabel("Kategori")
                ChipRow { assetCategories.forEach { value -> SelectChip(category == value, value.label) { category = value } } }
                Field(brand, { brand = it }, "Merek / pembuat")
                Field(serial, { serial = it }, "Nomor seri / kode aset")
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.weight(1f)) { Field(quantity, { quantity = it.filter(Char::isDigit).take(7) }, "Jumlah", number = true) }
                    Box(Modifier.weight(1f)) { Field(unit, { unit = it }, "Satuan") }
                }
                SectionLabel("Kondisi")
                ChipRow { InventoryStatus.entries.forEach { value -> SelectChip(status == value, value.label) { status = value } } }
                DateTimeFields(DisplayDates.parse(purchaseAt) ?: LocalDateTime.now(Clock.ZONE), { purchaseAt = DisplayDates.encode(it) }, "Tanggal beli / mulai dipakai")
                Field(notes, { notes = it }, "Catatan lokasi, kapasitas, atau perawatan")
                PrimaryBtn("Simpan inventory", enabled = name.isNotBlank() && (quantity.toIntOrNull() ?: -1) >= 0, icon = Icons.Outlined.Check) {
                    val old = editing
                    if (old == null) businessStore.addInventory(branchId, name, category, brand, serial, quantity.toIntOrNull() ?: 0, unit, status, purchaseAt, notes, sellable = false)
                    else businessStore.updateInventory(old.copy(branchId = branchId, name = name, category = category, brand = brand, serialNumber = serial, quantity = quantity.toIntOrNull() ?: 0, unit = unit, status = status, purchaseAt = purchaseAt, notes = notes, sellable = false))
                    toast("Aset tersimpan untuk ${businessStore.branch(branchId).name}"); creating = false; editing = null
                }
                if (editing != null) DangerBtn("Hapus aset") { businessStore.deleteInventory(editing!!.id)?.let(toast) ?: run { editing = null; toast("Aset dihapus") } }
                GhostBtn("Batal") { creating = false; editing = null }
            }
        }
        if (!creating && editing == null && rows.isEmpty()) item { EmptyHint("Aset belum dicatat", "Tambahkan mesin cuci, mesin pengering, peralatan, bahan, atau barang jual untuk cabang ini.") }
        if (!creating && editing == null && rows.isNotEmpty()) item {
            ListCard {
                rows.forEachIndexed { index, row ->
                    ListRow(
                        mark = row.name,
                        title = row.name,
                        detail = listOf(
                            row.category.label,
                            row.brand.ifBlank { "tanpa merek" },
                            "${row.quantity} ${row.unit}",
                            row.serialNumber.takeIf(String::isNotBlank).orEmpty(),
                            row.notes,
                        ).filter { it.isNotBlank() }.joinToString(" · "),
                        trailing = {
                            Chip(
                                row.status.label,
                                when (row.status) {
                                    InventoryStatus.Normal -> Green
                                    InventoryStatus.PerluPerbaikan -> Amber
                                    InventoryStatus.Rusak -> Coral
                                },
                            )
                        },
                        onClick = { fill(row) },
                    )
                    if (index < rows.lastIndex) RowDivider()
                }
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            allowedBranches.forEach { branch ->
                FilterSheetRow(branch.id == branchId, branch.name, "${businessStore.inventory.count { it.branchId == branch.id }} aset tercatat") {
                    branchId = branch.id; editing = null; creating = false; showBranchSheet = false
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ExpensesScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val session = businessStore.session.value ?: return
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    businessStore.revision.intValue
    val allowedBranches = if (session.role == Role.Owner) businessStore.branches.toList() else businessStore.branches.filter { it.id == session.branchId }
    var branchId by rememberSaveable { mutableStateOf(session.branchId) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var category by remember { mutableStateOf(ExpenseCategory.Gaji) }
    var amount by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var time by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE))) }
    val parsedTime = DisplayDates.parse(time) ?: LocalDateTime.now(Clock.ZONE)
    val rows = businessStore.expenses.filter { it.branchId == branchId }.sortedByDescending { it.occurredAtMs }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { ScreenHeader("Biaya operasional", "Semua pengeluaran tercatat per cabang", onBack = { nav.popBackStack() }) }
        if (allowedBranches.size > 1) item {
            FilterBar(
                label = "Cabang",
                value = businessStore.branch(branchId).name.removePrefix("Cuciin "),
                detail = "Saring biaya operasional berdasarkan satu cabang",
                icon = Icons.Outlined.Storefront,
                onClick = { showBranchSheet = true },
            )
        }
        item { Hero("Total biaya cabang", rp(rows.sumOf { it.amount }), listOf("${rows.size} transaksi biaya", businessStore.branch(branchId).name)) }
        if (!creating) item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrimaryBtn("Catat biaya", Modifier.weight(1f), icon = Icons.Outlined.Add) { creating = true }
                GhostBtn("Ekspor", Modifier.weight(.65f), icon = Icons.Outlined.FileDownload) { FileExports.shareExpenses(ctx, rows) }
            }
        }
        if (creating) item {
            CardBlock(accent = Coral) {
                SectionLabel("Biaya baru")
                ChipRow { ExpenseCategory.entries.forEach { value -> SelectChip(category == value, value.label) { category = value } } }
                Field(amount, { amount = it.filter(Char::isDigit).take(10) }, "Nominal biaya", number = true)
                DateTimeFields(parsedTime, { time = DisplayDates.encode(it) }, "Waktu biaya")
                Field(note, { note = it }, "Keterangan / penerima")
                PrimaryBtn("Simpan biaya", enabled = (amount.toIntOrNull() ?: 0) > 0 && note.isNotBlank(), icon = Icons.Outlined.Check) {
                    businessStore.addExpense(branchId, category, amount.toInt(), parsedTime.atZone(Clock.ZONE).toInstant().toEpochMilli(), note)
                    toast("Biaya tercatat di ${businessStore.branch(branchId).name}"); amount = ""; note = ""; creating = false
                }
                GhostBtn("Batal") { creating = false }
            }
        }
        if (rows.isEmpty()) item { EmptyHint("Belum ada biaya", "Gaji, sewa, listrik, perawatan mesin, dan biaya lain akan tampil di sini.") }
        if (rows.isNotEmpty()) item {
            ListCard {
                rows.forEachIndexed { index, row ->
                    ListRow(
                        mark = row.category.label,
                        title = row.category.label,
                        detail = listOf(row.occurredAt, row.by, row.note).filter { it.isNotBlank() }.joinToString(" · "),
                        showChevron = false,
                        trailing = {
                            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(rp(row.amount), color = Coral, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Surface(
                                    onClick = { businessStore.deleteExpense(row.id)?.let(toast) ?: toast("Biaya dihapus") },
                                    shape = CircleShape,
                                    color = Surface2,
                                    modifier = Modifier.size(44.dp),
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(Icons.Outlined.Delete, "Hapus biaya", tint = Coral, modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                        },
                    )
                    if (index < rows.lastIndex) RowDivider()
                }
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            allowedBranches.forEach { branch ->
                FilterSheetRow(branch.id == branchId, branch.name, "${businessStore.expenses.count { it.branchId == branch.id }} biaya tercatat") {
                    branchId = branch.id; creating = false; showBranchSheet = false
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AttendanceScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val session = businessStore.session.value ?: return
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    businessStore.revision.intValue
    var branchId by rememberSaveable { mutableStateOf(session.branchId) }
    var note by rememberSaveable { mutableStateOf("") }
    var checkInPhotoPath by rememberSaveable { mutableStateOf("") }
    var checkOutPhotoPath by rememberSaveable { mutableStateOf("") }
    var pendingCheckIn by remember { mutableStateOf<File?>(null) }
    var pendingCheckOut by remember { mutableStateOf<File?>(null) }
    val allowedBranches = if (session.role == Role.Owner) businessStore.branches.toList()
    else businessStore.branches.filter { it.id == session.branchId }
    val today = businessStore.todayAttendance(session.email)
    val rows = if (session.role == Role.Owner) businessStore.visibleAttendance(branchIds = setOf(branchId))
    else businessStore.visibleAttendance()
    val tap = rememberTapFeedback()
    val takeCheckIn = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
        val file = pendingCheckIn
        if (taken && file != null) {
            checkInPhotoPath = AttendancePhotos.stamp(file, "masuk", session.name, businessStore.branch(branchId).name).orEmpty()
            if (checkInPhotoPath.isBlank()) toast("Foto belum dapat diproses. Coba ambil kembali.")
        } else if (!taken) toast("Foto absensi masuk dibatalkan")
        pendingCheckIn = null
    }
    val takeCheckOut = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
        val file = pendingCheckOut
        if (taken && file != null) {
            checkOutPhotoPath = AttendancePhotos.stamp(file, "pulang", session.name, businessStore.branch(branchId).name).orEmpty()
            if (checkOutPhotoPath.isBlank()) toast("Foto belum dapat diproses. Coba ambil kembali.")
        } else if (!taken) toast("Foto absensi pulang dibatalkan")
        pendingCheckOut = null
    }

    fun durationLabel(row: AttendanceRecord): String {
        val end = row.checkOutAtMs ?: Clock.nowMs()
        val minutes = ((end - row.checkInAtMs).coerceAtLeast(0) / 60_000).toInt()
        return "${minutes / 60} jam ${minutes % 60} menit"
    }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 28.dp),
    ) {
        item { ScreenHeader("Absensi karyawan", "Jam masuk dan pulang tercatat per cabang", onBack = { nav.popBackStack() }) }
        item {
            CardBlock(accent = if (today?.checkOutAtMs == null) Teal else Green) {
                SectionLabel("Absensi saya hari ini")
                if (today == null) {
                    Text("Belum absen masuk", fontSize = 22.sp, fontWeight = FontWeight.Black, color = Ink)
                    Text("Pilih cabang tempat bekerja, lalu tekan Absen masuk.", color = Muted, fontSize = 12.sp)
                } else {
                    InfoRow(Icons.Outlined.Login, "Masuk", today.checkInAt)
                    InfoRow(Icons.Outlined.Logout, "Pulang", today.checkOutAt ?: "Shift masih berjalan")
                    Text(durationLabel(today), color = Teal, fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            CardBlock {
                SectionLabel("Lokasi kerja")
                FilterBar(
                    label = "Cabang",
                    value = businessStore.branch(branchId).name.removePrefix("Cuciin "),
                    detail = "Pilih cabang tempat Anda bekerja hari ini",
                    icon = Icons.Outlined.Storefront,
                    onClick = { if (allowedBranches.size > 1) showBranchSheet = true },
                )
                Field(note, { note = it.take(160) }, "Catatan shift (opsional)")
                if (today == null) {
                    GhostBtn(if (checkInPhotoPath.isBlank()) "Ambil foto masuk" else "Foto masuk siap", icon = Icons.Outlined.PhotoCamera) {
                        val target = AttendancePhotos.createTarget(ctx, "masuk")
                        pendingCheckIn = target.first
                        takeCheckIn.launch(target.second)
                    }
                    PrimaryBtn("Absen masuk", enabled = checkInPhotoPath.isNotBlank(), icon = Icons.Outlined.Login) {
                        tap()
                        businessStore.checkIn(branchId, note, checkInPhotoPath)?.let(toast) ?: run { note = ""; checkInPhotoPath = ""; toast("Absen masuk berhasil dicatat") }
                    }
                } else if (today.checkOutAtMs == null) {
                    GhostBtn(if (checkOutPhotoPath.isBlank()) "Ambil foto pulang" else "Foto pulang siap", icon = Icons.Outlined.PhotoCamera) {
                        val target = AttendancePhotos.createTarget(ctx, "pulang")
                        pendingCheckOut = target.first
                        takeCheckOut.launch(target.second)
                    }
                    PrimaryBtn("Absen pulang", enabled = checkOutPhotoPath.isNotBlank(), icon = Icons.Outlined.Logout) {
                        tap()
                        businessStore.checkOut(note, checkOutPhotoPath)?.let(toast) ?: run { note = ""; checkOutPhotoPath = ""; toast("Absen pulang berhasil dicatat") }
                    }
                } else {
                    FeedbackBanner("Absensi hari ini sudah lengkap.")
                }
            }
        }
        item { SectionLabel(if (session.role == Role.Owner) "Riwayat cabang" else "Riwayat saya") }
        item { GhostBtn("Ekspor absensi CSV", icon = Icons.Outlined.FileDownload) { FileExports.shareAttendance(ctx, rows) } }
        if (rows.isEmpty()) item { EmptyHint("Belum ada absensi", "Riwayat absen masuk dan pulang akan tampil di sini.") }
        items(rows, key = { it.id }) { row ->
            CardBlock {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text(row.staffName, fontWeight = FontWeight.Bold)
                        Text(businessStore.branches.firstOrNull { it.id == row.branchId }?.name ?: row.branchId, color = Muted, fontSize = 12.sp)
                    }
                    Chip(if (row.checkOutAtMs == null) "Aktif" else "Lengkap", if (row.checkOutAtMs == null) Amber else Green)
                }
                InfoRow(Icons.Outlined.Schedule, "Jam kerja", "${row.checkInAt} sampai ${row.checkOutAt ?: "sekarang"}")
                Text("Durasi ${durationLabel(row)}", color = Ink, fontWeight = FontWeight.SemiBold)
                AttendancePhotoPreview(row.checkInPhotoPath, "Foto masuk tersimpan di perangkat")
                if (row.checkOutPhotoPath.isNotBlank()) AttendancePhotoPreview(row.checkOutPhotoPath, "Foto pulang tersimpan di perangkat")
                if (row.note.isNotBlank()) Text(row.note, color = Muted, fontSize = 12.sp)
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang kerja", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            allowedBranches.forEach { branch ->
                FilterSheetRow(branch.id == branchId, branch.name, null) { branchId = branch.id; showBranchSheet = false }
            }
        }
    }
}

@Composable
private fun AttendancePhotoPreview(path: String, label: String) {
    val image = remember(path) { path.takeIf { it.isNotBlank() }?.let { BitmapFactory.decodeFile(it)?.asImageBitmap() } }
    if (image == null) Text(label, color = Muted, fontSize = 12.sp)
    else {
        Image(image, label, modifier = Modifier.fillMaxWidth().height(150.dp))
        Text(label, color = Muted, fontSize = 12.sp)
    }
}
