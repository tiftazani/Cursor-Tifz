package com.tiftazani.laundryops.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Surface
import androidx.compose.material.icons.outlined.Login
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.LockOpen
import androidx.compose.material.icons.outlined.LocalLaundryService
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.heightIn
import com.tiftazani.laundryops.ui.components.BrandMark
import com.tiftazani.laundryops.ui.components.CardBlock
import com.tiftazani.laundryops.ui.components.EmptyHint
import com.tiftazani.laundryops.ui.components.FeedbackBanner
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.tiftazani.laundryops.BuildConfig
import com.tiftazani.laundryops.data.CloudSync
import com.tiftazani.laundryops.data.CuciinStore
import com.tiftazani.laundryops.data.FirebaseCloud
import com.tiftazani.laundryops.data.Role
import com.tiftazani.laundryops.ui.components.ChipRow
import com.tiftazani.laundryops.ui.components.GhostBtn
import com.tiftazani.laundryops.ui.components.PrimaryBtn
import com.tiftazani.laundryops.ui.components.ScreenHeader
import com.tiftazani.laundryops.ui.components.SelectChip
import com.tiftazani.laundryops.ui.theme.Card
import com.tiftazani.laundryops.ui.theme.Coral
import com.tiftazani.laundryops.ui.theme.Ink
import com.tiftazani.laundryops.ui.theme.Line
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Teal
import com.tiftazani.laundryops.ui.theme.TealDeep

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

@Composable
internal fun LoginScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var email by remember { mutableStateOf(if (BuildConfig.DEBUG) store.ownerEmail else "") }
    var pass by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var loginHelp by remember { mutableStateOf(false) }
    var resetEmail by remember { mutableStateOf("") }
    var resetBusy by remember { mutableStateOf(false) }
    var resetMessage by remember { mutableStateOf("") }
    var resetFailed by remember { mutableStateOf(false) }
    fun goHome() {
        nav.navigate("home") { popUpTo("login") { inclusive = true } }
    }
    fun localLogin() {
        if (store.login(email, pass)) goHome()
        else if (store.pendingName.value != null) nav.navigate("pending")
        else toast("Email atau kata sandi salah, atau akun belum ada.")
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(ui.pad), horizontalAlignment = Alignment.CenterHorizontally) {
        Column(Modifier.widthIn(max = 460.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                BrandMark()
                Column {
                    Text("cuciin", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text("LAUNDRY & PERAWATAN", fontSize = 10.sp, letterSpacing = 1.sp, color = Muted)
                }
            }
            Surface(color = TealDeep, shape = RoundedCornerShape(26.dp)) {
                Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Cucian terurus.\nPekerjaan tertata.", color = Color.White, fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold)
                    Text("Catat pesanan, pantau proses, dan siapkan cucian pelanggan dalam satu tempat.", color = Color.White.copy(alpha = .8f), fontSize = 14.sp, lineHeight = 21.sp)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Outlined.CheckCircle, null, tint = Color(0xFF90E6F2), modifier = Modifier.size(18.dp))
                        Text("Dari pesanan masuk hingga selesai", color = Color.White, fontSize = 12.sp)
                    }
                }
            }
            CardBlock {
                Text("Masuk ke akun Anda", color = Ink, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                Text("Gunakan akun yang terdaftar di laundry Anda.", color = Muted, fontSize = 13.sp)
            Field(email, { email = it }, "Email")
            Field(pass, { pass = it }, "Kata sandi", password = true)
            Text("Akun awal memakai kata sandi test1234. Segera ubah melalui menu Profil.", color = Muted, fontSize = 12.sp)
            PrimaryBtn(if (busy) "Memeriksa akun…" else "Masuk", enabled = !busy, icon = Icons.Outlined.Login) {
                if (busy) return@PrimaryBtn
                if (!BuildConfig.DEBUG && (email.isBlank() || pass.isBlank())) {
                    toast("Email dan kata sandi wajib diisi.")
                    return@PrimaryBtn
                }
                if (!FirebaseCloud.enabled) {
                    localLogin()
                    return@PrimaryBtn
                }
                busy = true
                FirebaseCloud.signIn(email, pass) { ok, pending, msg ->
                    busy = false
                    when {
                        ok -> goHome()
                        pending -> nav.navigate("pending")
                        else -> {
                            if (BuildConfig.DEBUG && store.login(email, pass)) goHome()
                            else if (store.pendingName.value != null) nav.navigate("pending")
                            else toast(msg)
                        }
                    }
                }
            }
            if (busy) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = Teal)
                }
            }
                TextButton(onClick = { resetEmail = email; resetMessage = ""; resetFailed = false; loginHelp = true }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Lupa kata sandi?", color = Teal) }
            }
            GhostBtn("Daftar sebagai Kasir / SPV", icon = Icons.Outlined.PersonAdd) { nav.navigate("register") }
            if (BuildConfig.DEBUG) {
                Text("MASUK CEPAT", color = Teal, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    listOf(Role.Owner to "Owner", Role.Kasir to "Kasir", Role.Supervisor to "SPV").forEach { (role, label) ->
                        GhostBtn(label, modifier = Modifier.weight(1f)) {
                            store.demoLogin(role)
                            goHome()
                        }
                    }
                }
            }
            Text("Dikelola oleh ${store.ownerName}", color = Muted, fontSize = 12.sp)
            Text(CloudSync.lastStatus, color = Muted, fontSize = 12.sp)
            TextButton(onClick = { nav.navigate("versions") }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text("Versi ${BuildConfig.VERSION_NAME}", color = Muted)
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
                resetMessage = error ?: "Link reset sudah dikirim. Periksa kotak masuk dan folder spam."
            }
        }) { Text(if (resetBusy) "Mengirim…" else "Kirim link") }
    }, dismissButton = { TextButton(enabled = !resetBusy, onClick = { loginHelp = false }) { Text("Batal") } })
}

@Composable
internal fun RegisterScreen(nav: NavHostController, toast: (String) -> Unit) {
    val ui = rememberUi()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(Role.Kasir) }
    var branch by remember { mutableStateOf(store.branches.firstOrNull()?.id.orEmpty()) }
    var busy by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(horizontal = ui.pad)) {
        ScreenHeader("Daftar", "Akun akan ditinjau Owner", onBack = { nav.popBackStack() })
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
            Field(name, { name = it }, "Nama")
            Field(email, { email = it }, "Email")
            Field(pass, { pass = it }, "Kata sandi", password = true)
            ChipRow {
                SelectChip(role == Role.Kasir, "Kasir") { role = Role.Kasir }
                SelectChip(role == Role.Supervisor, "SPV") { role = Role.Supervisor }
            }
            ChipRow {
                store.branches.forEach { b ->
                    SelectChip(branch == b.id, b.name.removePrefix("Cuciin ")) { branch = b.id }
                }
            }
            PrimaryBtn(if (busy) "Mengirim…" else "Kirim pendaftaran", enabled = !busy) {
                if (name.isBlank() || email.isBlank()) {
                    toast("Nama dan email wajib")
                    return@PrimaryBtn
                }
                if (!BuildConfig.DEBUG && pass.length < 12) {
                    toast("Gunakan kata sandi minimal 12 karakter.")
                    return@PrimaryBtn
                }
                busy = true
                FirebaseCloud.register(name, email, pass, role, branch) { result ->
                    busy = false
                    if (result == "pending" || result == "pending-local") nav.navigate("pending")
                    else toast("Pendaftaran belum berhasil. Periksa koneksi dan data akun.")
                }
            }
            Spacer(Modifier.height(24.dp))
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
