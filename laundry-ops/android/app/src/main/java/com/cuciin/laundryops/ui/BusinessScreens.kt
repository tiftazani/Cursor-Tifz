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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
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
internal fun ExpensesScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val session = businessStore.session.value ?: return
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    businessStore.revision.intValue
    val allowedBranches = if (canViewAllBranches(session)) businessStore.branches.toList() else businessStore.branches.filter { it.id == session.branchId }
    var branchId by rememberSaveable { mutableStateOf(session.branchId) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var category by remember { mutableStateOf(ExpenseCategory.Gaji) }
    var amount by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var time by rememberSaveable { mutableStateOf(DisplayDates.encode(LocalDateTime.now(Clock.ZONE))) }
    val parsedTime = DisplayDates.parse(time) ?: LocalDateTime.now(Clock.ZONE)
    val rows = businessStore.expenses.filter { it.branchId == branchId }.sortedByDescending { it.occurredAtMs }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap), contentPadding = PaddingValues(bottom = 28.dp)) {
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
                // Pintu MENULIS diperiksa fungsinya; rute `expenses` hanya memeriksa modul supaya
                // role kustom tetap dapat MEMBACA daftar biaya.
                if (businessStore.canAccess("expense", "expense.write")) {
                    PrimaryBtn("Catat biaya", Modifier.weight(1f), icon = Icons.Outlined.Add) { creating = true }
                }
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
                    val tersimpan = businessStore.addExpense(branchId, category, amount.toInt(), parsedTime.atZone(Clock.ZONE).toInstant().toEpochMilli(), note)
                    if (tersimpan == null) toast("Akses Catat biaya dicabut untuk role akun ini")
                    else {
                        toast("Biaya tercatat di ${businessStore.branch(branchId).name}"); amount = ""; note = ""; creating = false
                    }
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
    // Koreksi catatan absensi karyawan lain. Hanya tampil bila fungsi `attendance.correct`
    // dimiliki; tanpa itu tombolnya tidak ada dan store pun menolak.
    var editingAttendance by remember { mutableStateOf<AttendanceRecord?>(null) }
    var attendanceNote by remember { mutableStateOf("") }
    val allowedBranches = if (canViewAllBranches(session)) businessStore.branches.toList()
    else businessStore.branches.filter { it.id == session.branchId }
    val today = businessStore.todayAttendance(session.email)
    val rows = if (canViewAllBranches(session)) businessStore.visibleAttendance(branchIds = setOf(branchId))
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
        verticalArrangement = Arrangement.spacedBy(ui.gap),
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
        item { SectionLabel(if (canViewAllBranches(session)) "Riwayat cabang" else "Riwayat saya") }
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
                if (businessStore.canAccess("attendance", "attendance.correct")) {
                    GhostBtn("Koreksi catatan", icon = Icons.Outlined.Edit) {
                        editingAttendance = row
                        attendanceNote = row.note
                    }
                }
            }
        }
    }
    editingAttendance?.let { row ->
        AlertDialog(
            onDismissRequest = { editingAttendance = null },
            title = { Text("Koreksi catatan ${row.staffName}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Catatan absensi tidak mengubah jam masuk atau pulang.", color = Muted, fontSize = 12.sp)
                    OutlinedTextField(
                        attendanceNote,
                        { attendanceNote = it },
                        label = { Text("Catatan") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val err = businessStore.correctAttendance(row.id, attendanceNote)
                    toast(err ?: "Catatan absensi diperbarui")
                    if (err == null) editingAttendance = null
                }) { Text("Simpan catatan") }
            },
            dismissButton = { TextButton(onClick = { editingAttendance = null }) { Text("Batal") } },
        )
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
