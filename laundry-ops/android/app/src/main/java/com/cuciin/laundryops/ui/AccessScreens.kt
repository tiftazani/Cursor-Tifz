package com.cuciin.laundryops.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.data.*
import com.cuciin.laundryops.ui.components.*
import com.cuciin.laundryops.ui.theme.*

private val accessStore get() = CuciinStore

/**
 * Daftar role akses.
 *
 * Setiap pengguna melekat pada satu role, dan role menentukan modul serta fungsi yang boleh
 * dipakai. Role bawaan tidak dapat dihapus supaya peran lama tetap bekerja.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AccessRolesScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    accessStore.revision.intValue
    LaunchedEffect(Unit) { accessStore.ensureAccessRoles() }
    val roles = accessStore.roles()
    var newName by rememberSaveable { mutableStateOf("") }
    var showCreate by rememberSaveable { mutableStateOf(false) }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader("Kontrol Akses Role", "Role menentukan modul dan fungsi yang dapat diakses penggunanya", onBack = { nav.popBackStack() }) }
        item {
            ListCard {
                roles.forEachIndexed { index, role ->
                    val members = AccessPolicy.memberCount(accessStore.staff, role.id)
                    ListRow(
                        mark = role.name,
                        title = role.name,
                        detail = buildString {
                            append("${role.modules.size} modul · ${role.functions.size} fungsi")
                            append(if (members == 0) " · belum dipakai" else " · $members pengguna")
                            if (role.builtIn) append(" · bawaan")
                        },
                        trailing = {
                            if (role.builtIn) Chip("Bawaan", Teal)
                        },
                    ) { nav.navigate("accessRole/${role.id}") }
                    if (index < roles.lastIndex) RowDivider()
                }
            }
        }
        item {
            PrimaryBtn("Role baru", icon = Icons.Outlined.Add) { newName = ""; showCreate = true }
        }
        item {
            Text(
                "Pengguna melekat ke satu role. Mengubah role langsung mengubah akses seluruh penggunanya. Atur pengguna di Daftar User.",
                color = Muted, fontSize = 12.sp, lineHeight = 17.sp,
            )
        }
        item { SectionLabel("Pengguna dan role-nya") }
        item {
            ListCard {
                val list = accessStore.staff.filter { it.approved }
                list.forEachIndexed { index, person ->
                    val role = AccessPolicy.effectiveRole(person, accessStore.accessRoles)
                    ListRow(
                        mark = person.name,
                        title = person.name,
                        detail = "${role.name} · ${person.email}",
                        showChevron = false,
                        trailing = {
                            if (person.role == Role.Owner) Chip("Owner", TealDeep)
                        },
                    ) { nav.navigate("accessRoleUser/${person.email}") }
                    if (index < list.lastIndex) RowDivider()
                }
            }
        }
    }
    if (showCreate) ModalBottomSheet(onDismissRequest = { showCreate = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Role baru", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            Text("Beri nama role, lalu pilih modul dan fungsinya di layar berikutnya.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp))
            Field(newName, { newName = it }, "Nama role", modifier = Modifier.padding(horizontal = 16.dp))
            PrimaryBtn("Buat role", Modifier.padding(horizontal = 16.dp, vertical = 8.dp), enabled = newName.isNotBlank()) {
                val name = newName.trim()
                if (accessStore.roles().any { it.name.equals(name, true) }) {
                    toast("Nama role $name sudah dipakai")
                } else {
                    val created = accessStore.createAccessRole(name)
                    if (created == null) toast("Hanya Owner yang dapat membuat role")
                    else { showCreate = false; nav.navigate("accessRole/${created.id}") }
                }
            }
        }
    }
}

/**
 * Editor satu role: modul dipilih lebih dari satu, dan tiap modul menampilkan fungsi yang
 * dapat dipilih. Pilihan yang aktif ditandai centang sekaligus dihitung jumlahnya, sehingga
 * jelas mana yang dipilih dan mana yang belum.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AccessRoleEditScreen(nav: NavHostController, roleId: String, toast: (String) -> Unit) {
    val ui = rememberUi()
    accessStore.revision.intValue
    LaunchedEffect(Unit) { accessStore.ensureAccessRoles() }
    val stored = accessStore.roleById(roleId)
    var name by rememberSaveable(roleId) { mutableStateOf(stored?.name.orEmpty()) }
    var modules by rememberSaveable(roleId) { mutableStateOf(stored?.modules ?: emptySet()) }
    var functions by rememberSaveable(roleId) { mutableStateOf(stored?.functions ?: emptySet()) }
    var showModuleSheet by rememberSaveable { mutableStateOf(false) }
    var showPresetSheet by rememberSaveable { mutableStateOf(false) }
    var expandedModule by rememberSaveable { mutableStateOf("") }

    if (stored == null) {
        EmptyHint("Role tidak ditemukan", "Role mungkin sudah dihapus. Kembali ke daftar role.")
        return
    }
    val selectedFunctions = functions.count { key -> modules.any { m -> AccessCatalog.functionsOf(m).any { it.key == key } } }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader("Role ${stored.name}", "Atur modul dan fungsi yang dapat diakses role ini", onBack = { nav.popBackStack() }) }
        item { Field(name, { name = it }, "Nama role") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                SectionLabel("Preset peran")
                Text(
                    "Preset mengisi centang sekaligus sebagai titik awal. Setelah diterapkan, centangnya tetap bisa diubah satu per satu.",
                    color = Muted,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                )
                GhostBtn("Terapkan preset peran", icon = Icons.Outlined.Bolt) { showPresetSheet = true }
            }
        }
        item {
            FilterBar(
                label = "Modul yang dapat diakses",
                value = if (modules.isEmpty()) "Belum ada modul dipilih" else "${modules.size} modul dipilih",
                detail = modules.sorted().joinToString(", ") { AccessCatalog.moduleLabel(it) }.ifBlank { "Pilih modul lebih dari satu" },
                icon = Icons.Outlined.Tune,
                onClick = { showModuleSheet = true },
            )
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionLabel("Modul dan fungsi")
                Text("Centang fungsi yang boleh dipakai. Fungsi tanpa centang berarti tidak diizinkan.", color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
            }
        }
        itemsIndexed(AccessCatalog.modules) { index, module ->
            val moduleOn = module.key in modules
            Surface(
                color = Card,
                shape = CuciinShape.card,
                border = BorderStroke(1.dp, if (moduleOn) Teal else Line),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        CheckBoxMark(moduleOn) {
                            modules = if (moduleOn) modules - module.key else modules + module.key
                            // Mematikan modul sekaligus mencabut fungsi di dalamnya.
                            if (moduleOn) functions = functions - module.functions.map { it.key }.toSet()
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(module.label, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(module.detail, color = Muted, fontSize = 12.sp, lineHeight = 16.sp)
                        }
                        val on = module.functions.count { it.key in functions }
                        Text("$on/${module.functions.size}", color = if (moduleOn) TealDeep else Muted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Surface(
                            onClick = { expandedModule = if (expandedModule == module.key) "" else module.key },
                            shape = CircleShape,
                            color = Surface2,
                            modifier = Modifier.size(40.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(if (expandedModule == module.key) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, "Buka fungsi ${module.label}", tint = Ink, modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                    if (expandedModule == module.key) {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            module.functions.forEach { fn ->
                                val on = fn.key in functions
                                // Fungsi yang SERVER tolak untuk non-Owner tidak bisa dicentang:
                                // centangnya tidak akan pernah tersinkron, dan pengguna hanya
                                // melihat kegagalan yang tidak dapat dipahami.
                                val terkunci = fn.key in AccessCatalog.ownerLocked
                                Row(
                                    Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    CheckBoxMark(on && moduleOn && !terkunci) {
                                        if (terkunci) return@CheckBoxMark
                                        if (!moduleOn) {
                                            // Menyalakan fungsi otomatis menyalakan modulnya.
                                            modules = modules + module.key
                                            functions = functions + fn.key
                                        } else {
                                            functions = if (on) functions - fn.key else functions + fn.key
                                        }
                                    }
                                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Text(fn.label, color = if (moduleOn) Ink else Muted, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                            if (terkunci) Chip("Khusus Owner", Amber)
                                        }
                                        Text(
                                            if (terkunci) "${fn.detail}. Hanya Owner: server menolak fungsi ini untuk role lain." else fn.detail,
                                            color = Muted,
                                            fontSize = 12.sp,
                                            lineHeight = 16.sp,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        item {
            Surface(color = Mist, shape = CuciinShape.card, border = BorderStroke(1.dp, Line)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("RINGKASAN PILIHAN", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = .5.sp)
                    Text("${modules.size} dari ${AccessCatalog.modules.size} modul · $selectedFunctions dari ${AccessCatalog.allFunctionKeys().size} fungsi", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    val off = AccessCatalog.modules.filterNot { it.key in modules }
                    Text(if (off.isEmpty()) "Semua modul dipilih." else "Belum dipilih: ${off.joinToString(", ") { it.label }}", color = Muted, fontSize = 12.sp, lineHeight = 16.sp)
                }
            }
        }
        item {
            PrimaryBtn("Simpan role", enabled = name.isNotBlank(), icon = Icons.Outlined.Check) {
                accessStore.saveAccessRole(stored.copy(name = name, modules = modules, functions = functions))?.let(toast) ?: run {
                    toast("Role ${name.trim()} disimpan")
                    nav.popBackStack()
                }
            }
        }
        if (!stored.builtIn) item {
            DangerBtn("Hapus role") {
                accessStore.deleteAccessRole(stored.id)?.let(toast) ?: run { toast("Role ${stored.name} dihapus"); nav.popBackStack() }
            }
        }
        if (stored.builtIn) item {
            Text("Role bawaan tidak dapat dihapus. Hak aksesnya tetap dapat diubah.", color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
        }
    }
    if (showPresetSheet) ModalBottomSheet(onDismissRequest = { showPresetSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Preset peran", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            Text(
                "Preset mengisi modul dan fungsi sekaligus. Sesudahnya centangnya tetap bisa diubah satu per satu.",
                color = Muted,
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            AccessCatalog.presets.forEach { preset ->
                FilterSheetRow(
                    modules == preset.modules && functions == preset.functions,
                    preset.label,
                    "${preset.modules.size} modul · ${preset.functions.size} fungsi · ${preset.detail}",
                ) {
                    modules = preset.modules
                    functions = preset.functions
                    showPresetSheet = false
                }
            }
        }
    }
    if (showModuleSheet) ModalBottomSheet(onDismissRequest = { showModuleSheet = false }) {
        // Tinggi dibatasi dan daftar mengambil sisa ruang, jadi tombol Selesai selalu terlihat
        // berapa pun jumlah modul dan sepanjang apa pun daftarnya.
        Column(Modifier.fillMaxWidth().heightIn(max = 560.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Modul yang dapat diakses", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            Text("Bisa pilih lebih dari satu. Menyalakan fungsi otomatis menyalakan modulnya.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp))
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Surface(color = if (modules.isEmpty()) Mist else TealDeep, shape = CuciinShape.pill) {
                    Text(
                        "${modules.size} dari ${AccessCatalog.modules.size} modul dipilih",
                        color = if (modules.isEmpty()) Muted else OnPrim,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                GhostBtn(if (modules.size == AccessCatalog.modules.size) "Kosongkan" else "Pilih semua") {
                    modules = if (modules.size == AccessCatalog.modules.size) emptySet() else AccessCatalog.modules.map { it.key }.toSet()
                    if (modules.isEmpty()) functions = emptySet()
                }
            }
            Column(Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState())) {
                AccessCatalog.modules.forEach { module ->
                    val on = module.key in modules
                    FilterSheetRow(on, module.label, "${module.detail} · ${module.functions.count { it.key in functions }}/${module.functions.size} fungsi", multiSelect = true) {
                        modules = if (on) modules - module.key else modules + module.key
                        if (on) functions = functions - module.functions.map { it.key }.toSet()
                    }
                }
            }
            PrimaryBtn("Selesai", Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) { showModuleSheet = false }
        }
    }
}

/** Pemilih role untuk satu pengguna. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AccessRoleUserScreen(nav: NavHostController, email: String, toast: (String) -> Unit) {
    val ui = rememberUi()
    accessStore.revision.intValue
    LaunchedEffect(Unit) { accessStore.ensureAccessRoles() }
    val person = accessStore.staff.firstOrNull { it.email.equals(email, true) }
    if (person == null) {
        EmptyHint("Pengguna tidak ditemukan", "Akun mungkin sudah dihapus.")
        return
    }
    val current = AccessPolicy.effectiveRole(person, accessStore.accessRoles)
    var showSheet by rememberSaveable { mutableStateOf(false) }
    val roles = accessStore.roles()

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item { ScreenHeader(person.name, "Role menentukan modul dan fungsi yang dapat diakses", onBack = { nav.popBackStack() }) }
        item {
            FilterBar(
                label = "Role pengguna",
                value = current.name,
                detail = "${current.modules.size} modul · ${current.functions.size} fungsi",
                icon = Icons.Outlined.Badge,
                onClick = { if (person.role != Role.Owner) showSheet = true },
            )
        }
        item {
            CardBlock {
                InfoRow(Icons.Outlined.MailOutline, "Email", person.email)
                InfoRow(Icons.Outlined.VerifiedUser, "Peran akun", if (person.role == Role.Supervisor) "SPV" else person.role.name)
                InfoRow(Icons.Outlined.Storefront, "Cabang", person.branchIds.joinToString { accessStore.branch(it).name })
            }
        }
        item {
            if (person.role == Role.Owner) {
                Text("Owner selalu memiliki seluruh akses dan tidak dapat dibatasi.", color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
            } else {
                Text("Akses berlaku setelah perangkat ini menyinkronkan perubahan ke server.", color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
            }
        }
    }
    if (showSheet) ModalBottomSheet(onDismissRequest = { showSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih role", color = Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            Text("Pengguna mengikuti modul dan fungsi dari role yang dipilih.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp))
            roles.forEach { role ->
                FilterSheetRow(role.id == current.id, role.name, "${role.modules.size} modul · ${role.functions.size} fungsi") {
                    accessStore.assignAccessRole(person.email, role.id)?.let(toast) ?: toast("${person.name} memakai role ${role.name}")
                    showSheet = false
                }
            }
        }
    }
}

/** Kotak centang yang terlihat jelas terpilih atau tidak, dengan target sentuh 44dp. */
@Composable
private fun CheckBoxMark(checked: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShapeSmall,
        color = if (checked) TealDeep else Card,
        border = if (checked) null else BorderStroke(1.5.dp, Line),
        modifier = Modifier.size(26.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (checked) Icon(Icons.Outlined.Check, "Dipilih", tint = OnPrim, modifier = Modifier.size(17.dp))
        }
    }
}

private val RoundedCornerShapeSmall = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
