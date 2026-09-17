package com.cuciin.laundryops.data

/**
 * Pembentuk Aset ID.
 *
 * Aset ID tidak diisi manual: ia dibentuk dari kode cabang, kode jenis aset, lalu nomor urut
 * tiga digit pada cabang itu. Logikanya dipisahkan dari store supaya dapat diuji tanpa Android.
 */
object AssetCodes {
    fun prefix(branchCode: String, typeCode: String): String {
        val branch = branchCode.trim().uppercase().filter(Char::isLetterOrDigit).take(6).ifBlank { "CAB" }
        val type = typeCode.trim().uppercase().filter(Char::isLetterOrDigit).take(4).ifBlank { "AS" }
        return "$branch-$type-"
    }

    /**
     * Nomor urut diambil dari kode tertinggi yang sudah ada pada cabang dan jenis yang sama,
     * bukan jumlah baris, supaya kode tidak terpakai ulang setelah sebuah aset dihapus.
     */
    fun next(branchCode: String, typeCode: String, existingCodes: List<String>): String {
        val head = prefix(branchCode, typeCode)
        val highest = existingCodes
            .filter { it.startsWith(head) }
            .mapNotNull { it.removePrefix(head).toIntOrNull() }
            .maxOrNull() ?: 0
        return head + (highest + 1).toString().padStart(3, '0')
    }
}
