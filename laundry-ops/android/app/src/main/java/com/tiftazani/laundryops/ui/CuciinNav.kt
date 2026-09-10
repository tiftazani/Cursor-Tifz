package com.tiftazani.laundryops.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.tiftazani.laundryops.BuildConfig
import com.tiftazani.laundryops.data.Clock
import com.tiftazani.laundryops.data.CloudSync
import com.tiftazani.laundryops.data.CuciinStore
import com.tiftazani.laundryops.data.FileExports
import com.tiftazani.laundryops.data.FirebaseCloud
import com.tiftazani.laundryops.data.LaundryStatus
import com.tiftazani.laundryops.data.Nota
import com.tiftazani.laundryops.data.PayMethod
import com.tiftazani.laundryops.data.PayStatus
import com.tiftazani.laundryops.data.Role
import com.tiftazani.laundryops.data.StockKind
import com.tiftazani.laundryops.data.VersionHistory
import com.tiftazani.laundryops.data.rp
import com.tiftazani.laundryops.ui.components.CardBlock
import com.tiftazani.laundryops.ui.components.Chip
import com.tiftazani.laundryops.ui.components.CuciinTopBar
import com.tiftazani.laundryops.ui.components.Hero
import com.tiftazani.laundryops.ui.components.LaundryChip
import com.tiftazani.laundryops.ui.components.PayChip
import com.tiftazani.laundryops.ui.components.PeriodRow
import com.tiftazani.laundryops.ui.theme.Amber
import com.tiftazani.laundryops.ui.theme.Green
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Navy
import kotlinx.coroutines.launch

private val store get() = CuciinStore

@Composable
fun CuciinRoot() {
    val nav = rememberNavController()
    val snack = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val session = store.session.value
    store.revision.intValue
    val route = nav.currentBackStackEntryAsState().value?.destination?.route
    val showBar = session != null && route in setOf("home", "nota", "wa", "stok", "more")

    fun toast(msg: String) { scope.launch { snack.showSnackbar(msg) } }

    Scaffold(
        snackbarHost = { SnackbarHost(snack) },
        bottomBar = {
            if (showBar) {
                NavigationBar {
                    NavigationBarItem(route == "home", { nav.navigate("home") { launchSingleTop = true } }, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("Antrian") })
                    if (session?.role != Role.Supervisor) {
                        NavigationBarItem(route == "nota", { nav.navigate("nota") { launchSingleTop = true } }, icon = { Icon(Icons.Outlined.PointOfSale, null) }, label = { Text("Nota") })
                        NavigationBarItem(route == "wa", { nav.navigate("wa") { launchSingleTop = true } }, icon = { Icon(Icons.Outlined.Chat, null) }, label = { Text("WA") })
                    }
                    NavigationBarItem(route == "stok", { nav.navigate("stok") { launchSingleTop = true } }, icon = { Icon(Icons.Outlined.Inventory2, null) }, label = { Text("Stok") })
                    if (session?.role == Role.Owner) {
                        NavigationBarItem(route == "more", { nav.navigate("more") { launchSingleTop = true } }, icon = { Icon(Icons.Outlined.MoreHoriz, null) }, label = { Text("Modul") })
                    }
                }
            }
        },
    ) { pad ->
        NavHost(nav, startDestination = if (session == null) "login" else "home", modifier = Modifier.padding(pad)) {
            composable("login") { LoginScreen(nav, ::toast) }
            composable("register") { RegisterScreen(nav, ::toast) }
            composable("pending") { PendingScreen(nav) }
            composable("home") { HomeScreen(nav) }
            composable("nota") { NotaScreen(nav, ::toast) }
            composable("bayar") { BayarScreen(nav, ::toast) }
            composable("queue/{id}") { e -> QueueDetailScreen(nav, e.arguments?.getString("id") ?: "", ::toast) }
            composable("wa") { WaListScreen(nav, archive = false) }
            composable("waArchive") { WaListScreen(nav, archive = true) }
            composable("stok") { StockScreen(nav, ::toast) }
            composable("stokEdit") { StockEditScreen(nav, ::toast) }
            composable("stokHistory") { StockHistoryScreen(nav) }
            composable("more") { MoreScreen(nav) }
            composable("analytics") { AnalyticsScreen(nav) }
            composable("branches") { BranchesScreen(nav, ::toast) }
            composable("audit") { AuditScreen(nav) }
            composable("users") { UsersScreen(nav, ::toast) }
            composable("versions") { VersionScreen(nav) }
            composable("cash") { CashScreen(nav, ::toast) }
            composable("customers") { CustomersScreen(nav, ::toast) }
            composable("profil") { ProfilScreen(nav, ::toast) }
        }
    }
}

