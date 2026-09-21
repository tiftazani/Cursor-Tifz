package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Masuk yang gagal harus selalu memberi jawaban ke pengguna.
 *
 * Pernah terjadi: kredensial salah membuat Firebase gagal, lalu ia mencoba ulang lewat
 * reCAPTCHA dan SafetyNet. Di perangkat yang layanan Google-nya tidak lengkap kedua jalur itu
 * tidak pernah selesai, sehingga `onDone` tidak pernah dipanggil. Tombol Masuk berhenti di
 * "Memeriksa akun" tanpa penjelasan apa pun, dan pengguna hanya melihat layar diam.
 */
class LoginTimeoutTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private val sumber = { jalur: String ->
        File(appDir, "src/main/java/com/cuciin/laundryops/$jalur").readText()
    }

    @Test
    fun masukPunyaBatasWaktuSupayaTidakMenggantung() {
        val cloud = sumber("data/FirebaseCloud.kt")

        assertTrue(
            "signIn tidak memasang batas waktu, jadi kegagalan bisa menggantung tanpa jawaban",
            cloud.contains("main.postDelayed(watchdog, 20_000)") && cloud.contains("val watchdog = Runnable {"),
        )
        assertTrue(
            "jawaban hanya boleh dipakai sekali, kalau tidak pesan ganda muncul",
            cloud.contains("if (!done.compareAndSet(false, true)) return"),
        )
        assertTrue(
            "batas waktu harus dibatalkan saat jawaban asli datang",
            cloud.contains("main.removeCallbacks(watchdog)"),
        )
    }

    @Test
    fun pesanGagalMemakaiBahasaPengguna() {
        val cloud = sumber("data/FirebaseCloud.kt")

        // Pesan mentah Firebase berbahasa Inggris dan tidak berguna bagi kasir.
        assertTrue(cloud.contains("private fun friendlyAuthMessage(e: Exception): String"))
        assertTrue(cloud.contains("\"Email atau kata sandi tidak sesuai.\""))
        assertTrue(
            "listener gagal harus lewat finish, bukan memanggil onDone langsung",
            cloud.contains("finish(false, false, friendlyAuthMessage(e))")
            && cloud.contains(".addOnCanceledListener {"),
        )
    }

    @Test
    fun jawabanDiantarKeMainThread() {
        val cloud = sumber("data/FirebaseCloud.kt")

        // Listener Firebase berjalan di thread internalnya. Memperbarui state Compose dari
        // thread itu membuat tampilan tidak ikut berubah, sehingga penolakan server tidak
        // terlihat sama sekali di layar.
        assertTrue(
            "finish() tidak mengantar jawaban ke main thread, jadi kegagalan tidak akan tergambar",
            cloud.contains("ui {\n                onDone(ok, pending, msg)\n            }"),
        )
    }

    @Test
    fun gagalMasukDitampilkanDiLayarBukanLewatPesanSingkat() {
        val auth = sumber("ui/AuthScreens.kt")

        // SnackbarHost berada di Scaffold yang hanya membungkus rute setelah login. Layar
        // Masuk dirender di luar Scaffold itu, jadi pesan lewat toast tidak pernah muncul di
        // pohon tampilan: bukti perangkat pernah menunjukkan jejak penolakan di log tetapi
        // nol elemen Snackbar di uiautomator dump.
        assertTrue(
            "layar Masuk tidak lagi menyimpan pesan kegagalan di state layar",
            auth.contains("var loginError by remember { mutableStateOf(\"\") }"),
        )
        assertTrue(
            "pesan kegagalan tidak dirender di layar Masuk",
            auth.contains("if (loginError.isNotBlank()) {") &&
                auth.contains("FeedbackBanner(loginError)"),
        )
        assertTrue(
            "kegagalan masuk kembali dikirim lewat pesan singkat yang tidak terlihat di layar pra-login",
            !auth.contains("else toast(msg)"),
        )
        assertTrue(
            "pesan kegagalan pendaftaran tidak tampil di layar pendaftaran",
            auth.contains("var regError by remember { mutableStateOf(\"\") }") &&
                auth.contains("if (regError.isNotBlank()) FeedbackBanner(regError)"),
        )
    }
}
