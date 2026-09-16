package com.cuciin.laundryops.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.ui.components.CardBlock
import com.cuciin.laundryops.ui.components.ChipRow
import com.cuciin.laundryops.ui.components.FilterBar
import com.cuciin.laundryops.ui.components.FilterSheetRow
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.components.SectionLabel
import com.cuciin.laundryops.ui.components.SelectChip
import com.cuciin.laundryops.ui.theme.Muted

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun OwnerSettingsScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val session = CuciinStore.session.value ?: return
    var showUserSheet by remember { mutableStateOf(false) }
    if (session.role != Role.Owner) { nav.popBackStack(); return }
    val users = CuciinStore.staff.filter { it.role != Role.Owner && it.approved }
    var selectedEmail by remember { mutableStateOf(users.firstOrNull()?.email.orEmpty()) }
    var modules by remember { mutableStateOf(emptySet<String>()) }
    var functions by remember { mutableStateOf(emptySet<String>()) }
    val template = CuciinStore.whatsappTemplate()
    var opening by remember { mutableStateOf(template.opening) }
    var content by remember { mutableStateOf(template.content) }
    var closing by remember { mutableStateOf(template.closing) }
    LaunchedEffect(selectedEmail) {
        val current = CuciinStore.accessFor(selectedEmail)
        modules = current.modules
        functions = current.functions
    }
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 28.dp),
    ) {
        item { ScreenHeader("Pengaturan Owner", "Kontrol akses pengguna dan pesan WhatsApp", onBack = { nav.popBackStack() }) }
        item {
            CardBlock {
                SectionLabel("Template WhatsApp")
                Text("Gunakan {pelanggan}, {cabang}, {kasir}, atau {nota} bila diperlukan.", color = Muted, fontSize = 12.sp)
                Field(opening, { opening = it }, "Pesan pembuka")
                Field(content, { content = it }, "Isi pengantar")
                Field(closing, { closing = it }, "Pesan penutup")
                PrimaryBtn("Simpan pesan WhatsApp", icon = Icons.Outlined.Save) {
                    CuciinStore.saveWhatsAppTemplate(opening, content, closing)?.let(toast) ?: toast("Template WhatsApp disimpan")
                }
            }
        }
        item {
            CardBlock {
                SectionLabel("Kontrol akses pengguna")
                Text("Role dasar tetap berlaku. Pilihan di bawah membatasi modul dan fungsi pengguna terpilih.", color = Muted, fontSize = 12.sp)
                if (users.isEmpty()) Text("Belum ada Kasir atau SPV aktif.", color = Muted)
                else {
                    val selectedUser = users.firstOrNull { it.email.equals(selectedEmail, true) }
                    FilterBar(
                        label = "User yang diatur",
                        value = selectedUser?.name ?: "Pilih user",
                        detail = selectedUser?.let { "${if (it.role == Role.Supervisor) "SPV" else it.role.name} · ${it.email}" } ?: "Pilih satu user untuk mengatur aksesnya",
                        icon = Icons.Outlined.AdminPanelSettings,
                        onClick = { showUserSheet = true },
                    )
                    SectionLabel("Modul")
                    val choices = listOf("queue" to "Antrian", "service" to "Service", "customer" to "Pelanggan", "stock" to "Produk & stok", "inventory" to "Aset", "attendance" to "Absensi", "whatsapp" to "WhatsApp", "expense" to "Biaya", "cash" to "Kas")
                    ChipRow { choices.forEach { (key, label) -> SelectChip(key in modules, label) { modules = if (key in modules) modules - key else modules + key } } }
                    SectionLabel("Fungsi")
                    val actions = listOf("service.create" to "Buat Service", "service.correct" to "Koreksi sebelum WA", "queue.status" to "Ubah status kerja", "stock.write" to "Ubah stok", "attendance.write" to "Absen", "whatsapp.send" to "Kirim WhatsApp")
                    ChipRow { actions.forEach { (key, label) -> SelectChip(key in functions, label) { functions = if (key in functions) functions - key else functions + key } } }
                    PrimaryBtn("Simpan akses pengguna", icon = Icons.Outlined.AdminPanelSettings, enabled = selectedEmail.isNotBlank()) {
                        CuciinStore.saveAccessPolicy(selectedEmail, modules, functions)?.let(toast) ?: toast("Akses pengguna diperbarui")
                    }
                    GhostBtn("Pulihkan akses role", icon = Icons.Outlined.Save) {
                        CuciinStore.clearAccessPolicy(selectedEmail)?.let(toast) ?: run {
                            val current = CuciinStore.accessFor(selectedEmail)
                            modules = current.modules; functions = current.functions
                            toast("Akses role dasar dipulihkan")
                        }
                    }
                }
            }
        }
    }
    if (showUserSheet && users.isNotEmpty()) ModalBottomSheet(onDismissRequest = { showUserSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih user", color = com.cuciin.laundryops.ui.theme.Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            users.forEach { user ->
                FilterSheetRow(
                    selected = selectedEmail.equals(user.email, true),
                    label = user.name,
                    detail = "${if (user.role == Role.Supervisor) "SPV" else user.role.name} · ${user.email}",
                ) { selectedEmail = user.email; showUserSheet = false }
            }
        }
    }
}
