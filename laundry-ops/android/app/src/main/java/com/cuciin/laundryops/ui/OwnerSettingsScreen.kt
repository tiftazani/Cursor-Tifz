package com.cuciin.laundryops.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.ui.components.CardBlock
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.components.SectionLabel
import com.cuciin.laundryops.ui.theme.Muted

/**
 * Pengaturan Owner hanya berisi hal yang memang milik Owner: pesan WhatsApp.
 *
 * Pengaturan akses pengguna tidak lagi di sini. Hak akses kini diatur per role di menu
 * Kontrol Akses Role, sehingga satu perubahan role langsung berlaku untuk semua penggunanya
 * dan tidak ada lagi pengaturan akses yang tersebar per pengguna.
 */
@Composable
internal fun OwnerSettingsScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val session = CuciinStore.session.value ?: return
    // Gerbang rute `ownerSettings` memakai `whatsapp` + `whatsapp.template`, jadi layar ini harus
    // memakai ukuran yang sama. Sebelumnya layar memeriksa modul `owner`, yang sudah tidak ada
    // sejak katalog 1.10.30 dipecah, sehingga `canAccess` selalu false dan SETIAP pengguna
    // termasuk Owner langsung terlempar keluar: menu "Pengaturan Owner" tampak tidak bisa diklik.
    // Dua lapis harus memakai ukuran yang sama, bukan nama modul era lama.
    if (!CuciinStore.canAccess("whatsapp", "whatsapp.template")) { nav.popBackStack(); return }
    val template = CuciinStore.whatsappTemplate()
    var opening by remember { mutableStateOf(template.opening) }
    var content by remember { mutableStateOf(template.content) }
    var closing by remember { mutableStateOf(template.closing) }
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(ui.gap),
        contentPadding = PaddingValues(bottom = 28.dp),
    ) {
        item { ScreenHeader("Pengaturan Owner", "Pesan WhatsApp dan pengaturan operasional", onBack = { nav.popBackStack() }) }
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
            Text(
                "Akses modul dan fungsi diatur per role di menu Kontrol Akses Role. Setiap pengguna mengikuti role yang dipilih pada Daftar User.",
                color = Muted, fontSize = 12.sp, lineHeight = 17.sp,
            )
        }
    }
}
