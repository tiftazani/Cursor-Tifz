package com.cuciin.laundryops.data

/**
 * Sebab kegagalan pendaftaran, diterjemahkan dari pesan mentah Firebase.
 *
 * Kejadian nyata yang dikunci di sini: seorang kasir mencoba mendaftar dan layarnya hanya
 * berbunyi "Pendaftaran belum berhasil. Periksa koneksi dan data akun." Koneksinya sehat.
 * Sebab sebenarnya: email itu sudah dihapus Owner dari daftar user, tetapi akun loginnya
 * masih tersimpan di Firebase. Akibatnya orang itu terjebak dua arah — tidak bisa masuk
 * (baris user-nya tidak ada) dan tidak bisa mendaftar ulang (Firebase menolak dengan
 * EMAIL_EXISTS). Pesan generik lama menyembunyikan itu, jadi tidak ada yang tahu harus
 * berbuat apa.
 *
 * Pesan mentah Firebase berbahasa Inggris dan menyebut istilah teknis. Yang dibutuhkan
 * pendaftar hanya dua hal: apa yang salah, dan apa yang harus dilakukan.
 */
object PendaftaranAkun {

    /**
     * Apakah kegagalan ini berarti emailnya masih tersimpan di server identitas.
     *
     * Dipakai aplikasi untuk mengambil jalan kedua: pakai akun lama itu untuk mendaftar ulang,
     * bukan menyerah di situ. Karena itu pengenalnya harus tepat. Kalau terlalu longgar,
     * kegagalan sandi lemah akan ikut dianggap "email terpakai" dan aplikasi mencoba masuk
     * dengan sandi yang memang belum pernah diterima.
     */
    fun emailSudahTerpakai(raw: String?): Boolean {
        val teks = raw.orEmpty().lowercase()
        return "already in use" in teks || "email exists" in teks || "email_exists" in teks
    }

    /**
     * Terjemahkan pesan mentah dari Firebase menjadi kalimat yang bisa ditindaklanjuti.
     *
     * Setiap cabang menyebut JALAN KELUARNYA, bukan hanya melarang. Pesan asing yang tidak
     * dikenali diteruskan apa adanya supaya sebab yang tidak terduga tidak ikut tersembunyi.
     */
    fun sebab(raw: String?): String {
        val teks = raw.orEmpty().lowercase()
        return when {
            // Paling sering terjadi, dan paling membingungkan kalau tidak dijelaskan.
            emailSudahTerpakai(raw) -> emailTerkunciTanpaSandiCocok()
            "network" in teks || "timeout" in teks || "unreachable" in teks ->
                "Tidak dapat menghubungi server identitas. Periksa koneksi lalu coba lagi."
            "password" in teks ->
                "Kata sandi ditolak server identitas. Pakai kata sandi lain."
            "too many" in teks || "blocked" in teks ->
                "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
            raw.isNullOrBlank() -> "Pendaftaran belum berhasil. Periksa data akun."
            else -> raw
        }
    }

    /**
     * Email terkunci dan sandi yang diketik tidak cocok dengan akun lama itu.
     *
     * Ini sisa dari email yang dipakai akun lama, bukan akun baru. Hanya orang yang tahu
     * sandi akun itu yang bisa memakainya, jadi yang dibutuhkan orang ini adalah pemulihan
     * sandi, bukan pendaftaran ulang.
     */
    fun emailTerkunciTanpaSandiCocok(): String =
        "Email ini sudah pernah dipakai akun lain di server identitas. " +
            "Kalau email ini memang milik Anda, pulihkan dulu kata sandinya lewat " +
            "\"Lupa kata sandi\", lalu masuk. Kalau bukan, daftar dengan email lain."
}
