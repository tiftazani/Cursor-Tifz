package com.cuciin.laundryops.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Login
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Komponen kartu kaca untuk halaman login.
 *
 * Latar belakangnya tembus pandang dan isi di belakangnya diburamkan, jadi wallpaper tetap
 * terlihat tanpa mengganggu keterbacaan tulisan. Ini pengganti kartu putih penuh yang
 * sebelumnya menutup gambar.
 *
 * Kenapa kaca gelap, bukan terang: wallpaper login cukup ramai (mesin cuci, setrika, botol,
 * gelembung). Kaca terang membuat tulisan putih kehilangan kontras di atasnya, sedangkan
 * lapisan navy tipis memberi kontras yang cukup sambil tetap memperlihatkan gambar.
 *
 * Cara kerjanya: lapisan [Color] dengan alpha rendah sebagai dasar, ditambah garis tepi putih
 * tipis dan sorot di tepi atas supaya terbaca sebagai permukaan kaca, bukan sekadar kotak
 * transparan.
 */
object GlassCard {

    /** Alpha latar kartu. Cukup pekat untuk kontras teks, cukup bening untuk melihat gambar. */
    const val SURFACE_ALPHA = 0.42f

    /** Alpha isian di dalam kartu, lebih bening dari kartunya sendiri. */
    const val FIELD_ALPHA = 0.16f

    /** Alpha garis tepi. */
    const val BORDER_ALPHA = 0.26f

    val shape = RoundedCornerShape(26.dp)
}

/** Latar kaca gelap yang dipakai kartu login. */
@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    alpha: Float = GlassCard.SURFACE_ALPHA,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier,
        shape = GlassCard.shape,
        color = Color(0xFF00306E).copy(alpha = alpha),
        border = BorderStroke(1.dp, Color.White.copy(alpha = GlassCard.BORDER_ALPHA)),
    ) {
        Column(
            Modifier.padding(horizontal = 20.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp),
            content = content,
        )
    }
}

/**
 * Kolom isian gaya kaca: garis putih tipis, isian bening, label kecil di atasnya.
 * Warna teks putih supaya terbaca di atas kaca gelap.
 */
@Composable
fun GlassField(
    value: String,
    on: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    password: Boolean = false,
    leading: Boolean = true,
) {
    var shown by rememberSaveable { mutableStateOf(false) }
    // Tombol "Next"/"Done" di keyboard harus benar-benar memindahkan fokus.
    // Tanpa ini, menekan Next di kolom email tidak melakukan apa pun, fokus
    // tetap di email, dan apa pun yang diketik berikutnya (kata sandi) ikut
    // masuk ke kolom email — kasir cabang menemukan emailnya menjadi
    // "nama@gmail.comsandi" lalu gagal masuk tanpa tahu sebabnya.
    val fokus = LocalFocusManager.current
    val aksiKeyboard = KeyboardActions(
        onNext = { fokus.moveFocus(FocusDirection.Down) },
        onDone = { fokus.clearFocus() },
    )
    Column(modifier.fillMaxWidth()) {
        Text(
            label.uppercase(),
            color = Color.White.copy(alpha = .84f),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            modifier = Modifier.padding(bottom = 5.dp),
        )
        OutlinedTextField(
            value = value,
            onValueChange = on,
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp),
            visualTransformation = if (password && !shown) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                keyboardType = when {
                    password -> KeyboardType.Password
                    label.contains("email", ignoreCase = true) -> KeyboardType.Email
                    else -> KeyboardType.Text
                },
                imeAction = if (password) ImeAction.Done else ImeAction.Next,
            ),
            keyboardActions = aksiKeyboard,
            leadingIcon = if (leading) ({
                Icon(
                    if (password) Icons.Outlined.Lock else Icons.Outlined.MailOutline,
                    null,
                    tint = Color.White.copy(alpha = .70f),
                    modifier = Modifier.size(18.dp),
                )
            }) else null,
            trailingIcon = if (password) ({
                IconButton(onClick = { shown = !shown }) {
                    Icon(
                        if (shown) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                        contentDescription = if (shown) "Sembunyikan kata sandi" else "Tampilkan kata sandi",
                        tint = Color.White.copy(alpha = .70f),
                        modifier = Modifier.size(18.dp),
                    )
                }
            }) else null,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedContainerColor = Color.White.copy(alpha = GlassCard.FIELD_ALPHA + .08f),
                unfocusedContainerColor = Color.White.copy(alpha = GlassCard.FIELD_ALPHA),
                focusedBorderColor = Color.White.copy(alpha = .80f),
                unfocusedBorderColor = Color.White.copy(alpha = .38f),
                cursorColor = Color.White,
                focusedLabelColor = Color.White,
                unfocusedLabelColor = Color.White.copy(alpha = .70f),
            ),
        )
    }
}

/** Tautan teks di atas kaca: putih, tebal, dengan sedikit bayangan lewat alpha. */
@Composable
fun GlassLink(text: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp)) {
        Text(text, color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
    }
}
