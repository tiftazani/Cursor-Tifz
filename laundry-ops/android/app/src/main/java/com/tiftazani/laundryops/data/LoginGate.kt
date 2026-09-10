package com.tiftazani.laundryops.data

/**
 * Aturan layar masuk. Akun awal Owner/Kasir/SPV hash-nya kosong —
 * kata sandi **tidak** wajib. Jangan toast "email dan kata sandi wajib diisi".
 */
object LoginGate {
    const val EMAIL_REQUIRED = "Email wajib diisi"
    const val WRONG = "Email / password salah, atau akun belum ada."

    fun emailError(email: String): String? =
        if (email.isBlank()) EMAIL_REQUIRED else null

    /** Firebase Auth menolak password kosong. Akun awal harus lewat login lokal. */
    fun useLocalLogin(password: String, firebaseEnabled: Boolean): Boolean =
        password.isBlank() || !firebaseEnabled
}
