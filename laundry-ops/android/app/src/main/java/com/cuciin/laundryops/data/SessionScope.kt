package com.cuciin.laundryops.data

/**
 * Aturan penyegaran sesi yang tidak bergantung layar maupun basis data.
 *
 * Dipisah dari [CuciinStore] supaya bisa diuji langsung, sama seperti [AttendanceScope].
 *
 * Kejadian nyata 24 Sep 2026: Owner menambahkan `aidanurita25@gmail.com` ke cabang kedua pukul
 * 13:19 WIB. Data di server sudah benar, tetapi sesi kasir yang sudah terbuka tetap memegang daftar
 * cabang lama sampai aplikasinya dimulai ulang. Akibatnya absen di cabang kedua tetap tidak muncul
 * walaupun server sudah mengizinkan.
 */
internal object SessionScope {

    /**
     * Sesi yang sudah disesuaikan dengan baris staf terbaru dari server.
     *
     * Mengembalikan [aktif] apa adanya bila tidak ada yang berubah, sehingga pemanggil bisa memakai
     * perbandingan identitas untuk menghindari penulisan ulang state Compose tanpa sebab.
     *
     * Nama dan email tidak pernah disentuh: identitas akun tidak boleh berubah sendiri di tengah
     * sesi. Peran ikut disamakan supaya penurunan hak akses di server langsung berlaku.
     */
    fun refreshed(aktif: Session, baris: Staff): Session {
        val cabang = baris.branchIds.ifEmpty { aktif.branchIds }
        if (baris.role == aktif.role && cabang == aktif.branchIds) return aktif
        // Cabang yang sedang dipilih layar dipertahankan bila masih termasuk penugasan; kalau tidak,
        // jatuh ke cabang pertama yang masih diizinkan supaya pilihan tidak menunjuk cabang terlarang.
        val pilihan = aktif.branchId.takeIf { it.isNotBlank() && it in cabang }
            ?: cabang.firstOrNull()
            ?: aktif.branchId
        return aktif.copy(role = baris.role, branchId = pilihan, branchIds = cabang)
    }
}
