package com.tiftazani.laundryops.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
    OutlinedTextField(
        value = value,
        onValueChange = on,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth(),
        singleLine = true,
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = when {
                phone -> KeyboardType.Phone
                number -> KeyboardType.Number
                password -> KeyboardType.Password
                else -> KeyboardType.Text
            },
        ),
        shape = RoundedCornerShape(16.dp),
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
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(if (ui.heightDp < 700) 168.dp else 220.dp)
                .background(Brush.linearGradient(listOf(TealDeep, Teal))),
        ) {
            Column(Modifier.align(Alignment.BottomStart).padding(ui.pad).padding(bottom = 20.dp)) {
                Box(Modifier.size(44.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                    Text("C", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp)
                }
                Spacer(Modifier.height(12.dp))
                Text("Cuciin", color = Color.White, fontSize = ui.heroSp, fontWeight = FontWeight.Black)
                Text("Operasional laundry · ${store.ownerName}", color = Color.White.copy(alpha = 0.78f), fontSize = 13.sp)
            }
        }
        Column(Modifier.padding(ui.pad), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
            Text(CloudSync.lastStatus, color = Muted, fontSize = 12.sp)
            Field(email, { email = it }, "Email")
            Field(pass, { pass = it }, "Password (kosong = akun awal)", password = true)
            PrimaryBtn(if (busy) "Masuk…" else "Masuk", enabled = !busy) {
                if (busy) return@PrimaryBtn
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
                            if (store.login(email, pass)) goHome()
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
            GhostBtn("Daftar Kasir / SPV") { nav.navigate("register") }
            Text("MASUK CEPAT", color = Teal, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                listOf(Role.Owner to "Owner", Role.Kasir to "Kasir", Role.Supervisor to "SPV").forEach { (role, label) ->
                    GhostBtn(label, modifier = Modifier.weight(1f)) {
                        store.demoLogin(role)
                        goHome()
                    }
                }
            }
            TextButton(onClick = { nav.navigate("versions") }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text("Versi ${BuildConfig.VERSION_NAME}", color = Muted)
            }
        }
    }
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
        ScreenHeader("Daftar", "Nunggu approve Owner", onBack = { nav.popBackStack() })
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(ui.gap)) {
            Field(name, { name = it }, "Nama")
            Field(email, { email = it }, "Email")
            Field(pass, { pass = it }, "Password", password = true)
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
                busy = true
                FirebaseCloud.register(name, email, pass, role, branch) {
                    busy = false
                    nav.navigate("pending")
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
        ScreenHeader("Nunggu Owner", onBack = { nav.popBackStack() })
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("${store.pendingName.value ?: "Akun"} menunggu ${store.ownerName} setujui.", color = Ink)
            GhostBtn("Kembali ke masuk") { nav.navigate("login") { popUpTo("login") { inclusive = true } } }
        }
    }
}
