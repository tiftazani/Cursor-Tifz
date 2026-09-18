package com.cuciin.laundryops.ui

/**
 * Ukuran isi layar login menurut tinggi ruang yang tersedia.
 *
 * Layar login dirancang muat dalam satu layar tanpa gulir. Masalahnya, saat keyboard terbuka
 * ruang tersisa menyusut jauh dan isi tidak lagi muat, sehingga bagian bawahnya terpotong:
 * tulisan "Lupa kata sandi?" hilang separuh dan "Daftar akun" tidak terlihat sama sekali.
 *
 * Aturannya sekarang: isi dipadatkan lebih dulu (logo dan jarak mengecil) ketika ruang sempit,
 * lalu boleh digulir sebagai jaring pengaman supaya tidak ada bagian yang tidak terjangkau.
 * Saat ruang lega, layar tetap satu layar penuh tanpa gulir seperti desain aslinya.
 */
internal object LoginLayout {

    /**
     * Tinggi minimum agar isi login muat lega tanpa gulir. Di bawah angka ini isi dipadatkan
     * dan boleh digulir. Layar ponsel biasa sekitar 800dp; keyboard memakan 300 sampai 400dp,
     * jadi keadaan sesudah keyboard terbuka hampir selalu masuk kategori sempit.
     */
    const val ROOMY_MIN_HEIGHT_DP = 640

    class Spec(
        val roomy: Boolean,
        val brandSize: Int,
        val gap: Int,
        val verticalPad: Int,
    ) {
        /**
         * Isi boleh digulir hanya saat ruang tidak cukup. Saat lega, layar tetap satu layar
         * penuh supaya desainnya tidak berubah dan tidak ada gulir yang tidak perlu.
         */
        val scrollable: Boolean get() = !roomy
    }

    /**
     * [keyboardOpen] dipakai karena pada Android modern jendela tidak lagi menyusut saat
     * keyboard muncul, sehingga tinggi yang dilaporkan sistem tetap penuh. Satu-satunya tanda
     * yang dapat dipercaya bahwa ruang benar-benar menyusut adalah inset keyboard itu sendiri.
     */
    fun forRoom(heightDp: Int, keyboardOpen: Boolean): Spec =
        if (!keyboardOpen && heightDp >= ROOMY_MIN_HEIGHT_DP) {
            Spec(roomy = true, brandSize = 104, gap = 10, verticalPad = 12)
        } else {
            Spec(roomy = false, brandSize = 76, gap = 8, verticalPad = 8)
        }
}
