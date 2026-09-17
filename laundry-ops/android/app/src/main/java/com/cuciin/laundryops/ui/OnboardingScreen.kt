package com.cuciin.laundryops.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.R
import com.cuciin.laundryops.ui.components.BrandMark
import com.cuciin.laundryops.ui.components.rememberTapFeedback
import com.cuciin.laundryops.ui.theme.CuciinShape
import kotlinx.coroutines.launch

/**
 * Isi layar pembuka sebelum halaman masuk.
 *
 * Dipisah dari layar supaya teks dan urutannya dapat diperiksa tanpa Android, dan supaya
 * tidak ada salah tempel gambar saat menambah halaman baru.
 */
internal object Onboarding {

    class Page(val image: Int, val title: String, val body: String)

    /**
     * Urutan halaman. Gambarnya rasio 9:20 supaya tidak terpotong di HP modern, dan tiap
     * gambar sudah punya ruang lega di bagian bawah tempat teks diletakkan.
     */
    val pages: List<Page> = listOf(
        Page(R.drawable.onboarding_1, "Semua cabang dalam satu aplikasi", "Antrian, nota, stok, dan kas."),
        Page(R.drawable.onboarding_2, "Tetap jalan tanpa internet", "Nota tersimpan di HP, terkirim otomatis."),
        Page(R.drawable.onboarding_3, "Akses sesuai peran", "Kasir, SPV, dan Owner punya menu sendiri."),
    )

    val lastIndex: Int get() = pages.lastIndex

    /** Tulisan tombol utama di halaman ke-[index]. */
    fun primaryLabel(index: Int): String = if (index == lastIndex) "Masuk ke akun" else "Lanjut"

    /**
     * Apakah halaman ke-[index] punya tombol kedua.
     *
     * Tombol kedua isinya "Lewati" dan hanya berguna selama masih ada halaman berikutnya. Di
     * halaman terakhir tidak ada lagi yang bisa dilewati, dan tombol utamanya sudah "Masuk ke
     * akun", jadi tombol kedua dihilangkan supaya tidak ada dua tombol berbeda tulisan yang
     * melakukan hal yang sama.
     */
    fun hasSecondButton(index: Int): Boolean = index != lastIndex

    /** Tulisan tombol kedua, atau null bila halaman itu tidak punya tombol kedua. */
    fun secondLabel(index: Int): String? = if (hasSecondButton(index)) "Lewati" else null
}

/**
 * Layar pembuka: tiga halaman geser, muncul sekali setelah aplikasi dipasang, dan bisa dibuka
 * lagi lewat tautan "Tentang aplikasi" di halaman masuk.
 *
 * Tata letaknya dibagi tiga lapisan:
 *
 * 1. Pager gambar: hanya gambar halaman, mengisi seluruh layar.
 * 2. Gradien: supaya teks di tepi atas dan bawah tetap terbaca.
 * 3. Isi: logo, judul, dan tombol dalam SATU kolom yang mengalir dari atas ke bawah.
 *
 * Judul dan tombol tidak boleh dipisah ke dua wadah berisi penuh layar, karena keduanya akan
 * sama-sama terdorong ke dasar layar dan saling menimpa. Dengan satu kolom, judul selalu duduk
 * tepat di atas blok tombol berapa pun tinggi layarnya.
 */
@Composable
internal fun OnboardingScreen(nav: NavHostController, onDone: () -> Unit) {
    val pager = rememberPagerState(pageCount = { Onboarding.pages.size })
    val scope = rememberCoroutineScope()
    val tap = rememberTapFeedback()
    val page = Onboarding.pages[pager.currentPage.coerceIn(0, Onboarding.lastIndex)]

    Box(Modifier.fillMaxSize().background(Color(0xFF0D164B))) {

        HorizontalPager(state = pager, modifier = Modifier.fillMaxSize()) { index ->
            Image(
                painter = painterResource(Onboarding.pages[index].image),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }

        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    0f to Color(0xFF0D164B).copy(alpha = .58f),
                    0.14f to Color(0xFF0D164B).copy(alpha = .14f),
                    0.30f to Color.Transparent,
                    0.44f to Color.Transparent,
                    0.60f to Color(0xFF0D164B).copy(alpha = .62f),
                    1f to Color(0xFF0D164B).copy(alpha = .95f),
                )
            )
        )

        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.systemBars)
                .padding(horizontal = 22.dp, vertical = 20.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                BrandMark(size = 58.dp)
                Spacer(Modifier.weight(1f))
                // "Lewati" hanya berguna selama masih ada halaman berikutnya. Di halaman
                // terakhir tombol utamanya sudah "Masuk ke akun", jadi tombol ini dihilangkan
                // supaya tidak ada dua tombol yang melakukan hal yang sama.
                if (Onboarding.hasSecondButton(pager.currentPage)) SkipPill { tap(); onDone() }
            }

            // Satu-satunya pengisi fleksibel: mendorong judul dan tombol ke bawah bersama-sama.
            Spacer(Modifier.weight(1f))

            Text(
                page.title,
                color = Color.White,
                fontSize = 28.sp,
                lineHeight = 33.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.6).sp,
            )
            Text(
                page.body,
                color = Color.White.copy(alpha = .94f),
                fontSize = 14.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 8.dp),
            )

            Spacer(Modifier.height(18.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(Onboarding.pages.size) { i ->
                    val active = pager.currentPage == i
                    Box(
                        Modifier
                            .height(7.dp)
                            .width(if (active) 20.dp else 7.dp)
                            .clip(CircleShape)
                            .background(if (active) Color(0xFFF7CA3A) else Color.White.copy(alpha = .45f))
                    )
                }
            }

            Spacer(Modifier.height(13.dp))

            Button(
                onClick = {
                    tap()
                    val here = pager.currentPage
                    if (here == Onboarding.lastIndex) {
                        onDone()
                    } else {
                        scope.launch { pager.animateScrollToPage(here + 1) }
                    }
                },
                modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp),
                shape = CuciinShape.button,
                colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color(0xFF0D164B)),
            ) {
                Text(
                    Onboarding.primaryLabel(pager.currentPage),
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.Bold,
                )
                // Panah hanya di tombol "Lanjut". Di halaman terakhir tombolnya "Masuk ke akun",
                // dan panah di situ akan terbaca sebagai "pindah halaman" padahal bukan.
                if (pager.currentPage != Onboarding.lastIndex) {
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null, modifier = Modifier.size(17.dp))
                }
            }

            Spacer(Modifier.height(9.dp))

            // Tombol kedua hanya ada selama masih ada halaman berikutnya, isinya "Lewati".
            // Di halaman terakhir tombolnya dihilangkan supaya tidak ada dua tombol berbeda
            // tulisan yang melakukan hal sama.
            if (Onboarding.hasSecondButton(pager.currentPage)) {
                OutlinedButton(
                    onClick = { tap(); scope.launch { pager.animateScrollToPage(Onboarding.lastIndex) } },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp),
                    shape = CuciinShape.button,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = .45f)),
                ) {
                    Text(
                        Onboarding.secondLabel(pager.currentPage).orEmpty(),
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

/** Tombol "Lewati" kecil di pojok kanan atas. */
@Composable
private fun SkipPill(onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        color = Color.White.copy(alpha = .16f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = .30f)),
    ) {
        Text(
            "Lewati",
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
        )
    }
}
