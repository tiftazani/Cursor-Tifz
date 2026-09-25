package com.cuciin.laundryops.data

/**
 * Aturan pembuatan akun login Firebase untuk user yang ditambahkan Owner.
 *
 * Login aplikasi diverifikasi Firebase Auth, sedangkan daftar user hanya baris data di server.
 * Dua hal itu terpisah: baris staff yang tersimpan rapi TIDAK membuat akun login. Kalau akun
 * loginnya tidak dibuat, orangnya tidak akan pernah bisa masuk meskipun namanya ada di daftar
 * user dan sandinya benar. Aturan di sini dipisah dari layar supaya bisa diuji langsung.
 */
enum class ProvisionKind { CREATED, ALREADY_EXISTS, SKIPPED, FAILED }

data class ProvisionResult(val kind: ProvisionKind, val detail: String = "")

object LoginProvision {
    /** Sandi awal aplikasi. Sama dengan yang dipakai layar Daftar dan sandi bawaan lainnya. */
    const val INITIAL_PASSWORD = "test1234"

    /** Batas terpendek kata sandi akun login menurut Firebase. */
    const val MIN_PASSWORD = 6

    /** Sandi yang diketik Owner dipakai apa adanya; kosong berarti sandi awal aplikasi. */
    fun initialPassword(typed: String): String = typed.trim().ifBlank { INITIAL_PASSWORD }

    /**
     * Kata sandi yang terlalu pendek ditolak SEBELUM disimpan.
     *
     * Firebase menolaknya juga, tetapi kalau baru ditolak di sana, baris usernya sudah
     * terlanjur tersimpan tanpa akun login dan orangnya tidak bisa masuk.
     */
    fun passwordProblem(typed: String, firebaseOn: Boolean): String? {
        if (!firebaseOn) return null
        val value = typed.trim()
        if (value.isEmpty() || value.length >= MIN_PASSWORD) return null
        return "Kata sandi akun login minimal $MIN_PASSWORD karakter. Kosongkan saja untuk memakai sandi awal aplikasi."
    }

    /** Pesan hasil untuk Owner. Selalu menyebut bahwa datanya sudah tersimpan. */
    fun message(result: ProvisionResult, passwordTyped: Boolean): String = when (result.kind) {
        ProvisionKind.CREATED -> "Pengguna tersimpan. Akun login dibuat."
        ProvisionKind.ALREADY_EXISTS -> if (passwordTyped) {
            "Pengguna tersimpan. Akun login sudah ada, jadi kata sandinya TIDAK ikut berubah; pemiliknya bisa memakai Lupa kata sandi."
        } else {
            "Pengguna tersimpan. Akun login sudah ada."
        }
        ProvisionKind.SKIPPED ->
            "Pengguna tersimpan. Akun login tidak dibuat karena Firebase tidak aktif di build ini."
        ProvisionKind.FAILED ->
            "Pengguna tersimpan, tetapi akun login GAGAL dibuat (${result.detail.ifBlank { "sebab tidak diketahui" }}). Ulangi Simpan agar dicoba lagi."
    }
}
