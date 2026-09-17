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
        FirebaseAuth.getInstance().signInWithEmailAndPassword(email.trim(), password)
            .addOnSuccessListener {
                CloudSync.verifyIdentity { identity, error ->
                    if (identity == null) {
                        FirebaseAuth.getInstance().signOut()
                        onDone(false, false, error ?: "Akun belum diizinkan")
                        return@verifyIdentity
                    }
                    val local = CuciinStore.staff.firstOrNull { it.email.equals(identity.email, true) }
                    val branchId = identity.branchIds.firstOrNull() ?: local?.branchIds?.firstOrNull()
                    if (branchId == null) {
                        FirebaseAuth.getInstance().signOut()
                        onDone(false, false, "Akun belum memiliki cabang")
                        return@verifyIdentity
                    }
                    CuciinStore.session.value = Session(identity.role, identity.name, identity.email, branchId)
                    CuciinStore.viewBranch.value = if (identity.role == Role.Owner) "all" else branchId
                    CuciinStore.bumpPublic()
                    CloudSync.onAuthenticated()
                    onDone(true, false, "ok")
                }
            }
            .addOnFailureListener { e -> ui { onDone(false, false, e.message ?: "Auth gagal") } }
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
            .addOnSuccessListener { ui { onDone(null) } }
            .addOnFailureListener { e -> ui { onDone(e.message ?: "Link reset belum berhasil dikirim") } }
    }

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
            .addOnSuccessListener { ui { onDone(null) } }
            .addOnFailureListener { e -> ui { onDone(e.message ?: "Kata sandi belum berhasil diubah") } }
    }
}
