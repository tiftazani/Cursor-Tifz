package com.cuciin.laundryops.data

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth
import java.util.concurrent.TimeUnit

/** Firebase hanya menangani identitas. Data operasional dikirim ke Cloudflare D1. */
object FirebaseCloud {
    private const val TAG = "CuciinFirebase"
    private val main = Handler(Looper.getMainLooper())
    var enabled: Boolean = false
        private set
    val authenticated: Boolean get() = enabled && FirebaseAuth.getInstance().currentUser != null

    /** Dipanggil dari thread I/O untuk mengautentikasi API Cloudflare. */
    fun idTokenBlocking(): String? {
        if (!authenticated) return null
        return try {
            Tasks.await(FirebaseAuth.getInstance().currentUser!!.getIdToken(false), 10, TimeUnit.SECONDS).token
        } catch (e: Exception) {
            Log.w(TAG, "token Firebase belum tersedia", e)
            null
        }
    }

    private fun ui(block: () -> Unit) {
        main.post(block)
    }

    fun init(app: Application) {
        enabled = try {
            if (FirebaseApp.getApps(app).isEmpty()) FirebaseApp.initializeApp(app) != null else true
        } catch (e: Exception) {
            Log.i(TAG, "Firebase off (lokal): ${e.message}")
            false
        }
    }

    fun signOut() {
        if (enabled) FirebaseAuth.getInstance().signOut()
    }

    fun signIn(email: String, password: String, onDone: (ok: Boolean, pending: Boolean, msg: String) -> Unit) {
        if (!enabled) return ui { onDone(false, false, "Firebase belum dikonfigurasi") }
        // Rantai Task Firebase tidak bisa diandalkan untuk memberi jawaban: saat kredensial salah,
        // reCAPTCHA call wrapper menangkap kegagalannya dan mencoba ulang lewat SafetyNet, dan di
        // perangkat yang layanan Google-nya tidak lengkap rantai itu tidak pernah selesai. Listener
        // sukses maupun gagal tidak dipanggil, jadi tombol Masuk berhenti tanpa penjelasan apa pun.
        // Karena itu jawaban selalu dipaksa keluar dari sini, bukan diserahkan ke Task.
        val done = java.util.concurrent.atomic.AtomicBoolean(false)
        fun finish(ok: Boolean, pending: Boolean, msg: String) {
            if (!done.compareAndSet(false, true)) return
            // Semua listener Firebase (sukses, gagal, maupun batal) dipanggil di thread
            // internal Firebase, bukan main thread. Memperbarui state Compose dari thread
            // itu membuat pesannya tidak pernah tergambar, sehingga kegagalan login tampak
            // seperti tombol yang tidak bereaksi. Jawaban wajib diantar ke main thread.
            ui {
                onDone(ok, pending, msg)
            }
        }
        val watchdog = Runnable {
            finish(false, false, "Server identitas tidak menjawab. Periksa koneksi lalu coba lagi.")
        }
        main.postDelayed(watchdog, 20_000)
        FirebaseAuth.getInstance().signInWithEmailAndPassword(email.trim(), password)
            .addOnSuccessListener {
                CloudSync.verifyIdentity { identity, error ->
                    main.removeCallbacks(watchdog)
                    if (identity == null) {
                        FirebaseAuth.getInstance().signOut()
                        finish(false, false, error ?: "Akun belum diizinkan")
                        return@verifyIdentity
                    }
                    val local = CuciinStore.staff.firstOrNull { it.email.equals(identity.email, true) }
                    val branchId = identity.branchIds.firstOrNull() ?: local?.branchIds?.firstOrNull()
                    if (branchId == null) {
                        FirebaseAuth.getInstance().signOut()
                        finish(false, false, "Akun belum memiliki cabang")
                        return@verifyIdentity
                    }
                    CuciinStore.session.value = Session(identity.role, identity.name, identity.email, branchId)
                    CuciinStore.viewBranch.value = if (identity.role == Role.Owner) "all" else branchId
                    CuciinStore.bumpPublic()
                    CloudSync.onAuthenticated()
                    finish(true, false, "ok")
                }
            }
            .addOnFailureListener { e ->
                main.removeCallbacks(watchdog)
                finish(false, false, friendlyAuthMessage(e))
            }
        // addOnCanceledListener: rantai yang dibatalkan reCAPTCHA juga harus menjawab.
        .addOnCanceledListener {
            main.removeCallbacks(watchdog)
            finish(false, false, "Email atau kata sandi tidak sesuai.")
        }
    }

