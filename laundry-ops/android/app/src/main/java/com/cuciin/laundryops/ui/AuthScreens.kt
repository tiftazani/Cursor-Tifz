package com.cuciin.laundryops.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Surface
import androidx.compose.material.icons.outlined.Login
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.LockOpen
import androidx.compose.material.icons.outlined.LocalLaundryService
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.heightIn
import com.cuciin.laundryops.ui.components.BrandMark
import com.cuciin.laundryops.ui.components.CardBlock
import com.cuciin.laundryops.ui.components.EmptyHint
import com.cuciin.laundryops.ui.components.FeedbackBanner
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.BuildConfig
import com.cuciin.laundryops.R
import com.cuciin.laundryops.data.CloudSync
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.FirebaseCloud
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.ui.components.ChipRow
import com.cuciin.laundryops.ui.components.FilterBar
import com.cuciin.laundryops.ui.components.FilterSheetRow
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.components.SelectChip
import com.cuciin.laundryops.ui.theme.Card
import com.cuciin.laundryops.ui.theme.Coral
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Line
import com.cuciin.laundryops.ui.theme.LocalCuciinPalette
import com.cuciin.laundryops.ui.theme.Muted
import com.cuciin.laundryops.ui.theme.Teal
import com.cuciin.laundryops.ui.theme.TealDeep
import com.cuciin.laundryops.ui.theme.OnHero

private val store get() = CuciinStore