@Composable
private fun LoginScreen(nav: NavHostController, toast: (String) -> Unit) {
    var email by remember { mutableStateOf(store.ownerEmail) }
    var pass by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    fun goHome() {
        nav.navigate("home") { popUpTo("login") { inclusive = true } }
    }
    fun localLogin() {
        if (store.login(email, pass)) goHome()
        else if (store.pendingName.value != null) nav.navigate("pending")
        else toast("Email / password salah, atau akun belum ada.")
    }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("Cuciin", fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, color = Navy)
        Text("Owner: ${store.ownerName}", color = Muted)
        Text(
            CloudSync.lastStatus,
            color = Muted,
            fontSize = 12.sp,
            modifier = Modifier.padding(bottom = 20.dp),
        )
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(pass, { pass = it }, label = { Text("Password (kosong = akun awal)") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
        Button(
            onClick = {
                if (busy) return@Button
                if (!FirebaseCloud.enabled) {
                    localLogin()
                    return@Button
                }
                busy = true
                FirebaseCloud.signIn(email, pass) { ok, pending, msg ->
                    busy = false
                    when {
                        ok -> goHome()
                        pending -> nav.navigate("pending")
                        else -> {
                            if (store.login(email, pass)) goHome()
                            else if (store.pendingName.value != null) nav.navigate("pending")
                            else toast(msg)
                        }
                    }
                }
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            shape = RoundedCornerShape(16.dp),
        ) {
            if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = androidx.compose.ui.graphics.Color.White)
            else Text("Masuk")
        }
        TextButton(onClick = { nav.navigate("register") }) { Text("Daftar Kasir / SPV") }
        Text("Masuk cepat akun awal di HP ini", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton({ store.demoLogin(Role.Owner); goHome() }) { Text("Owner") }
            OutlinedButton({ store.demoLogin(Role.Kasir); goHome() }) { Text("Kasir") }
            OutlinedButton({ store.demoLogin(Role.Supervisor); goHome() }) { Text("SPV") }
        }
        TextButton(onClick = { nav.navigate("versions") }) { Text("Riwayat versi ${BuildConfig.VERSION_NAME}") }
    }
}

@Composable
private fun RegisterScreen(nav: NavHostController, toast: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(Role.Kasir) }
    var branch by remember { mutableStateOf(store.branches.firstOrNull()?.id ?: "melati") }
    var busy by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        CuciinTopBar("Daftar", "Nunggu approve Owner", onBack = { nav.popBackStack() })
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(name, { name = it }, label = { Text("Nama") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(pass, { pass = it }, label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(role == Role.Kasir, { role = Role.Kasir }, label = { Text("Kasir") })
                FilterChip(role == Role.Supervisor, { role = Role.Supervisor }, label = { Text("SPV") })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                store.branches.forEach { b ->
                    FilterChip(branch == b.id, { branch = b.id }, label = { Text(b.name.removePrefix("Cuciin ")) })
                }
            }
            Button(
                onClick = {
                    if (name.isBlank() || email.isBlank()) {
                        toast("Nama dan email wajib")
                        return@Button
                    }
                    if (busy) return@Button
                    busy = true
                    FirebaseCloud.register(name, email, pass, role, branch) {
                        busy = false
                        nav.navigate("pending")
                    }
                },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
            ) { Text(if (busy) "Mengirim…" else "Kirim pendaftaran") }
        }
    }
}

@Composable
private fun PendingScreen(nav: NavHostController) {
    Column(Modifier.fillMaxSize()) {
        CuciinTopBar("Nunggu Owner", onBack = { nav.popBackStack() })
        Column(Modifier.padding(16.dp)) {
            Text("${store.pendingName.value ?: "Akun"} menunggu ${store.ownerName} setujui.")
            OutlinedButton(onClick = { nav.navigate("login") { popUpTo("login") { inclusive = true } } }, modifier = Modifier.padding(top = 16.dp)) { Text("Kembali ke masuk") }
        }
    }
}

