package com.cuciin.laundryops.ui

/**
 * Aturan perpindahan antar tab.
 *
 * Dipisah dari layar supaya keputusannya dapat diperiksa tanpa Android. Layar memanggil
 * [needsNavigation] sebelum menavigasi, dan memakai [HOME_ROUTE] serta [POP_INCLUSIVE] saat
 * menyusun panggilan navigate.
 *
 * Kenapa dipisah: perpindahan tab pernah memakai `popUpTo(saveState)` berpasangan dengan
 * `restoreState`. Kombinasi itu hanya benar untuk graf bertingkat; pada graf datar seperti di
 * sini ia membuat tab macet setelah layar Service dibuka dari tombol "Service baru".
 */
internal object NavTransition {

    /** Rute dasar tempat semua tab dibersihkan. Selalu ada selama pengguna sudah masuk. */
    const val HOME_ROUTE = "home"

    /** home dipertahankan, bukan ikut dibuang, supaya selalu ada tempat pulang. */
    const val POP_INCLUSIVE = false

    /**
     * Apakah sebuah tab perlu dinavigasi.
     *
     * Menekan tab yang sedang aktif tidak perlu apa-apa: menavigasi ke rute yang sama hanya
     * menambah entri baru ke stack tanpa mengubah layar.
     */
    fun needsNavigation(current: String?, target: String): Boolean = current != target
}
