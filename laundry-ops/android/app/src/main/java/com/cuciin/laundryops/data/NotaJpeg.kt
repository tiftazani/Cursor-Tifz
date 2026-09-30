package com.cuciin.laundryops.data

/**
 * Aturan ukuran gambar JPEG nota. Dipisah dari renderer supaya bisa diuji tanpa Android.
 *
 * Nota dirender dari berkas PDF yang sama dengan tombol PDF, jadi tata letaknya tidak pernah
 * bercabang. Halaman banyak digabung tegak menjadi satu gambar; saat halaman bertambah, skala
 * diturunkan otomatis supaya bitmap gabungan tidak melewati batas memori perangkat cabang.
 */
object NotaJpeg {
    /** Skala render dari satuan point PDF (72 dpi) ke piksel: 2x berarti 144 dpi. */
    const val SKALA = 2f

    /** Batas tinggi gambar gabungan dalam piksel; 8.000 x 1.190 masih aman di HP cabang. */
    const val TINGGI_MAKS = 8_000

    /** Mutu kompres JPEG. 92 menjaga teks kecil tetap tajam tanpa berkas membengkak. */
    const val KUALITAS = 92

    /**
     * Skala yang benar-benar dipakai untuk sejumlah halaman. Selalu `min(SKALA, batas)`, jadi
     * tinggi gabungan tidak pernah melewati [TINGGI_MAKS] berapa pun jumlah halamannya.
     */
    fun skalaEfektif(halaman: Int, tinggiHalaman: Int): Float {
        if (halaman <= 0 || tinggiHalaman <= 0) return SKALA
        return minOf(SKALA, TINGGI_MAKS.toFloat() / (halaman.toFloat() * tinggiHalaman))
    }

    /** Lebar gambar dalam piksel. */
    fun lebar(halaman: Int, lebarHalaman: Int, tinggiHalaman: Int): Int =
        (lebarHalaman * skalaEfektif(halaman, tinggiHalaman)).toInt().coerceAtLeast(1)

    /** Tinggi gambar gabungan seluruh halaman dalam piksel. */
    fun tinggiGabungan(halaman: Int, tinggiHalaman: Int): Int {
        val jumlah = halaman.coerceAtLeast(1)
        val baris = (tinggiHalaman * skalaEfektif(jumlah, tinggiHalaman)).toInt().coerceAtLeast(1)
        return baris * jumlah
    }
}