@Composable
private fun HomeScreen(nav: NavHostController) {
    val s = store.session.value ?: return
    var filter by remember { mutableStateOf("gantung") }
    val all = store.visibleNotas()
    val list = when (filter) {
        "selesai" -> all.filter { !it.hanging }
        "do" -> all.filter { it.dropOut }
        else -> all.filter { it.hanging }
    }
    val waPend = all.count { !it.waSent }
    val bid = if (s.role == Role.Owner) store.viewBranch.value else s.branchId
    Scaffold(topBar = { CuciinTopBar("Antrian", "${s.name} · ${if (s.role == Role.Owner) "semua cabang" else store.branch(s.branchId).name}") }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (s.role == Role.Owner) {
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(store.viewBranch.value == "all", { store.viewBranch.value = "all" }, label = { Text("Semua") })
                        store.branches.forEach { b ->
                            FilterChip(store.viewBranch.value == b.id, { store.viewBranch.value = b.id }, label = { Text(b.name.removePrefix("Cuciin ")) })
                        }
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(store.viewKasir.value == "all", { store.viewKasir.value = "all" }, label = { Text("Semua kasir") })
                        store.staff.filter { it.role == Role.Kasir && it.approved }.forEach { k ->
                            FilterChip(store.viewKasir.value == k.name, { store.viewKasir.value = k.name }, label = { Text(k.name) })
                        }
                    }
                }
                item { CardBlock(Modifier.clickable { nav.navigate("analytics") }) { Text("Analytics keuangan", fontWeight = FontWeight.Bold); Text("Dari nota yang tersimpan, bukan angka dummy", color = Muted, fontSize = 12.sp) } }
            }
            item {
                Hero(
                    if (s.role == Role.Owner) "Masuk kas hari ini" else "Shift ${s.name} · hari ini",
                    rp(store.todayCollected(bid)),
                    listOf("${all.count { it.hanging }} menggantung", "$waPend WA pending"),
                )
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(filter == "gantung", { filter = "gantung" }, label = { Text("Menggantung") })
                    FilterChip(filter == "selesai", { filter = "selesai" }, label = { Text("Selesai") })
                    FilterChip(filter == "do", { filter = "do" }, label = { Text("DO") })
                }
            }
            if (list.isEmpty()) {
                item { Text("Antrian kosong. Buka Nota buat transaksi pertama — datanya nyangkut di HP.", color = Muted) }
            }
            items(list, key = { it.id }) { n -> NotaCard(n) { nav.navigate("queue/${n.id}") } }
            item { TextButton({ nav.navigate("versions") }) { Text("Versi ${BuildConfig.VERSION_NAME} · riwayat") } }
            item {
                TextButton({
                    store.logout()
                    nav.navigate("login") { popUpTo(0) }
                }) { Text("Keluar") }
            }
        }
    }
}

@Composable
private fun NotaCard(n: Nota, onClick: () -> Unit) {
    CardBlock(Modifier.clickable(onClick = onClick)) {
        Text("${n.id} · ${n.customer}", fontWeight = FontWeight.Bold)
        Text("${n.kasir} · ${n.items}", color = Muted, fontSize = 12.sp)
        Text("${n.createdAt} · pickup ${n.pickupAt}", color = Muted, fontSize = 12.sp)
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PayChip(n.pay)
            LaundryChip(n.laundry)
            if (n.hanging) Chip("Menggantung", Amber) else Chip("Beres", Green)
            if (!n.waSent) Chip("WA pending", Amber)
        }
    }
}