@Composable
internal fun Field(
    value: String,
    on: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    password: Boolean = false,
    phone: Boolean = false,
    number: Boolean = false,
) {
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = on,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth(),
        singleLine = true,
        visualTransformation = if (password && !passwordVisible) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        trailingIcon = if (password) ({
            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                Icon(if (passwordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                    contentDescription = if (passwordVisible) "Sembunyikan kata sandi" else "Tampilkan kata sandi")
            }
        }) else null,
        keyboardOptions = KeyboardOptions(
            keyboardType = when {
                phone -> KeyboardType.Phone
                number -> KeyboardType.Number
                password -> KeyboardType.Password
                label.contains("email", ignoreCase = true) -> KeyboardType.Email
                else -> KeyboardType.Text
            },
        ),
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Teal,
            unfocusedBorderColor = Line,
            focusedContainerColor = Card,
            unfocusedContainerColor = Card,
        ),
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun LoginScreen(nav: NavHostController) {
    val ui = rememberUi()
    val palette = LocalCuciinPalette.current
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var loginHelp by remember { mutableStateOf(false) }
    var loginError by remember { mutableStateOf("") }
    var resetEmail by remember { mutableStateOf("") }
    var resetBusy by remember { mutableStateOf(false) }
    var resetMessage by remember { mutableStateOf("") }
    var resetFailed by remember { mutableStateOf(false) }
    fun goHome() {
        nav.navigate("home") { popUpTo("login") { inclusive = true } }
    }
    Box(Modifier.fillMaxSize()) {
        Image(
            painter = painterResource(R.drawable.login_laundry),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(Modifier.fillMaxSize().background(Color(0xA80D164B)))
        // Layar login mengikuti ruang yang benar-benar tersisa. Saat keyboard terbuka ruang
        // menyusut tajam, jadi isi dipadatkan dan boleh digulir supaya tidak ada bagian yang
        // terpotong. Saat ruang lega, layar tetap satu layar penuh tanpa gulir seperti semula.
        val scroll = rememberScrollState()
        // Tinggi jendela saja tidak cukup: pada Android modern jendela bisa tidak menyusut saat
        // keyboard muncul. Inset keyboard dan tinggi jendela diperiksa dua-duanya supaya
        // keadaan sempit tetap terdeteksi pada kedua perilaku sistem itu.
        val ime = WindowInsets.ime.getBottom(LocalDensity.current)
        val spec = LoginLayout.forRoom(ui.heightDp, ime > 0)
        // Saat keyboard terbuka, gulirkan seperlunya supaya kartu login (kolom isian, tombol
        // Masuk, dan Lupa kata sandi) terlihat penuh. Bukan digulir ke dasar layar, karena
        // yang sedang diisi justru ada di kartu itu.
        val cardIntoView = remember { BringIntoViewRequester() }
        LaunchedEffect(ime) {
            if (ime > 0) {
                // Dua kali: sekali setelah keyboard selesai muncul, sekali lagi setelah
                // tata letak menyesuaikan tinggi barunya.
                cardIntoView.bringIntoView()
                kotlinx.coroutines.delay(120)
                cardIntoView.bringIntoView()
            }
        }
        Column(
            Modifier
                .fillMaxSize()
                // Layar ini mengatur insetnya sendiri karena wallpaper harus mencapai tepi
                // layar. union mengambil nilai terbesar, jadi inset bar sistem dan keyboard
                // tidak dihitung dua kali saat keyboard terbuka.
                .windowInsetsPadding(WindowInsets.systemBars.union(WindowInsets.ime))
                .padding(horizontal = ui.pad, vertical = spec.verticalPad.dp)
                .then(if (spec.scrollable) Modifier.verticalScroll(scroll) else Modifier),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(spec.gap.dp),
        ) {
            Column(
                Modifier.widthIn(max = 460.dp).fillMaxWidth().then(if (spec.roomy) Modifier.weight(1f) else Modifier),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(spec.gap.dp),
            ) {
                BrandMark(size = spec.brandSize.dp)
                Text(
                    "Dicuci bersih, dicatat rapi.",
                    color = OnHero.copy(alpha = .82f),
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.2.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                GlassSurface(Modifier.bringIntoViewRequester(cardIntoView)) {
                    Text("Masuk ke akun Anda", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "Pakai email dan kata sandi akun Anda.",
                        color = Color.White.copy(alpha = .86f),
                        fontSize = 12.5.sp,
                        lineHeight = 17.sp,
                        modifier = Modifier.padding(top = 6.dp, bottom = 16.dp),
                    )
                    GlassField(email, { email = it; loginError = "" }, "Email", modifier = Modifier.padding(bottom = 13.dp))
                    GlassField(pass, { pass = it; loginError = "" }, "Kata sandi", password = true)
                    // Pesan kegagalan masuk ditampilkan sebagai banner di layar, bukan
                    // lewat toast/snackbar: SnackbarHost berada di Scaffold yang hanya
                    // membungkus rute setelah login, jadi pesan untuk layar Masuk
                    // pernah hilang tanpa jejak dan pengguna tidak tahu kenapa gagal.
                    if (loginError.isNotBlank()) {
                        Box(Modifier.padding(top = 12.dp)) { FeedbackBanner(loginError) }
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Lupa kata sandi?",
                            color = Color.White,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable {
                                resetEmail = email; resetMessage = ""; resetFailed = false; loginHelp = true
                            },
                        )
                    }
                    PrimaryBtn(if (busy) "Memeriksa akun…" else "Masuk", enabled = !busy, icon = Icons.Outlined.Login) {
                        if (busy) return@PrimaryBtn
                        if (email.isBlank() || pass.isBlank()) {
                            loginError = "Email dan kata sandi wajib diisi."
                            return@PrimaryBtn
                        }
                        if (!FirebaseCloud.enabled) {
                            loginError = "Konfigurasi identitas belum tersedia. Hubungi Owner sebelum memakai aplikasi."
                            return@PrimaryBtn
                        }
                        busy = true
                        FirebaseCloud.signIn(email, pass) { ok, pending, msg ->
                            busy = false
                            when {
                                ok -> goHome()
                                pending -> nav.navigate("pending")
                                else -> {
                                    if (store.pendingName.value != null) nav.navigate("pending")
                                    else loginError = msg
                                }
                            }
                        }
                    }
                    if (busy) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                            CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = Teal)
                        }
                    }
                }
                GhostBtn("Daftar akun baru", icon = Icons.Outlined.PersonAdd) { nav.navigate("register") }
            }
            Row(
                Modifier.align(Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = { nav.navigate("versions") }) {
                    Text("Versi ${BuildConfig.VERSION_NAME}", color = Color.White.copy(alpha = .70f))
                }
                Text("·", color = Color.White.copy(alpha = .45f), fontSize = 13.sp)
                // Membuka layar pembuka lagi, karena setelah aplikasi dipasang layar itu
                // tidak muncul sendiri lagi.
                TextButton(onClick = { nav.navigate("onboarding") }) {
                    Text("Tentang aplikasi", color = Color.White.copy(alpha = .82f), fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
    if (loginHelp) AlertDialog(onDismissRequest = { if (!resetBusy) loginHelp = false }, title = { Text("Reset kata sandi") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Kami akan mengirim link reset ke email akun yang terdaftar.", color = Muted)
            Field(resetEmail, { resetEmail = it }, "Email akun")
            if (!FirebaseCloud.enabled) Text("Reset email belum aktif pada build ini karena Firebase Auth produksi belum terhubung.", color = Coral, fontSize = 12.sp)
            if (resetMessage.isNotBlank()) {
                if (resetFailed) Surface(color = Coral.copy(alpha = .09f), shape = RoundedCornerShape(12.dp)) {
                    Text(resetMessage, color = Coral, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(12.dp))
                } else FeedbackBanner(resetMessage)
            }
        }
    }, confirmButton = {
        TextButton(enabled = !resetBusy && resetEmail.isNotBlank(), onClick = {
            resetBusy = true
            FirebaseCloud.sendPasswordReset(resetEmail) { error ->
                resetBusy = false
                resetFailed = error != null
                resetMessage = error ?: "Tautan reset sudah dikirim ke email itu. Periksa kotak masuk dan folder spam.\n\nBuka tautannya dari email yang sama. Sebagian aplikasi email dan pemindai tautan memotong bagian alamat, sehingga halaman menampilkan 'The selected page mode is invalid.'. Kalau itu terjadi, salin alamat lengkapnya ke browser, atau minta tautan baru lewat tombol di atas."
            }
        }) { Text(if (resetBusy) "Mengirim…" else "Kirim link") }
    }, dismissButton = { TextButton(enabled = !resetBusy, onClick = { loginHelp = false }) { Text("Batal") } })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun RegisterScreen(nav: NavHostController) {
    val ui = rememberUi()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(Role.Kasir) }
    var branch by remember { mutableStateOf(store.branches.firstOrNull()?.id.orEmpty()) }
    var busy by remember { mutableStateOf(false) }
    var showRoleSheet by rememberSaveable { mutableStateOf(false) }
    var showBranchSheet by rememberSaveable { mutableStateOf(false) }
    fun roleLabel(value: Role) = when (value) {
        Role.Owner -> "Owner"
        Role.Supervisor -> "SPV"
        Role.Kasir -> "Kasir"
    }
    val branchName = store.branches.firstOrNull { it.id == branch }?.name?.removePrefix("Cuciin ")?.ifBlank { null } ?: "Pilih cabang"
    var regError by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(horizontal = ui.pad)) {
        ScreenHeader("Daftar", "Akun akan ditinjau Owner", onBack = { nav.popBackStack() })
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Field(name, { name = it; regError = "" }, "Nama")
            Field(email, { email = it; regError = "" }, "Email")
            Field(pass, { pass = it; regError = "" }, "Kata sandi", password = true)
            FilterBar(
                label = "Peran akses",
                value = roleLabel(role),
                detail = "Kasir, SPV, atau Owner. Owner baru tetap ditinjau Owner aktif.",
                icon = Icons.Outlined.AdminPanelSettings,
                onClick = { showRoleSheet = true },
            )
            FilterBar(
                label = "Cabang penugasan",
                value = branchName,
                detail = "Satu cabang awal. Owner dapat menambah cabang setelah persetujuan.",
                icon = Icons.Outlined.Storefront,
                onClick = { showBranchSheet = true },
            )
            // Layar pendaftaran juga berada di luar Scaffold ber-snackbar, jadi
            // pesan kegagalannya ditampilkan sebagai banner di layar.
            if (regError.isNotBlank()) FeedbackBanner(regError)
            PrimaryBtn(if (busy) "Mengirim…" else "Kirim pendaftaran", enabled = !busy) {
                if (name.isBlank() || email.isBlank()) {
                    regError = "Nama dan email wajib diisi."
                    return@PrimaryBtn
                }
                if (branch.isBlank()) {
                    regError = "Pilih cabang penugasan."
                    return@PrimaryBtn
                }
                if (!BuildConfig.DEBUG && pass.length < 12) {
                    regError = "Gunakan kata sandi minimal 12 karakter."
                    return@PrimaryBtn
                }
                busy = true
                FirebaseCloud.register(name, email, pass, role, branch) { result ->
                    busy = false
                    if (result == "pending" || result == "pending-local") nav.navigate("pending")
                    else regError = "Pendaftaran belum berhasil. Periksa koneksi dan data akun."
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
    if (showRoleSheet) ModalBottomSheet(onDismissRequest = { showRoleSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih peran akses", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Satu peran per pendaftaran. Owner dapat lebih dari dua selama disetujui Owner aktif.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            Role.entries.forEach { option ->
                FilterSheetRow(role == option, roleLabel(option), null) { role = option; showRoleSheet = false }
            }
        }
    }
    if (showBranchSheet) ModalBottomSheet(onDismissRequest = { showBranchSheet = false }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Pilih cabang penugasan", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            Text("Daftar tumbuh mengikuti master cabang, bukan chip yang terpotong.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
            store.branches.forEach { b ->
                FilterSheetRow(branch == b.id, b.name.removePrefix("Cuciin "), b.code) { branch = b.id; showBranchSheet = false }
            }
        }
    }
}

@Composable
internal fun PendingScreen(nav: NavHostController) {
    val ui = rememberUi()
    Column(Modifier.fillMaxSize().padding(horizontal = ui.pad)) {
        ScreenHeader("Menunggu persetujuan", onBack = { nav.popBackStack() })
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            EmptyHint("Pendaftaran diterima", "${store.pendingName.value ?: "Akun"} menunggu persetujuan ${store.ownerName} sebelum dapat masuk.")
            GhostBtn("Kembali ke masuk") { nav.navigate("login") { popUpTo("login") { inclusive = true } } }
        }
    }
}
