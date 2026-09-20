package com.cuciin.laundryops.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import android.graphics.BitmapFactory
import com.cuciin.laundryops.data.*
import com.cuciin.laundryops.ui.components.*
import com.cuciin.laundryops.ui.theme.*
import java.io.File
import java.time.LocalDateTime

private val assetStore get() = CuciinStore

/**
 * Daftar aset cabang. Kategori dan jenis aset dipilih lewat bilah filter, bukan deretan chip,
 * supaya daftar tetap ringkas saat jenis aset bertambah.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AssetListScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val session = assetStore.session.value ?: return
    assetStore.revision.intValue
    val allowedBranches = if (canViewAllBranches(session)) assetStore.branches.toList() else assetStore.branches.filter { it.id == session.branchId }
    var branchId by rememberSaveable { mutableStateOf(session.branchId) }
    var typeFilter by rememberSaveable { mutableStateOf("") }
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    var showTypeSheet by rememberSaveable { mutableStateOf(false) }
    val assetTypes = if (assetStore.assetTypes.isEmpty()) assetStore.defaultAssetTypes() else assetStore.assetTypes
    val rows = assetStore.inventory
        .filter { it.branchId == branchId }
        .filter { typeFilter.isBlank() || it.assetTypeId == typeFilter }
        .sortedByDescending { it.assetCode }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader("Daftar Aset Cabang", "Mesin dan peralatan operasional per cabang", onBack = { nav.popBackStack() }) }
        item {
            FilterBar(
                label = "Cabang",
                value = assetStore.branch(branchId).name.removePrefix("Cuciin "),
                detail = "${assetStore.inventory.count { it.branchId == branchId }} aset tercatat",
                icon = Icons.Outlined.Storefront,
                onClick = { if (allowedBranches.size > 1) showBranchSheet = true },
            )
        }
        item {
            FilterBar(
                label = "Jenis aset",
                value = typeFilter.ifBlank { "Semua jenis" }.let { key -> assetTypes.firstOrNull { it.id == typeFilter }?.name ?: key },
                detail = "${rows.size} aset tampil",
                icon = Icons.Outlined.Category,
                onClick = { showTypeSheet = true },
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Tombol ini membuka formulir yang MENYIMPAN aset, jadi izinnya diperiksa di sini.
                // Sebelumnya ia selalu tampil: role yang hanya memegang modul `inventory` tanpa
                // fungsi `inventory.write` (mis. Supervisor bawaan) bisa membuka dan mengisi
                // formulirnya, lalu ditolak saat menyimpan.
                if (assetStore.canWriteInventory()) {
                    PrimaryBtn("Daftarkan aset", Modifier.weight(1f), icon = Icons.Outlined.Add) { nav.navigate("assetNew") }
                }
                GhostBtn("Ekspor", Modifier.weight(.6f), icon = Icons.Outlined.FileDownload) { FileExports.shareInventory(nav.context, rows) }
            }
        }
        if (rows.isEmpty()) item { EmptyHint("Aset belum dicatat", "Tambahkan mesin, peralatan, atau barang operasional untuk cabang ini.") }
        if (rows.isNotEmpty()) item {
            ListCard {
                rows.forEachIndexed { index, row ->
                    // Membuka baris berarti membuka formulir yang MENYIMPAN, jadi pintunya
                    // diperiksa; tanpa itu role yang hanya boleh membaca tetap bisa mengubah.
                    AssetRow(row, assetStore.assetTypeName(row.assetTypeId).ifBlank { row.category.label }) {
                        if (assetStore.canWriteInventory()) nav.navigate("assetEdit/${row.id}")
                        else toast("Akses ubah aset dicabut untuk role akun ini")
                    }
                    if (index < rows.lastIndex) RowDivider()
                }
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            SheetTitle("Pilih cabang", "Aset ditampilkan per cabang.")
            allowedBranches.forEach { branch ->
                FilterSheetRow(branch.id == branchId, branch.name, "${assetStore.inventory.count { it.branchId == branch.id }} aset") {
                    branchId = branch.id; showBranchSheet = false
                }
            }
        }
    }
    if (showTypeSheet) ModalBottomSheet(onDismissRequest = { showTypeSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            SheetTitle("Jenis aset", "Saring daftar berdasarkan jenis aset.")
            FilterSheetRow(typeFilter.isBlank(), "Semua jenis", "${assetStore.inventory.count { it.branchId == branchId }} aset") { typeFilter = ""; showTypeSheet = false }
            assetTypes.forEach { type ->
                val count = assetStore.inventory.count { it.branchId == branchId && it.assetTypeId == type.id }
                FilterSheetRow(type.id == typeFilter, type.name, "${type.code} · $count aset") { typeFilter = type.id; showTypeSheet = false }
            }
            ListDivider()
            // "Kelola jenis aset" menulis data induk (owner.manage), bukan sekadar menyaring.
            if (assetStore.canManageAssetTypes()) {
                FilterSheetRow(false, "Kelola jenis aset", "Tambah atau nonaktifkan jenis") { showTypeSheet = false; nav.navigate("assetTypes") }
            }
        }
    }
}

@Composable
private fun SheetTitle(title: String, detail: String? = null) {
    Text(title, color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
    if (detail != null) Text(detail, color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp))
}

@Composable
private fun AssetRow(row: InventoryItem, typeName: String, onClick: () -> Unit) {
    val tap = rememberTapFeedback()
    Surface(onClick = { tap(); onClick() }, color = Card, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AvatarMark(row.name)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(row.name, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("$typeName · ${row.quantity} ${row.unit}", color = Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (row.assetCode.isNotBlank()) Text(row.assetCode, color = TealDeep, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Chip(row.status.label, when (row.status) {
                InventoryStatus.Normal -> Green
                InventoryStatus.PerluPerbaikan -> Amber
                InventoryStatus.Rusak -> Coral
            })
        }
    }
}

/**
 * Registrasi aset pada layar terpisah. Aset ID dibuat sistem dari kode cabang, kode jenis,
 * dan nomor urut; pengguna hanya mengisi informasi yang tidak dapat dihitung aplikasi.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AssetFormScreen(nav: NavHostController, assetId: String?, toast: (String) -> Unit) {
    val ui = rememberUi()
    val ctx = LocalContext.current
    val session = assetStore.session.value ?: return
    assetStore.revision.intValue
    val editing = remember(assetId) { assetStore.inventory.firstOrNull { it.id == assetId } }
    val allowedBranches = if (canViewAllBranches(session)) assetStore.branches.toList() else assetStore.branches.filter { it.id == session.branchId }
    var branchId by rememberSaveable { mutableStateOf(editing?.branchId ?: session.branchId) }
    var assetTypeId by rememberSaveable { mutableStateOf(editing?.assetTypeId ?: "") }
    var name by rememberSaveable { mutableStateOf(editing?.name.orEmpty()) }
    var brand by rememberSaveable { mutableStateOf(editing?.brand.orEmpty()) }
    var serial by rememberSaveable { mutableStateOf(editing?.serialNumber.orEmpty()) }
    var quantity by rememberSaveable { mutableStateOf(editing?.quantity?.toString() ?: "1") }
    var unit by rememberSaveable { mutableStateOf(editing?.unit ?: "unit") }
    var status by rememberSaveable { mutableStateOf(editing?.status ?: InventoryStatus.Normal) }
    var purchaseAt by rememberSaveable { mutableStateOf(editing?.purchaseAt?.takeIf { DisplayDates.parse(it) != null } ?: DisplayDates.encode(LocalDateTime.now(Clock.ZONE))) }
    var notes by rememberSaveable { mutableStateOf(editing?.notes.orEmpty()) }
    var photoPath by rememberSaveable { mutableStateOf(editing?.photoPath.orEmpty()) }
    var pendingPhoto by remember { mutableStateOf<File?>(null) }
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    var showTypeSheet by rememberSaveable { mutableStateOf(false) }

    val assetTypes = if (assetStore.assetTypes.isEmpty()) assetStore.defaultAssetTypes() else assetStore.assetTypes
    val effectiveTypeId = assetTypeId.ifBlank { assetTypes.firstOrNull()?.id.orEmpty() }
    val previewCode = if (editing != null && editing.assetCode.isNotBlank()) editing.assetCode else assetStore.nextAssetCode(branchId, effectiveTypeId)
    val capturePhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
        val file = pendingPhoto
        if (taken && file != null) {
            val stored = AssetPhotos.compressCaptured(file)
            if (stored != null) photoPath = stored else toast("Foto belum dapat diproses. Coba ambil kembali.")
        } else if (!taken) toast("Pengambilan foto dibatalkan")
        pendingPhoto = null
    }
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            val stored = AssetPhotos.importFromUri(ctx, uri)
            if (stored != null) photoPath = stored else toast("Foto belum dapat dibaca dari galeri")
        }
    }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader(if (editing == null) "Aset baru" else "Ubah aset", "${assetStore.branch(branchId).name} · ${session.name}", onBack = { nav.popBackStack() }) }
        item {
            Surface(color = Mist, shape = CuciinShape.card, border = BorderStroke(1.dp, Line)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("ASET ID · DIBUAT OTOMATIS", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = .5.sp)
                    Text(previewCode, color = TealDeep, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "Kode cabang, kode jenis aset, lalu nomor urut pada cabang ini. Tidak diisi manual.",
                        color = Muted, fontSize = 12.sp, lineHeight = 16.sp,
                    )
                }
            }
        }
        if (editing == null && allowedBranches.size > 1) item {
            FilterBar(label = "Cabang", value = assetStore.branch(branchId).name.removePrefix("Cuciin "), detail = "Menentukan kode cabang pada Aset ID", icon = Icons.Outlined.Storefront, onClick = { showBranchSheet = true })
        }
        item {
            FilterBar(
                label = "Jenis aset",
                value = assetTypes.firstOrNull { it.id == effectiveTypeId }?.name ?: "Pilih jenis aset",
                detail = "Menentukan kode jenis pada Aset ID",
                icon = Icons.Outlined.Category,
                onClick = { showTypeSheet = true },
            )
        }
        item { Field(name, { name = it }, "Nama aset") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) { Field(brand, { brand = it }, "Merek / pembuat") }
                Box(Modifier.weight(1f)) { Field(serial, { serial = it }, "Nomor seri") }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) { Field(quantity, { quantity = it.filter(Char::isDigit).take(6) }, "Jumlah", number = true) }
                Box(Modifier.weight(1f)) { Field(unit, { unit = it }, "Satuan") }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionLabel("Kondisi")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    InventoryStatus.entries.forEach { value ->
                        val selected = status == value
                        Surface(
                            onClick = { status = value },
                            modifier = Modifier.weight(1f).heightIn(min = 64.dp),
                            shape = CuciinShape.card,
                            color = if (selected) Mist else Card,
                            border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) TealDeep else Line),
                        ) {
                            Column(
                                Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 12.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(5.dp),
                            ) {
                                Box(
                                    Modifier.size(10.dp).background(
                                        when (value) {
                                            InventoryStatus.Normal -> Green
                                            InventoryStatus.PerluPerbaikan -> Amber
                                            InventoryStatus.Rusak -> Coral
                                        },
                                        CircleShape,
                                    ),
                                )
                                Text(value.label, color = if (selected) TealDeep else Ink, fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, textAlign = androidx.compose.ui.text.style.TextAlign.Center, lineHeight = 15.sp)
                            }
                        }
                    }
                }
            }
        }
        item { DateTimeFields(DisplayDates.parse(purchaseAt) ?: LocalDateTime.now(Clock.ZONE), { purchaseAt = DisplayDates.encode(it) }, "Tanggal beli / mulai dipakai") }
        item { Field(notes, { notes = it }, "Catatan") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionLabel("Foto aset")
                if (photoPath.isNotBlank()) {
                    val bitmap = remember(photoPath) { runCatching { BitmapFactory.decodeFile(photoPath) }.getOrNull() }
                    if (bitmap != null) {
                        Image(bitmap.asImageBitmap(), "Foto aset", modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp))
                        GhostBtn("Hapus foto", icon = Icons.Outlined.DeleteOutline) { AssetPhotos.delete(photoPath); photoPath = "" }
                    }
                } else {
                    Surface(color = Mist, shape = CuciinShape.card, border = BorderStroke(1.dp, Line)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Outlined.PhotoCamera, null, tint = Teal, modifier = Modifier.size(28.dp))
                            Text("Belum ada foto aset", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text("Foto disimpan di perangkat ini saja dan tidak dikirim ke server.", color = Muted, fontSize = 12.sp, lineHeight = 16.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GhostBtn("Kamera", Modifier.weight(1f), icon = Icons.Outlined.PhotoCamera) {
                        val target = AssetPhotos.createTarget(ctx)
                        pendingPhoto = target.first
                        capturePhoto.launch(target.second)
                    }
                    GhostBtn("Galeri", Modifier.weight(1f), icon = Icons.Outlined.PhotoLibrary) { pickPhoto.launch("image/*") }
                }
            }
        }
        item {
            PrimaryBtn(if (editing == null) "Simpan aset" else "Simpan perubahan", enabled = name.isNotBlank() && effectiveTypeId.isNotBlank(), icon = Icons.Outlined.Check) {
                val qty = quantity.toIntOrNull() ?: 0
                val type = assetTypes.firstOrNull { it.id == effectiveTypeId }
                val category = legacyCategoryFor(type?.name.orEmpty())
                if (editing == null) {
                    val row = assetStore.addInventory(branchId, name, category, brand, serial, qty, unit, status, purchaseAt, notes, sellable = false, assetTypeId = effectiveTypeId, photoPath = photoPath)
                    if (row == null) { toast("Akses Ubah aset dicabut untuk role akun ini"); return@PrimaryBtn }
                    toast("Aset ${row.assetCode.ifBlank { previewCode }} tersimpan")
                    nav.popBackStack()
                } else {
                    val tolak = assetStore.updateInventory(editing.copy(name = name, category = category, brand = brand, serialNumber = serial, quantity = qty, unit = unit, status = status, purchaseAt = purchaseAt, notes = notes, assetTypeId = effectiveTypeId, photoPath = photoPath))
                    if (tolak != null) { toast(tolak); return@PrimaryBtn }
                    toast("Perubahan aset tersimpan")
                    nav.popBackStack()
                }
            }
        }
        if (editing != null) item {
            DangerBtn("Hapus aset") {
                assetStore.deleteInventory(editing.id)?.let(toast) ?: run { toast("Aset dihapus"); nav.popBackStack() }
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            SheetTitle("Pilih cabang", "Kode cabang dipakai pada Aset ID.")
            allowedBranches.forEach { branch ->
                FilterSheetRow(branch.id == branchId, branch.name, "Kode ${branch.code}") { branchId = branch.id; showBranchSheet = false }
            }
        }
    }
    if (showTypeSheet) ModalBottomSheet(onDismissRequest = { showTypeSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            SheetTitle("Jenis aset", "Kode jenis dipakai pada Aset ID.")
            assetTypes.forEach { type ->
                FilterSheetRow(type.id == effectiveTypeId, type.name, "Kode ${type.code}") { assetTypeId = type.id; showTypeSheet = false }
            }
            ListDivider()
            // Menambah jenis aset menulis data induk (owner.manage), jadi pintunya diperiksa.
            if (assetStore.canManageAssetTypes()) {
                FilterSheetRow(false, "Tambah jenis aset baru", "Buka katalog jenis aset") { showTypeSheet = false; nav.navigate("assetTypes") }
            }
        }
    }
}

/** Jenis aset baru tetap mengisi kategori lama supaya laporan dan filter lama tidak kosong. */
private fun legacyCategoryFor(typeName: String): InventoryCategory = when {
    typeName.contains("cuci", true) -> InventoryCategory.MesinCuci
    typeName.contains("pengering", true) -> InventoryCategory.MesinPengering
    typeName.contains("setrika", true) || typeName.contains("steamer", true) -> InventoryCategory.Setrika
    typeName.contains("timbangan", true) -> InventoryCategory.Timbangan
    typeName.contains("peralatan", true) -> InventoryCategory.Peralatan
    else -> InventoryCategory.Lainnya
}