@Composable
private fun NotaScreen(nav: NavHostController, toast: (String) -> Unit) {
    val s = store.session.value ?: return
    val cust = store.selectedCustomer.value
    Scaffold(topBar = { CuciinTopBar("Nota baru", "${store.branch(s.branchId).name} · ${store.nextNotaId(s.branchId)}", onBack = { nav.navigate("home") }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                CardBlock(Modifier.clickable { nav.navigate("customers") }) {
                    if (cust == null) {
                        Text("Pilih / tambah pelanggan", fontWeight = FontWeight.Bold)
                        Text("Wajib sebelum simpan nota", color = Muted, fontSize = 12.sp)
                    } else {
                        Text(cust.name, fontWeight = FontWeight.Bold)
                        Text("${cust.phone} · ${cust.address}", color = Muted, fontSize = 12.sp)
                    }
                }
            }
            items(store.services, key = { it.id }) { svc ->
                CardBlock(Modifier.clickable { store.addToCart(svc) }) {
                    Text(svc.name, fontWeight = FontWeight.Bold)
                    Text("${rp(svc.price)} / ${svc.unit}${if (svc.retail) " · potong stok" else ""}", color = Muted, fontSize = 12.sp)
                }
            }
            item {
                Text("Keranjang", fontWeight = FontWeight.Bold)
                if (store.cart.isEmpty()) Text("Tap layanan di atas", color = Muted, fontSize = 12.sp)
                store.cart.forEach { line ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("${line.service.name} ${line.qty}${line.service.unit}  ${rp((line.qty * line.service.price).toInt())}")
                        Row {
                            TextButton({ store.cartDelta(line.service.id, if (line.service.unit == "kg") -1.0 else -1.0) }) { Text("−") }
                            TextButton({ store.addToCart(line.service) }) { Text("+") }
                        }
                    }
                }
                val total = store.cart.sumOf { (it.qty * it.service.price).toInt() }
                if (store.cart.isNotEmpty()) {
                    Button(onClick = {
                        if (cust == null) {
                            toast("Pilih pelanggan dulu")
                            nav.navigate("customers")
                        } else nav.navigate("bayar")
                    }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
                        Text("Lanjut janji & bayar · ${rp(total)}")
                    }
                }
            }
        }
    }
}