    /**
     * Pesan Firebase mentah berbahasa Inggris dan menyebut istilah teknis yang tidak berguna bagi
     * kasir, misalnya "The supplied auth credential is incorrect, malformed or has expired".
     * Yang penting hanya: apakah email/sandi salah, atau akunnya memang belum bisa dipakai.
     */
    private fun friendlyAuthMessage(e: Exception): String {
        val raw = e.message.orEmpty().lowercase()
        return when {
            "password is invalid" in raw || "credential is incorrect" in raw || "invalid_login" in raw ||
                "malformed" in raw || "no user record" in raw || "user not found" in raw ->
                "Email atau kata sandi tidak sesuai."
            "network" in raw || "timeout" in raw || "unreachable" in raw ->
                "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi."
            "too many" in raw || "blocked" in raw ->
                "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi."
            e.message.isNullOrBlank() -> "Masuk belum berhasil. Periksa email dan kata sandi."
            else -> e.message!!
        }
    }

    fun register(name: String, email: String, password: String, role: Role, branchId: String, onDone: (String) -> Unit) {
        if (!enabled) {
            CuciinStore.register(name, email, role, branchId, password)
            return ui { onDone("pending-local") }
        }
        FirebaseAuth.getInstance().createUserWithEmailAndPassword(email.trim(), password)
            .addOnSuccessListener {
                CloudSync.submitRegistration(name, email, role, branchId) { error ->
                    val auth = FirebaseAuth.getInstance()
                    if (error == null) {
                        CuciinStore.markRegistrationPending(name)
                        auth.signOut()
                        onDone("pending")
                    } else {
                        auth.currentUser?.delete()?.addOnCompleteListener {
                            auth.signOut()
                            onDone(error)
                        } ?: run {
                            auth.signOut()
                            onDone(error)
                        }
                    }
                }
            }
            .addOnFailureListener { e -> ui { onDone(e.message ?: "gagal daftar") } }
    }

    fun sendPasswordReset(email: String, onDone: (String?) -> Unit) {
        if (!enabled) return ui { onDone("Layanan reset email belum aktif pada build ini.") }
        if (email.isBlank()) return ui { onDone("Isi email akun terlebih dahulu.") }
        FirebaseAuth.getInstance().sendPasswordResetEmail(email.trim())
            // Setelah link reset dipakai, kata sandi Firebase berubah tanpa melalui aplikasi,
            // sementara hash lokal tetap yang lama. Akibatnya orang tidak bisa masuk lagi dan
            // harus memakai "Lupa kata sandi" sekali lagi. Baris ini membuang hash lokal supaya
            // layar masuk jatuh ke jalur verifikasi Firebase, bukan menolak sandi barunya.
            .addOnSuccessListener { ui { forgetLocal(email); onDone(null) } }
            .addOnFailureListener { e -> ui { onDone(e.message ?: "Link reset belum berhasil dikirim") } }
    }

    /** Dipakai setelah reset supaya hash lokal yang usang tidak menolak kata sandi baru. */
    var forgetLocal: (String) -> Unit = {}

    fun changeEmail(currentPassword: String, newEmail: String, onDone: (String?) -> Unit) {
        val user = FirebaseAuth.getInstance().currentUser ?: return ui { onDone("Silakan masuk kembali") }
        val oldEmail = user.email ?: return ui { onDone("Email akun tidak ditemukan") }
        val credential = EmailAuthProvider.getCredential(oldEmail, currentPassword)
        user.reauthenticate(credential).continueWithTask { user.updateEmail(newEmail.trim()) }
            .addOnSuccessListener { ui { onDone(null) } }
            .addOnFailureListener { e -> ui { onDone(e.message ?: "Email belum berhasil diubah") } }
    }

    fun changePassword(currentPassword: String, newPassword: String, onDone: (String?) -> Unit) {
        val user = FirebaseAuth.getInstance().currentUser ?: return ui { onDone("Silakan masuk kembali") }
        val email = user.email ?: return ui { onDone("Email akun tidak ditemukan") }
        val credential = EmailAuthProvider.getCredential(email, currentPassword)
        user.reauthenticate(credential).continueWithTask { user.updatePassword(newPassword) }
            // Kata sandi yang dipakai layar masuk adalah hash lokal, bukan kata sandi Firebase.
            // Jadi keduanya harus berubah bersama, kalau tidak orang tidak bisa masuk lagi
            // dengan kata sandi barunya meski Firebase sudah menerimanya.
            .addOnSuccessListener { ui { onDone(changeLocal(currentPassword, newPassword)) } }
            .addOnFailureListener { e -> ui { onDone(e.message ?: "Kata sandi belum berhasil diubah") } }
    }

    /** Menyamakan hash lokal dengan kata sandi baru. Diisi MoreScreens supaya tanpa impor lingkar. */
    var changeLocal: (String, String) -> String? = { _, _ -> null }
}
