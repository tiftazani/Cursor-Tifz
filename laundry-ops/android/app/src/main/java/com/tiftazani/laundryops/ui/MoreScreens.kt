package com.tiftazani.laundryops.ui

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.tiftazani.laundryops.BuildConfig
import com.tiftazani.laundryops.data.CloudSync
import com.tiftazani.laundryops.data.CuciinStore
import com.tiftazani.laundryops.data.PayMethod
import com.tiftazani.laundryops.data.Role
import com.tiftazani.laundryops.data.VersionHistory
import com.tiftazani.laundryops.data.rp
import com.tiftazani.laundryops.ui.components.CardBlock
import com.tiftazani.laundryops.ui.components.Chip
import com.tiftazani.laundryops.ui.components.ChipRow
import com.tiftazani.laundryops.ui.components.GhostBtn
import com.tiftazani.laundryops.ui.components.Hero
import com.tiftazani.laundryops.ui.components.PeriodRow
import com.tiftazani.laundryops.ui.components.PrimaryBtn
import com.tiftazani.laundryops.ui.components.ScreenHeader
import com.tiftazani.laundryops.ui.components.SelectChip
import com.tiftazani.laundryops.ui.theme.Ink
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Teal

private val store get() = CuciinStore

@Composable
internal fun MoreScreen(nav: NavHostController) {
    val ui = rememberUi()
    val role = store.session.value?.role ?: Role.Kasir
    val items = buildList {
        if (role == Role.Owner) {
            add("Analytics keuangan" to "analytics")
            add("Cabang" to "branches")
            add("User · kasir · SPV" to "users")
            add("Layanan & harga" to "services")
            add("Produk stok" to "products")
            add("Audit trail" to "audit")
        }
        add("Pelanggan" to "customers")
        if (role != Role.Supervisor) {
            add("WA pending" to "wa")
            add("WA archive" to "waArchive")
            add("Tutup kas" to "cash")
        }
        add("Riwayat versi" to "versions")
        add("Profil" to "profil")
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Modul", store.ownerName) }
        items(items) { (label, route) ->
            CardBlock(Modifier.clickable { nav.navigate(route) }) {
                Text(label, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
        item {
            GhostBtn("Keluar") {
                store.logout()
                nav.navigate("login") { popUpTo(0) }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun AnalyticsScreen(nav: NavHostController) {
    val ui = rememberUi()
    val period = store.reportPeriod.value
    val rows = store.periodNotas()
    val omzet = store.omzet(rows)
    val masuk = store.collected(rows)
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Analytics", "${rows.size} nota · ${store.ownerName}", onBack = { nav.popBackStack() }) }
        item { PeriodRow(period) { store.reportPeriod.value = it; store.touchStatus() } }
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
        item { Hero("Omzet nota", rp(omzet), listOf("masuk kas ${rp(masuk)}", "piutang ${rp(store.piutang())}")) }
        items(store.staff.filter { it.role == Role.Kasir && it.approved }) { k ->
            val kasirRows = rows.filter { it.kasir == k.name }
            CardBlock {
                Text(k.name, fontWeight = FontWeight.Bold)
                Text(k.branchIds.joinToString { id -> store.branches.find { it.id == id }?.name ?: id }, color = Muted, fontSize = 12.sp)
                Text("${rp(store.omzet(kasirRows))} · ${kasirRows.size} nota", fontWeight = FontWeight.Black, color = Ink)
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun AuditScreen(nav: NavHostController) {
    val ui = rememberUi()
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Audit trail", "Semua transaksi", onBack = { nav.popBackStack() }) }
        items(store.audit) { a ->
            CardBlock(Modifier.clickable { a.notaId?.let { nav.navigate("queue/$it") } }) {
                Text(a.action, fontWeight = FontWeight.Bold)
                Text("${a.at} · ${a.user}", color = Muted, fontSize = 12.sp)
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun CashScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value ?: return
    val bid = if (s.role == Role.Owner) store.viewBranch.value else s.branchId
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item {
            ScreenHeader(
                "Tutup kas",
                "${s.name} · ${if (bid == "all") "semua cabang" else store.branch(bid).name}",
                onBack = { nav.popBackStack() },
            )
        }
        item {
            CardBlock {
                Text("Tunai hari ini", color = Muted, fontSize = 12.sp)
                Text(rp(store.todayByMethod(PayMethod.Tunai, bid)), fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text("QRIS  ${rp(store.todayByMethod(PayMethod.Qris, bid))}", modifier = Modifier.padding(top = 8.dp))
                Text("Transfer  ${rp(store.todayByMethod(PayMethod.Transfer, bid))}")
                Text("Piutang  ${rp(store.piutang(store.notas.filter { bid == "all" || it.branchId == bid }))}")
            }
        }
        item {
            PrimaryBtn("Tutup shift") {
                val row = store.closeCash()
                toast("Kas ditutup ${row.at}")
                nav.popBackStack()
            }
        }
        if (store.cashCloses.isNotEmpty()) {
            item { Text("Riwayat", fontWeight = FontWeight.Bold) }
            items(store.cashCloses.take(12), key = { it.id }) { c ->
                Text("${c.at} · ${c.by} · tunai ${rp(c.tunai)}", color = Muted, fontSize = 13.sp)
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun ProfilScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    val s = store.session.value
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Profil", onBack = { nav.popBackStack() }) }
        item {
            CardBlock(accent = Teal) {
                Text(s?.name ?: store.ownerName, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text(s?.email ?: store.ownerEmail, color = Muted)
                Text("Versi ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", color = Muted, fontSize = 13.sp)
                Text(CloudSync.lastStatus, color = Muted, fontSize = 12.sp)
            }
        }
        item { GhostBtn("Riwayat versi") { nav.navigate("versions") } }
        item {
            GhostBtn("Hapus akun saya") {
                if (s?.role == Role.Owner) toast("Owner tidak bisa hapus akun dari sini")
                else if (store.deleteMyAccount()) {
                    toast("Akun dihapus dari HP ini")
                    nav.navigate("login") { popUpTo(0) }
                }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
internal fun VersionScreen(nav: NavHostController) {
    val ui = rememberUi()
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
        item { ScreenHeader("Riwayat versi", "Sekarang ${BuildConfig.VERSION_NAME}", onBack = { nav.popBackStack() }) }
        item {
            CardBlock(accent = Teal) {
                Text("Cuciin Android", fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text("v${BuildConfig.VERSION_NAME} · build ${BuildConfig.VERSION_CODE}", color = Muted, fontSize = 13.sp)
            }
        }
        items(VersionHistory.releases) { r ->
            CardBlock {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("v${r.name}", fontWeight = FontWeight.Black, color = Ink, fontSize = 18.sp)
                    Chip("build ${r.code}", Teal)
                }
                Text(r.date, color = Muted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                r.notes.forEach { Text("• $it", fontSize = 13.sp, modifier = Modifier.padding(bottom = 4.dp), color = Ink) }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}