/** Katalog jenis aset: menambah jenis baru dan menonaktifkan yang tidak dipakai lagi. */
@Composable
internal fun AssetTypesScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    assetStore.revision.intValue
    val assetTypes = if (assetStore.assetTypes.isEmpty()) assetStore.defaultAssetTypes() else assetStore.assetTypes
    var newName by rememberSaveable { mutableStateOf("") }
    var newCode by rememberSaveable { mutableStateOf("") }
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader("Jenis aset", "Dipakai sebagai filter dan pembentuk Aset ID", onBack = { nav.popBackStack() }) }
        item {
            ListCard {
                assetTypes.forEachIndexed { index, type ->
                    val count = assetStore.inventory.count { it.assetTypeId == type.id }
                    ListRow(
                        mark = type.code,
                        title = type.name,
                        detail = "Kode ${type.code} · ${if (count == 0) "belum dipakai" else "$count aset"}",
                        showChevron = false,
                        trailing = {
                            if (count > 0) Chip("Dipakai", Green)
                            else Surface(
                                onClick = { assetStore.deleteAssetType(type.id)?.let(toast) ?: toast("Jenis dihapus") },
                                shape = CircleShape,
                                color = Surface2,
                                modifier = Modifier.size(44.dp),
                            ) {
                                Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Delete, "Hapus jenis", tint = Coral, modifier = Modifier.size(18.dp)) }
                            }
                        },
                    )
                    if (index < assetTypes.lastIndex) RowDivider()
                }
            }
        }
        item { Text("Jenis yang sudah dipakai aset tidak dapat dihapus, hanya dinonaktifkan, agar kode aset lama tetap terbaca.", color = Muted, fontSize = 12.sp, lineHeight = 17.sp) }
        item { SectionLabel("Jenis aset baru") }
        item { Field(newName, { newName = it }, "Nama jenis aset") }
        item { Field(newCode, { newCode = it.uppercase().filter(Char::isLetterOrDigit).take(4) }, "Kode jenis (2 sampai 4 huruf)") }
        item {
            PrimaryBtn("Tambah jenis", enabled = newName.isNotBlank() && newCode.isNotBlank(), icon = Icons.Outlined.Add) {
                assetStore.addAssetType(newCode, newName)?.let(toast) ?: run { toast("Jenis $newName ditambahkan"); newName = ""; newCode = "" }
            }
        }
    }
}