@Composable
private fun CustomersScreen(nav: NavHostController, toast: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    Scaffold(topBar = { CuciinTopBar("Pelanggan", "Tersimpan di HP", onBack = { nav.popBackStack() }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                CardBlock {
                    Text("Pelanggan baru", fontWeight = FontWeight.Bold)
                    OutlinedTextField(name, { name = it }, label = { Text("Nama") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                    OutlinedTextField(phone, { phone = it }, label = { Text("WA / telepon") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(address, { address = it }, label = { Text("Alamat") }, modifier = Modifier.fillMaxWidth())
                    Button(
                        onClick = {
                            if (name.isBlank() || phone.isBlank()) {
                                toast("Nama dan telepon wajib")
                                return@Button
                            }
                            store.addCustomer(name, phone, address)
                            toast("Pelanggan disimpan")
                            nav.popBackStack()
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) { Text("Simpan & pilih") }
                }
            }
            if (store.customers.isEmpty()) item { Text("Belum ada pelanggan.", color = Muted) }
            items(store.customers, key = { it.id }) { c ->
                CardBlock(Modifier.clickable { store.selectedCustomer.value = c; nav.popBackStack() }) {
                    Text(c.name, fontWeight = FontWeight.Bold)
                    Text("${c.phone} · ${c.address}", color = Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun BayarScreen(nav: NavHostController, toast: (String) -> Unit) {
    var pickup by remember { mutableStateOf(Clock.defaultPickup()) }
    var paid by remember { mutableIntStateOf(0) }
    var method by remember { mutableStateOf(PayMethod.Tunai) }
    val cust = store.selectedCustomer.value
    val total = store.cart.sumOf { (it.qty * it.service.price).toInt() }.coerceAtLeast(0)
    val ctx = LocalContext.current
    fun save(openWa: Boolean) {
        if (cust == null) {
            toast("Pilih pelanggan")
            nav.navigate("customers")
            return
        }
        if (store.cart.isEmpty()) {
            toast("Keranjang kosong")
            return
        }
        val n = store.saveNota(cust, store.cart.toList(), paid, pickup, method, sendWa = false)
        if (openWa) {
            val url = "${store.waMe(n.phone)}?text=${Uri.encode(store.notaText(n))}"
            try {
                ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                store.markWaSent(n.id)
            } catch (_: Exception) {
                toast("WA tidak kebuka, nota tetap tersimpan")
            }
        } else toast("Nota ${n.id} tersimpan, WA pending")
        nav.navigate("queue/${n.id}") { popUpTo("home") }
    }
    Scaffold(topBar = { CuciinTopBar("Janji & bayar", onBack = { nav.popBackStack() }) }) { p ->
        Column(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(rp(total), fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, color = Navy)
            PayChip(if (paid >= total && total > 0) PayStatus.Lunas else PayStatus.Belum)
            OutlinedTextField(pickup, { pickup = it }, label = { Text("Kapan selesai / bisa pickup") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(paid.toString(), { paid = it.filter { ch -> ch.isDigit() }.toIntOrNull() ?: 0 }, label = { Text("Dibayar sekarang") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton({ paid = 0 }) { Text("Belum lunas") }
                Button({ paid = total }) { Text("Lunas") }
            }
            Text("Metode (catat, bukan gateway)", color = Muted, fontSize = 12.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PayMethod.entries.forEach {
                    FilterChip(method == it, { method = it }, label = { Text(it.label) })
                }
            }
            Button(onClick = { save(false) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) { Text("Simpan, WA nanti") }
            Button(onClick = { save(true) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) { Text("Simpan & buka WA") }
        }
    }
}

@Composable
private fun QueueDetailScreen(nav: NavHostController, id: String, toast: (String) -> Unit) {
    val n = store.notas.find { it.id == id } ?: return
    val ctx = LocalContext.current
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val path = store.addLocalProof(id, uri)
        toast(if (path != null) "Foto disalin ke penyimpanan app" else "Gagal salin foto")
    }
    val s = store.session.value
    Scaffold(topBar = { CuciinTopBar(n.id, store.branch(n.branchId).name, onBack = { nav.popBackStack() }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                CardBlock {
                    Text(n.customer, fontWeight = FontWeight.Bold)
                    Text("${n.phone} · kasir ${n.kasir}", color = Muted, fontSize = 12.sp)
                    Text(n.items, color = Muted, fontSize = 12.sp)
                    Text("Dibuat ${n.createdAt}", color = Muted, fontSize = 12.sp)
                    Text("Pickup ${n.pickupAt}", fontWeight = FontWeight.SemiBold)
                    Text("Metode ${n.payMethod.label} · ${rp(n.paid)} / ${rp(n.total)}", color = Muted, fontSize = 12.sp)
                    Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        PayChip(n.pay); LaundryChip(n.laundry)
                        if (n.hanging) Chip("Menggantung", Amber)
                    }
                }
            }
            item {
                Text("Status laundry", fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LaundryStatus.entries.forEach { st -> FilterChip(n.laundry == st, onClick = {}, enabled = false, label = { Text(st.label, fontSize = 11.sp) }) }
                }
                if (n.laundry != LaundryStatus.Selesai) {
                    Button(onClick = { store.advanceLaundry(id); toast(n.laundry.label) }, modifier = Modifier.fillMaxWidth()) { Text("Lanjut status laundry") }
                }
                if (n.pay != PayStatus.Lunas && s?.role != Role.Supervisor) {
                    OutlinedButton(onClick = { store.markLunas(id); toast("Lunas") }, modifier = Modifier.fillMaxWidth()) { Text("Tandai lunas") }
                }
            }
            item {
                Text("Bukti di HP (bukan cloud)", fontWeight = FontWeight.Bold)
                n.photos.forEach { Text("📷 ${it.substringAfterLast('/')}") }
                if (s?.role != Role.Supervisor) OutlinedButton({ pick.launch("image/*") }) { Text("Salin foto dari galeri") }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton({ FileExports.shareText(ctx, store.notaText(n)) }) { Text("Teks") }
                    OutlinedButton({ FileExports.shareCsv(ctx, n) }) { Text("Excel") }
                    OutlinedButton({ FileExports.sharePdf(ctx, n) }) { Text("PDF") }
                }
            }
            item {
                val url = "${store.waMe(n.phone)}?text=${Uri.encode(store.notaText(n))}"
                Button(onClick = {
                    try {
                        ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        store.markWaSent(id)
                        toast("Masuk archive WA")
                    } catch (_: Exception) {
                        toast("WA tidak kebuka")
                    }
                }, modifier = Modifier.fillMaxWidth()) { Text(if (n.waSent) "Kirim ulang WA" else "Kirim WA nota") }
            }
        }
    }
}

@Composable
private fun WaListScreen(nav: NavHostController, archive: Boolean) {
    val rows = store.visibleNotas().filter { it.waSent == archive }
    Scaffold(topBar = { CuciinTopBar(if (archive) "WA archive" else "WA pending", if (archive) "Sudah dikirim, tetap bisa dibuka" else "List tetap ada sampai dikirim", onBack = { nav.navigate("home") }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(!archive, { nav.navigate("wa") }, label = { Text("Pending") })
                    FilterChip(archive, { nav.navigate("waArchive") }, label = { Text("Archive") })
                }
            }
            items(rows, key = { it.id }) { n ->
                CardBlock(Modifier.clickable { nav.navigate("queue/${n.id}") }) {
                    Text("${n.id} · ${n.customer}", fontWeight = FontWeight.Bold)
                    Text(if (archive) "Terkirim ${n.waAt}" else n.phone, color = Muted, fontSize = 12.sp)
                }
            }
            if (rows.isEmpty()) item { Text(if (archive) "Archive kosong" else "Belum ada nota, atau semua sudah dikirim WA", color = Muted) }
        }
    }
}

@Composable
private fun StockScreen(nav: NavHostController, toast: (String) -> Unit) {
    val s = store.session.value ?: return
    Scaffold(topBar = { CuciinTopBar("Stok", "Mutasi per tanggal, tersimpan di HP", onBack = { nav.navigate("home") }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(store.products, key = { it.name }) { p0 ->
                CardBlock {
                    Text(p0.name + if (p0.stock <= p0.min) "  rendah" else "", fontWeight = FontWeight.Bold)
                    Text("Sisa ${p0.stock}", color = Muted)
                }
            }
            item { OutlinedButton({ nav.navigate("stokHistory") }, Modifier.fillMaxWidth()) { Text("Lihat mutasi tanggal") } }
            if (s.role != Role.Supervisor) item { Button({ nav.navigate("stokEdit") }, Modifier.fillMaxWidth()) { Text("Ubah stok manual") } }
        }
    }
}

@Composable
private fun StockEditScreen(nav: NavHostController, toast: (String) -> Unit) {
    var product by remember { mutableStateOf(store.products.firstOrNull()?.name ?: "Sabun") }
    var kind by remember { mutableStateOf(StockKind.Tambah) }
    var qty by remember { mutableIntStateOf(12) }
    Scaffold(topBar = { CuciinTopBar("Ubah stok", onBack = { nav.popBackStack() }) }) { p ->
        Column(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Jual retail via nota potong otomatis. Kasir juga bisa tambah/kurang/update di sini.")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                store.products.forEach { FilterChip(product == it.name, { product = it.name }, label = { Text(it.name) }) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(StockKind.Tambah, StockKind.Kurang, StockKind.Update).forEach {
                    FilterChip(kind == it, { kind = it }, label = { Text(it.label) })
                }
            }
            OutlinedTextField(qty.toString(), { qty = it.filter(Char::isDigit).toIntOrNull() ?: 0 }, label = { Text("Jumlah") })
            Button({ store.editStock(product, kind, qty); toast("Mutasi tersimpan"); nav.navigate("stokHistory") }, Modifier.fillMaxWidth()) { Text("Simpan mutasi") }
        }
    }
}

@Composable
private fun StockHistoryScreen(nav: NavHostController) {
    Scaffold(topBar = { CuciinTopBar("Mutasi stok", "Perubahan per tanggal", onBack = { nav.popBackStack() }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (store.stockMoves.isEmpty()) item { Text("Belum ada mutasi.", color = Muted) }
            items(store.stockMoves) { m ->
                CardBlock {
                    Text("${m.product} · ${m.kind.label} ${m.qty}", fontWeight = FontWeight.Bold)
                    Text("${m.at} · ${m.by}", color = Muted, fontSize = 12.sp)
                    Text(m.notaId ?: m.note, color = Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun MoreScreen(nav: NavHostController) {
    val items = listOf(
        "Analytics keuangan" to "analytics",
        "Cabang laundry" to "branches",
        "Pelanggan" to "customers",
        "WA pending" to "wa",
        "WA archive" to "waArchive",
        "Audit trail" to "audit",
        "User & pengajuan" to "users",
        "Tutup kas" to "cash",
        "Riwayat versi" to "versions",
        "Profil" to "profil",
    )
    Scaffold(topBar = { CuciinTopBar("Modul", store.ownerName) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(items) { (label, route) ->
                CardBlock(Modifier.clickable { nav.navigate(route) }) { Text(label, fontWeight = FontWeight.Bold) }
            }
            item {
                OutlinedButton({
                    store.logout()
                    nav.navigate("login") { popUpTo(0) }
                }, Modifier.fillMaxWidth()) { Text("Keluar") }
            }
        }
    }
}

@Composable
private fun AnalyticsScreen(nav: NavHostController) {
    val period = store.reportPeriod.value
    val rows = store.periodNotas()
    val omzet = store.omzet(rows)
    val masuk = store.collected(rows)
    Scaffold(topBar = { CuciinTopBar("Analytics", "${rows.size} nota · ${store.ownerName}", onBack = { nav.popBackStack() }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { PeriodRow(period) { store.reportPeriod.value = it } }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(store.viewBranch.value == "all", { store.viewBranch.value = "all" }, label = { Text("Semua") })
                    store.branches.forEach { b -> FilterChip(store.viewBranch.value == b.id, { store.viewBranch.value = b.id }, label = { Text(b.name.removePrefix("Cuciin ")) }) }
                }
            }
            item { Hero("Omzet (total nota)", rp(omzet), listOf("masuk kas ${rp(masuk)}", "piutang ${rp(store.piutang())}")) }
            items(store.staff.filter { it.role == Role.Kasir && it.approved }) { k ->
                val kasirRows = rows.filter { it.kasir == k.name }
                CardBlock {
                    Text(k.name, fontWeight = FontWeight.Bold)
                    Text(k.branchIds.joinToString { id -> store.branches.first { it.id == id }.name }, color = Muted, fontSize = 12.sp)
                    Text("${rp(store.omzet(kasirRows))} · ${kasirRows.size} nota", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun BranchesScreen(nav: NavHostController, toast: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var maps by remember { mutableStateOf("") }
    val ctx = LocalContext.current
    Scaffold(topBar = { CuciinTopBar("Cabang", "Nama · lokasi · Maps", onBack = { nav.popBackStack() }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                CardBlock {
                    Text("Cabang baru", fontWeight = FontWeight.Bold)
                    OutlinedTextField(name, { name = it }, label = { Text("Nama") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                    OutlinedTextField(code, { code = it }, label = { Text("Kode nota (MEL)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(location, { location = it }, label = { Text("Lokasi") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(maps, { maps = it }, label = { Text("Titik Maps / alamat") }, modifier = Modifier.fillMaxWidth())
                    Button(
                        onClick = {
                            if (name.isBlank() || code.isBlank()) {
                                toast("Nama dan kode wajib")
                                return@Button
                            }
                            store.addBranch(name, code, location, maps)
                            name = ""; code = ""; location = ""; maps = ""
                            toast("Cabang tersimpan")
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) { Text("Tambah cabang") }
                }
            }
            items(store.branches, key = { it.id }) { b ->
                val kasir = store.staff.filter { it.role == Role.Kasir && it.approved && b.id in it.branchIds }
                val spv = store.staff.filter { it.role == Role.Supervisor && it.approved && b.id in it.branchIds }
                CardBlock {
                    Text(b.name, fontWeight = FontWeight.Bold)
                    Text(b.location, color = Muted, fontSize = 12.sp)
                    Text("Kasir: ${kasir.joinToString { it.name }.ifBlank { "—" }}", fontSize = 12.sp)
                    Text("SPV: ${spv.joinToString { it.name }.ifBlank { "—" }}", fontSize = 12.sp)
                    Text("Kode nota ${b.code}-…", fontSize = 12.sp)
                    TextButton({ ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(b.mapsQuery)} (${b.name})"))) }) { Text("Buka Google Maps") }
                }
            }
        }
    }
}

@Composable
private fun AuditScreen(nav: NavHostController) {
    Scaffold(topBar = { CuciinTopBar("Audit trail", "Semua transaksi", onBack = { nav.popBackStack() }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(store.audit) { a ->
                CardBlock(Modifier.clickable { a.notaId?.let { nav.navigate("queue/$it") } }) {
                    Text(a.action, fontWeight = FontWeight.Bold)
                    Text("${a.at} · ${a.user}", color = Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun UsersScreen(nav: NavHostController, toast: (String) -> Unit) {
    Scaffold(topBar = { CuciinTopBar("User", "1 cabang: ≥1 kasir + SPV", onBack = { nav.popBackStack() }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(store.staff.toList(), key = { it.email }) { u ->
                CardBlock {
                    Text(u.name, fontWeight = FontWeight.Bold)
                    Text("${u.role} · ${u.email} · ${if (u.approved) "aktif" else "pending"}", color = Muted, fontSize = 12.sp)
                    if (!u.approved) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button({ store.approve(u.name, true); toast("Disetujui") }) { Text("Setujui") }
                            OutlinedButton({ store.approve(u.name, false); toast("Ditolak") }) { Text("Tolak") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CashScreen(nav: NavHostController, toast: (String) -> Unit) {
    val s = store.session.value ?: return
    val bid = if (s.role == Role.Owner) store.viewBranch.value else s.branchId
    Scaffold(topBar = { CuciinTopBar("Tutup kas", "${s.name} · ${if (bid == "all") "semua cabang" else store.branch(bid).name}", onBack = { nav.popBackStack() }) }) { p ->
        Column(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            CardBlock {
                Text("Tunai hari ini  ${rp(store.todayByMethod(PayMethod.Tunai, bid))}")
                Text("QRIS hari ini  ${rp(store.todayByMethod(PayMethod.Qris, bid))}")
                Text("Transfer hari ini  ${rp(store.todayByMethod(PayMethod.Transfer, bid))}")
                Text("Piutang menggantung  ${rp(store.piutang(store.notas.filter { bid == "all" || it.branchId == bid }))}")
            }
            Button({
                val row = store.closeCash()
                toast("Kas ditutup ${row.at}")
                nav.popBackStack()
            }, Modifier.fillMaxWidth()) { Text("Tutup shift (catat ke audit)") }
            if (store.cashCloses.isNotEmpty()) {
                Text("Riwayat tutup kas", fontWeight = FontWeight.Bold)
                store.cashCloses.take(8).forEach { c ->
                    Text("${c.at} · ${c.by} · tunai ${rp(c.tunai)}", color = Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun ProfilScreen(nav: NavHostController, toast: (String) -> Unit) {
    val s = store.session.value
    Scaffold(topBar = { CuciinTopBar("Profil", onBack = { nav.popBackStack() }) }) { p ->
        Column(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(s?.name ?: store.ownerName, fontWeight = FontWeight.Bold)
            Text(s?.email ?: store.ownerEmail, color = Muted)
            Text("Versi ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", color = Muted)
            Text("Database: ${CloudSync.lastStatus}", color = Muted, fontSize = 12.sp)
            OutlinedButton({ nav.navigate("versions") }, Modifier.fillMaxWidth()) { Text("Riwayat versi") }
            OutlinedButton({
                if (s?.role == Role.Owner) toast("Owner tidak bisa hapus akun dari sini")
                else if (store.deleteMyAccount()) {
                    toast("Akun dihapus dari HP ini")
                    nav.navigate("login") { popUpTo(0) }
                }
            }, Modifier.fillMaxWidth()) { Text("Hapus akun saya") }
        }
    }
}

@Composable
private fun VersionScreen(nav: NavHostController) {
    Scaffold(topBar = { CuciinTopBar("Riwayat versi", "Sekarang ${BuildConfig.VERSION_NAME}", onBack = { nav.popBackStack() }) }) { p ->
        LazyColumn(Modifier.padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                CardBlock {
                    Text("Cuciin Android", fontWeight = FontWeight.Bold)
                    Text("versionName ${BuildConfig.VERSION_NAME} · versionCode ${BuildConfig.VERSION_CODE}", color = Muted, fontSize = 12.sp)
                    Text("Sama dengan changelog di repo. Setiap rilis APK nambah baris di sini.", color = Muted, fontSize = 12.sp)
                }
            }
            items(VersionHistory.releases) { r ->
                CardBlock {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("v${r.name}", fontWeight = FontWeight.ExtraBold, color = Navy, fontSize = 18.sp)
                        Chip("build ${r.code}", Navy)
                    }
                    Text(r.date, color = Muted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                    r.notes.forEach { Text("• $it", fontSize = 13.sp, modifier = Modifier.padding(bottom = 4.dp)) }
                }
            }
        }
    }
}
