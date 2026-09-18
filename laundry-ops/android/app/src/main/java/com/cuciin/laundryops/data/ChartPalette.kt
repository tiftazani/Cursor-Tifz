package com.cuciin.laundryops.data

/**
 * Palet kategorikal untuk diagram.
 *
 * Diagram donat dan batang memerlukan warna yang saling berbeda supaya setiap bagian
 * dapat dikenali dari legendanya. Palet tema (navy, biru, sky) tidak dipakai di sini
 * karena beberapa bagian akan tampak sama dan legendanya tidak terbaca.
 *
 * Urutan warna dipilih agar bagian yang bersebelahan tetap kontras, termasuk ketika
 * dicetak hitam putih: terang, gelap, sedang, lalu berulang.
 */
object ChartPalette {
    /** Warna diwakili sebagai komponen RGB 0-255 agar dipakai Compose maupun kanvas PDF. */
    val categorical: List<Triple<Int, Int, Int>> = listOf(
        Triple(7, 91, 175),    // biru Cuciin
        Triple(255, 138, 61),  // oranye
        Triple(23, 160, 133),  // hijau tosca
        Triple(197, 62, 140),  // magenta
        Triple(255, 197, 61),  // kuning
        Triple(94, 108, 214),  // indigo
        Triple(226, 87, 76),   // merah bata
        Triple(0, 168, 204),   // cyan
        Triple(138, 96, 190),  // ungu
        Triple(122, 148, 44),  // zaitun
    )

    fun colorAt(index: Int): Triple<Int, Int, Int> = categorical[index.mod(categorical.size)]

    /** Ramp batang: satu warna dasar dengan dua tingkat terang, supaya urutan tetap terbaca. */
    val barHigh = Triple(7, 91, 175)
    val barLow = Triple(178, 205, 232)
}
