package com.cuciin.laundryops.data

/**
 * Aturan absensi yang tidak bergantung layar maupun basis data.
 *
 * Dipisah dari [CuciinStore] supaya bisa diuji langsung. Sebelumnya seluruh aturan absensi
 * menumpang di store yang butuh berkas dan jaringan, sehingga tidak ada satu pun test yang bisa
 * membuktikan perilakunya. Akibatnya bug "kasir dua cabang hanya bisa absen di satu cabang" lolos
 * ke produksi.
 *
 * Aturan pokoknya: absensi dikunci per **karyawan, tanggal, dan cabang**. Satu orang yang bekerja
 * di dua cabang pada hari yang sama punya dua catatan, masing-masing dengan jam masuk dan
 * pulangnya sendiri.
 */
internal object AttendanceScope {

    /**
     * Id baris absensi untuk satu karyawan, satu tanggal, satu cabang.
     *
     * Sengaja deterministik, bukan angka acak. Dua perangkat yang mengabsen orang yang sama di
     * cabang yang sama pada hari yang sama menghasilkan id yang sama, sehingga server memperbarui
     * barisnya alih-alih menabrak batas unik `(staff_email, work_date, branch_id)` dan menjawab
     * 409. Sidik pos-el dipakai alih-alih alamat penuh supaya panjangnya tetap jauh di bawah batas
     * 100 karakter yang diberlakukan Worker untuk kolom id.
     */
    fun idFor(branchId: String, workDate: String, email: String): String =
        "att-$branchId-$workDate-${email.lowercase().hashCode().toUInt().toString(16)}"

    /**
     * Catatan absensi milik [email] pada [workDate] **di cabang [branchId]**.
     *
     * Cabangnya bagian dari pencarian, bukan penyaring sesudahnya. Inilah inti perbaikannya:
     * versi lama mencari baris pertama hari itu tanpa melihat cabang, sehingga orang yang sudah
     * absen di cabang pertama dianggap "sudah absen" di cabang kedua.
     */
    fun rowFor(
        rows: List<AttendanceRecord>,
        email: String,
        workDate: String,
        branchId: String,
    ): AttendanceRecord? = rows.firstOrNull {
        it.staffEmail.equals(email, true) && it.workDate == workDate && it.branchId == branchId
    }

    /**
     * Posisi catatan yang sudah masuk tetapi belum pulang, di cabang tertentu.
     *
     * `-1` berarti belum ada absen masuk di cabang itu. Absen pulang harus memakai cabangnya
     * sendiri: versi lama menutup baris pertama hari itu yang belum pulang, sehingga absen pulang
     * di cabang kedua justru menutup catatan cabang pertama.
     */
    fun openRowIndex(
        rows: List<AttendanceRecord>,
        email: String,
        workDate: String,
        branchId: String,
    ): Int = rows.indexOfFirst {
        it.staffEmail.equals(email, true) && it.workDate == workDate &&
            it.branchId == branchId && it.checkOutAtMs == null
    }

    /** Seluruh catatan absensi milik [email] pada [workDate], satu per cabang yang sudah diabsen. */
    fun rowsFor(
        rows: List<AttendanceRecord>,
        email: String,
        workDate: String,
    ): List<AttendanceRecord> = rows
        .filter { it.staffEmail.equals(email, true) && it.workDate == workDate }
        .sortedBy { it.checkInAtMs }

    /**
     * Boleh atau tidak akun ini mencatat absensi di [branchId].
     *
     * Owner boleh di cabang mana pun yang ada di katalog. Selain Owner hanya cabang penugasan
     * akun itu — seluruhnya, bukan hanya yang pertama. Mengembalikan pesan penolakan, atau `null`
     * bila boleh.
     */
    fun rejection(
        role: Role,
        allowedBranchIds: List<String>,
        knownBranchIds: Collection<String>,
        branchId: String,
    ): String? = when {
        branchId.isBlank() -> "Cabang absensi tidak dikenal"
        role == Role.Owner -> if (branchId in knownBranchIds) null else "Cabang tidak ditemukan"
        branchId in allowedBranchIds -> null
        else -> "Cabang absensi tidak sesuai akun"
    }
}
